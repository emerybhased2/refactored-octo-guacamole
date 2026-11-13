package mope;

import java.util.*;

/**
 * Game modes of Mope.io (rules summarised from the Mope.io Wiki: Battle Royale, Team Mode, Zombie Infection, Viral Pandemic, Wild Mope, Classic Mode;
 * numbers are INFERRED where the wiki gives none). Per-world state lives in {@link State}; World calls the hooks below.
 */
public final class Modes {
    private Modes() {}
    public static final List<String> WORLD_MODES = List.of("normal", "classic", "zombie", "royale", "team", "wild", "pandemic");
    public static final String[] TEAM_NAMES = { "", "Yellow", "Cyan", "Purple" };
    /** Team Stone perks (wiki, 2022). Only the first five are simulated; the rest are listed in data/modes/modes.json as not simulated. */
    public static final String[] PERKS = { "xp", "killxp", "coins", "speed", "recharge", "dmgprey", "dmgpred", "dive", "bodydmg", "depend", "burn", "poison", "stun" };

    public static final class Stone { public int id, owner, perk; public double x, y, hp = 100; }
    public static final class Meteor { public double x, y; public long hitTick; }
    public static final class Virus { public double x, y, vx, vy; }
    public static final class Pickup { public int id, type; public double x, y; } // pandemic: 1 = mushroom mask, 2 = aloe vera
    public static final class State {
        final World w; public final String mode;
        // battle royale
        public double cx, cy, r, fromR, toR; public int phase; public long phaseStart, shrinkStart, roundStart, overTick; public boolean over; public String winner = "";
        // team
        public final List<Stone> stones = new ArrayList<>(); public final List<Meteor> meteors = new ArrayList<>(); public long apocalypseUntil, nextMeteor; public int apocalypseTeam; public boolean apocalypseDone;
        // pandemic
        public final List<Virus> viruses = new ArrayList<>(); public final List<Pickup> pickups = new ArrayList<>();
        long nextZombie;
        State(World w, String mode) { this.w = w; this.mode = mode; }
    }

    static final double[] ROYALE_RADII = { 0.75, 0.56, 0.42, 0.30, 0.20, 0.12, 0.06 }; // x world size; INFERRED (wiki: 'the safe area gets smaller and smaller')
    static final double[] ROYALE_DPS = { 2, 4, 7, 11, 16, 22, 30 };                 // wiki: 'at first a few seconds are survivable; later deadlier'
    static final int ROYALE_PHASE_SECONDS = 25, ROYALE_SHRINK_SECONDS = 10, ROYALE_RESTART_SECONDS = 8;

    public static State create(World w, String mode) {
        State s = new State(w, mode);
        switch (mode) {
            case "royale" -> newRound(s);
            case "team" -> { for (int i = 0; i < 12; i++) { Stone st = new Stone(); st.id = i; st.perk = i % PERKS.length; double[] pt = w.biomes.randomPoint(w.rnd, w.cfg.biomeIds); st.x = pt[0]; st.y = pt[1]; s.stones.add(st); } }
            case "pandemic" -> {
                for (int i = 0; i < 70; i++) { Virus v = new Virus(); double[] pt = w.biomes.randomPoint(w.rnd, w.cfg.biomeIds); v.x = pt[0]; v.y = pt[1]; double a = w.rnd.nextDouble() * 6.28; v.vx = Math.cos(a) * 30; v.vy = Math.sin(a) * 30; s.viruses.add(v); }
                for (int i = 0; i < 40; i++) addPickup(s, i < 28 ? 1 : 2);
            }
            default -> { }
        }
        return s;
    }
    /** Classic Mode config: the 2017 build restricted to Land + Ocean with 14 tiers (data/modes/classic.json). */
    public static VersionManager.Config classicConfig(VersionManager.Config v2017) {
        com.google.gson.JsonObject o = v2017.raw.deepCopy(); o.addProperty("id", "classic"); o.addProperty("label", "Classic Mode (Old Mope)");
        com.google.gson.JsonArray b = new com.google.gson.JsonArray(); b.add("land"); b.add("ocean"); o.add("biomes", b);
        com.google.gson.JsonObject layout = new com.google.gson.JsonObject(); com.google.gson.JsonArray lr = new com.google.gson.JsonArray(), orr = new com.google.gson.JsonArray();
        for (double d : new double[] { 0, 0, 1, 0.68 }) lr.add(d); for (double d : new double[] { 0, 0.68, 1, 0.32 }) orr.add(d); layout.add("land", lr); layout.add("ocean", orr); o.add("layout", layout);
        o.add("classic", Data.read("data/modes/classic.json").getAsJsonObject()); return VersionManager.resolve(o);
    }
    private static void addPickup(State s, int type) { Pickup p = new Pickup(); p.id = s.pickups.size() + 1 + (int) (s.w.tick % 100000) * 100; p.type = type; double[] pt = s.w.biomes.randomPoint(s.w.rnd, s.w.cfg.biomeIds); p.x = pt[0]; p.y = pt[1]; s.pickups.add(p); }

    static void newRound(State s) {
        World w = s.w; s.over = false; s.winner = ""; s.phase = 0; s.roundStart = w.tick;
        s.cx = w.size * (0.3 + 0.4 * w.rnd.nextDouble()); s.cy = w.size * (0.3 + 0.4 * w.rnd.nextDouble());
        s.r = w.size * ROYALE_RADII[0] * 1.6; s.fromR = s.r; s.toR = s.r; s.phaseStart = w.tick; s.shrinkStart = w.tick + (long) ROYALE_PHASE_SECONDS * w.cfg.tickRate;
    }

    /** Called from World.join. */
    public static void onJoin(World w, Player p) {
        State s = w.ms; if (s == null) return;
        switch (s.mode) {
            case "team" -> { int[] n = new int[4]; for (Player q : w.players.values()) if (q.team > 0) n[q.team]++; int best = 1; for (int t = 2; t <= 3; t++) if (n[t] < n[best] || (n[t] == n[best] && w.rnd.nextBoolean())) best = t; p.team = best; }
            case "zombie" -> { if (p.bot && w.rnd.nextDouble() < 0.08) { p.infection = 100; p.zombie = true; p.health = p.maxHealth(); } }
            case "pandemic" -> p.immunity = 70 + 30 * w.rnd.nextDouble();
            case "royale" -> { double a = w.rnd.nextDouble() * 6.28, d = Math.sqrt(w.rnd.nextDouble()) * s.r * 0.6; p.x = Math.max(p.radius, Math.min(w.size - p.radius, s.cx + Math.cos(a) * d)); p.y = Math.max(p.radius, Math.min(w.size - p.radius, s.cy + Math.sin(a) * d)); p.protectedUntilTick = w.tick + 3L * w.cfg.tickRate; }
            default -> { }
        }
    }
    /** Evolving cures a zombie / infection (wiki: 'zombies can only remove infection by progressing to the next tier'). */
    public static void onEvolve(World w, Player p) { if (w.ms != null && w.ms.mode.equals("zombie")) { p.infection = 0; p.zombie = false; p.health = Math.min(p.health, p.maxHealth()); } }

    private static boolean teamPerk(State s, int team, String perk) { if (team <= 0) return false; int idx = Arrays.asList(PERKS).indexOf(perk); for (Stone st : s.stones) if (st.owner == team && st.perk == idx) return true; return false; }
    private static int teamStones(State s, int team) { int n = 0; for (Stone st : s.stones) if (st.owner == team) n++; return n; }

    public static double speedMul(World w, Player p) {
        State s = w.ms; if (s == null) return 1; double m = 1;
        switch (s.mode) {
            case "wild" -> m = 1.10;                                                  // wiki wave 1: +10% movement speed (tiers 1-6); applied to all tiers here
            case "team" -> { if (teamPerk(s, p.team, "speed")) m = 1.25; }
            case "pandemic" -> { if (p.slowUntilTick > w.tick) m = 0.55; }            // sneezing slows briefly
            case "zombie" -> { if (p.zombie) m = w.inWater(p.x, p.y) == "ocean".equals(p.animal.biome) ? 1.15 : 0.7; } // zombies: faster on their own terrain, slower in the other
            default -> { }
        }
        return m;
    }
    public static double foodXpMul(World w, Player p) { State s = w.ms; return s != null && s.mode.equals("team") && teamPerk(s, p.team, "xp") ? 1.2 : 1; }
    public static double killXpMul(World w, Player p, Player victim) { State s = w.ms; return s != null && s.mode.equals("team") && teamPerk(s, p.team, "killxp") && victim.team != p.team ? 1.4 : 1; }
    public static double cooldownMul(World w, Player p) { State s = w.ms; if (s == null) return 1; if (s.mode.equals("wild")) return 0.8; if (s.mode.equals("team") && teamPerk(s, p.team, "recharge")) return 0.8; return 1; }
    /** Wild Mope: the ability's duration is longer too (wiki: stronger effect, longer duration, shorter cooldown). */
    public static double durationMul(World w) { return w.ms != null && w.ms.mode.equals("wild") ? 1.3 : 1; }

    /** Eating rules per mode. Falls back to the normal tier rule. */
    public static boolean canEat(World w, Player pred, Player prey) {
        State s = w.ms;
        if (s != null) switch (s.mode) {
            case "team" -> { if (pred.team == prey.team) return false; }
            case "zombie" -> {
                if (pred.zombie && prey.zombie) return false;
            }
            default -> { }
        }
        return Collision.canEat(pred, prey);
    }

    /** Per-tick mode simulation (after movement and food/eating so deaths are collected in `dying`). */
    public static void tick(World w, double dt, List<Player> dying) {
        State s = w.ms; if (s == null) return; long tk = w.tick; int hz = w.cfg.tickRate;
        switch (s.mode) {
            case "royale" -> royaleTick(s, dt, dying);
            case "team" -> teamTick(s, dt, dying);
            case "zombie" -> zombieTick(s, dt, dying);
            case "pandemic" -> pandemicTick(s, dt, dying);
            default -> { }
        }
    }

    private static void royaleTick(State s, double dt, List<Player> dying) {
        World w = s.w; int hz = w.cfg.tickRate;
        if (s.over) {
            if (w.tick - s.overTick >= (long) ROYALE_RESTART_SECONDS * hz) restartRound(s);
            return;
        }
        // phases: hold for 25s, then shrink to the next radius over 10s
        if (w.tick >= s.shrinkStart && s.phase < ROYALE_RADII.length - 1 && s.toR == s.fromR) { s.fromR = s.r; s.toR = w.size * ROYALE_RADII[s.phase + 1]; }
        if (s.toR != s.fromR) {
            double k = Math.min(1, (w.tick - s.shrinkStart) / (double) (ROYALE_SHRINK_SECONDS * hz)); s.r = s.fromR + (s.toR - s.fromR) * k;
            if (k >= 1) { s.phase++; s.fromR = s.toR; s.phaseStart = w.tick; s.shrinkStart = w.tick + (long) ROYALE_PHASE_SECONDS * hz; }
        }
        double dps = ROYALE_DPS[Math.min(s.phase, ROYALE_DPS.length - 1)]; int alive = 0; Player last = null;
        for (Player p : w.players.values()) {
            if (p.dead) continue;
            double dx = p.x - s.cx, dy = p.y - s.cy;
            if (dx * dx + dy * dy > s.r * s.r) { p.health -= dps * dt; if (p.health <= 0) { w.die(p, "the red zone", World.EATEN, dying); continue; } }
            alive++; last = p;
        }
        for (Player d : dying) if (alive > 0) { /* already excluded above */ }
        if (w.tick - s.roundStart > 15L * hz && alive <= 1 && w.players.size() > 1) {
            s.over = true; s.overTick = w.tick; s.winner = last != null ? last.name : "nobody";
            String msg = "{\"t\":\"round\",\"over\":1,\"winner\":" + Data.GSON.toJson(s.winner) + ",\"restart\":" + ROYALE_RESTART_SECONDS + "}";
            for (Player p : w.players.values()) if (!p.bot && p.sender != null) p.sender.send(msg);
            for (World.Spectator sp : w.spectators) sp.sender.send(msg);
            if (last != null) { last.bonusCoins += 100; w.onReward.accept(last); } // INFERRED reward
        }
    }
    private static void restartRound(State s) {
        World w = s.w; String msg = "{\"t\":\"round-restart\"}";
        for (Player p : new ArrayList<>(w.players.values())) { if (!p.bot && p.sender != null) p.sender.send(msg); }
        for (World.Spectator sp : w.spectators) sp.sender.send(msg);
        w.players.clear(); newRound(s);
        for (int i = 0; i < w.cfg.bots; i++) w.join("Bot" + (i + 1), null, true);
    }

    private static void teamTick(State s, double dt, List<Player> dying) {
        World w = s.w; int hz = w.cfg.tickRate;
        // capture: standing on a stone pushes it towards your team (neutral -> captured needs one full drain; an enemy stone needs two)
        for (Stone st : s.stones) {
            int[] on = new int[4];
            for (Player p : w.players.values()) if (!p.dead && p.team > 0) { double dx = p.x - st.x, dy = p.y - st.y, r = 110 + p.radius; if (dx * dx + dy * dy <= r * r) on[p.team]++; }
            int dom = 0, best = 0; for (int t = 1; t <= 3; t++) if (on[t] > best) { best = on[t]; dom = t; }
            if (dom == 0) continue;
            if (st.owner == dom) st.hp = Math.min(100, st.hp + 6 * dt);
            else { st.hp -= (8 + 4 * best) * dt; if (st.hp <= 0) { if (st.owner != 0) { st.owner = 0; st.hp = 100; } else { st.owner = dom; st.hp = 100; } } }
            if (st.owner == dom) for (Player p : w.players.values()) if (!p.dead && p.team == dom) { double dx = p.x - st.x, dy = p.y - st.y, r = 110 + p.radius; if (dx * dx + dy * dy <= r * r) p.xp += 12 * dt * Math.max(1, p.animal.tier); } // owned stones give XP
        }
        // coins perk: +5 coins per minute for the whole team
        if (w.tick % (60L * hz) == 0) for (Player p : w.players.values()) if (!p.dead && !p.bot && teamPerk(s, p.team, "coins")) { p.bonusCoins += 5; w.onReward.accept(p); }
        // apocalypse: a team holding 10 stones calls meteors for 30 seconds
        if (s.apocalypseUntil == 0 && !s.apocalypseDone) for (int t = 1; t <= 3; t++) if (teamStones(s, t) >= 10) { s.apocalypseTeam = t; s.apocalypseUntil = w.tick + 30L * hz; s.nextMeteor = w.tick; for (Player p : w.players.values()) if (!p.bot && p.sender != null) p.sender.send("{\"t\":\"apocalypse\",\"team\":" + t + "}"); }
        if (s.apocalypseUntil > 0) {
            if (w.tick >= s.nextMeteor) { s.nextMeteor = w.tick + Math.max(1, hz * 2 / 5); List<Player> alive = new ArrayList<>(); for (Player p : w.players.values()) if (!p.dead) alive.add(p); if (!alive.isEmpty()) { Player tg = alive.get(w.rnd.nextInt(alive.size())); Meteor m = new Meteor(); m.x = tg.x + (w.rnd.nextDouble() - 0.5) * 260; m.y = tg.y + (w.rnd.nextDouble() - 0.5) * 260; m.hitTick = w.tick + (long) (1.2 * hz); s.meteors.add(m); } }
            Iterator<Meteor> it = s.meteors.iterator();
            while (it.hasNext()) { Meteor m = it.next(); if (w.tick < m.hitTick) continue; it.remove(); for (Player p : w.players.values()) { if (p.dead || p.team == s.apocalypseTeam) continue; double dx = p.x - m.x, dy = p.y - m.y, r = 120 + p.radius; if (dx * dx + dy * dy <= r * r) { p.health -= 45; if (p.health <= 0) w.die(p, "a meteor", World.EATEN, dying); } } }
            if (w.tick >= s.apocalypseUntil) { s.apocalypseUntil = 0; s.apocalypseDone = true; s.meteors.clear(); for (Player p : w.players.values()) if (!p.dead) { { p.bonusCoins += 50; w.onReward.accept(p); } if (!p.bot && p.sender != null) p.sender.send("{\"t\":\"apocalypse\",\"team\":0,\"survived\":1}"); } } // survivors get extra coins (wiki)
        }
        if (s.apocalypseDone && w.tick % (180L * hz) == 0) { s.apocalypseDone = false; for (Stone st : s.stones) { st.owner = 0; st.hp = 100; } } // a new war every 3 minutes (INFERRED)
    }

    private static void zombieTick(State s, double dt, List<Player> dying) {
        World w = s.w; int hz = w.cfg.tickRate; List<Player> zs = new ArrayList<>(); for (Player p : w.players.values()) if (!p.dead && p.zombie) zs.add(p);
        for (Player z : zs) { // two zombies touching heal each other; touching a human infects it
            for (Player o : w.players.values()) { if (o == z || o.dead) continue; if (!Collision.overlap(z, o)) continue;
                if (o.zombie) z.health = Math.min(z.maxHealth(), z.health + 10 * dt); else if (o.protectedUntilTick <= w.tick) o.infection = Math.min(100, o.infection + 22 * dt); }
        }
        for (Player p : w.players.values()) {
            if (p.dead) continue;
            if (p.zombie) { if (w.tick % (10L * hz) == (p.id % (10L * hz))) { /* 'RAAAUGH' flavour is client-side */ } continue; }
            if (p.infection > 0) {
                if (w.inWater(p.x, p.y)) p.infection = Math.max(0, p.infection - 4 * dt);       // washing off the virus (stands in for healing stones / lotus, which do not exist here)
                else p.infection = Math.min(100, p.infection + 1.2 * dt);                     // the virus keeps spreading
                p.health -= (p.infection / 100.0) * 1.5 * dt;
                if (p.infection >= 100) { p.zombie = true; p.health = p.maxHealth(); }
                else if (p.health <= 0) w.die(p, "the zombie virus", World.EATEN, dying);
            }
        }
        if (w.tick >= s.nextZombie) { s.nextZombie = w.tick + 20L * hz; if (zs.size() < 3) { List<Player> hs = new ArrayList<>(); for (Player p : w.players.values()) if (!p.dead && !p.zombie && p.infection == 0) hs.add(p); if (!hs.isEmpty()) hs.get(w.rnd.nextInt(hs.size())).infection = 35; } }
    }

    private static void pandemicTick(State s, double dt, List<Player> dying) {
        World w = s.w; int hz = w.cfg.tickRate;
        for (Virus v : s.viruses) { v.x += v.vx * dt; v.y += v.vy * dt; if (v.x < 0 || v.x > w.size) v.vx = -v.vx; if (v.y < 0 || v.y > w.size) v.vy = -v.vy; if (w.rnd.nextDouble() < 0.01) { double a = w.rnd.nextDouble() * 6.28; v.vx = Math.cos(a) * 30; v.vy = Math.sin(a) * 30; } }
        for (Player p : w.players.values()) {
            if (p.dead) continue; boolean exposed = false;
            for (Virus v : s.viruses) { double dx = p.x - v.x, dy = p.y - v.y, r = 40 + p.radius; if (dx * dx + dy * dy <= r * r) { exposed = true; break; } }
            boolean masked = p.maskUntilTick > w.tick, sanitized = p.sanitizedUntilTick > w.tick;
            if (exposed && !masked && !sanitized) p.immunity = Math.max(0, p.immunity - 12 * dt); else if (!exposed) p.immunity = Math.min(100, p.immunity + 0.5 * dt);
            if (p.immunity <= 0) { p.infection = Math.min(100, p.infection + (exposed ? 4 : 0.5) * dt); } else p.infection = Math.max(0, p.infection - 1.5 * dt);
            double drain = p.immunity <= 0 ? (p.infection >= 100 ? 1.2 : 0.3 + 0.6 * p.infection / 100.0) : (p.immunity < 100 ? 0.02 : 0); // wiki: 0.2hp/10s while losing immunity, doubled and faster when fully infected
            p.health -= drain * dt; if (p.health <= 0) { w.die(p, "the virus", World.EATEN, dying); continue; }
            if (p.infection >= 30 && w.tick >= p.nextSneezeTick) { p.nextSneezeTick = w.tick + (long) ((p.infection >= 100 ? 4 : 10) * hz); p.slowUntilTick = w.tick + (long) (0.8 * hz); Virus v = new Virus(); v.x = p.x; v.y = p.y; v.vx = (w.rnd.nextDouble() - 0.5) * 80; v.vy = (w.rnd.nextDouble() - 0.5) * 80; if (s.viruses.size() < 160) s.viruses.add(v); } // 'ACHOO!'
            Iterator<Pickup> it = s.pickups.iterator();
            while (it.hasNext()) { Pickup k = it.next(); double dx = p.x - k.x, dy = p.y - k.y, r = 24 + p.radius; if (dx * dx + dy * dy <= r * r) { it.remove(); if (k.type == 1) p.maskUntilTick = w.tick + 90L * hz; else { p.sanitizedUntilTick = w.tick + 45L * hz; p.immunity = Math.min(100, p.immunity + 40); } addPickup(s, k.type); } }
        }
    }

    /** Extra JSON fields appended to a snapshot (leading comma included) and the per-player flag bits. */
    public static String extraJson(World w, Player me) {
        State s = w.ms; if (s == null) return "";
        StringBuilder b = new StringBuilder(",\"md\":{\"m\":\"").append(s.mode).append('"');
        switch (s.mode) {
            case "royale" -> { int alive = 0; for (Player p : w.players.values()) if (!p.dead) alive++; double nx = s.toR != s.fromR ? 0 : Math.max(0, (s.shrinkStart - w.tick) / (double) w.cfg.tickRate);
                b.append(",\"z\":[").append(Math.round(s.cx)).append(',').append(Math.round(s.cy)).append(',').append(Math.round(s.r)).append("],\"ph\":").append(s.phase).append(",\"nx\":").append(Math.round(nx)).append(",\"al\":").append(alive).append(",\"over\":").append(s.over ? 1 : 0).append(",\"out\":").append(me.x < 0 ? 0 : (Math.hypot(me.x - s.cx, me.y - s.cy) > s.r ? 1 : 0)).append(",\"dps\":").append(ROYALE_DPS[Math.min(s.phase, ROYALE_DPS.length - 1)]); }
            case "team" -> { int[] n = new int[4]; for (Player p : w.players.values()) if (!p.dead && p.team > 0) n[p.team]++; b.append(",\"tm\":[").append(n[1]).append(',').append(n[2]).append(',').append(n[3]).append("],\"me\":").append(me.team).append(",\"own\":[").append(teamStones(s, 1)).append(',').append(teamStones(s, 2)).append(',').append(teamStones(s, 3)).append("],\"ap\":").append(s.apocalypseUntil > 0 ? Math.max(0, (s.apocalypseUntil - w.tick) * 1000 / w.cfg.tickRate) : 0).append(",\"st\":[");
                boolean f = true; for (Stone st : s.stones) { if (!f) b.append(','); f = false; b.append('[').append(st.id).append(',').append(Math.round(st.x)).append(',').append(Math.round(st.y)).append(',').append(st.owner).append(',').append(Math.round(st.hp)).append(',').append(st.perk).append(']'); }
                b.append("],\"mt\":["); f = true; for (Meteor m : s.meteors) { if (!f) b.append(','); f = false; b.append('[').append(Math.round(m.x)).append(',').append(Math.round(m.y)).append(',').append(Math.max(0, (m.hitTick - w.tick) * 1000 / w.cfg.tickRate)).append(']'); } b.append(']'); }
            case "zombie" -> b.append(",\"inf\":").append(Math.round(me.infection)).append(",\"zb\":").append(me.zombie ? 1 : 0);
            case "pandemic" -> { b.append(",\"im\":").append(Math.round(me.immunity)).append(",\"inf\":").append(Math.round(me.infection)).append(",\"mask\":").append(Math.max(0, (me.maskUntilTick - w.tick) / w.cfg.tickRate)).append(",\"san\":").append(Math.max(0, (me.sanitizedUntilTick - w.tick) / w.cfg.tickRate)).append(",\"vr\":[");
                boolean f = true; for (Virus v : s.viruses) { if (Math.abs(v.x - me.x) > 1100 || Math.abs(v.y - me.y) > 1100) continue; if (!f) b.append(','); f = false; b.append('[').append(Math.round(v.x)).append(',').append(Math.round(v.y)).append(']'); }
                b.append("],\"pk\":["); f = true; for (Pickup k : s.pickups) { if (Math.abs(k.x - me.x) > 1100 || Math.abs(k.y - me.y) > 1100) continue; if (!f) b.append(','); f = false; b.append('[').append(k.id).append(',').append(Math.round(k.x)).append(',').append(Math.round(k.y)).append(',').append(k.type).append(']'); } b.append(']'); }
            case "wild" -> b.append(",\"w\":1");
            default -> { }
        }
        return b.append('}').toString();
    }
    /** Player flag bits for the snapshot: low 2 bits team (1-3), 4 = zombie, 8 = infected. */
    public static int flags(Player p) { return (p.team & 3) | (p.zombie ? 4 : 0) | (!p.zombie && p.infection >= 10 ? 8 : 0); }
}
