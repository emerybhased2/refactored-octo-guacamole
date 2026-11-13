package mope;

import java.util.*;

/** Authoritative food spawning: keeps each food type near its target density, paced by respawnMs. */
public final class FoodEngine {
    private final List<Defs.FoodDef> defs;
    private final BiomeEngine biomes;
    private final Random rnd;
    private final int[] target, count;
    private final double[] nextSpawnMs;
    public final List<Food> foods = new ArrayList<>();
    private int nextId = 1_000_000;

    /** density = items per 1,000,000 px^2 of allowed biome. */
    public FoodEngine(List<Defs.FoodDef> defs, BiomeEngine biomes, Random rnd) {
        this.defs = defs; this.biomes = biomes; this.rnd = rnd;
        target = new int[defs.size()]; count = new int[defs.size()]; nextSpawnMs = new double[defs.size()];
        for (int i = 0; i < defs.size(); i++) target[i] = (int) Math.round(defs.get(i).density * biomes.area(defs.get(i).biomes) / 1_000_000.0);
    }
    public void fill() { for (int i = 0; i < defs.size(); i++) while (count[i] < target[i]) spawn(i); }
    private void spawn(int i) {
        double[] p = biomes.randomPoint(rnd, defs.get(i).biomes);
        foods.add(new Food(nextId++, defs.get(i), i, p[0], p[1])); count[i]++;
    }
    public void consumed(Food f) { f.removed = true; count[f.typeIndex]--; }
    public void tick(double nowMs) {
        foods.removeIf(f -> f.removed);
        for (int i = 0; i < defs.size(); i++) {
            if (count[i] < target[i] && nowMs >= nextSpawnMs[i]) { spawn(i); nextSpawnMs[i] = nowMs + defs.get(i).respawnMs / Math.max(1, target[i] / 20.0); }
        }
    }
    public int target(int i) { return target[i]; }
}
