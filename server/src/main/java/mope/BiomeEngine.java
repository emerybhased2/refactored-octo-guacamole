package mope;

import java.util.*;

/** Maps world positions to biomes and enforces animal biome restrictions. */
public final class BiomeEngine {
    private final List<Defs.BiomeDef> biomes;
    private final double size;

    public BiomeEngine(List<Defs.BiomeDef> biomes, double worldSize) { this.biomes = biomes; this.size = worldSize; }

    public Defs.BiomeDef biomeAt(double x, double y) {
        for (Defs.BiomeDef b : biomes) {
            double[] r = b.rect;
            if (x >= r[0] * size && x < (r[0] + r[2]) * size && y >= r[1] * size && y < (r[1] + r[3]) * size) return b;
        }
        return null;
    }
    /** An animal may stand where its biome matches, or anywhere if its biome is "any". */
    public boolean canEnter(Animal a, double x, double y) {
        Defs.BiomeDef b = biomeAt(x, y);
        return b != null && ("any".equals(a.biome) || a.biome.equals(b.id));
    }
    public double[] randomPoint(Random rnd, List<String> allowed) {
        for (int i = 0; i < 20; i++) {
            Defs.BiomeDef b = biomes.get(rnd.nextInt(biomes.size()));
            if (!allowed.contains(b.id)) continue;
            double[] r = b.rect;
            return new double[] { (r[0] + rnd.nextDouble() * r[2]) * size, (r[1] + rnd.nextDouble() * r[3]) * size };
        }
        return new double[] { size / 2, size / 2 };
    }
    public double area(List<String> allowed) {
        double a = 0;
        for (Defs.BiomeDef b : biomes) if (allowed.contains(b.id)) a += b.rect[2] * size * b.rect[3] * size;
        return a;
    }
}
