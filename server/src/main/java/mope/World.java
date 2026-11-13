package mope;

import com.google.gson.JsonObject;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Authoritative simulation for one historical version. Single tick thread; inputs arrive through {@link #submit}. */
public final class World {
    public final VersionManager.Config cfg;
    public final double size;
    public final Random rnd;
    public final EvolutionEngine evolution;
    public final AbilityEngine abilities;
    public final BiomeEngine biomes;
    public final FoodEngine foods;
    public final QuadTree tree;
    public final Map<Integer, Player> players = new LinkedHashMap<>();
    public long tick;
    public Consumer<Player> onDeath = p -> {};
    private final Queue<Runnable> inbox = new ConcurrentLinkedQueue<>();
    private final ArrayList<Entity> tmp = new ArrayList<>();
    private int nextId = 1;
    private ScheduledExecutorService exec;
    public volatile double lastTickMs;

    public World(VersionManager.Config cfg, long seed) {
        this.cfg = cfg; this.size = cfg.worldSize; this.rnd = new Random(seed);
        evolution = new EvolutionEngine(cfg.animals, cfg.edges);
        abilities = new AbilityEngine(cfg.abilities, cfg.date);
        biomes = new BiomeEngine(cfg.biomes, size);
        foods = new FoodEngine(cfg.foods, biomes, rnd);
        foods.fill();
        tree = new QuadTree(0, 0, size, size);
        for (int i = 0; i < cfg.bots; i++) join("Bot" + (i + 1), null, true);
    }

    public long nowMs() { return tick * 1000L / cfg.tickRate; }
    public void submit(Runnable r) { inbox.add(r); }
    public int humanCount() { int n = 0; for (Player p : players.values()) if (!p.bot) n++; return n; }

    public void start() {
        exec = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "world-" + cfg.id); t.setDaemon(true); return t; });
        exec.scheduleAtFixedRate(() -> { try { long t0 = System.nanoTime(); tick(); lastTickMs = (System.nanoTime() - t0) / 1e6; } catch (Throwable e) { e.printStackTrace(); } },
            0, 1000L / cfg.tickRate, TimeUnit.MILLISECONDS);
    }
    public void stop() { if (exec != null) exec.shutdownNow(); }

    public Player join(String name, Player.Sender sender, boolean bot) {
        Player p = new Player();
        p.world = this; p.id = nextId++; p.name = name; p.sender = sender; p.bot = bot;
        p.setAnimal(evolution.start()); p.xp = 0; p.health = p.maxHealth();
        double[] pt = biomes.randomPoint(rnd, List.of(p.animal.biome));
        p.x = pt[0]; p.y = pt[1];
        p.protectedUntilTick = tick + 2L * cfg.tickRate;
        players.put(p.id, p);
        return p;
    }
    public void leave(Player p) { players.remove(p.id); p.dead = true; }

    /** Server-side evolution. The client only ever requests; XP and edges are validated here. */
    public boolean evolve(Player p, String targetId) {
        if (p.dead || !evolution.canEvolve(p.animal, targetId, p.xp)) return false;
        p.setAnimal(cfg.animals.get(targetId));
        p.health = p.maxHealth();
        return true;
    }

    public void tick() {
        tick++;
        Runnable r;
        while ((r = inbox.poll()) != null) r.run();
        double dt = 1.0 / cfg.tickRate, now = nowMs();

        for (Player p : players.values()) {
            if (p.bot) Bot.think(this, p);
            double mag = Math.max(0, Math.min(1, p.inputMag));
            if (mag > 0.05) {
                p.angle = p.inputAngle;
                double sp = 220 * p.animal.speed * mag * abilities.speedMultiplier(p, (long) now);
                double nx = p.x + Math.cos(p.angle) * sp * dt, ny = p.y + Math.sin(p.angle) * sp * dt;
                nx = Math.max(p.radius, Math.min(size - p.radius, nx)); ny = Math.max(p.radius, Math.min(size - p.radius, ny));
                if (biomes.canEnter(p.animal, nx, ny)) { p.x = nx; p.y = ny; }
            }
            p.health = Math.min(p.maxHealth(), p.health + 2 * dt);
        }

        tree.clear();
        for (Player p : players.values()) tree.insert(p);
        for (Food f : foods.foods) tree.insert(f);

        List<Player> dying = new ArrayList<>();
        for (Player p : players.values()) {
            if (p.dead) continue;
            tmp.clear();
            tree.query(p.x, p.y, p.radius + 40, tmp);
            for (Entity e : tmp) {
                if (e instanceof Food f) {
                    if (!f.removed && Collision.overlap(p, f)) { foods.consumed(f); p.xp += f.def.xp; p.health = Math.min(p.maxHealth(), p.health + f.def.health); }
                } else if (e instanceof Player o && Collision.canEat(p, o) && !dying.contains(o)) {
                    p.xp += 20 * o.animal.tier + o.xp * 0.25; p.kills++; dying.add(o); o.dead = true;
                    if (!o.bot && o.sender != null) o.sender.send("{\"t\":\"died\",\"xp\":" + (long) o.xp + ",\"by\":" + Data.GSON.toJson(p.name) + "}");
                }
            }
        }
        for (Player o : dying) { players.remove(o.id); onDeath.accept(o); if (o.bot) { Player nb = join(o.name, null, true); nb.kills = 0; } }
        foods.tick(now);

        if (tick % Math.max(1, cfg.tickRate / cfg.netRate) == 0) broadcast();
    }

    private List<Player> leaderboard() {
        List<Player> l = new ArrayList<>(players.values());
        l.sort((a, b) -> Double.compare(b.xp, a.xp));
        return l.subList(0, Math.min(10, l.size()));
    }

    private void broadcast() {
        List<Player> lb = null;
        String lbJson = null;
        for (Player p : players.values()) {
            if (p.bot || p.sender == null) continue;
            if (lbJson == null) {
                StringBuilder s = new StringBuilder("[");
                for (Player q : leaderboard()) { if (s.length() > 1) s.append(','); s.append('[').append(Data.GSON.toJson(q.name)).append(',').append((long) q.xp).append(',').append(q.id).append(']'); }
                lbJson = s.append(']').toString();
            }
            p.sender.send(snapshot(p, lbJson));
        }
    }

    String snapshot(Player me, String lbJson) {
        StringBuilder s = new StringBuilder(2048);
        s.append("{\"t\":\"snap\",\"k\":").append(tick)
         .append(",\"you\":{\"id\":").append(me.id).append(",\"x\":").append(r1(me.x)).append(",\"y\":").append(r1(me.y))
         .append(",\"xp\":").append((long) me.xp).append(",\"hp\":").append((int) me.health).append(",\"a\":\"").append(me.animal.id).append("\",\"ev\":[");
        List<String> ev = evolution.evolvable(me.animal, me.xp);
        for (int i = 0; i < ev.size(); i++) { if (i > 0) s.append(','); s.append('"').append(ev.get(i)).append('"'); }
        s.append("],\"cd\":").append(Math.max(0, me.abilityReadyAt - nowMs())).append("},\"p\":[");
        tmp.clear(); tree.query(me.x, me.y, 1100, tmp);
        boolean first = true;
        for (Entity e : tmp) if (e instanceof Player o && !o.dead) {
            if (!first) s.append(','); first = false;
            s.append('[').append(o.id).append(',').append(r1(o.x)).append(',').append(r1(o.y)).append(',')
             .append(cfg.animalOrder.indexOf(o.animal.id)).append(',').append(r2(o.angle)).append(',').append((int) (100 * o.health / o.maxHealth())).append(',')
             .append(Data.GSON.toJson(o.name)).append(']');
        }
        s.append("],\"f\":[");
        first = true;
        for (Entity e : tmp) if (e instanceof Food f && !f.removed) {
            if (!first) s.append(','); first = false;
            s.append('[').append(f.id).append(',').append(r1(f.x)).append(',').append(r1(f.y)).append(',').append(f.typeIndex).append(']');
        }
        s.append("],\"lb\":").append(lbJson).append('}');
        return s.toString();
    }
    private static String r1(double v) { return Double.toString(Math.round(v * 10) / 10.0); }
    private static String r2(double v) { return Double.toString(Math.round(v * 100) / 100.0); }
}
