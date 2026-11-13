package mope;

import java.util.*;

/**
 * Special + passive abilities of Mope.io (names, users and activation from the Mope.io Wiki; every number is INFERRED).
 * Abilities are data-driven archetypes: speed, area (stun/knock/damage), zone (fire/poison/web/...), shield, hide, invisibility, fly, grab,
 * projectile, summon, food, water (data/abilities/abilities.json "effects").
 */
public final class Abilities {
    private Abilities() {}
    public static final class Zone { public double x, y, r, dps, slow, pull, heal; public String kind; public long until; public int owner; public boolean follow, front, blind; }
    public static final class Proj { public double x, y, vx, vy, r, dmg, dot; public long until, dotMs, stunMs; public int owner; public String kind; }
    public static final class Fx { public double x, y, r; public String kind; public long until; }
    public static final class State { public final List<Zone> zones = new ArrayList<>(); public final List<Proj> projs = new ArrayList<>(); public final List<Fx> fx = new ArrayList<>(); }

    static final Map<String, Integer> KIND_IDX = new HashMap<>();
    public static final String[] KINDS = { "ring", "fire", "venom", "fruit", "spit", "spear", "snow", "ink", "whirl", "frost", "wave", "web", "stink", "sink", "firetornado", "camp", "slash", "boom" };
    static { for (int i = 0; i < KINDS.length; i++) KIND_IDX.put(KINDS[i], i); }
    static int kindIdx(String k) { return KIND_IDX.getOrDefault(k, 0); }

    // ---- passives (only the wiki-sourced version gives animals wiki passives) ----
    public static boolean has(Player p, String passive) {
        if (p.animal.passives != null && p.world.cfg.feature("wikiAbilities") && p.animal.passives.contains(passive)) return true;
        return passive.equals("invisible_still") && "camouflage".equals(p.animal.ability);
    }
    public static double passiveSpeed(World w, Player p) {
        double m = 1;
        if (has(p, "speed_up")) m *= 1.08;
        if (has(p, "fast_water") && w.inWater(p.x, p.y)) m *= 1.25;
        if (has(p, "sprint_hurt") && p.health < 0.35 * p.maxHealth()) m *= 1.25;
        return m;
    }
    /** Combined ability-driven speed factor: buffs, slows, hiding/shield/flying speeds, stun (0) and carry (0). */
    public static double speedFactor(World w, Player p) {
        long t = w.tick; if (p.stunUntilTick > t || p.carriedBy != 0) return 0;
        double m = passiveSpeed(w, p);
        if (p.buffUntilTick > t) m *= p.buffMul;
        if (p.abSlowUntilTick > t) m *= p.abSlowMul;
        if (p.hiddenUntilTick > t) m *= p.hideSpeed;
        if (p.shieldUntilTick > t) m *= p.shieldSpeed;
        if (p.flyUntilTick > t) m *= p.flySpeed;
        return m;
    }
    public static boolean flying(World w, Player p) { return p.flyUntilTick > w.tick || has(p, "fly_over"); }

    // ---- activation ----
    static List<Defs.AbilityDef> defsFor(World w, Player p) {
        List<String> ids = w.cfg.feature("wikiAbilities") && p.animal.abilities != null && !p.animal.abilities.isEmpty() ? p.animal.abilities : (p.animal.ability != null ? List.of(p.animal.ability) : List.of());
        List<Defs.AbilityDef> out = new ArrayList<>(); for (String id : ids) { Defs.AbilityDef d = w.abilities.def(id); if (d != null && d.effects != null) out.add(d); }
        return out;
    }
    static boolean needsOk(World w, Player p, String needs) {
        if (needs == null) return true; boolean not = needs.startsWith("!"), v = (not ? needs.substring(1) : needs).equals("climbing") ? p.climbing : true; return not != v;
    }
    /** The ability on this key slot (0 = W / right click, 1 = S) that is usable right now, or null. */
    public static Defs.AbilityDef pick(World w, Player p, int slot) {
        String key = slot == 1 ? "S" : "W";
        List<Defs.AbilityDef> ds = defsFor(w, p);
        for (Defs.AbilityDef d : ds) if (d.needs != null && key.equals(d.keyboard == null ? "W" : d.keyboard) && needsOk(w, p, d.needs)) return d; // context abilities (fly up a tree, caw on the ground) win when their condition holds
        for (Defs.AbilityDef d : ds) if (d.needs == null && key.equals(d.keyboard == null ? "W" : d.keyboard)) return d;
        return null;
    }
    public static String abilityIdFor(World w, Player p, int slot) { Defs.AbilityDef d = pick(w, p, slot); return d == null ? null : d.id; }

    /** Key down (down=true) or up. Press abilities fire on key down; hold abilities run while held (up ends them early). */
    public static boolean use(World w, Player p, int slot, boolean down) {
        if (p.dead || w.sandbox) return false; long now = w.nowMs(), t = w.tick; int hz = w.cfg.tickRate;
        if (!down) { // release: ends a held ability early, ambush bursts out
            if (!p.holdAbility.isEmpty()) { endHold(w, p); return true; } return false;
        }
        if (p.stunUntilTick > t || p.carriedBy != 0) return false;
        Defs.AbilityDef d = pick(w, p, slot); if (d == null) return false;
        long ready = slot == 1 ? p.abilityReadyAt2 : p.abilityReadyAt; if (now < ready) return false;
        double cm = Modes.cooldownMul(w, p), dm = Modes.durationMul(w);
        long cd = (long) (d.cooldownMs * cm); if (slot == 1) p.abilityReadyAt2 = now + cd; else p.abilityReadyAt = now + cd;
        for (com.google.gson.JsonElement je : d.effects) apply(w, p, je.getAsJsonObject(), dm, d);
        if ("hold".equals(d.activation)) { p.holdAbility = d.id; p.holdSince = t; }
        return true;
    }
    private static void endHold(World w, Player p) {
        String id = p.holdAbility; p.holdAbility = ""; long t = w.tick;
        if (p.hiddenUntilTick > t) { p.hiddenUntilTick = t; if (p.burstAtEndTick > 0) { burst(w, p); } }
        if (p.invisUntilTick > t) p.invisUntilTick = t;
        if (p.flyUntilTick > t) p.flyUntilTick = t;
        for (Zone z : w.fxState.zones) if (z.follow && z.owner == p.id) z.until = t;
        p.burstAtEndTick = 0;
    }
    private static void burst(World w, Player p) { area(w, p, 110, false, false, 1500, 1500, 0, 15, 0, 0, 0, 99, "boom"); }

    private static long ticks(World w, double ms) { return Math.max(1, (long) Math.round(ms * w.cfg.tickRate / 1000.0)); }
    private static double d(com.google.gson.JsonObject o, String k, double def) { return o.has(k) ? o.get(k).getAsDouble() : def; }

    static void apply(World w, Player p, com.google.gson.JsonObject e, double dm, Defs.AbilityDef def) {
        String k = e.get("k").getAsString(); long t = w.tick;
        switch (k) {
            case "speed" -> { p.buffMul = d(e, "mul", 1.5); p.buffUntilTick = t + ticks(w, d(e, "ms", 1000) * dm); if (e.has("homing")) p.homingUntilTick = p.buffUntilTick; }
            case "area" -> area(w, p, d(e, "r", 120), e.has("front"), e.has("back"), d(e, "stunPrey", 0) * dm, d(e, "stunPred", d(e, "stunPrey", 0)) * dm, d(e, "knock", 0), d(e, "dmg", 0), d(e, "dot", 0), d(e, "dotMs", 0), d(e, "pull", 0), (int) d(e, "maxTier", 99), "ring");
            case "zone" -> { Zone z = new Zone(); z.kind = e.get("zk").getAsString(); z.r = d(e, "r", 120); z.dps = d(e, "dps", 0); z.slow = d(e, "slow", 0); z.pull = d(e, "pull", 0); z.heal = d(e, "heal", 0); z.follow = e.has("follow"); z.front = e.has("front"); z.blind = e.has("blind"); z.owner = p.id;
                z.until = t + ticks(w, d(e, "ms", 3000) * dm); placeZone(z, p); w.fxState.zones.add(z); }
            case "shield" -> { p.shieldUntilTick = t + ticks(w, d(e, "ms", 3000) * dm); p.shieldSpeed = d(e, "speed", 1); p.reflect = d(e, "reflect", 0); if (e.has("grow")) { p.growUntilTick = p.shieldUntilTick; p.growMul = d(e, "grow", 1.5); p.radius = p.animal.radius() * p.growMul; } }
            case "hide" -> { p.hiddenUntilTick = t + ticks(w, d(e, "ms", 3000) * dm); p.hideSpeed = d(e, "speed", 0.5); p.burstAtEndTick = e.has("burst") ? p.hiddenUntilTick : 0; p.holdAbility = def.id; p.holdSince = t; }
            case "invis" -> { p.invisUntilTick = t + ticks(w, d(e, "ms", 5000) * dm); p.hideSpeed = 1; }
            case "fly" -> { p.flyUntilTick = t + ticks(w, d(e, "ms", 3000) * dm); p.flySpeed = d(e, "speed", 1.1); p.landBurst = e.has("landArea"); }
            case "grab" -> grab(w, p, d(e, "r", 90), ticks(w, d(e, "ms", 2500) * dm), d(e, "dps", 0), e.has("fly"));
            case "proj" -> { Proj pr = new Proj(); pr.kind = e.get("pk").getAsString(); double sp = d(e, "speed", 700); pr.x = p.x + Math.cos(p.angle) * p.radius; pr.y = p.y + Math.sin(p.angle) * p.radius; pr.vx = Math.cos(p.angle) * sp; pr.vy = Math.sin(p.angle) * sp; pr.r = d(e, "r", 18); pr.dmg = d(e, "dmg", 0); pr.stunMs = (long) d(e, "stun", 0); pr.dot = d(e, "dot", 0); pr.dotMs = (long) d(e, "dotMs", 0); pr.owner = p.id; pr.until = t + ticks(w, d(e, "range", 600) / sp * 1000.0); w.fxState.projs.add(pr); }
            case "summon" -> { int n = (int) d(e, "count", 2); for (int i = 0; i < n; i++) { Animal baby = w.evolution.start(); Player b = w.join(p.name + "'s baby", null, true); b.setAnimal(baby); b.xp = 0; b.health = b.maxHealth(); b.ownerId = p.id; b.expireTick = t + ticks(w, d(e, "ms", 20000)); b.x = p.x + (w.rnd.nextDouble() - 0.5) * 120; b.y = p.y + (w.rnd.nextDouble() - 0.5) * 120; b.protectedUntilTick = t + 30; } }
            case "food" -> { int n = (int) d(e, "count", 2); double r = d(e, "r", 100); for (int i = 0; i < n; i++) { double a = e.has("front") ? p.angle + (w.rnd.nextDouble() - 0.5) * 0.6 : w.rnd.nextDouble() * 6.28, dist = p.radius + 20 + w.rnd.nextDouble() * r; w.foods.spawnAt(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, w.rnd.nextInt(Math.max(1, w.foods.typeCount()))); } }
            case "water" -> p.water = Math.min(100, p.water + d(e, "amount", 20));
            default -> { }
        }
    }
    private static void placeZone(Zone z, Player p) { double off = z.front ? p.radius + z.r * 0.6 : 0; z.x = p.x + Math.cos(p.angle) * off; z.y = p.y + Math.sin(p.angle) * off; }

    private static boolean valid(World w, Player p, Player o) { return o != p && !o.dead && o.protectedUntilTick <= w.tick && o.ownerId != p.id && p.ownerId != o.id && !(w.ms != null && w.mode.equals("team") && o.team == p.team) && !(o.hiddenUntilTick > w.tick); }
    static void hurt(World w, Player by, Player o, double amount, List<Player> dying) { if (amount <= 0 || o.dead) return; o.health -= amount; if (o.health <= 0) w.dieLater(o, by == null ? "an ability" : by.name); }

    /** Instant area effect around (or in front of / behind) the caster: stun, knockback, pull, damage, poison. */
    static void area(World w, Player p, double r, boolean front, boolean back, double stunPrey, double stunPred, double knock, double dmg, double dot, double dotMs, double pull, int maxTier, String fxKind) {
        double ox = p.x + (front ? Math.cos(p.angle) * p.radius * 0.8 : back ? -Math.cos(p.angle) * p.radius * 0.8 : 0), oy = p.y + (front ? Math.sin(p.angle) * p.radius * 0.8 : back ? -Math.sin(p.angle) * p.radius * 0.8 : 0);
        Fx f = new Fx(); f.x = ox; f.y = oy; f.r = r + p.radius * (front || back ? 0 : 1); f.kind = fxKind; f.until = w.tick + Math.max(6, w.cfg.tickRate / 3); w.fxState.fx.add(f);
        for (Player o : new ArrayList<>(w.players.values())) {
            if (!valid(w, p, o) || o.animal.tier > maxTier && maxTier < 99) continue;
            double dx = o.x - ox, dy = o.y - oy, dist = Math.hypot(dx, dy); if (dist > r + p.radius * (front || back ? 0 : 1) + o.radius) continue;
            if (front || back) { double ang = Math.atan2(dy, dx), face = back ? p.angle + Math.PI : p.angle, diff = Math.abs(Math.atan2(Math.sin(ang - face), Math.cos(ang - face))); if (diff > 1.1 && dist > o.radius) continue; }
            boolean prey = o.animal.tier <= p.animal.tier; double sMs = prey ? stunPrey : stunPred;
            if (sMs > 0) o.stunUntilTick = Math.max(o.stunUntilTick, w.tick + ticks(w, sMs));
            if (dmg > 0 && prey) hurt(w, p, o, dmg, null); else if (dmg > 0) hurt(w, p, o, dmg * 0.4, null);
            if (dot > 0 && !has(o, "poison_immunity")) { o.dotDps = dot; o.dotUntilTick = w.tick + ticks(w, dotMs); o.dotBy = p.id; }
            double len = Math.max(1, dist); if (knock > 0) shove(w, o, dx / len * knock * (prey ? 1 : 0.5), dy / len * knock * (prey ? 1 : 0.5)); if (pull > 0) shove(w, o, -dx / len * pull, -dy / len * pull);
        }
    }
    static void shove(World w, Player o, double dx, double dy) { double nx = Math.max(o.radius, Math.min(w.size - o.radius, o.x + dx)), ny = Math.max(o.radius, Math.min(w.size - o.radius, o.y + dy)); if (w.biomes.canEnter(o.animal, nx, ny) || flying(w, o)) { o.x = nx; o.y = ny; } }
    private static void grab(World w, Player p, double r, long ticks, double dps, boolean flyToo) {
        Player best = null; double bd = 1e18; for (Player o : w.players.values()) { if (!valid(w, p, o) || o.animal.tier >= p.animal.tier || o.carriedBy != 0) continue; double dd = Collision.dist2(p, o); if (dd < (r + p.radius + o.radius) * (r + p.radius + o.radius) && dd < bd) { bd = dd; best = o; } }
        if (flyToo) { p.flyUntilTick = w.tick + ticks; p.flySpeed = 1.1; }
        if (best != null) { best.carriedBy = p.id; best.carryUntilTick = w.tick + ticks; best.dotDps = dps; best.dotUntilTick = w.tick + ticks; best.dotBy = p.id; best.stunUntilTick = best.carryUntilTick; }
    }

    // ---- per-tick simulation ----
    public static void tick(World w, double dt, List<Player> dying) {
        State s = w.fxState; long t = w.tick; Map<Integer, Player> byId = w.players;
        for (Player p : new ArrayList<>(w.players.values())) {
            if (p.dead) continue;
            if (p.expireTick > 0 && t >= p.expireTick) { p.dead = true; dying.add(p); continue; }                                   // summoned babies time out
            if (p.carriedBy != 0) { Player c = byId.get(p.carriedBy); if (c == null || c.dead || t >= p.carryUntilTick) { p.carriedBy = 0; p.carryUntilTick = 0; } else { p.x = c.x + Math.cos(c.angle) * c.radius * 0.4; p.y = c.y + Math.sin(c.angle) * c.radius * 0.4; } }
            if (p.dotUntilTick > t && p.dotDps > 0 && !has(p, "poison_immunity")) { p.health -= p.dotDps * dt; if (p.health <= 0) { w.die(p, p.dotBy != 0 && byId.get(p.dotBy) != null ? byId.get(p.dotBy).name : "poison", World.EATEN, dying); continue; } }
            if (p.growUntilTick > 0 && t >= p.growUntilTick) { p.growUntilTick = 0; p.radius = p.animal.radius(); }
            if (p.shieldUntilTick > t && p.reflect > 0) for (Player o : w.players.values()) if (valid(w, p, o) && Collision.overlap(p, o)) { o.health -= p.reflect * dt; if (o.health <= 0) w.die(o, p.name, World.EATEN, dying); } // spikes hurt whoever touches them
            if (p.homingUntilTick > t) { Player tg = null; double bd = 1e18; for (Player o : w.players.values()) if (valid(w, p, o) && o.animal.tier < p.animal.tier) { double dd = Collision.dist2(p, o); if (dd < bd && dd < 700 * 700) { bd = dd; tg = o; } } if (tg != null) { p.inputAngle = Math.atan2(tg.y - p.y, tg.x - p.x); p.inputMag = 1; } }
            if (p.landBurst && p.flyUntilTick > 0 && t >= p.flyUntilTick) { p.landBurst = false; area(w, p, 140, false, false, 1500, 1500, 0, 12, 0, 0, 0, 99, "boom"); }
            if (p.burstAtEndTick > 0 && t >= p.burstAtEndTick && !p.holdAbility.isEmpty()) { p.holdAbility = ""; burst(w, p); p.burstAtEndTick = 0; }
            if (!p.holdAbility.isEmpty() && p.hiddenUntilTick <= t && p.flyUntilTick <= t && p.invisUntilTick <= t && !hasActiveZone(s, p)) p.holdAbility = "";
            if (has(p, "invisible_still") && p.inputMag < 0.05 && p.stunUntilTick <= t) p.invisUntilTick = Math.max(p.invisUntilTick, t + 2);          // camouflage: invisible while standing still
            if (has(p, "exhale_food") && t >= p.nextExhaleTick) { p.nextExhaleTick = t + 8L * w.cfg.tickRate; w.foods.spawnAt(p.x + Math.cos(p.angle) * (p.radius + 25), p.y + Math.sin(p.angle) * (p.radius + 25), w.rnd.nextInt(Math.max(1, w.foods.typeCount()))); }
        }
        // zones
        Iterator<Zone> zi = s.zones.iterator();
        while (zi.hasNext()) {
            Zone z = zi.next(); Player own = byId.get(z.owner);
            if (t >= z.until || (z.follow && (own == null || own.dead))) { zi.remove(); continue; }
            if (z.follow && own != null) placeZone(z, own);
            for (Player o : w.players.values()) {
                if (o.dead) continue; double dx = o.x - z.x, dy = o.y - z.y, rr = z.r + o.radius; if (dx * dx + dy * dy > rr * rr) continue;
                boolean ally = own != null && (o == own || o.ownerId == own.id || (w.ms != null && w.mode.equals("team") && o.team == own.team));
                if (z.heal > 0 && ally) o.health = Math.min(o.maxHealth(), o.health + z.heal * dt);
                if (ally || o.hiddenUntilTick > t) continue;
                if (z.dps > 0 && !(z.kind.equals("stink") && o.animal.tier > (own == null ? 99 : own.animal.tier) + 2)) { o.health -= z.dps * dt; if (o.health <= 0) { w.die(o, own == null ? "an ability" : own.name, World.EATEN, dying); continue; } }
                if (z.slow > 0) { o.abSlowUntilTick = t + 3; o.abSlowMul = Math.min(o.abSlowUntilTick > t ? o.abSlowMul : 1, 1 - z.slow); }
                if (z.pull > 0) { double len = Math.max(1, Math.hypot(dx, dy)); shove(w, o, -dx / len * z.pull * dt, -dy / len * z.pull * dt); }
            }
        }
        // projectiles
        Iterator<Proj> pi = s.projs.iterator();
        while (pi.hasNext()) {
            Proj pr = pi.next(); if (t >= pr.until) { pi.remove(); continue; } pr.x += pr.vx * dt; pr.y += pr.vy * dt; Player own = byId.get(pr.owner); boolean hit = false;
            if (pr.x < 0 || pr.y < 0 || pr.x > w.size || pr.y > w.size) { pi.remove(); continue; }
            for (Player o : w.players.values()) { if (o.dead || own == null || !valid(w, own, o) || o.flyUntilTick > t && !"spear".equals(pr.kind)) continue; double dx = o.x - pr.x, dy = o.y - pr.y, rr = pr.r + o.radius; if (dx * dx + dy * dy <= rr * rr) {
                if (pr.stunMs > 0) o.stunUntilTick = Math.max(o.stunUntilTick, t + ticks(w, pr.stunMs)); if (pr.dmg > 0) { o.health -= pr.dmg; if (o.health <= 0) { w.die(o, own.name, World.EATEN, dying); } }
                if (pr.dot > 0 && !has(o, "poison_immunity")) { o.dotDps = pr.dot; o.dotUntilTick = t + ticks(w, pr.dotMs); o.dotBy = pr.owner; }
                Fx f = new Fx(); f.x = pr.x; f.y = pr.y; f.r = 40; f.kind = pr.kind; f.until = t + w.cfg.tickRate / 4; s.fx.add(f); hit = true; break; } }
            if (hit) pi.remove();
        }
        s.fx.removeIf(f -> t >= f.until);
    }
    private static boolean hasActiveZone(State s, Player p) { for (Zone z : s.zones) if (z.owner == p.id && z.follow) return true; return false; }

    // ---- network ----
    /** Per-player flag bits (shared with Modes.flags): 16 stunned, 32 shielded, 64 hidden, 128 flying, 256 invisible, 512 carried, 1024 poisoned, 2048 grown. */
    public static int flags(World w, Player p) {
        long t = w.tick; int f = 0;
        if (p.stunUntilTick > t) f |= 16; if (p.shieldUntilTick > t) f |= 32; if (p.hiddenUntilTick > t) f |= 64; if (flying(w, p)) f |= 128; if (p.invisUntilTick > t) f |= 256; if (p.carriedBy != 0) f |= 512; if (p.dotUntilTick > t) f |= 1024;
        return f;
    }
    public static boolean visibleTo(World w, Player o, Player me) { long t = w.tick; if (o == me) return true; if (!(o.hiddenUntilTick > t || o.invisUntilTick > t)) return true; return Collision.dist2(o, me) < Math.pow(o.radius + me.radius + 40, 2) || (w.ms != null && w.mode.equals("team") && o.team == me.team && me.team > 0); }
    public static String snapshotJson(World w, Player me) {
        State s = w.fxState; if (s.zones.isEmpty() && s.projs.isEmpty() && s.fx.isEmpty()) return "";
        StringBuilder b = new StringBuilder(",\"ab\":{\"zn\":["); boolean f = true; long t = w.tick;
        for (Zone z : s.zones) { if (Math.abs(z.x - me.x) > 1300 || Math.abs(z.y - me.y) > 1300) continue; if (!f) b.append(','); f = false; b.append('[').append(Math.round(z.x)).append(',').append(Math.round(z.y)).append(',').append(Math.round(z.r)).append(',').append(kindIdx(z.kind)).append(',').append(Math.max(0, z.until - t) * 1000 / w.cfg.tickRate).append(']'); }
        b.append("],\"pj\":["); f = true; for (Proj p : s.projs) { if (Math.abs(p.x - me.x) > 1300 || Math.abs(p.y - me.y) > 1300) continue; if (!f) b.append(','); f = false; b.append('[').append(Math.round(p.x)).append(',').append(Math.round(p.y)).append(',').append(kindIdx(p.kind)).append(',').append(Math.round(p.r)).append(']'); }
        b.append("],\"fx\":["); f = true; for (Fx x : s.fx) { if (Math.abs(x.x - me.x) > 1300 || Math.abs(x.y - me.y) > 1300) continue; if (!f) b.append(','); f = false; b.append('[').append(Math.round(x.x)).append(',').append(Math.round(x.y)).append(',').append(Math.round(x.r)).append(',').append(kindIdx(x.kind)).append(',').append(Math.max(0, x.until - t) * 1000 / w.cfg.tickRate).append(']'); }
        return b.append("]}").toString();
    }
}
