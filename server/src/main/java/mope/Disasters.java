package mope;

import com.google.gson.JsonObject;
import java.util.*;

/**
 * Data-driven rare world events (data/disasters/disasters.json). A disaster is a circular zone with effects on animals inside it:
 * speed multiplier, damage, water, push away, pull in (escapable by boosting). Existence of each disaster and a few numbers
 * (Duststorm -10% speed, lava lakes last 5-10 minutes) come from the 2019-12-23 notes; everything else is INFERRED.
 */
final class Disasters {
    static final int BURN = 13; // death reason code (the archived client has 'You died from burning!')
    static final class Active { final int id; final Defs.DisasterDef def; final double x, y, r; final long endTick;
        Active(int id, Defs.DisasterDef def, double x, double y, double r, long endTick) { this.id = id; this.def = def; this.x = x; this.y = y; this.r = r; this.endTick = endTick; } }

    final List<Active> active = new ArrayList<>();
    private final World w;
    private int nextId = 1;
    private long nextSpawnTick;

    Disasters(World w) { this.w = w; schedule(); }

    boolean enabled() {
        VersionManager.Config c = w.cfg;
        return c.feature("disasters") && !w.arena && !w.sandbox && !c.disasters.isEmpty() && !(c.disasterCfg != null && c.disasterCfg.has("enabled") && !c.disasterCfg.get("enabled").getAsBoolean());
    }
    private double cfgNum(String k, double d) { JsonObject o = w.cfg.disasterCfg; return o != null && o.has(k) ? o.get(k).getAsDouble() : d; }
    private void schedule() { double mean = cfgNum("meanIntervalSec", 180), min = cfgNum("minIntervalSec", 60); nextSpawnTick = w.tick + (long) ((min + w.rnd.nextDouble() * 2 * Math.max(0, mean - min)) * w.cfg.tickRate); }

    Defs.DisasterDef def(String id) { for (Defs.DisasterDef d : w.cfg.disasters) if (d.id.equals(id)) return d; return null; }

    /** Spawn one disaster now (random location for its biome, or at a volcano for eruptions). Returns null if the id is unknown here. */
    Active trigger(String id) {
        Defs.DisasterDef d = def(id); if (d == null) return null;
        double[] pt = locationFor(d);
        long ticks = (long) ((d.durationRangeSec != null ? d.durationRangeSec[0] + w.rnd.nextDouble() * (d.durationRangeSec[1] - d.durationRangeSec[0]) : d.durationSec) * w.cfg.tickRate);
        return spawn(d, pt[0], pt[1], ticks);
    }
    private double[] locationFor(Defs.DisasterDef d) {
        String src = d.id.equals("volcanic_eruption") ? "volcano_cone" : d.id.equals("arctic_eruption") ? "arctic_volcano" : null;
        if (src != null) { List<double[]> objs = new ArrayList<>(); for (double[] o : w.terrain) if (w.cfg.terrain.get((int) o[0]).id.equals(src)) objs.add(o); if (!objs.isEmpty()) { double[] o = objs.get(w.rnd.nextInt(objs.size())); return new double[] { o[1], o[2] }; } }
        List<String> allowed = "any".equals(d.biome) ? w.cfg.biomeIds : List.of(d.biome);
        double[] p = w.biomes.randomPoint(w.rnd, allowed); return p;
    }
    private Active spawn(Defs.DisasterDef d, double x, double y, long ticks) {
        Active a = new Active(nextId++, d, x, y, d.radius, w.tick + ticks); active.add(a);
        String msg = "{\"t\":\"disaster\",\"id\":\"" + d.id + "\",\"name\":" + Data.GSON.toJson(d.name) + ",\"x\":" + (int) x + ",\"y\":" + (int) y + "}";
        for (Player p : w.players.values()) if (!p.bot && p.sender != null) p.sender.send(msg);
        if (d.spawns != null) { // e.g. eruptions throw lava balls that become lava lakes
            Defs.DisasterDef child = def(d.spawns.get("id").getAsString());
            if (child != null) for (int i = 0; i < d.spawns.get("count").getAsInt(); i++) {
                double ang = w.rnd.nextDouble() * Math.PI * 2, dist = w.rnd.nextDouble() * d.spawns.get("spread").getAsDouble();
                long cticks = (long) ((child.durationRangeSec != null ? child.durationRangeSec[0] + w.rnd.nextDouble() * (child.durationRangeSec[1] - child.durationRangeSec[0]) : child.durationSec) * w.cfg.tickRate);
                active.add(new Active(nextId++, child, x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, child.radius, w.tick + cticks));
            }
        }
        return a;
    }

    private Defs.DisasterDef pickRandom() {
        double total = 0; for (Defs.DisasterDef d : w.cfg.disasters) total += Math.max(0, d.weight); if (total <= 0) return null;
        double r = w.rnd.nextDouble() * total; for (Defs.DisasterDef d : w.cfg.disasters) { r -= Math.max(0, d.weight); if (r <= 0) return d; } return null;
    }

    void tick(double dt, List<Player> dying) {
        active.removeIf(a -> w.tick >= a.endTick);
        if (w.tick >= nextSpawnTick) { if (enabled()) { Defs.DisasterDef d = pickRandom(); if (d != null) trigger(d.id); } schedule(); }
        for (Player p : w.players.values()) {
            p.disasterSpeed = 1;
            if (p.dead || active.isEmpty()) continue;
            double mx = 0, my = 0;
            for (Active a : active) {
                double dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy); if (d > a.r) continue;
                boolean natives = "any".equals(a.def.biome) || a.def.biome.equals(p.animal.biome);
                double sm = a.def.fx("speedMul", 1); if (sm < 1 && (!a.def.fb("freezeNonNative") || !natives)) p.disasterSpeed *= sm;
                double dps = a.def.fx("dps", 0); if (dps > 0) p.health -= dps * dt;
                double rain = a.def.fx("waterPerSec", 0); if (rain > 0) p.water = Math.min(100, p.water + rain * dt);
                double push = a.def.fx("pushPerSec", 0), pull = a.def.fx("pullPerSec", 0);
                if (push > 0 && d > 1e-6 && !(a.def.fb("washOutNonOcean") && "ocean".equals(p.animal.biome))) { mx += dx / d * push * dt; my += dy / d * push * dt; }
                if (pull > 0 && d > 1e-6) { boolean escapes = a.def.fb("boostEscapes") && p.boost && p.water > 5 && p.inputMag > 0.05; if (!escapes) { mx -= dx / d * pull * dt; my -= dy / d * pull * dt; } }
            }
            if (mx != 0 || my != 0) {
                double nx = Math.max(p.radius, Math.min(w.size - p.radius, p.x + mx)), ny = Math.max(p.radius, Math.min(w.size - p.radius, p.y + my));
                if (w.biomes.canEnter(p.animal, nx, ny)) { p.x = nx; p.y = ny; }
            }
            if (p.health <= 0) w.die(p, "fire", BURN, dying);
        }
    }

    /** Compact snapshot piece for disasters near (x,y): [[id, defId, x, y, r, remainingMs], ...]. */
    String snapshotNear(double x, double y, long nowTick, int tickRate) {
        StringBuilder s = null;
        for (Active a : active) if (Math.hypot(a.x - x, a.y - y) < a.r + 1100) {
            if (s == null) s = new StringBuilder(",\"dz\":["); else s.append(',');
            s.append('[').append(a.id).append(",\"").append(a.def.id).append("\",").append((int) a.x).append(',').append((int) a.y).append(',').append((int) a.r).append(',').append((a.endTick - nowTick) * 1000 / tickRate).append(']');
        }
        return s == null ? "" : s.append(']').toString();
    }
}
