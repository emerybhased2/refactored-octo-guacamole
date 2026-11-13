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
        else if (Math.hypot(gx - b.x, gy - b.y) < 80 || b.botGoalX == 0) { double[] pt = w.biomes.randomPoint(w.rnd, java.util.List.of(b.animal.biome)); gx = pt[0]; gy = pt[1]; }
        if (b.ownerId != 0) { Player ow = w.players.get(b.ownerId); if (ow != null) { gx = ow.x + Math.cos(b.id) * 90; gy = ow.y + Math.sin(b.id) * 90; } } // summoned babies follow their parent
        else if ((flee || bestPrey != null) && w.rnd.nextInt(40) == 0) Abilities.use(w, b, 0, true); // bots use their abilities now and then
        b.botGoalX = gx; b.botGoalY = gy;
        b.inputAngle = Math.atan2(gy - b.y, gx - b.x); b.inputMag = 1;
    }
}
