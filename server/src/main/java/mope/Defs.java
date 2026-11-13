package mope;

import java.util.List;

/** Small definition records loaded from JSON. */
public final class Defs {
    private Defs() {}
    public static class Edge { public String from, to, releaseDate, removalDate, confidence; }
    public static class ShopItem { public String id, type, animal, family, name, sprite, spriteStatus, releaseDate, removalDate, confidence; public int price; public Integer listPrice; public Boolean isNew; public java.util.List<String> contains; }
    public static class Variant { public String id, animal, name, sprite, spriteStatus, releaseDate, removalDate, confidence; public double rarity; }
    public static class DisasterDef {
        public boolean permanent, hillRing;
        public String id, name, biome, releaseDate, removalDate, spawnedBy, confidence;
        public double radius, durationSec, weight; public double[] durationRangeSec;
        public com.google.gson.JsonObject visual, effects, spawns;
        public double fx(String k, double d) { return effects != null && effects.has(k) ? effects.get(k).getAsDouble() : d; }
        public boolean fb(String k) { return effects != null && effects.has(k) && effects.get(k).getAsBoolean(); }
    }
    public static class Cat { public String from, name; }
    public static class Tier { public int tier; public String name, color, releaseDate; public List<Cat> categories; }
    public static class TerrainDef {
        public String id, name, kind, sprite, spriteStatus, releaseDate, removalDate, confidence, effect;
        public double radius, density, forestDensity;
        public List<String> biomes;
    }
    public static class FoodDef {
        public String id, name, color, sprite, spriteStatus, releaseDate, removalDate, confidence;
        public double xp, health, radius, density, respawnMs;
        public List<String> biomes;
    }
    public static class BiomeDef {
        public String id, name, color, releaseDate, removalDate, confidence;
        public double[] rect;
        public Lakes lakes;
    }
    public static class Lakes { public int count; public double radius; }
    public static class AbilityDef {
        public String id, name, type, releaseDate, removalDate, icon, iconStatus;
        public double cooldownMs, durationMs, speedMultiplier, damage, range;
        public List<String> biomes;
        public boolean implemented, verified;
    }
}
