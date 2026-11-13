package mope;

import java.util.*;

/** Progression rules for one historical version. Entirely data driven. */
public final class EvolutionEngine {
    private final Map<String, Animal> animals;
    private final List<Defs.Edge> edges;

    private final String startId;

    public EvolutionEngine(Map<String, Animal> animals, List<Defs.Edge> edges, String startId) { this.animals = animals; this.edges = edges; this.startId = startId; }

    /** Spawn animal, defined per version (version.json "startAnimal"). */
    public Animal start() { return animals.get(startId); }
    /** Rare animals (rarity > 0, e.g. Snowman 1/2000) are only offered when `allowed` says so (lucky roll or shop ownership). */
    public List<Animal> options(Animal cur, java.util.function.Predicate<Animal> allowed) {
        List<Animal> out = new ArrayList<>();
        for (Defs.Edge e : edges) if (e.from.equals(cur.id)) { Animal a = animals.get(e.to); if (a != null && (a.rarity <= 0 || allowed.test(a))) out.add(a); }
        return out;
    }
    public List<Animal> options(Animal cur) { return options(cur, a -> false); }
    /** Server-side validation of an evolve request. */
    public boolean canEvolve(Animal cur, String targetId, double xp, java.util.function.Predicate<Animal> allowed) {
        for (Animal a : options(cur, allowed)) if (a.id.equals(targetId)) return xp >= a.xpRequired;
        return false;
    }
    public boolean canEvolve(Animal cur, String targetId, double xp) { return canEvolve(cur, targetId, xp, a -> false); }
    public List<String> evolvable(Animal cur, double xp, java.util.function.Predicate<Animal> allowed) {
        List<String> out = new ArrayList<>();
        for (Animal a : options(cur, allowed)) if (xp >= a.xpRequired) out.add(a.id);
        return out;
    }
    public List<String> evolvable(Animal cur, double xp) { return evolvable(cur, xp, a -> false); }
}
