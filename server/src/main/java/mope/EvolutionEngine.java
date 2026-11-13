package mope;

import java.util.*;

/** Progression rules for one historical version. Entirely data driven. */
public final class EvolutionEngine {
    private final Map<String, Animal> animals;
    private final List<Defs.Edge> edges;

    public EvolutionEngine(Map<String, Animal> animals, List<Defs.Edge> edges) { this.animals = animals; this.edges = edges; }

    /** Spawn animal: available animal with no predecessor and xpRequired 0 (lowest tier first). */
    public Animal start() {
        Set<String> targets = new HashSet<>();
        for (Defs.Edge e : edges) targets.add(e.to);
        return animals.values().stream().filter(a -> !targets.contains(a.id) && a.xpRequired <= 0)
            .min(Comparator.comparingInt((Animal a) -> a.tier).thenComparing(a -> a.id)).orElseThrow();
    }
    public List<Animal> options(Animal cur) {
        List<Animal> out = new ArrayList<>();
        for (Defs.Edge e : edges) if (e.from.equals(cur.id)) { Animal a = animals.get(e.to); if (a != null) out.add(a); }
        return out;
    }
    /** Server-side validation of an evolve request. */
    public boolean canEvolve(Animal cur, String targetId, double xp) {
        for (Animal a : options(cur)) if (a.id.equals(targetId)) return xp >= a.xpRequired;
        return false;
    }
    public List<String> evolvable(Animal cur, double xp) {
        List<String> out = new ArrayList<>();
        for (Animal a : options(cur)) if (xp >= a.xpRequired) out.add(a.id);
        return out;
    }
}
