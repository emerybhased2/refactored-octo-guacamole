package mope;

import com.google.gson.*;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.*;

/**
 * Discovers versions/&#42;&#42;/version.json and resolves the progression databases (animals, tiers,
 * evolution, xp, stats, food, biomes, abilities) as they existed on each version's date.
 */
public final class VersionManager {
    public static final class Config {
        public String id, label, confidence, menu, upgradeMenu, hud, startAnimal;
        public List<String> modes;
        public LocalDate date;
        public JsonObject features, raw;
        public List<String> biomeIds, foodIds;
        public int tickRate, netRate, bots;
        public double worldSize;
        public Map<String, Animal> animals = new LinkedHashMap<>();
        public List<Defs.Edge> edges = new ArrayList<>();
        public List<Defs.Tier> tiers = new ArrayList<>();
        public List<Defs.FoodDef> foods = new ArrayList<>();
        public List<Defs.BiomeDef> biomes = new ArrayList<>();
        public List<Defs.AbilityDef> abilities = new ArrayList<>();
        public List<String> animalOrder = new ArrayList<>();

        public boolean feature(String k) { return features != null && features.has(k) && features.get(k).getAsBoolean(); }

        /** Payload sent to the client in the welcome message (menus inlined so the client has one source of truth). */
        public JsonObject clientJson() {
            JsonObject o = new JsonObject();
            o.addProperty("id", id); o.addProperty("label", label); o.addProperty("date", date.toString());
            o.addProperty("worldSize", worldSize); o.addProperty("tickRate", tickRate); o.addProperty("netRate", netRate);
            o.add("features", features); o.addProperty("startAnimal", startAnimal);
            o.add("modes", Data.GSON.toJsonTree(modes));
            o.add("animals", Data.GSON.toJsonTree(animalOrder.stream().map(animals::get).collect(Collectors.toList())));
            o.add("edges", Data.GSON.toJsonTree(edges));
            o.add("tiers", Data.GSON.toJsonTree(tiers));
            o.add("foods", Data.GSON.toJsonTree(foods));
            o.add("biomes", Data.GSON.toJsonTree(biomes));
            o.add("upgradeMenu", Data.read(upgradeMenu));
            o.add("hud", Data.read(hud));
            return o;
        }
    }

    private final TreeMap<String, Config> versions = new TreeMap<>();

    public VersionManager() { load(); }

    public void load() {
        versions.clear();
        Path dir = Data.root.resolve("versions");
        try (Stream<Path> s = Files.walk(dir)) {
            for (Path p : s.filter(f -> f.getFileName().toString().equals("version.json")).sorted().collect(Collectors.toList())) {
                JsonObject o = JsonParser.parseString(Files.readString(p)).getAsJsonObject();
                Config c = resolve(o);
                versions.put(c.id, c);
            }
        } catch (IOException e) { throw new IllegalStateException(e); }
        if (versions.isEmpty()) throw new IllegalStateException("No versions found under " + dir);
    }

    public Config get(String id) { return versions.get(id); }
    public Config first() { return versions.firstEntry().getValue(); }
    public Collection<Config> all() { return versions.values(); }

    static Config resolve(JsonObject o) {
        Config c = new Config();
        c.raw = o;
        c.id = o.get("id").getAsString(); c.date = LocalDate.parse(o.get("date").getAsString());
        c.label = o.get("label").getAsString();
        c.confidence = o.has("confidence") ? o.get("confidence").getAsString() : "unknown";
        c.menu = o.get("menu").getAsString(); c.upgradeMenu = o.get("upgradeMenu").getAsString(); c.hud = o.get("hud").getAsString();
        c.features = o.getAsJsonObject("features");
        c.startAnimal = o.get("startAnimal").getAsString(); c.modes = strings(o.getAsJsonArray("modes"));
        c.tickRate = o.get("tickRate").getAsInt(); c.netRate = o.get("netRate").getAsInt();
        c.worldSize = o.get("worldSize").getAsDouble(); c.bots = o.has("bots") ? o.get("bots").getAsInt() : 0;
        c.biomeIds = strings(o.getAsJsonArray("biomes")); c.foodIds = strings(o.getAsJsonArray("foods"));

        for (Animal a : Data.read("data/progression/animals.json", Animal[].class))
            if (Data.active(a.releaseDate, a.removalDate, c.date) && c.biomeIds.contains(a.biome)) c.animals.put(a.id, a);
        // historical xp overrides
        JsonArray xp = Data.read("data/progression/xp-requirements.json").getAsJsonObject().get("entries").getAsJsonArray();
        applyLatest(xp, c.date, (entry) -> entry.getAsJsonObject().get("xp").getAsJsonObject().entrySet().forEach(e -> { Animal a = c.animals.get(e.getKey()); if (a != null) a.xpRequired = e.getValue().getAsDouble(); }));
        // historical stat changes
        JsonObject changes = Data.read("data/progression/animal-statistics.json").getAsJsonObject().get("changes").getAsJsonObject();
        for (Map.Entry<String, JsonElement> e : changes.entrySet()) {
            Animal a = c.animals.get(e.getKey()); if (a == null) continue;
            applyLatest(e.getValue().getAsJsonArray(), c.date, (ch) -> {
                JsonObject co = ch.getAsJsonObject();
                if (co.has("health")) a.health = co.get("health").getAsDouble();
                if (co.has("speed")) a.speed = co.get("speed").getAsDouble();
                if (co.has("size")) a.size = co.get("size").getAsDouble();
                if (co.has("damage")) a.damage = co.get("damage").getAsDouble();
            });
        }
        for (Defs.Edge e : Data.read("data/progression/evolution.json", Defs.Edge[].class))
            if (Data.active(e.releaseDate, e.removalDate, c.date) && c.animals.containsKey(e.from) && c.animals.containsKey(e.to)) c.edges.add(e);
        for (Defs.Tier t : Data.read("data/progression/tiers.json", Defs.Tier[].class)) if (Data.active(t.releaseDate, null, c.date)) c.tiers.add(t);
        for (Defs.FoodDef f : Data.read("data/food/foods.json", Defs.FoodDef[].class))
            if (c.foodIds.contains(f.id) && Data.active(f.releaseDate, f.removalDate, c.date)) c.foods.add(f);
        for (Defs.BiomeDef b : Data.read("data/biomes/biomes.json", Defs.BiomeDef[].class))
            if (c.biomeIds.contains(b.id) && Data.active(b.releaseDate, b.removalDate, c.date)) c.biomes.add(b);
        c.abilities.addAll(Arrays.asList(Data.read("data/abilities/abilities.json", Defs.AbilityDef[].class)));
        c.animalOrder.addAll(c.animals.keySet());
        if (!c.animals.isEmpty() && !c.animals.containsKey(c.startAnimal)) throw new IllegalStateException("startAnimal " + c.startAnimal + " not available in " + c.id);
        return c;
    }

    private static List<String> strings(JsonArray a) { List<String> l = new ArrayList<>(); a.forEach(e -> l.add(e.getAsString())); return l; }

    /** Applies, in order, every entry whose "from" date is <= at (later entries override earlier ones). */
    private static void applyLatest(JsonArray arr, LocalDate at, java.util.function.Consumer<JsonElement> fn) {
        List<JsonElement> es = new ArrayList<>(); arr.forEach(es::add);
        es.sort(Comparator.comparing(e -> e.getAsJsonObject().get("from").getAsString()));
        for (JsonElement e : es) if (!at.isBefore(LocalDate.parse(e.getAsJsonObject().get("from").getAsString()))) fn.accept(e);
    }
}
