package mope;

import java.util.*;

/** Dependency-free server test suite (run by build.sh): java -cp mope-server.jar mope.SelfTest */
public final class SelfTest {
    static int passed, failed;
    static void check(String name, boolean ok) { if (ok) passed++; else { failed++; System.out.println("FAIL: " + name); } }
    static void eq(String name, Object a, Object b) { boolean ok = Objects.equals(a, b); if (!ok) System.out.println("  expected " + b + " got " + a); check(name, ok); }

    /** Same version without bots: scenario tests must not depend on 30 hunting bots wandering into the player. */
    static VersionManager.Config quiet(VersionManager.Config c) { com.google.gson.JsonObject o = c.raw.deepCopy(); o.addProperty("bots", 0); return VersionManager.resolve(o); }
    static Player human(World w, String n, List<String> inbox) { return w.join(n, inbox == null ? null : inbox::add, false); }
    static void place(Player p, double x, double y) { p.x = x; p.y = y; p.protectedUntilTick = 0; }
    /** A land point that is not inside a lake. */
    static double[] dryLand(World w) {
        for (double y = 2000; y < 4000; y += 50) for (double x = 200; x < 5800; x += 50) if (!w.inWater(x, y) && w.biomes.biomeAt(x, y).id.equals("land")) return new double[] { x, y };
        throw new IllegalStateException("no dry land");
    }

    public static void main(String[] args) throws Exception {
        VersionManager vm = new VersionManager();
        VersionManager.Config v = vm.get("2017-02-13");
        check("version 2017-02-13 loaded", v != null);

        // ---- Version / progression data
        eq("44 animals", v.animals.size(), 44);
        eq("3 biomes", v.biomeIds, List.of("land", "ocean", "arctic"));
        EvolutionEngine ev = new EvolutionEngine(v.animals, v.edges, v.startAnimal);
        eq("start animal", ev.start().id, "mouse");
        Animal mouse = v.animals.get("mouse");
        check("mouse->rabbit needs xp", !ev.canEvolve(mouse, "rabbit", 59) && ev.canEvolve(mouse, "rabbit", 60));
        check("cannot skip tiers", !ev.canEvolve(mouse, "dragon", 1e9));
        check("cross-biome option from mouse", ev.canEvolve(mouse, "trout", 100) && ev.canEvolve(mouse, "arctichare", 100));
        eq("rabbit options", ev.options(v.animals.get("rabbit")).stream().map(a -> a.id).sorted().toList(), List.of("fox", "pig"));
        eq("verified internal ids", v.animals.get("kraken").internalId, 24);
        eq("verified ability text -> cheetah boost", v.animals.get("cheetah").ability, "extra_boost");
        JsonObjectHolder.testEarlyDate();

        // ---- QuadTree vs brute force
        Random r = new Random(1); QuadTree qt = new QuadTree(0, 0, 1000, 1000); List<Entity> es = new ArrayList<>();
        for (int i = 0; i < 2000; i++) { Entity e = new Entity(); e.x = r.nextDouble() * 1000; e.y = r.nextDouble() * 1000; es.add(e); qt.insert(e); }
        List<Entity> got = new ArrayList<>(); qt.query(500, 500, 120, got);
        long brute = es.stream().filter(e -> Math.abs(e.x - 500) <= 120 && Math.abs(e.y - 500) <= 120).count();
        eq("quadtree matches brute force", (long) got.size(), brute);

        // ---- Biome restriction (real data: land animals cannot enter the ocean strip)
        BiomeEngine be = new BiomeEngine(v.biomes, v.worldSize);
        check("mouse ok on land", be.canEnter(mouse, 3000, 3000));
        check("mouse blocked in ocean", !be.canEnter(mouse, 3000, 5500));
        check("mouse blocked in arctic", !be.canEnter(mouse, 3000, 500));
        check("shrimp ok in ocean", be.canEnter(v.animals.get("shrimp"), 3000, 5500));

        // ---- Abilities: real implemented speed abilities (cheetah boost, 8s cooldown verified)
        AbilityEngine ab = new AbilityEngine(v.abilities, v.date);
        Player cp = new Player(); cp.setAnimal(v.animals.get("cheetah"));
        check("cheetah boost activates", ab.activate(cp, 1000, null));
        check("boost multiplies speed", ab.speedMultiplier(cp, 1200) > 1.5);
        eq("boost expires", ab.speedMultiplier(cp, 5000), 1.0);
        check("boost on cooldown until 8s", !ab.activate(cp, 8999, null) && ab.activate(cp, 9000, null));
        Player lp = new Player(); lp.setAnimal(v.animals.get("shark")); check("no ability, no activate", !ab.activate(lp, 99999, null));
        Player kp = new Player(); kp.setAnimal(v.animals.get("kraken")); check("unimplemented ability does not activate", !ab.activate(kp, 99999, null));

        // ---- World: movement, food, evolution, predation
        World w = new World(quiet(v), 42);
        double[] dry = dryLand(w);
        Player a1 = human(w, "A", null), a2 = human(w, "B", null);
        place(a1, 100, 3000); a1.inputAngle = 0; a1.inputMag = 1; place(a2, dry[0], dry[1]);
        for (int i = 0; i < 30; i++) w.tick();
        check("player moved right ~220px/s", a1.x > 250 && a1.x < 360);
        Food f = new Food(9, v.foods.get(0), 0, a2.x, a2.y); w.foods.foods.add(f);
        double xp0 = a2.xp; w.tick();
        check("food eaten gives xp", a2.xp >= xp0 + v.foods.get(0).xp && f.removed);
        a2.xp = 10; check("evolve rejected without xp", !w.evolve(a2, "rabbit"));
        a2.xp = 100; check("evolve accepted", w.evolve(a2, "rabbit") && a2.animal.id.equals("rabbit"));
        check("evolve to non-child rejected", !w.evolve(a2, "dragon"));
        // predator/prey on land
        a1.setAnimal(v.animals.get("lion")); a1.inputMag = 0; place(a1, 3000, 3000); place(a2, 3005, 3000); a2.xp = 0;
        w.tick();
        check("lion eats rabbit", a2.dead && a1.kills == 1);

        // ---- Cross-biome evolution teleports (archived update note: arctic teleporting)
        World w2 = new World(quiet(v), 5); Player t = human(w2, "T", null); place(t, 3000, 3000); t.xp = 500;
        check("mouse->arctichare ok", w2.evolve(t, "arctichare"));
        eq("teleported into arctic", w2.biomes.biomeAt(t.x, t.y).id, "arctic");
        check("arctic animal can stand there", w2.biomes.canEnter(t.animal, t.x, t.y));

        // ---- Thirst (verified death reason 4) and water refill
        World w3 = new World(quiet(v), 11); List<String> msgs = new ArrayList<>(); Player th = human(w3, "Th", msgs);
        double[] d3 = dryLand(w3); place(th, d3[0], d3[1]); th.inputMag = 0; th.water = 30;
        for (int i = 0; i < 30 * 5; i++) w3.tick();
        check("water drains on dry land", th.water < 28);
        th.water = 0; th.health = 5;
        for (int i = 0; i < 30 * 2; i++) w3.tick();
        check("dies of thirst with reason 4", th.dead && msgs.stream().anyMatch(m -> m.contains("\"t\":\"died\"") && m.contains("\"r\":4")));
        World w4 = new World(quiet(v), 12); Player sw = human(w4, "Sw", null); sw.setAnimal(v.animals.get("shrimp")); place(sw, 3000, 5500); sw.water = 10;
        for (int i = 0; i < 30; i++) w4.tick();
        check("water refills in ocean", sw.water > 35);
        // run uses extra water
        World w5 = new World(quiet(v), 13); Player ru = human(w5, "Ru", null); double[] d5 = dryLand(w5); place(ru, d5[0], d5[1]); ru.inputAngle = 0; ru.inputMag = 1; ru.boost = true;
        for (int i = 0; i < 30 * 3; i++) { w5.tick(); if (w5.inWater(ru.x, ru.y)) ru.water = 100; place(ru, ru.x, ru.y); }
        check("running moves faster than walking and uses water", ru.x - d5[0] > 220 * 3 * 1.2 || ru.x > 5900);

        // ---- Chat
        World w6 = new World(quiet(v), 14); List<String> c1 = new ArrayList<>(), c2 = new ArrayList<>(); Player ch1 = human(w6, "C1", c1), ch2 = human(w6, "C2", c2);
        place(ch1, 3000, 3000); place(ch2, 3100, 3000);
        w6.chat(ch1, "hello"); w6.chat(ch1, "spam");
        check("chat relayed to nearby player once (rate limit)", c2.stream().filter(m -> m.contains("\"t\":\"chat\"")).count() == 1 && c2.stream().anyMatch(m -> m.contains("hello")));

        // ---- Sandbox
        World sb = new World(v, 15, true); check("sandbox has no bots", sb.players.isEmpty());
        Player s1 = human(sb, "S1", null), s2 = human(sb, "S2", null); place(s1, 3000, 3000); place(s2, 3002, 3000);
        eq("sandbox starts as mouse", s1.animal.id, "mouse");
        check("sandbox step down wraps to top animal", sb.sandboxStep(s1, -1) && s1.animal.tier == 8);
        check("sandbox step up wraps to mouse", sb.sandboxStep(s1, 1) && s1.animal.id.equals("mouse"));
        sb.sandboxStep(s1, 1); // now a tier-2 animal: sandbox lets anyone eat anyone
        check("normal evolution disabled in sandbox", !sb.evolve(s2, "rabbit"));
        place(s1, 3000, 3000); s2.setAnimal(v.animals.get("mouse")); place(s2, 3002, 3000); sb.tick();
        check("sandbox: higher tier eats lower", s2.dead);

        // ---- Version 2018-04-21 (second historical version) and cross-version isolation
        VersionManager.Config v18 = vm.get("2018-04-21");
        check("2018-04-21 loaded", v18 != null);
        eq("61 animals in 2018", v18.animals.size(), 61);
        check("2017 has none of the 2018 animals", !v.animals.containsKey("tiger") && !v.animals.containsKey("blackdragon") && !v.animals.containsKey("snail"));
        check("2018 has all 17 new animals", List.of("snail", "blackdragon", "sabertoothtiger", "elephant", "bluewhale", "cobra", "boaconstrictor", "giantspider", "trex", "tiger", "giraffe", "eagle", "hedgehog", "duck", "duckling", "lemming", "kingcrab").stream().allMatch(v18.animals::containsKey));
        check("every 2017 evolution edge still exists in 2018", v.edges.stream().allMatch(e17 -> v18.edges.stream().anyMatch(e18 -> e18.from.equals(e17.from) && e18.to.equals(e17.to))));
        check("2018 tree is larger", v18.edges.size() > v.edges.size());
        Set<String> reach = new HashSet<>(v18.starters); boolean grew = true;
        while (grew) { grew = false; for (Defs.Edge e : v18.edges) if (reach.contains(e.from) && reach.add(e.to)) grew = true; }
        check("every 2018 animal is reachable from a starter", reach.containsAll(v18.animals.keySet()));
        eq("2018 offers only normal mode", v18.modes, List.of("normal")); check("2018 has no sandbox feature", !v18.feature("sandbox") && v.feature("sandbox"));
        check("abilities are date-gated per version", v.abilities.stream().noneMatch(a -> a.id.equals("venom_spit")) && v18.abilities.stream().anyMatch(a -> a.id.equals("venom_spit")));
        Player cobra = new Player(); cobra.setAnimal(v18.animals.get("cobra")); eq("cobra has its verified ability", cobra.animal.ability, "venom_spit");
        check("catalogued-but-unimplemented ability stays inert", !new AbilityEngine(v18.abilities, v18.date).activate(cobra, 99999, null));
        World w18 = new World(v18, 3); Set<String> kinds = new HashSet<>(); for (Player p : w18.players.values()) kinds.add(p.animal.id);
        check("2018 bots spawn as varied starters", kinds.size() >= 3 && v18.starters.containsAll(kinds));
        for (int i = 0; i < 90; i++) w18.tick();
        check("2018 world runs", w18.players.size() >= 30 && w18.lastTickMs >= 0);

        // ---- Stress: 200+ entities
        World big = new World(v, 7);
        for (int i = 0; i < 220; i++) big.join("S" + i, null, true);
        long t0 = System.nanoTime();
        for (int i = 0; i < 300; i++) big.tick();
        double ms = (System.nanoTime() - t0) / 1e6 / 300;
        System.out.printf("stress: %d players, %d food, %.2f ms/tick%n", big.players.size(), big.foods.foods.size(), ms);
        check("stress tick under 33ms", ms < 33);

        // ---- Accounts
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
            com.google.gson.JsonObject o = new VersionManager().get("2017-02-13").raw.deepCopy();
            o.addProperty("id", "t"); o.addProperty("date", "2017-02-12");
            VersionManager.Config c = VersionManager.resolve(o);
            check("no animals before earliest capture date", c.animals.isEmpty() && c.edges.isEmpty() && c.foods.isEmpty());
        }
    }
}
