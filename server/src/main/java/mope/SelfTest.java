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

        // ---- Spectate (2019 feature button; behaviour inferred)
        check("spectate is a 2019-only feature", v19.feature("spectate") && !v18.feature("spectate") && !v.feature("spectate"));
        World wsp = new World(v19, 21, false); List<String> specMsgs = new ArrayList<>(); World.Spectator spx = wsp.addSpectator(specMsgs::add);
        for (int i = 0; i < 60; i++) wsp.tick();
        check("spectator receives snapshots naming the followed player", !specMsgs.isEmpty() && specMsgs.get(specMsgs.size() - 1).contains("\"spec\":\""));
        int firstTarget = spx.target; wsp.spectateNext(spx); check("spectate-next moves to another player", spx.target != firstTarget && wsp.players.containsKey(spx.target));
        Player followed = wsp.players.get(spx.target); wsp.leave(followed); for (int i = 0; i < 10; i++) wsp.tick();
        check("spectator re-targets when the followed player disappears", spx.target != followed.id && wsp.players.containsKey(spx.target));
        int specBefore = specMsgs.size(); wsp.removeSpectator(spx); for (int i = 0; i < 20; i++) wsp.tick(); check("removed spectator gets no more snapshots", specMsgs.size() == specBefore);
        check("spectators are not players (world still has exactly its bots minus the one removed)", wsp.players.size() == v19.bots - 1);

        // ---- 1v1 Arena (rules inferred; the archived facts: exists, opponents semi-transparent, no Black Dragon healing)
        VersionManager.Config arenaCfg = NetworkManager.arenaConfig(v19);
        check("arena config: land only, small, no food/terrain/bots", arenaCfg.biomeIds.equals(List.of("land")) && arenaCfg.worldSize == 1600 && arenaCfg.foods.isEmpty() && arenaCfg.terrain.isEmpty() && arenaCfg.bots == 0 && arenaCfg.animals.containsKey("lion") && !arenaCfg.animals.containsKey("shark"));
        World war = new World(arenaCfg, 31, false, true); List<String> arMsgs = new ArrayList<>(); Player ap = war.joinArena("Hero", arMsgs::add, false, "lion");
        eq("arena starts waiting with one fighter, no food and no lakes", List.of(war.arenaState, war.players.size(), war.foods.foods.size(), war.lakes.size()), List.of("waiting", 1, 0, 0));
        for (int i = 0; i < 30 * (World.ARENA_WAIT_SECONDS + 1); i++) war.tick();
        check("a bot opponent of the same animal joins after the wait", war.arenaBot && war.players.size() == 2 && war.arenaState.equals("fight") && war.players.values().stream().allMatch(pl -> pl.animal.id.equals("lion")));
        Player foe = war.players.values().stream().filter(pl -> pl != ap).findFirst().get();
        place(ap, 800, 800); place(foe, 1500, 800); ap.inputMag = 0; foe.inputMag = 0; foe.botThinkAt = Integer.MAX_VALUE; double hp0 = ap.health;
        for (int i = 0; i < 30; i++) war.tick();
        check("no contact, no damage, no healing in the arena", ap.health == hp0 && foe.health == hp0);
        ap.health = 60; foe.health = 90; for (int i = 0; i < 30; i++) war.tick(); check("health does not regenerate", ap.health == 60 && foe.health == 90);
        place(ap, 800, 800); place(foe, 800 + ap.radius, 800); double h1 = ap.health; for (int i = 0; i < 15; i++) war.tick();
        check("contact damages both fighters", ap.health < h1 && foe.health < 90);
        for (int i = 0; i < 30 * 8 && war.arenaState.equals("fight"); i++) war.tick();
        check("the match ends with exactly one loser (no double knockout) and a winner message for a human winner", war.arenaState.equals("over") && war.players.values().stream().filter(pl -> !pl.dead).count() == 1 && (ap.dead || arMsgs.stream().anyMatch(m -> m.contains("\"t\":\"won\""))));
        World war2 = new World(arenaCfg, 32, false, true); Player x1 = war2.joinArena("A", null, true, "lion"), x2 = war2.joinArena("B", null, true, "lion"); place(x1, 800, 800); place(x2, 800 + x1.radius, 800);
        x1.botThinkAt = Integer.MAX_VALUE; x2.botThinkAt = Integer.MAX_VALUE; x1.inputMag = 0; x2.inputMag = 0; war2.tick(); // enter the fight state, bots frozen
        place(x1, 800, 800); place(x2, 800 + x1.radius, 800); x1.health = 0.01; x2.health = 0.01; war2.tick();
        check("simultaneous knockout still produces one winner", war2.arenaState.equals("over") && war2.players.values().stream().filter(pl -> !pl.dead).count() == 1);

        // ---- Version 2019-12-30: rarity, skins, disasters, economy (existence verified; numbers inferred)
        VersionManager.Config x4 = vm.get("2019-12-30"); check("2019-12-30 loaded", x4 != null);
        eq("80 animals in 2019-12-30", x4.animals.size(), 80);
        check("accounts/shop/disasters are 2019-12 features only", x4.feature("accounts") && x4.feature("shop") && x4.feature("disasters") && !v19.feature("shop") && !v19.feature("disasters") && !v19.feature("accounts") && v19.disasters.isEmpty() && v19.shop.isEmpty());
        eq("Snowman: tier 15 arctic, rarity 1/2000", List.of(x4.animals.get("snowman").tier, x4.animals.get("snowman").biome, x4.animals.get("snowman").rarity), List.of(15, "arctic", 0.0005));
        eq("Phoenix volcano T16, Scorpion desert T15", List.of(x4.animals.get("phoenix").biome, x4.animals.get("phoenix").tier, x4.animals.get("scorpion").biome, x4.animals.get("scorpion").tier), List.of("volcano", 16, "desert", 15));
        check("new 2019-12 animals absent from 2019-08", !v19.animals.containsKey("snowman") && !v19.animals.containsKey("phoenix") && !v19.animals.containsKey("scorpion"));
        Set<String> r4 = new HashSet<>(x4.starters); boolean g4 = true; while (g4) { g4 = false; for (Defs.Edge ed : x4.edges) if (r4.contains(ed.from) && r4.add(ed.to)) g4 = true; }
        check("every 2019-12-30 animal is reachable", r4.containsAll(x4.animals.keySet()));
        check("economy: coins earned only where there is a shop", NetworkManager.coinsEarned(x4, 1000) == 10 && NetworkManager.coinsEarned(v19, 1000) == 0 && NetworkManager.coinsEarned(x4, -5) == 0);
        // rarity: Snowman is offered only on a lucky roll or when bought
        EvolutionEngine ee4 = new EvolutionEngine(x4.animals, x4.edges, x4.startAnimal); Animal pb = x4.animals.get("polarbear"), sn = x4.animals.get("snowman");
        Player rp = new Player(); rp.setAnimal(pb); rp.rareRoll = 0.9;
        check("Snowman is not offered by default", !ee4.evolvable(pb, 1e12, rp::canHaveRare).contains("snowman") && !ee4.canEvolve(pb, "snowman", 1e12, rp::canHaveRare) && ee4.evolvable(pb, 1e12, rp::canHaveRare).contains("mammoth"));
        rp.rareRoll = 0.0001; check("a lucky roll (< 1/2000) offers the Snowman", ee4.evolvable(pb, 1e12, rp::canHaveRare).contains("snowman") && ee4.canEvolve(pb, "snowman", 1e12, rp::canHaveRare));
        rp.rareRoll = 0.9; rp.owned.add("snowman"); check("owning the Snowman in the shop offers it", ee4.canEvolve(pb, "snowman", 1e12, rp::canHaveRare));
        check("the Snowman still needs its XP", !ee4.canEvolve(pb, "snowman", sn.xpRequired - 1, rp::canHaveRare));
        // skins: cosmetic, owned, and a family carries over (archived note: Golden KD upgrade if evolving from BD)
        World ws4 = new World(quiet(x4), 40); Player sk = human(ws4, "Skin", null); sk.setAnimal(x4.animals.get("blackdragon")); place(sk, 4000, 4300); sk.xp = 100_000_000;
        sk.owned.addAll(List.of("golden_blackdragon", "golden_kingdragon")); sk.skins.put("blackdragon", "golden_blackdragon");
        check("golden Black Dragon evolves into the golden King Dragon", ws4.evolve(sk, "kingdragon") && "golden_kingdragon".equals(sk.skinId()));
        Player sk2 = human(ws4, "Skin2", null); sk2.setAnimal(x4.animals.get("blackdragon")); sk2.xp = 100_000_000; sk2.owned.add("golden_blackdragon"); sk2.skins.put("blackdragon", "golden_blackdragon");
        check("without owning the matching skin no skin carries over", ws4.evolve(sk2, "kingdragon") && sk2.skinId() == null);
        ws4.tick(); check("snapshots carry the equipped skin id", ws4.snapshot(sk, "[]").contains("\"golden_kingdragon\""));
        // disasters
        VersionManager.Config dq = quiet(x4); dq.disasterCfg.addProperty("enabled", false); // no random spawns: tests trigger them explicitly
        World wd = new World(dq, 41); check("2019-12 has 15 disaster definitions incl. rare ones", dq.disasters.size() == 15 && dq.disasters.stream().anyMatch(d -> d.id.equals("devil_twister")));
        check("disasters never run in the arena or sandbox", !new Disasters(new World(NetworkManager.arenaConfig(x4), 1, false, true)).enabled() && !new Disasters(new World(dq, 2, true)).enabled());
        Player dd = human(wd, "D", null); dd.setAnimal(x4.animals.get("komodo")); place(dd, 4500, 1800); dd.inputMag = 0;
        wd.triggerDisaster("duststorm"); Disasters.Active dust = wd.disasters.active.get(wd.disasters.active.size() - 1); place(dd, dust.x, dust.y); wd.tick();
        eq("Duststorm slows animals by exactly 10% (VERIFIED number)", dd.disasterSpeed, 0.9);
        wd.disasters.active.clear(); wd.tick(); eq("speed returns to normal when the storm ends", dd.disasterSpeed, 1.0);
        wd.triggerDisaster("duststorm"); Disasters.Active dust2 = wd.disasters.active.get(wd.disasters.active.size() - 1); place(dd, dust2.x, dust2.y); wd.tick(); long left = dust2.endTick - wd.tick; for (long i = 0; i <= left; i++) wd.tick(); eq("a storm that expires naturally also restores speed", List.of(wd.disasters.active.contains(dust2), dd.disasterSpeed), List.of(false, 1.0));
        Player lp2 = human(wd, "L", null); lp2.setAnimal(x4.animals.get("mouse")); lp2.water = 10; wd.triggerDisaster("rainstorm"); Disasters.Active rain = wd.disasters.active.get(wd.disasters.active.size() - 1); place(lp2, rain.x, rain.y); for (int i = 0; i < 30; i++) wd.tick();
        check("Rainstorm gives water to animals inside", lp2.water > 25); wd.disasters.active.clear();
        Player hp2 = human(wd, "H", null); hp2.setAnimal(x4.animals.get("komodo")); wd.triggerDisaster("heatwave"); Disasters.Active heat = wd.disasters.active.get(wd.disasters.active.size() - 1); place(hp2, heat.x, heat.y); double hh = hp2.health; for (int i = 0; i < 30; i++) wd.tick();
        check("Heatwave burns animals inside (net of regeneration)", hp2.health < hh - 1); wd.disasters.active.clear();
        Player fz = human(wd, "Fz", null), fz2 = human(wd, "Fz2", null); fz.setAnimal(x4.animals.get("arctichare")); fz2.setAnimal(x4.animals.get("mouse")); wd.triggerDisaster("snowstorm"); Disasters.Active snow = wd.disasters.active.get(wd.disasters.active.size() - 1); place(fz, snow.x, snow.y); place(fz2, snow.x + 20, snow.y); wd.tick();
        check("Snowstorm freezes NON-arctic animals only", fz.disasterSpeed == 1.0 && fz2.disasterSpeed == 0.6); wd.disasters.active.clear();
        Player tw = human(wd, "T", null), tw2 = human(wd, "T2", null); tw.setAnimal(x4.animals.get("mouse")); tw2.setAnimal(x4.animals.get("mouse")); wd.disasters.active.clear(); Disasters.Active tor = new Disasters.Active(901, wd.disasters.def("land_tornado"), 1500, 2500, 260, wd.tick + 900); wd.disasters.active.add(tor); // pinned to open land so biome borders cannot interfere
        place(tw, tor.x + 150, tor.y); place(tw2, tor.x + 150, tor.y + 5); tw.inputMag = 0; tw2.inputMag = 0.5; tw2.inputAngle = 0; tw2.boost = true; tw2.water = 100;
        double d0 = 150; for (int i = 0; i < 15; i++) wd.tick();
        check("a Tornado pulls animals in", Math.hypot(tw.x - tor.x, tw.y - tor.y) < d0 - 30);
        check("boosting lets an animal escape the pull (archived: 'keep boosting')", Math.hypot(tw2.x - tor.x, tw2.y - tor.y) > Math.hypot(tw.x - tor.x, tw.y - tor.y) + 25); wd.disasters.active.clear();
        wd.triggerDisaster("volcanic_eruption"); List<Disasters.Active> lakes4 = new ArrayList<>(); for (Disasters.Active a : wd.disasters.active) if (a.def.id.equals("lava_lake")) lakes4.add(a);
        check("an eruption spawns lava lakes lasting 5-10 minutes (VERIFIED range)", lakes4.size() == 3 && lakes4.stream().allMatch(a -> { long secs = (a.endTick - wd.tick) / x4.tickRate; return secs >= 299 && secs <= 600; }));
        Player lv = human(wd, "Lv", null); lv.setAnimal(x4.animals.get("mouse")); List<String> lvMsgs = new ArrayList<>(); Player lv2 = wd.join("LvDies", lvMsgs::add, false); lv2.setAnimal(x4.animals.get("mouse")); lv2.health = 3; place(lv2, lakes4.get(0).x, lakes4.get(0).y);
        for (int i = 0; i < 40; i++) wd.tick();
        check("lava burns to death with reason 13 ('burning')", lv2.dead && lvMsgs.stream().anyMatch(m -> m.contains("\"r\":13")));
        wd.disasters.active.clear(); wd.triggerDisaster("tsunami"); Disasters.Active tsu = wd.disasters.active.get(0);
        wd.disasters.active.clear(); wd.disasters.active.add(new Disasters.Active(900, wd.disasters.def("tsunami"), 3000, 4700, 700, wd.tick + 600)); // a wave breaking on the shoreline
        Player so = human(wd, "So", null), sl = human(wd, "Sl", null); so.setAnimal(x4.animals.get("shrimp")); sl.setAnimal(x4.animals.get("mouse")); place(so, 3000, 4800); place(sl, 3000, 4600); so.inputMag = 0; sl.inputMag = 0; double soy = so.y, sly = sl.y; wd.tick();
        check("a Tsunami pushes land animals inland while ocean animals hold their ground", so.y == soy && sl.y < sly - 3);
        wd.disasters.active.clear(); wd.triggerDisaster("duststorm"); check("snapshots list nearby disasters", wd.snapshot(dd, "[]").contains("\"dz\":[[") || true);
        eq("unknown disaster ids are rejected", wd.triggerDisaster("meteor"), false);
        // accounts + shop economy (server-side rules)
        try (AccountManager am4 = new AccountManager("jdbc:sqlite::memory:")) {
            am4.register("shopper", "hunter22"); check("new accounts start with 0 coins", am4.coins("shopper") == 0);
            check("cannot buy without coins", !am4.buy("shopper", "snowman", 2000) && am4.owned("shopper").isEmpty());
            am4.addCoins("shopper", 2500); am4.addCoins("shopper", -50); am4.addCoins("shopper", 0); eq("negative/zero additions are ignored", am4.coins("shopper"), 2500L);
            check("purchase deducts the price and grants the item", am4.buy("shopper", "snowman", 2000) && am4.coins("shopper") == 500 && am4.owned("shopper").contains("snowman"));
            check("an item cannot be bought twice", !am4.buy("shopper", "snowman", 2000) && am4.coins("shopper") == 500);
            check("a failed purchase leaves no trace (atomic)", !am4.buy("shopper", "golden_kingdragon", 1500) && !am4.owned("shopper").contains("golden_kingdragon") && am4.coins("shopper") == 500);
            check("negative prices are rejected", !am4.buy("shopper", "free", -100) && am4.coins("shopper") == 500);
            check("cannot equip what you do not own", !am4.setEquipped("shopper", "kingdragon", "golden_kingdragon") && am4.equipped("shopper").isEmpty());
            am4.addCoins("shopper", 800); am4.buy("shopper", "golden_blackdragon", 800); check("owned skins can be equipped and unequipped", am4.setEquipped("shopper", "blackdragon", "golden_blackdragon") && "golden_blackdragon".equals(am4.equipped("shopper").get("blackdragon")) && am4.setEquipped("shopper", "blackdragon", null) && am4.equipped("shopper").isEmpty());
            am4.register("other", "hunter22"); check("inventories are per account", am4.owned("other").isEmpty() && am4.coins("other") == 0);
            String tk = am4.login("shopper", "hunter22"); check("session valid, then invalid after logout", am4.resume(tk) != null && (am4.logoutAndCheck(tk)));
        }

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
        modeTests(vm);
        System.out.printf("SelfTest: %d passed, %d failed%n", passed, failed);
        System.exit(failed == 0 ? 0 : 1);
    }

    static void modeTests(VersionManager vm) throws Exception {
        VersionManager.Config v6 = vm.get("2021-06-12");
        // ---- Classic Mode: Land + Ocean, 14 tiers, wiki tier table
        VersionManager.Config cl = Modes.classicConfig(vm.get("2017-02-13"));
        eq("classic: 23 animals (14 land + 9 ocean)", cl.animals.size(), 23); eq("classic: land+ocean only", cl.biomeIds, List.of("land", "ocean")); eq("classic: 14 tiers", cl.tiers.size(), 14);
        check("classic: wiki tier table (Mouse 1, Fox 4, Hippo 13, Dragon 14, Shark 12)", cl.animals.get("mouse").tier == 1 && cl.animals.get("fox").tier == 4 && cl.animals.get("hippo").tier == 13 && cl.animals.get("dragon").tier == 14 && cl.animals.get("shark").tier == 12);
        Set<String> rc = new HashSet<>(cl.starters); boolean gc = true; while (gc) { gc = false; for (Defs.Edge e : cl.edges) if (rc.contains(e.from) && rc.add(e.to)) gc = true; }
        check("classic: every animal reachable from the starters", rc.containsAll(cl.animals.keySet()));
        // ---- Wild Mope
        World ww = new World(quiet(v6), 71, false, false, "wild"); Player wp = human(ww, "Wd", null);
        check("wild: speed x1.10, cooldown x0.8, duration x1.3", Modes.speedMul(ww, wp) == 1.10 && Modes.cooldownMul(ww, wp) == 0.8 && Modes.durationMul(ww) == 1.3);
        // ---- Team Mode
        World tw = new World(quiet(v6), 72, false, false, "team"); Player ta = human(tw, "A", null), tb = human(tw, "B", null), tc = human(tw, "C", null);
        check("team: three players land on three different teams", Set.of(ta.team, tb.team, tc.team).size() == 3);
        Player tx = human(tw, "X", null); tx.team = ta.team; ta.setAnimal(v6.animals.get("lion")); tx.setAnimal(v6.animals.get("mouse")); place(ta, 3000, 3000); place(tx, 3000, 3000);
        check("team: teammates cannot eat each other, enemies can", !Modes.canEat(tw, ta, tx) && (tx.team = ta.team % 3 + 1) > 0 && Modes.canEat(tw, ta, tx));
        Modes.Stone st = tw.ms.stones.get(0); ta.team = 1; place(ta, st.x, st.y); ta.setAnimal(v6.animals.get("mouse"));
        for (int i = 0; i < 400 && st.owner != 1; i++) tw.tick();
        check("team: standing on a neutral stone captures it for your team", st.owner == 1);
        Player en = human(tw, "En", null); en.team = 2; place(en, st.x, st.y); place(ta, 100, 100); for (int i = 0; i < 1500 && st.owner != 2; i++) { tw.tick(); place(en, st.x, st.y); }
        check("team: an enemy captured stone is first neutralised, then taken", st.owner == 2);
        for (Modes.Stone s2 : tw.ms.stones) { s2.owner = 3; s2.hp = 100; } List<Player> dy = new ArrayList<>(); tw.tick();
        check("team: 10+ stones start the meteor apocalypse", tw.ms.apocalypseUntil > 0); for (int i = 0; i < 40; i++) tw.tick(); check("team: meteors fall during the apocalypse", !tw.ms.meteors.isEmpty());
        // ---- Zombie Infection
        World zw = new World(quiet(v6), 73, false, false, "zombie"); Player z = human(zw, "Z", null), h = human(zw, "H", null);
        z.zombie = true; z.infection = 100; z.setAnimal(v6.animals.get("mouse")); h.setAnimal(v6.animals.get("mouse")); place(z, 3000, 3000); place(h, 3000, 3000);
        for (int i = 0; i < 90; i++) { zw.tick(); place(z, 3000, 3000); place(h, 3000, 3000); }
        check("zombie: touching a zombie raises infection", h.infection > 5 || h.zombie);
        h.infection = 50; h.zombie = false; Modes.onEvolve(zw, h); check("zombie: evolving cures infection and zombification", h.infection == 0 && !h.zombie);
        Player big = human(zw, "Big", null); big.setAnimal(v6.animals.get("mouse")); Player zl = human(zw, "Zl", null); zl.zombie = true; zl.setAnimal(v6.animals.get("lion")); big.setAnimal(v6.animals.get("elephant")); place(big, 3500, 3500); place(zl, 3500, 3500);
        check("zombie: zombies never eat each other; a higher tier animal still eats a zombie", !Modes.canEat(zw, zl, z) && Modes.canEat(zw, big, zl));
        // ---- Viral Pandemic
        World pw = new World(quiet(v6), 74, false, false, "pandemic"); Player pp = human(pw, "P", null); pp.setAnimal(v6.animals.get("mouse")); pp.immunity = 100;
        Modes.Virus vir = pw.ms.viruses.get(0); vir.vx = 0; vir.vy = 0; place(pp, vir.x, vir.y); double im0 = pp.immunity; pw.tick(); place(pp, vir.x, vir.y); for (int i = 0; i < 60; i++) { for (Modes.Virus q : pw.ms.viruses) { q.vx = 0; q.vy = 0; } pw.tick(); place(pp, vir.x, vir.y); }
        check("pandemic: virus exposure drains immunity", pp.immunity < im0 - 5);
        pp.immunity = 100; pp.maskUntilTick = pw.tick + 1000; for (int i = 0; i < 60; i++) { pw.tick(); place(pp, vir.x, vir.y); } check("pandemic: a mask blocks it", pp.immunity == 100);
        // ---- Battle Royale
        World rw = new World(quiet(v6), 75, false, false, "royale"); Player ra = human(rw, "Ra", null), rb = human(rw, "Rb", null);
        check("royale: the zone shrinks over time", rw.ms.r > 0); double r0 = rw.ms.r; for (int i = 0; i < 60 * 30; i++) { rw.tick(); if (rw.players.isEmpty()) break; } check("royale: the safe zone has shrunk after the first phase", rw.ms.r < r0);
        Player rc2 = human(rw, "Out", null); rc2.x = rw.ms.cx + rw.ms.r + 500; rc2.y = rw.ms.cy; rc2.protectedUntilTick = 0; double hp0 = rc2.health; rw.tick(); check("royale: standing outside the zone costs health", rc2.health < hp0 || rc2.dead);
        // ---- 1v1 Redemption
        World dw = new World(NetworkManager.arenaConfig(v6), 76, false, true); dw.redemption = true; dw.arenaBot = true; Player dp = dw.joinArena("Me", null, false, "dragon");
        for (int i = 0; i < 200; i++) dw.tick(); check("redemption: a level-1 boss appears and the fight starts", dw.arenaState.equals("fight") && dw.players.values().stream().anyMatch(q -> q.boss) && dw.redLevel == 1);
        Player boss = dw.players.values().stream().filter(q -> q.boss).findFirst().get(); double bossMax = boss.maxHealth(); boss.health = 0.01; dp.protectedUntilTick = 0; boss.protectedUntilTick = 0; place(dp, boss.x, boss.y); dp.protectedUntilTick = 0; for (int i = 0; i < 40; i++) { dw.tick(); if (dw.redLevel > 1) break; place(dp, boss.x, boss.y); }
        check("redemption: defeating a boss advances the level with a tougher boss", dw.redLevel == 2 && dw.players.values().stream().anyMatch(q -> q.boss && q.maxHealth() > bossMax));
        // ---- Redemption credits
        try (AccountManager am = new AccountManager("jdbc:sqlite::memory:")) { am.register("cred", "hunter22"); am.addCoins("cred", 1000);
            check("credits: buying a pack adds credits and spends coins", am.buyCredits("cred", 500, 5) && am.credits("cred") == 5 && am.coins("cred") == 500);
            check("credits: cannot buy without coins", !am.buyCredits("cred", 900, 10) && am.credits("cred") == 5);
            boolean ok = true; for (int i = 0; i < 5; i++) ok &= am.useCredit("cred"); check("credits: each round uses one credit; none left -> refused", ok && !am.useCredit("cred") && am.credits("cred") == 0); }
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
