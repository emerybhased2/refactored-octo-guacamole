package mope;

import java.util.*;

/** Dependency-free server test suite (run by build.sh): java -cp mope-server.jar mope.SelfTest */
public final class SelfTest {
    static int passed, failed;
    static void check(String name, boolean ok) { if (ok) passed++; else { failed++; System.out.println("FAIL: " + name); } }
    static void eq(String name, Object a, Object b) { boolean ok = Objects.equals(a, b); if (!ok) System.out.println("  expected " + b + " got " + a); check(name, ok); }

    public static void main(String[] args) throws Exception {
        VersionManager vm = new VersionManager();
        VersionManager.Config v = vm.get("2017-04-07");
        check("version 2017-04-07 loaded", v != null);

        // Version / progression
        eq("2017 roster", new ArrayList<>(v.animals.keySet()), List.of("mouse", "rabbit", "deer", "fox", "wolf", "bear"));
        EvolutionEngine ev = new EvolutionEngine(v.animals, v.edges);
        eq("start animal", ev.start().id, "mouse");
        Animal rabbit = v.animals.get("rabbit");
        check("mouse->rabbit needs xp", !ev.canEvolve(v.animals.get("mouse"), "rabbit", 59) && ev.canEvolve(v.animals.get("mouse"), "rabbit", 60));
        check("cannot skip tiers", !ev.canEvolve(v.animals.get("mouse"), "bear", 1e9));
        eq("rabbit options", ev.options(rabbit).stream().map(a -> a.id).sorted().toList(), List.of("deer", "fox"));

        // Historical gating: a date before release has no animals
        JsonObjectHolder.testEarlyDate();

        // QuadTree vs brute force
        Random r = new Random(1); QuadTree qt = new QuadTree(0, 0, 1000, 1000); List<Entity> es = new ArrayList<>();
        for (int i = 0; i < 2000; i++) { Entity e = new Entity(); e.x = r.nextDouble() * 1000; e.y = r.nextDouble() * 1000; es.add(e); qt.insert(e); }
        List<Entity> got = new ArrayList<>(); qt.query(500, 500, 120, got);
        long brute = es.stream().filter(e -> Math.abs(e.x - 500) <= 120 && Math.abs(e.y - 500) <= 120).count();
        eq("quadtree matches brute force", (long) got.size(), brute);

        // Biome restriction
        Defs.BiomeDef ocean = new Defs.BiomeDef(); ocean.id = "ocean"; ocean.rect = new double[] { 0.5, 0, 0.5, 1 };
        Defs.BiomeDef land = new Defs.BiomeDef(); land.id = "land"; land.rect = new double[] { 0, 0, 0.5, 1 };
        BiomeEngine be = new BiomeEngine(List.of(land, ocean), 1000);
        check("land animal blocked in ocean", be.canEnter(v.animals.get("mouse"), 100, 100) && !be.canEnter(v.animals.get("mouse"), 900, 100));

        // Ability cooldown
        Defs.AbilityDef dash = new Defs.AbilityDef(); dash.id = "dash"; dash.cooldownMs = 4000; dash.durationMs = 600; dash.speedMultiplier = 2;
        AbilityEngine ab = AbilityEngine.forTest(List.of(dash));
        Player p = new Player(); Animal a = v.animals.get("mouse").copy(); a.ability = "dash"; p.setAnimal(a);
        check("dash activates", ab.activate(p, 1000, null));
        eq("dash speed x2", ab.speedMultiplier(p, 1200), 2.0);
        eq("dash expires", ab.speedMultiplier(p, 1700), 1.0);
        check("dash on cooldown", !ab.activate(p, 4000, null));
        check("dash ready again", ab.activate(p, 5000, null));
        p.setAnimal(v.animals.get("mouse")); check("no ability, no activate", !ab.activate(p, 99999, null));

        // World: movement, food, eating, server-side evolution
        VersionManager.Config quiet = vm.get("2017-04-07");
        World w = new World(quiet, 42);
        Player a1 = w.join("A", null, false); Player a2 = w.join("B", null, false);
        a1.x = 100; a1.y = 100; a1.inputAngle = 0; a1.inputMag = 1; a2.x = 3000; a2.y = 3000;
        for (int i = 0; i < 30; i++) w.tick();
        check("player moved right ~220px/s", a1.x > 250 && a1.x < 360);
        // food consumption
        Food f = new Food(9, quiet.foods.get(0), 0, a2.x, a2.y); w.foods.foods.add(f);
        double xp0 = a2.xp; w.tick();
        check("food eaten gives xp", a2.xp >= xp0 + quiet.foods.get(0).xp && f.removed);
        // evolution validated server side
        a2.xp = 10; check("evolve rejected without xp", !w.evolve(a2, "rabbit"));
        a2.xp = 100; check("evolve accepted", w.evolve(a2, "rabbit") && a2.animal.id.equals("rabbit"));
        check("evolve to non-child rejected", !w.evolve(a2, "bear"));
        // predator/prey
        a1.setAnimal(v.animals.get("wolf")); a1.protectedUntilTick = 0; a1.inputMag = 0; a1.x = 2000; a1.y = 2000;
        a2.x = 2005; a2.y = 2000; a2.protectedUntilTick = 0; a2.xp = 0;
        w.tick();
        check("wolf eats rabbit", a2.dead && a1.kills == 1);

        // Stress: 200+ entities
        VersionManager.Config big = vm.get("2017-04-07");
        World sw = new World(big, 7);
        for (int i = 0; i < 220; i++) sw.join("S" + i, null, true);
        long t0 = System.nanoTime();
        for (int i = 0; i < 300; i++) sw.tick();
        double ms = (System.nanoTime() - t0) / 1e6 / 300;
        System.out.printf("stress: %d players, %d food, %.2f ms/tick%n", sw.players.size(), sw.foods.foods.size(), ms);
        check("stress tick under 33ms", ms < 33);

        // Accounts
        try (AccountManager am = new AccountManager("jdbc:sqlite::memory:")) {
            check("register ok", am.register("alice", "hunter22"));
            check("duplicate rejected", !am.register("ALICE", "other-pass"));
            check("short password rejected", !am.register("bob", "123"));
            check("bad login rejected", am.login("alice", "wrong-pass") == null);
            String tok = am.login("alice", "hunter22");
            check("login returns token", tok != null && tok.length() > 20);
            eq("resume works", am.resume(tok), "alice");
            check("bad token rejected", am.resume("nope") == null);
            am.recordGame("alice", 500, 3); am.recordGame("alice", 200, 1);
            eq("stats best_xp", am.stats("alice")[0], 500L); eq("stats kills", am.stats("alice")[1], 4L);
        }
        System.out.printf("SelfTest: %d passed, %d failed%n", passed, failed);
        System.exit(failed == 0 ? 0 : 1);
    }

    /** Resolving a version dated before any animal's release must yield no animals (no anachronisms). */
    static final class JsonObjectHolder {
        static void testEarlyDate() {
            com.google.gson.JsonObject o = Data.GSON.toJsonTree(VersionManager.class.cast(new VersionManager()).get("2017-04-07").raw).getAsJsonObject();
            o.addProperty("id", "t"); o.addProperty("date", "2017-04-06");
            VersionManager.Config c = VersionManager.resolve(o);
            check("no animals before launch date", c.animals.isEmpty() && c.edges.isEmpty() && c.foods.isEmpty());
        }
    }
}
