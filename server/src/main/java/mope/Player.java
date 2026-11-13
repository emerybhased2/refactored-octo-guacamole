package mope;

/** A human- or bot-controlled animal. All state is server-authoritative. */
public class Player extends Entity {
    public interface Sender { void send(String json); }
    public World world;
    public String name, account;
    public Animal animal;
    public double xp, health, angle, inputAngle, inputMag;
    public boolean dead, bot;
    public int kills;
    public long protectedUntilTick, abilityReadyAt, abilityActiveUntil;
    public Sender sender;
    // bot state
    public double botGoalX, botGoalY; public int botThinkAt;

    public double maxHealth() { return animal.health; }
    public void setAnimal(Animal a) { animal = a; radius = a.radius(); }
}
