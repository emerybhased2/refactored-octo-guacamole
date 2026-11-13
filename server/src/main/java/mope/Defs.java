package mope;

import java.util.List;

/** Small definition records loaded from JSON. */
public final class Defs {
    private Defs() {}
    public static class Edge { public String from, to, releaseDate, removalDate, confidence; }
    public static class Tier { public int tier; public String name, color, releaseDate; }
    public static class FoodDef {
        public String id, name, color, sprite, spriteStatus, releaseDate, removalDate, confidence;
        public double xp, health, radius, density, respawnMs;
        public List<String> biomes;
    }
    public static class BiomeDef {
        public String id, name, color, releaseDate, removalDate, confidence;
        public double[] rect;
    }
    public static class AbilityDef {
        public String id, name, type, releaseDate, removalDate;
        public double cooldownMs, durationMs, speedMultiplier, damage, range;
        public List<String> biomes;
        public boolean implemented, verified;
    }
}
