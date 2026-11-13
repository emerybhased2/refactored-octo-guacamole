package mope;

import java.util.*;

/** Minimal server-side AI used to populate worlds and stress-test the simulation. */
final class Bot {
    private Bot() {}
    private static final ThreadLocal<ArrayList<Entity>> BUF = ThreadLocal.withInitial(ArrayList::new);

    static void think(World w, Player b) {
        if (w.tick < b.botThinkAt) return;
        b.botThinkAt = (int) w.tick + 8 + w.rnd.nextInt(8);
        List<String> ev = w.evolution.evolvable(b.animal, b.xp);
        if (!ev.isEmpty()) w.evolve(b, ev.get(w.rnd.nextInt(ev.size())));
        ArrayList<Entity> near = BUF.get(); near.clear();
        w.tree.query(b.x, b.y, 450, near);
        Entity bestFood = null, bestPrey = null; double fd = 1e18, pd = 1e18; double fleeX = 0, fleeY = 0; boolean flee = false;
        for (Entity e : near) {
            double d = Collision.dist2(b, e);
            if (e instanceof Food) { if (d < fd) { fd = d; bestFood = e; } }
            else if (e instanceof Player p && p != b && !p.dead) {
                if (p.animal.tier > b.animal.tier && d < 300 * 300) { flee = true; fleeX += b.x - p.x; fleeY += b.y - p.y; }
                else if (p.animal.tier < b.animal.tier && d < pd) { pd = d; bestPrey = p; }
            }
        }
        double gx = b.botGoalX, gy = b.botGoalY;
        if (flee) { gx = b.x + fleeX; gy = b.y + fleeY; }
        else if (bestPrey != null) { gx = bestPrey.x; gy = bestPrey.y; }
        else if (bestFood != null) { gx = bestFood.x; gy = bestFood.y; }
        else if (Math.hypot(gx - b.x, gy - b.y) < 80 || b.botGoalX == 0) { gx = w.rnd.nextDouble() * w.size; gy = w.rnd.nextDouble() * w.size; }
        b.botGoalX = gx; b.botGoalY = gy;
        b.inputAngle = Math.atan2(gy - b.y, gx - b.x); b.inputMag = 1;
    }
}
