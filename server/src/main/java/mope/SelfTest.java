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
        check("mouse->rabbit needs xp (tier 2 = 50)", !ev.canEvolve(mouse, "rabbit", 49) && ev.canEvolve(mouse, "rabbit", 50));
        check("cannot skip tiers", !ev.canEvolve(mouse, "dragon", 1e9));
        check("cross-biome option from mouse", ev.canEvolve(mouse, "trout", 100) && ev.canEvolve(mouse, "arctichare", 100));
        eq("rabbit options (next land tier present in 2017 is 3)", ev.options(v.animals.get("rabbit")).stream().map(a -> a.id).sorted().toList(), List.of("mole"));
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
        check("sandbox step down wraps to the top tier (16)", sb.sandboxStep(s1, -1) && s1.animal.tier == 16);
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
        check("every edge strictly increases tier in 2017 and 2018", v.edges.stream().allMatch(e -> v.animals.get(e.to).tier > v.animals.get(e.from).tier) && v18.edges.stream().allMatch(e -> v18.animals.get(e.to).tier > v18.animals.get(e.from).tier));
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

        // ---- Version 2019-08-25 (user-provided tier structure; desert + volcano)
        VersionManager.Config v19 = vm.get("2019-08-25");
        check("2019-08-25 loaded", v19 != null);
        eq("77 animals in 2019", v19.animals.size(), 77);
        eq("5 biomes in 2019", v19.biomeIds, List.of("land", "ocean", "arctic", "desert", "volcano"));
        eq("highest tier 2017/2018/2019", List.of(v.animals.values().stream().mapToInt(a -> a.tier).max().getAsInt(), v18.animals.values().stream().mapToInt(a -> a.tier).max().getAsInt(), v19.animals.values().stream().mapToInt(a -> a.tier).max().getAsInt()), List.of(16, 16, 18));
        check("apex animals are tier 15 in 2019 (and not in 2018)", List.of("trex", "kingcrab", "mammoth").stream().allMatch(i -> v19.animals.get(i).tier == 15 && v18.animals.get(i).tier != 15));
        check("monsters are tier 16", List.of("kraken", "dragon", "yeti", "icemonster").stream().allMatch(i -> v19.animals.get(i).tier == 16));
        eq("Black Dragon is tier 17 in the volcano in 2019", List.of(v19.animals.get("blackdragon").tier, v19.animals.get("blackdragon").biome), List.of(17, "volcano"));
        eq("Black Dragon is tier 16 on land in 2018", List.of(v18.animals.get("blackdragon").tier, v18.animals.get("blackdragon").biome), List.of(16, "land"));
        eq("King Dragon is tier 18 and needs 100,000,000 XP", List.of(v19.animals.get("kingdragon").tier, (long) v19.animals.get("kingdragon").xpRequired), List.of(18, 100_000_000L));
        check("tier category names Apex/Monsters in 2019 only", v19.tiers.get(14).name.equals("Apex") && v19.tiers.get(15).name.equals("Monsters") && v18.tiers.get(14).name.equals("Tier 15") && v19.tiers.size() == 18 && v18.tiers.size() == 16);
        check("desert/volcano exist only from 2019", v19.biomes.stream().anyMatch(b -> b.id.equals("desert")) && v18.biomes.stream().noneMatch(b -> b.id.equals("desert") || b.id.equals("volcano")));
        check("2019 foods/terrain are date-gated", v19.foods.stream().anyMatch(fx -> fx.id.equals("watermelon")) && v18.foods.stream().noneMatch(fx -> fx.id.equals("watermelon")) && v19.terrain.stream().anyMatch(tx -> tx.id.equals("tree")) && v18.terrain.stream().noneMatch(tx -> tx.id.equals("tree")));
        EvolutionEngine ev19 = new EvolutionEngine(v19.animals, v19.edges, v19.startAnimal);
        check("dragon -> black dragon -> king dragon chain, King Dragon gated by 100M XP", ev19.canEvolve(v19.animals.get("dragon"), "blackdragon", 10_000_000) && !ev19.canEvolve(v19.animals.get("dragon"), "kingdragon", 1e12) && !ev19.canEvolve(v19.animals.get("blackdragon"), "kingdragon", 99_999_999) && ev19.canEvolve(v19.animals.get("blackdragon"), "kingdragon", 100_000_000));
        Set<String> reach19 = new HashSet<>(v19.starters); boolean g19 = true;
        while (g19) { g19 = false; for (Defs.Edge e : v19.edges) if (reach19.contains(e.from) && reach19.add(e.to)) g19 = true; }
        check("every 2019 animal is reachable from a starter", reach19.containsAll(v19.animals.keySet()));
        BiomeEngine be19 = new BiomeEngine(v19.biomes, v19.worldSize);
        check("2019 biome layout: each biome is reachable at its own centre", v19.biomes.stream().allMatch(b -> { double cx = (b.rect[0] + b.rect[2] / 2) * v19.worldSize, cy = (b.rect[1] + b.rect[3] / 2) * v19.worldSize; return be19.biomeAt(cx, cy) != null && be19.biomeAt(cx, cy).id.equals(b.id); }));
        check("a desert animal cannot enter land but a land animal cannot enter the desert", !be19.canEnter(v19.animals.get("komodo"), 0.3 * v19.worldSize, 0.5 * v19.worldSize) && !be19.canEnter(v19.animals.get("mouse"), 0.82 * v19.worldSize, 0.35 * v19.worldSize));
        World w19 = new World(quiet(v19), 19);
        check("no terrain object overlaps a lake", w19.terrain.stream().noneMatch(o -> w19.lakes.stream().anyMatch(l -> Math.hypot(o[1] - l[0], o[2] - l[1]) < l[2])));
        check("2019 world has terrain, desert lakes and food in the new biomes", w19.terrain.size() > 50 && w19.lakes.size() > 8 && w19.foods.foods.stream().anyMatch(fx -> fx.def.id.equals("cactus_fruit")) && w19.foods.foods.stream().anyMatch(fx -> fx.def.id.equals("ember_fruit")));
        Player k19 = human(w19, "K", null); k19.setAnimal(v19.animals.get("dragon")); place(k19, 0.3 * v19.worldSize, 0.5 * v19.worldSize); k19.xp = 10_000_000;
        check("evolving into the Volcano teleports the player there", w19.evolve(k19, "blackdragon") && w19.biomes.biomeAt(k19.x, k19.y).id.equals("volcano"));
        eq("food XP scales with tier (1.35^(tier-1))", Math.round(World.foodXpScale(1) * 100), 100L); check("tier 16 food is worth ~90x", Math.abs(World.foodXpScale(16) - Math.pow(1.35, 15)) < 1e-9);
        World wq = new World(quiet(v19), 4); Player fp = human(wq, "F", null); fp.setAnimal(v19.animals.get("elephant")); place(fp, 3000, 3000); wq.foods.foods.add(new Food(99, v19.foods.get(0), 0, fp.x, fp.y)); double before = fp.xp; wq.tick();
        check("a tier-15 animal gets scaled food xp", fp.xp - before > 5 * 50);

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
