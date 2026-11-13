package mope;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Authoritative simulation for one historical version + mode. Single tick thread; inputs arrive through {@link #submit}. */
public final class World {
    public static final int EATEN = 1, THIRST = 4; // reason codes (match the archived client's death codes)
    public final VersionManager.Config cfg;
    public final boolean sandbox;
    public final double size;
    public final Random rnd;
    public final EvolutionEngine evolution;
    public final AbilityEngine abilities;
    public final BiomeEngine biomes;
    public final FoodEngine foods;
    public final QuadTree tree;
    public final List<double[]> lakes = new ArrayList<>(); // x, y, radius
    public final Map<Integer, Player> players = new LinkedHashMap<>();
    public long tick;
    public Consumer<Player> onDeath = p -> {};
    private final Queue<Runnable> inbox = new ConcurrentLinkedQueue<>();
    private final ArrayList<Entity> tmp = new ArrayList<>();
    private final List<Animal> sandboxOrder = new ArrayList<>();
    private int nextId = 1;
    private ScheduledExecutorService exec;
    public volatile double lastTickMs;

    public World(VersionManager.Config cfg, long seed) { this(cfg, seed, false); }

    public World(VersionManager.Config cfg, long seed, boolean sandbox) {
        this.cfg = cfg; this.size = cfg.worldSize; this.rnd = new Random(seed); this.sandbox = sandbox;
        evolution = new EvolutionEngine(cfg.animals, cfg.edges, cfg.startAnimal);
        abilities = new AbilityEngine(cfg.abilities, cfg.date);
        biomes = new BiomeEngine(cfg.biomes, size);
        foods = new FoodEngine(cfg.foods, biomes, rnd);
        foods.fill();
        tree = new QuadTree(0, 0, size, size);
        for (Defs.BiomeDef b : cfg.biomes) if (b.lakes != null) for (int i = 0; i < b.lakes.count; i++) {
            double r = b.lakes.radius, x0 = b.rect[0] * size, y0 = b.rect[1] * size, w = b.rect[2] * size, h = b.rect[3] * size;
            lakes.add(new double[] { x0 + r + rnd.nextDouble() * (w - 2 * r), y0 + r + rnd.nextDouble() * (h - 2 * r), r });
        }
        sandboxOrder.addAll(cfg.animals.values());
        List<String> bo = cfg.biomeIds;
        sandboxOrder.sort(Comparator.comparingInt((Animal a) -> a.tier).thenComparingInt(a -> bo.indexOf(a.biome)).thenComparingInt(a -> a.internalId));
        if (!sandbox) for (int i = 0; i < cfg.bots; i++) join("Bot" + (i + 1), null, true);
    }

    public long nowMs() { return tick * 1000L / cfg.tickRate; }
    public void submit(Runnable r) { inbox.add(r); }
    public int humanCount() { int n = 0; for (Player p : players.values()) if (!p.bot) n++; return n; }

    public void start() {
        exec = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "world-" + cfg.id + (sandbox ? "-sandbox" : "")); t.setDaemon(true); return t; });
        exec.scheduleAtFixedRate(() -> { try { long t0 = System.nanoTime(); tick(); lastTickMs = (System.nanoTime() - t0) / 1e6; } catch (Throwable e) { e.printStackTrace(); } },
            0, 1000L / cfg.tickRate, TimeUnit.MILLISECONDS);
    }
    public void stop() { if (exec != null) exec.shutdownNow(); }

    public Player join(String name, Player.Sender sender, boolean bot) {
        Player p = new Player();
        p.world = this; p.id = nextId++; p.name = name; p.sender = sender; p.bot = bot;
        p.setAnimal(bot && !cfg.starters.isEmpty() ? cfg.animals.get(cfg.starters.get(rnd.nextInt(cfg.starters.size()))) : evolution.start()); p.xp = 0; p.health = p.maxHealth(); p.water = 100;
        teleportToBiome(p, p.animal.biome);
        p.protectedUntilTick = tick + 2L * cfg.tickRate;
        players.put(p.id, p);
        return p;
    }
    public void leave(Player p) { players.remove(p.id); p.dead = true; }

    private void teleportToBiome(Player p, String biome) {
        double[] pt = biomes.randomPoint(rnd, List.of(biome));
        p.x = pt[0]; p.y = pt[1];
    }
    public boolean inWater(double x, double y) {
        Defs.BiomeDef b = biomes.biomeAt(x, y);
        if (b != null && b.id.equals("ocean")) return true;
        for (double[] l : lakes) { double dx = x - l[0], dy = y - l[1]; if (dx * dx + dy * dy <= l[2] * l[2]) return true; }
        return false;
    }

    private void setAnimalAndMove(Player p, Animal a) {
        String old = p.animal.biome;
        p.setAnimal(a); p.health = p.maxHealth();
        if (!a.biome.equals(old)) teleportToBiome(p, a.biome); // "become an arctic animal from ANYWHERE, and be teleported" (archived update note)
    }

    /** Server-side evolution. The client only ever requests; XP and edges are validated here. */
    public boolean evolve(Player p, String targetId) {
        if (p.dead || sandbox || !evolution.canEvolve(p.animal, targetId, p.xp)) return false;
        setAnimalAndMove(p, cfg.animals.get(targetId));
        return true;
    }
    /** Sandbox only: step through every animal (wraps around). */
    public boolean sandboxStep(Player p, int dir) {
        if (!sandbox || p.dead || (dir != 1 && dir != -1)) return false;
        int i = Math.max(0, sandboxOrder.indexOf(p.animal)), n = sandboxOrder.size();
        setAnimalAndMove(p, sandboxOrder.get(((i + dir) % n + n) % n));
        return true;
    }
    /** Chat relay to nearby human players (feature-gated, rate limited to 1/s). */
    public void chat(Player p, String text) {
        if (!cfg.feature("chat") || p.dead || text == null || tick - p.lastChatTick < cfg.tickRate) return;
        p.lastChatTick = tick;
        String msg = "{\"t\":\"chat\",\"id\":" + p.id + ",\"m\":" + Data.GSON.toJson(text) + "}";
        for (Player q : players.values()) if (!q.bot && q.sender != null && Math.abs(q.x - p.x) < 1200 && Math.abs(q.y - p.y) < 1200) q.sender.send(msg);
    }

    private void die(Player o, String by, int reason, List<Player> dying) {
        if (o.dead) return;
        o.dead = true; dying.add(o);
        if (!o.bot && o.sender != null) o.sender.send("{\"t\":\"died\",\"xp\":" + (long) o.xp + ",\"by\":" + Data.GSON.toJson(by) + ",\"r\":" + reason + "}");
    }

    public void tick() {
        tick++;
        Runnable r;
        while ((r = inbox.poll()) != null) r.run();
        double dt = 1.0 / cfg.tickRate, now = nowMs();
        List<Player> dying = new ArrayList<>();

        for (Player p : players.values()) {
            if (p.bot) Bot.think(this, p);
            double mag = Math.max(0, Math.min(1, p.inputMag));
            boolean running = p.boost && p.water > 5 && mag > 0.05;
            if (mag > 0.05) {
                p.angle = p.inputAngle;
                double sp = 220 * p.animal.speed * mag * abilities.speedMultiplier(p, (long) now) * (running ? 1.5 : 1);
                double nx = p.x + Math.cos(p.angle) * sp * dt, ny = p.y + Math.sin(p.angle) * sp * dt;
                nx = Math.max(p.radius, Math.min(size - p.radius, nx)); ny = Math.max(p.radius, Math.min(size - p.radius, ny));
                if (biomes.canEnter(p.animal, nx, ny)) { p.x = nx; p.y = ny; }
            }
            if (!p.bot && !sandbox) { // thirst (bots and sandbox are exempt)
                if (inWater(p.x, p.y)) p.water = Math.min(100, p.water + 30 * dt);
                else p.water = Math.max(0, p.water - (0.5 + (running ? 5 : 0)) * dt);
                if (p.water <= 0) { p.health -= 6 * dt; if (p.health <= 0) { die(p, "thirst", THIRST, dying); continue; } }
                else p.health = Math.min(p.maxHealth(), p.health + 2 * dt);
            } else { p.water = 100; p.health = Math.min(p.maxHealth(), p.health + 2 * dt); }
        }

        tree.clear();
        for (Player p : players.values()) if (!p.dead) tree.insert(p);
        for (Food f : foods.foods) tree.insert(f);

        for (Player p : players.values()) {
            if (p.dead) continue;
            tmp.clear();
            tree.query(p.x, p.y, p.radius + 40, tmp);
            for (Entity e : tmp) {
                if (e instanceof Food f) {
                    if (!f.removed && Collision.overlap(p, f)) { foods.consumed(f); p.xp += f.def.xp; p.health = Math.min(p.maxHealth(), p.health + f.def.health); }
                } else if (e instanceof Player o && Collision.canEat(p, o)) {
                    p.xp += 20 * o.animal.tier + o.xp * 0.25; p.kills++;
                    die(o, p.name, EATEN, dying);
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
         .append(",\"n\":").append(players.size())
         .append(",\"you\":{\"id\":").append(me.id).append(",\"x\":").append(r1(me.x)).append(",\"y\":").append(r1(me.y))
         .append(",\"xp\":").append((long) me.xp).append(",\"hp\":").append((int) me.health).append(",\"w\":").append((int) me.water).append(",\"a\":\"").append(me.animal.id).append("\",\"ev\":[");
        List<String> ev = sandbox ? List.of() : evolution.evolvable(me.animal, me.xp);
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
