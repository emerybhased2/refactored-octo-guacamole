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

    private static final class Session { World world; Player player; String account; }

    private final VersionManager versions;
    private final AccountManager accounts;
    private final Map<String, World> worlds = new ConcurrentHashMap<>();
    private final Map<WebSocket, Session> sessions = new ConcurrentHashMap<>();
    private final long seed;

    public NetworkManager(int port, VersionManager versions, AccountManager accounts, long seed) {
        super(new InetSocketAddress(port));
        this.versions = versions; this.accounts = accounts; this.seed = seed;
        setReuseAddr(true);
    }

    public World world(String versionId, boolean sandbox) {
        return worlds.computeIfAbsent(versionId + (sandbox ? "|sandbox" : ""), key -> {
            World w = new World(versions.get(versionId), seed + key.hashCode(), sandbox);
            w.onDeath = p -> { if (p.account != null && !p.bot) accounts.recordGame(p.account, (long) p.xp, p.kills); };
            w.start();
            return w;
        });
    }

    @Override public void onOpen(WebSocket c, ClientHandshake h) { sessions.put(c, new Session()); }
    @Override public void onClose(WebSocket c, int code, String reason, boolean remote) {
        Session s = sessions.remove(c);
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
                case "input" -> {
                    Player p = s.player; if (p == null) return;
                    double a = num(m, "a"), mag = num(m, "m");
                    if (Double.isFinite(a) && Double.isFinite(mag)) { p.inputAngle = a; p.inputMag = mag; }
                    p.boost = m.has("b") && m.get("b").isJsonPrimitive() && m.get("b").getAsInt() == 1;
                }
                case "evolve" -> { Player p = s.player; String id = str(m, "id"); if (p != null && id != null) s.world.submit(() -> s.world.evolve(p, id)); }
                case "ability" -> { Player p = s.player; if (p != null) s.world.submit(() -> s.world.abilities.activate(p, s.world.nowMs(), null)); }
                case "chat" -> { Player p = s.player; String txt = str(m, "m"); if (p != null && txt != null) { String clean = txt.replaceAll("[\\p{Cntrl}<>]", "").trim(); if (clean.length() > 35) clean = clean.substring(0, 35); if (!clean.isEmpty()) { final String fc = clean; s.world.submit(() -> s.world.chat(p, fc)); } } }
                case "sandbox" -> { Player p = s.player; double d = num(m, "d"); if (p != null && Double.isFinite(d)) s.world.submit(() -> s.world.sandboxStep(p, (int) d)); }
                case "register", "login", "resume" -> auth(c, s, t, m);
                default -> { }
            }
        } catch (RuntimeException e) { System.err.println("bad message '" + t + "': " + e); }
    }

    private void auth(WebSocket c, Session s, String t, JsonObject m) {
        VersionManager.Config v = versions.get(str(m, "v"));
        if (v == null || !v.feature("accounts")) { c.send("{\"t\":\"auth\",\"ok\":false,\"err\":\"accounts unavailable in this version\"}"); return; }
        String user = str(m, "u"), pw = str(m, "p"), token = null;
        boolean ok;
        if (t.equals("register")) { ok = accounts.register(user, pw); if (ok) token = accounts.login(user, pw); }
        else if (t.equals("login")) { token = accounts.login(user, pw); ok = token != null; }
        else { user = accounts.resume(str(m, "token")); ok = user != null; token = str(m, "token"); }
        JsonObject o = new JsonObject(); o.addProperty("t", "auth"); o.addProperty("ok", ok);
        if (ok) { s.account = user; o.addProperty("user", user); o.addProperty("token", token); o.add("stats", Data.GSON.toJsonTree(accounts.stats(user))); }
        else o.addProperty("err", "authentication failed");
        c.send(o.toString());
    }

    private void join(WebSocket c, Session s, JsonObject m) {
        if (s.player != null && !s.player.dead && s.world.players.containsKey(s.player.id)) return;
        VersionManager.Config v = versions.get(str(m, "v"));
        if (v == null) { c.send("{\"t\":\"error\",\"err\":\"unknown version\"}"); return; }
        String name = str(m, "name");
        name = name == null ? "" : name.replaceAll("[\\p{Cntrl}<>]", "").trim();
        if (name.length() > 16) name = name.substring(0, 16);
        if (name.isEmpty()) name = "Mope";
        final String fn = name;
        boolean sb = "sandbox".equals(str(m, "mode")) && v.modes.contains("sandbox");
        World w = world(v.id, sb);
        s.world = w;
        w.submit(() -> {
            Player p = w.join(fn, c::send, false);
            p.account = v.feature("accounts") ? s.account : null;
            s.player = p;
            JsonObject o = new JsonObject(); o.addProperty("t", "welcome"); o.addProperty("id", p.id); o.addProperty("mode", sb ? "sandbox" : "normal"); o.add("version", v.clientJson());
            com.google.gson.JsonArray lk = new com.google.gson.JsonArray(); for (double[] l : w.lakes) lk.add(Data.GSON.toJsonTree(l)); o.add("lakes", lk);
            com.google.gson.JsonArray tr = new com.google.gson.JsonArray(); for (double[] t : w.terrain) tr.add(Data.GSON.toJsonTree(t)); o.add("terrain", tr);
            c.send(o.toString());
        });
    }

    private static String str(JsonObject m, String k) { return m.has(k) && m.get(k).isJsonPrimitive() ? m.get(k).getAsString() : null; }
    private static double num(JsonObject m, String k) { return m.has(k) && m.get(k).isJsonPrimitive() ? m.get(k).getAsDouble() : Double.NaN; }
}
