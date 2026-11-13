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
