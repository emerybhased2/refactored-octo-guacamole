package mope;

import java.util.*;

/** Data-driven abilities (abilities.json). Only types flagged implemented can activate. */
public final class AbilityEngine {
    private final Map<String, Defs.AbilityDef> defs = new HashMap<>();

    public AbilityEngine(Collection<Defs.AbilityDef> all, java.time.LocalDate at) {
        for (Defs.AbilityDef d : all) if (d.implemented && Data.active(d.releaseDate, d.removalDate, at)) defs.put(d.id, d);
    }
    /** For tests: bypass date gating. */
    public static AbilityEngine forTest(Collection<Defs.AbilityDef> all) {
        AbilityEngine e = new AbilityEngine(List.of(), java.time.LocalDate.now());
        for (Defs.AbilityDef d : all) e.defs.put(d.id, d);
        return e;
    }
    /** Resolved definition (implemented + active on the version date) or null. */
    public Defs.AbilityDef def(String id) { return id == null ? null : defs.get(id); }
    public boolean activate(Player p, long nowMs, String biomeId) {
        if (p.animal.ability == null) return false;
        Defs.AbilityDef d = defs.get(p.animal.ability);
        if (d == null || nowMs < p.abilityReadyAt) return false;
        if (d.biomes != null && biomeId != null && !d.biomes.contains(biomeId)) return false;
        p.abilityActiveUntil = nowMs + (long) d.durationMs;
        p.abilityReadyAt = nowMs + (long) d.cooldownMs;
        return true;
    }
    public double speedMultiplier(Player p, long nowMs) {
        if (p.animal.ability == null || nowMs >= p.abilityActiveUntil) return 1;
        Defs.AbilityDef d = defs.get(p.animal.ability);
        return d == null ? 1 : d.speedMultiplier;
    }
}
