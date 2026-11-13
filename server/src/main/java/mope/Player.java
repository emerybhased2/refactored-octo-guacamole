package mope;

/** A human- or bot-controlled animal. All state is server-authoritative. */
public class Player extends Entity {
    public interface Sender { void send(String json); }
    public World world;
    public String name, account;
    public Animal animal;
    public double xp, health, angle, inputAngle, inputMag;
    public boolean dead, bot, boost;
    public double water = 100;
    public long lastChatTick = -1_000_000;
    public int kills;
    public long protectedUntilTick, abilityReadyAt, abilityActiveUntil;
    public double rareRoll = 1, disasterSpeed = 1;                                  // rareRoll < animal.rarity => that rare animal is offered
    public final java.util.Map<String, String> skins = new java.util.HashMap<>();   // animal id -> equipped skin item id (cosmetic only)
    public final java.util.Set<String> owned = new java.util.HashSet<>();           // shop item ids owned by the account (e.g. "snowman")
    public boolean climbing;
    // game-mode state (Modes.java)
    public int team; public double infection, immunity = 100, healthMul = 1, bonusCoins; public boolean zombie; public long slowUntilTick, maskUntilTick, sanitizedUntilTick, nextSneezeTick; public boolean boss;
    public final java.util.Map<String, String> variants = new java.util.HashMap<>();  // animal id -> rare variant rolled when evolving into it
    /** An equipped shop skin wins; otherwise a rare variant that was rolled for this animal. */
    public String skinId() { String s = skins.get(animal.id); return s != null ? s : variants.get(animal.id); }
    /** May this player be offered the rare animal `a`? Lucky roll, or bought in the shop. */
    public boolean canHaveRare(Animal a) { return rareRoll < a.rarity || owned.contains(a.id); }
    public Sender sender;
    // bot state
    public double botGoalX, botGoalY; public int botThinkAt;

    public double maxHealth() { return animal.health * healthMul * (zombie ? 1.5 : 1); }
    public void setAnimal(Animal a) { animal = a; radius = a.radius(); }
}
