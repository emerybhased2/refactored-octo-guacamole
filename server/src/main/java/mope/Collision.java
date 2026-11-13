package mope;

/** Circle collision helpers and Mope eat rules. */
public final class Collision {
    private Collision() {}
    public static double dist2(Entity a, Entity b) { double dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
    public static boolean overlap(Entity a, Entity b) { double r = a.radius + b.radius; return dist2(a, b) <= r * r; }
    /** Predator eats prey when prey's center lies inside predator's body and predator tier is strictly higher. */
    public static boolean canEat(Player pred, Player prey) {
        if (pred == prey || pred.dead || prey.dead || prey.protectedUntilTick > pred.world.tick) return false;
        long t = pred.world.tick;
        if (prey.hiddenUntilTick > t || prey.shieldUntilTick > t || pred.hiddenUntilTick > t) return false;                      // hidden / shielded / hiding animals cannot be eaten (or eat)
        if (prey.flyUntilTick > t && !(pred.flyUntilTick > t || pred.world.cfg.fliers.contains(pred.animal.id))) return false;   // airborne prey is out of reach of walkers
        if (pred.ownerId != 0 && (pred.ownerId == prey.id || pred.ownerId == prey.ownerId) || prey.ownerId != 0 && prey.ownerId == pred.id) return false; // summoned babies are allies
        if (!pred.world.sandbox && pred.animal.tier <= prey.animal.tier) return false;
        if (prey.climbing && !(pred.climbing || pred.world.cfg.fliers.contains(pred.animal.id))) return false; // up in a tree (inferred from the Bigfoot spear note)
        double r = pred.radius * 0.9;
        return dist2(pred, prey) <= r * r;
    }
}
