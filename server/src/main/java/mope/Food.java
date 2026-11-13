package mope;

public class Food extends Entity {
    public final Defs.FoodDef def;
    public final int typeIndex;
    public Food(int id, Defs.FoodDef def, int typeIndex, double x, double y) { this.id = id; this.def = def; this.typeIndex = typeIndex; this.x = x; this.y = y; this.radius = def.radius; }
}
