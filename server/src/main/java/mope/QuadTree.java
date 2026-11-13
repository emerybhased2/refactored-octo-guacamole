package mope;

import java.util.*;

/** Region quadtree over circle entities (stored by center point). Rebuilt each tick. */
public final class QuadTree {
    private static final int CAP = 8, MAX_DEPTH = 8;
    private final double x, y, w, h;
    private final int depth;
    private final ArrayList<Entity> items = new ArrayList<>(CAP);
    private QuadTree[] kids;

    public QuadTree(double x, double y, double w, double h) { this(x, y, w, h, 0); }
    private QuadTree(double x, double y, double w, double h, int d) { this.x = x; this.y = y; this.w = w; this.h = h; this.depth = d; }

    public void clear() { items.clear(); kids = null; }

    public void insert(Entity e) {
        if (kids != null) { kids[index(e.x, e.y)].insert(e); return; }
        items.add(e);
        if (items.size() > CAP && depth < MAX_DEPTH) {
            split();
            for (Entity it : items) kids[index(it.x, it.y)].insert(it);
            items.clear();
        }
    }
    private void split() {
        double hw = w / 2, hh = h / 2;
        kids = new QuadTree[] {
            new QuadTree(x, y, hw, hh, depth + 1), new QuadTree(x + hw, y, hw, hh, depth + 1),
            new QuadTree(x, y + hh, hw, hh, depth + 1), new QuadTree(x + hw, y + hh, hw, hh, depth + 1) };
    }
    private int index(double px, double py) { return (px >= x + w / 2 ? 1 : 0) + (py >= y + h / 2 ? 2 : 0); }

    /** Collects entities whose centers lie within the axis-aligned square of half-size r around (cx,cy). */
    public void query(double cx, double cy, double r, List<Entity> out) {
        if (cx + r < x || cx - r > x + w || cy + r < y || cy - r > y + h) return;
        if (kids != null) { for (QuadTree k : kids) k.query(cx, cy, r, out); return; }
        for (Entity e : items) if (Math.abs(e.x - cx) <= r && Math.abs(e.y - cy) <= r) out.add(e);
    }
}
