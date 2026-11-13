package mope;

import com.google.gson.*;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

/** WebSocket front end (JSON text frames). Parses messages and hands them to the owning World's tick thread. */
public final class NetworkManager extends WebSocketServer {
    private static final int MAX_MSG = 2048;

    private static final class Session { World world; Player player; World.Spectator spec; String account; }

    private final VersionManager versions;
    private final AccountManager accounts;
    private final Map<String, World> worlds = new ConcurrentHashMap<>();
    private final Map<WebSocket, Session> sessions = new ConcurrentHashMap<>();
    private final java.util.List<World> arenas = new java.util.ArrayList<>();
    private World waitingArena;
    private final long seed;
    private static final boolean DEV = "1".equals(System.getenv("MOPE_DEV")); // enables dev-only messages (dev-coins, dev-disaster); never for ordinary servers

    public NetworkManager(int port, VersionManager versions, AccountManager accounts, long seed) {
        super(new InetSocketAddress(port));
        this.versions = versions; this.accounts = accounts; this.seed = seed;
        setReuseAddr(true);
    }

    public World world(String versionId, boolean sandbox) { return world(versionId, sandbox ? "sandbox" : "normal"); }
    private VersionManager.Config classicCfg;
    /** Classic Mode: the 2017 build restricted to Land + Ocean, 14 tiers (data/modes/classic.json). */
    synchronized VersionManager.Config classicConfig() { if (classicCfg == null) classicCfg = Modes.classicConfig(versions.get("2017-02-13")); return classicCfg; }
    /** Shared world per (version, mode): normal, sandbox, classic, zombie, royale, team, wild, pandemic. */
    public World world(String versionId, String mode) {
        final String md = mode == null ? "normal" : mode;
        return worlds.computeIfAbsent(versionId + (md.equals("normal") ? "" : "|" + md), key -> {
            World w = new World(md.equals("classic") ? classicConfig() : versions.get(versionId), seed + key.hashCode(), md.equals("sandbox"), false, md.equals("sandbox") ? "normal" : md);
            w.onReward = p -> { if (p.bonusCoins <= 0 || p.account == null || p.bot) { p.bonusCoins = 0; return; } long n = (long) p.bonusCoins; p.bonusCoins = 0; accounts.addCoins(p.account, n); if (p.sender != null) p.sender.send("{\"t\":\"coins\",\"coins\":" + accounts.coins(p.account) + ",\"earned\":" + n + ",\"bonus\":1}"); };
            w.onDeath = p -> {
                if (p.account == null || p.bot) return;
                accounts.recordGame(p.account, (long) p.xp, p.kills);
                VersionManager.Config vc = w.cfg; long earned = coinsEarned(vc, p.xp); if (earned > 0) accounts.addCoins(p.account, earned);
                if (vc.feature("shop") && p.sender != null) p.sender.send("{\"t\":\"coins\",\"coins\":" + accounts.coins(p.account) + ",\"earned\":" + earned + "}");
            };
            w.start();
            return w;
        });
    }

    /** Coins earned from a finished run (INFERRED rate from version.json economy.coinsPerXp; 0 where the version has no shop). */
    static long coinsEarned(VersionManager.Config vc, double xp) { double rate = vc.economy != null && vc.economy.has("coinsPerXp") ? vc.economy.get("coinsPerXp").getAsDouble() : 0; return vc.feature("shop") ? (long) Math.floor(Math.max(0, xp) * rate) : 0; }
    /** Arena config: one small land-only world, no food/terrain/bots (INFERRED rules). */
    static VersionManager.Config arenaConfig(VersionManager.Config v) {
        JsonObject o = v.raw.deepCopy();
        com.google.gson.JsonArray biomes = new com.google.gson.JsonArray(); biomes.add("land"); o.add("biomes", biomes);
        o.add("foods", new com.google.gson.JsonArray()); o.add("terrain", new com.google.gson.JsonArray());
        JsonObject layout = new JsonObject(); com.google.gson.JsonArray r = new com.google.gson.JsonArray(); for (double d : new double[] { 0, 0, 1, 1 }) r.add(d); layout.add("land", r); o.add("layout", layout);
        o.addProperty("bots", 0); o.addProperty("worldSize", 1600);
        return VersionManager.resolve(o);
    }
    /** Pair a joining player with a waiting arena if there is one, otherwise open a new match. */
    synchronized World arenaFor(VersionManager.Config v) {
        arenas.removeIf(a -> { boolean done = a.arenaState.equals("over") || a.players.isEmpty() && a.tick > 10; if (done) a.stop(); return done; });
        if (waitingArena != null && waitingArena.arenaState.equals("waiting") && !waitingArena.arenaBot && waitingArena.players.size() == 1) { World w = waitingArena; waitingArena = null; return w; }
        World w = new World(arenaConfig(v), seed + arenas.size() + System.nanoTime(), false, true); w.arenaStartTick = 0; w.start(); arenas.add(w); waitingArena = w; return w;
    }
    /** 1v1 Redemption: always a private match against AI bosses. */
    synchronized World redemptionFor(VersionManager.Config v, boolean pro) {
        arenas.removeIf(a -> { boolean done = a.arenaState.equals("over") || a.players.isEmpty() && a.tick > 10; if (done) a.stop(); return done; });
        World w = new World(arenaConfig(v), seed + System.nanoTime(), false, true); w.redemption = true; w.redPro = pro; w.arenaBot = true; w.arenaStartTick = 0;
        w.onReward = p -> { if (p.bonusCoins <= 0 || p.account == null || p.bot) { p.bonusCoins = 0; return; } long n = (long) p.bonusCoins; p.bonusCoins = 0; accounts.addCoins(p.account, n); if (p.sender != null) p.sender.send("{\"t\":\"coins\",\"coins\":" + accounts.coins(p.account) + ",\"earned\":" + n + ",\"bonus\":1}"); };
        w.start(); arenas.add(w); return w;
    }

    @Override public void onOpen(WebSocket c, ClientHandshake h) { sessions.put(c, new Session()); }
    @Override public void onClose(WebSocket c, int code, String reason, boolean remote) {
        Session s = sessions.remove(c);
        if (s != null && s.spec != null) { World.Spectator sp = s.spec; s.world.submit(() -> s.world.removeSpectator(sp)); }
        if (s != null && s.player != null) { Player p = s.player; s.world.submit(() -> { if (!p.dead && s.world.players.containsKey(p.id)) { s.world.onDeath.accept(p); } s.world.leave(p); }); }
    }
    @Override public void onError(WebSocket c, Exception e) { System.err.println("ws error: " + e); }
    @Override public void onStart() { System.out.println("[net] WebSocket server listening on " + getPort()); }

    @Override public void onMessage(WebSocket c, String raw) {
        Session s = sessions.get(c);
        if (s == null || raw.length() > MAX_MSG) return;
        JsonObject m;
        try { m = JsonParser.parseString(raw).getAsJsonObject(); } catch (RuntimeException e) { return; }
        String t = str(m, "t");
        if (t == null) return;
        try {
            switch (t) {
                case "ping" -> c.send("{\"t\":\"pong\",\"ts\":" + (m.has("ts") ? m.get("ts").getAsDouble() : 0) + "}");
                case "join" -> join(c, s, m);
                case "spectate-next" -> { World.Spectator sp = s.spec; if (sp != null) s.world.submit(() -> s.world.spectateNext(sp)); }
                case "leave" -> { if (s.spec != null) { World.Spectator sp = s.spec; s.spec = null; s.world.submit(() -> s.world.removeSpectator(sp)); } if (s.player != null) { Player p = s.player; s.player = null; s.world.submit(() -> { if (!p.dead) s.world.leave(p); }); } }
                case "input" -> {
                    Player p = s.player; if (p == null) return;
                    double a = num(m, "a"), mag = num(m, "m");
                    if (Double.isFinite(a) && Double.isFinite(mag)) { p.inputAngle = a; p.inputMag = mag; }
                    p.boost = m.has("b") && m.get("b").isJsonPrimitive() && m.get("b").getAsInt() == 1;
                }
                case "evolve" -> { Player p = s.player; String id = str(m, "id"); if (p != null && id != null) s.world.submit(() -> s.world.evolve(p, id)); }
                case "ability" -> { Player p = s.player; if (p != null) s.world.submit(() -> s.world.useAbility(p)); }
                case "chat" -> { Player p = s.player; String txt = str(m, "m"); if (p != null && txt != null) { String clean = txt.replaceAll("[\\p{Cntrl}<>]", "").trim(); if (clean.length() > 35) clean = clean.substring(0, 35); if (!clean.isEmpty()) { final String fc = clean; s.world.submit(() -> s.world.chat(p, fc)); } } }
                case "sandbox" -> { Player p = s.player; double d = num(m, "d"); if (p != null && Double.isFinite(d)) s.world.submit(() -> s.world.sandboxStep(p, (int) d)); }
                case "register", "login", "resume" -> auth(c, s, t, m);
                case "shop-info", "buy", "equip", "unequip" -> shopMsg(c, s, t, m);
                case "climb" -> { Player p = s.player; if (p != null) s.world.submit(() -> s.world.toggleClimb(p)); }
                case "logout" -> { accounts.logout(str(m, "token")); s.account = null; }
                case "dev-info" -> c.send("{\"t\":\"dev\",\"on\":" + DEV + "}"); // lets the dev bar show its tools only on dev servers
                case "dev-xp" -> { if (DEV && s.world != null && s.player != null) { double n = num(m, "n"); if (Double.isFinite(n) && n > 0 && n <= 1e8) { final Player pp = s.player; s.world.submit(() -> pp.xp += n); } } } // dev only: +XP to test evolutions
                case "dev-disaster" -> { if (DEV && s.world != null) { String id = str(m, "id"); s.world.submit(() -> s.world.triggerDisaster(id)); } }
                case "dev-coins" -> { if (DEV && s.account != null) { double n = num(m, "n"); if (Double.isFinite(n) && n > 0 && n <= 1_000_000) { accounts.addCoins(s.account, (long) n); c.send(shopState(s.account).toString()); } } }
                default -> { }
            }
        } catch (RuntimeException e) { System.err.println("bad message '" + t + "': " + e); }
    }

    private JsonObject shopState(String user) {
        JsonObject o = new JsonObject(); o.addProperty("t", "shop"); o.addProperty("coins", accounts.coins(user)); o.addProperty("credits", accounts.credits(user));
        o.add("owned", Data.GSON.toJsonTree(accounts.owned(user))); o.add("equipped", Data.GSON.toJsonTree(accounts.equipped(user))); return o;
    }
    private void shopMsg(WebSocket c, Session s, String t, JsonObject m) {
        VersionManager.Config v = versions.get(str(m, "v") != null ? str(m, "v") : (s.world != null ? s.world.cfg.id : null));
        if (v == null || !v.feature("shop")) { c.send("{\"t\":\"shop-error\",\"err\":\"shop unavailable in this version\"}"); return; }
        if (s.account == null) { c.send("{\"t\":\"shop-error\",\"err\":\"log in first\"}"); return; }
        String item = str(m, "item"); Defs.ShopItem it = null; if (item != null) for (Defs.ShopItem x : v.shop) if (x.id.equals(item)) it = x;
        switch (t) {
            case "shop-info" -> { }
            case "buy" -> { if (it == null) { c.send("{\"t\":\"shop-error\",\"err\":\"unknown item\"}"); return; } if (!("credits".equals(it.type) ? (it.credits != null && accounts.buyCredits(s.account, it.price, it.credits)) : "bundle".equals(it.type) ? accounts.buyBundle(s.account, it.id, it.price, it.contains == null ? java.util.List.of() : it.contains) : accounts.buy(s.account, it.id, it.price))) { c.send("{\"t\":\"shop-error\",\"err\":\"cannot buy (owned or not enough coins)\"}"); return; } }
            case "equip" -> { if (it == null || !("skin".equals(it.type) || "feature".equals(it.type)) || !accounts.setEquipped(s.account, "feature".equals(it.type) ? "__theme" : it.animal, it.id)) { c.send("{\"t\":\"shop-error\",\"err\":\"cannot equip\"}"); return; } }
            case "unequip" -> { String an = str(m, "animal"); if (an == null || !accounts.setEquipped(s.account, an, null)) { c.send("{\"t\":\"shop-error\",\"err\":\"cannot unequip\"}"); return; } }
            default -> { return; }
        }
        Player p = s.player; if (p != null && s.world != null) { Player pp = p; final String acct = s.account; s.world.submit(() -> applyAccount(pp, acct)); } // live-update the body the player is currently using
        c.send(shopState(s.account).toString());
    }
    /** Copy the account's inventory/equipped skins onto a live player. */
    private void applyAccount(Player p, String account) { p.owned.clear(); p.owned.addAll(accounts.owned(account)); p.skins.clear(); p.skins.putAll(accounts.equipped(account)); }

    private void auth(WebSocket c, Session s, String t, JsonObject m) {
        VersionManager.Config v = versions.get(str(m, "v"));
        if (v == null || !v.feature("accounts")) { c.send("{\"t\":\"auth\",\"ok\":false,\"err\":\"accounts unavailable in this version\"}"); return; }
        String user = str(m, "u"), pw = str(m, "p"), token = null;
        boolean ok;
        if (t.equals("register")) { ok = accounts.register(user, pw); if (ok) token = accounts.login(user, pw); }
        else if (t.equals("login")) { token = accounts.login(user, pw); ok = token != null; }
        else { user = accounts.resume(str(m, "token")); ok = user != null; token = str(m, "token"); }
        JsonObject o = new JsonObject(); o.addProperty("t", "auth"); o.addProperty("ok", ok);
        if (ok) { s.account = user; o.addProperty("user", user); o.addProperty("token", token); o.add("stats", Data.GSON.toJsonTree(accounts.stats(user))); if (v.feature("shop")) { o.addProperty("coins", accounts.coins(user)); o.add("owned", Data.GSON.toJsonTree(accounts.owned(user))); o.add("equipped", Data.GSON.toJsonTree(accounts.equipped(user))); } }
        else o.addProperty("err", "authentication failed");
        c.send(o.toString());
    }

    private void join(WebSocket c, Session s, JsonObject m) {
        if (s.spec != null) return;
        if (s.player != null && !s.player.dead && s.world.players.containsKey(s.player.id)) return;
        VersionManager.Config v = versions.get(str(m, "v"));
        if (v == null) { c.send("{\"t\":\"error\",\"err\":\"unknown version\"}"); return; }
        String name = str(m, "name");
        name = name == null ? "" : name.replaceAll("[\\p{Cntrl}<>]", "").trim();
        if (name.length() > 16) name = name.substring(0, 16);
        if (name.isEmpty()) name = "Mope";
        final String fn = name, req = str(m, "mode") == null ? "normal" : str(m, "mode");
        final String animalReq = str(m, "animal"), of = str(m, "of");
        // client-visible mode ("arena" also covers Redemption); gm = the actual game mode
        final String gm = req.equals("sandbox") && v.modes.contains("sandbox") ? "sandbox"
            : req.equals("spectate") && v.feature("spectate") ? "spectate"
            : req.equals("arena") && v.feature("arena") ? "arena"
            : req.equals("redemption") && v.feature("accounts") && v.feature("shop") ? "redemption"
            : Modes.WORLD_MODES.contains(req) ? req : "normal";
        final String mode = gm.equals("redemption") ? "arena" : (Modes.WORLD_MODES.contains(gm) ? "normal" : gm);
        if (gm.equals("redemption")) {
            if (s.account == null) { c.send("{\"t\":\"error\",\"err\":\"log in to play 1v1 Redemption\"}"); return; }
            if (!accounts.useCredit(s.account)) { c.send("{\"t\":\"error\",\"err\":\"you need a Redemption credit (buy credits in the Store)\"}"); return; }
            c.send("{\"t\":\"shop\",\"coins\":" + accounts.coins(s.account) + ",\"credits\":" + accounts.credits(s.account) + ",\"owned\":" + Data.GSON.toJson(accounts.owned(s.account)) + ",\"equipped\":" + Data.GSON.toJson(accounts.equipped(s.account)) + "}");
        }
        final boolean pro = "pro".equals(str(m, "difficulty"));
        World w = gm.equals("redemption") ? redemptionFor(v, pro) : mode.equals("arena") ? arenaFor(v) : gm.equals("sandbox") ? world(v.id, "sandbox") : gm.equals("spectate") ? world(v.id, of != null && Modes.WORLD_MODES.contains(of) ? of : "normal") : world(v.id, gm);
        s.world = w;
        w.submit(() -> {
            JsonObject o = new JsonObject(); o.addProperty("t", "welcome"); o.addProperty("mode", mode); o.addProperty("gm", gm); o.add("version", w.cfg == v ? v.clientJson() : w.cfg.clientJson());
            if (mode.equals("spectate")) { s.spec = w.addSpectator(c::send); o.addProperty("id", -1); }
            else {
                String aid = animalReq == null ? "lion" : animalReq;
                if (gm.equals("redemption")) { Animal ra = w.cfg.animals.get(aid); if (ra == null || ra.tier < 15 || ra.tier > 16) { aid = w.cfg.animals.values().stream().filter(x -> x.tier >= 15 && x.tier <= 16).map(x -> x.id).findFirst().orElse(aid); } }
                Player p = mode.equals("arena") ? w.joinArena(fn, c::send, false, aid) : w.join(fn, c::send, false);
                p.account = v.feature("accounts") ? s.account : null; if (p.account != null) applyAccount(p, p.account); s.player = p; o.addProperty("id", p.id);
            }
            com.google.gson.JsonArray lk = new com.google.gson.JsonArray(); for (double[] l : w.lakes) lk.add(Data.GSON.toJsonTree(l)); o.add("lakes", lk);
            com.google.gson.JsonArray tr = new com.google.gson.JsonArray(); for (double[] t : w.terrain) tr.add(Data.GSON.toJsonTree(t)); o.add("terrain", tr);
            c.send(o.toString());
        });
    }

    private static String str(JsonObject m, String k) { return m.has(k) && m.get(k).isJsonPrimitive() ? m.get(k).getAsString() : null; }
    private static double num(JsonObject m, String k) { return m.has(k) && m.get(k).isJsonPrimitive() ? m.get(k).getAsDouble() : Double.NaN; }
}
