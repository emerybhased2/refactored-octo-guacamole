package mope;

import java.util.List;

/** Animal definition as resolved for one historical version. Fields mirror animals.json. */
public class Animal {
    public String id, name, biome, ability, sprite, spriteStatus, placeholderColor, description, releaseDate, removalDate, confidence;
    public List<String> aliases, classification;
    public int tier;
    public double xpRequired, health, speed, size, damage;

    public Animal copy() { return Data.GSON.fromJson(Data.GSON.toJson(this), Animal.class); }
    public double radius() { return 18 * size; }
}
