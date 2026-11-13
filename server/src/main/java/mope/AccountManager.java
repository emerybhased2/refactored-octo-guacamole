package mope;

import java.security.*;
import java.security.spec.KeySpec;
import java.sql.*;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** SQLite-backed accounts (PBKDF2-HMAC-SHA256), sessions, stats and settings. Plain JDBC keeps PostgreSQL migration simple. */
public final class AccountManager implements AutoCloseable {
    private static final int ITER = 120_000;
    private static final long SESSION_MS = 7L * 24 * 3600 * 1000;
    private final Connection db;
    private final SecureRandom rnd = new SecureRandom();

    public AccountManager(String jdbcUrl) {
        try {
            db = DriverManager.getConnection(jdbcUrl);
            try (Statement s = db.createStatement()) {
                s.execute("CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL)");
                s.execute("CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires INTEGER NOT NULL)");
                s.execute("CREATE TABLE IF NOT EXISTS stats(username TEXT PRIMARY KEY, best_xp INTEGER NOT NULL DEFAULT 0, kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0)");
                s.execute("CREATE TABLE IF NOT EXISTS settings(username TEXT PRIMARY KEY, json TEXT NOT NULL)");
                s.execute("CREATE TABLE IF NOT EXISTS wallet(username TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0 CHECK(coins >= 0))");
                s.execute("CREATE TABLE IF NOT EXISTS inventory(username TEXT NOT NULL, item TEXT NOT NULL, PRIMARY KEY(username, item))");
                s.execute("CREATE TABLE IF NOT EXISTS credits(username TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0 CHECK(n >= 0))");
                s.execute("CREATE TABLE IF NOT EXISTS equipped(username TEXT NOT NULL, animal TEXT NOT NULL, item TEXT NOT NULL, PRIMARY KEY(username, animal))");
            }
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }

    private String hash(String pw, byte[] salt) throws GeneralSecurityException {
        KeySpec spec = new PBEKeySpec(pw.toCharArray(), salt, ITER, 256);
        return Base64.getEncoder().encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded());
    }
    private static String sha256(String s) throws GeneralSecurityException {
        return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    public synchronized boolean register(String user, String pw) {
        if (user == null || !user.matches("[A-Za-z0-9_]{3,16}") || pw == null || pw.length() < 6 || pw.length() > 128) return false;
        try {
            byte[] salt = new byte[16]; rnd.nextBytes(salt);
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO accounts(username,salt,hash,created) VALUES(?,?,?,?)")) {
                ps.setString(1, user); ps.setString(2, Base64.getEncoder().encodeToString(salt)); ps.setString(3, hash(pw, salt)); ps.setLong(4, System.currentTimeMillis());
                ps.executeUpdate();
            }
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO stats(username) VALUES(?)")) { ps.setString(1, user); ps.executeUpdate(); }
            return true;
        } catch (SQLException e) { return false; } // duplicate username
        catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
    }

    /** Returns a fresh session token on success, else null. Only a hash of the token is stored. */
    public synchronized String login(String user, String pw) {
        if (user == null || pw == null) return null;
        try (PreparedStatement ps = db.prepareStatement("SELECT username,salt,hash FROM accounts WHERE username=?")) {
            ps.setString(1, user);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) { hash(pw, new byte[16]); return null; } // equalize timing
                String calc = hash(pw, Base64.getDecoder().decode(rs.getString("salt")));
                if (!MessageDigest.isEqual(calc.getBytes(), rs.getString("hash").getBytes())) return null;
                byte[] t = new byte[32]; rnd.nextBytes(t);
                String token = Base64.getUrlEncoder().withoutPadding().encodeToString(t);
                try (PreparedStatement ins = db.prepareStatement("INSERT INTO sessions(token_hash,username,expires) VALUES(?,?,?)")) {
                    ins.setString(1, sha256(token)); ins.setString(2, rs.getString("username")); ins.setLong(3, System.currentTimeMillis() + SESSION_MS); ins.executeUpdate();
                }
                return token;
            }
        } catch (SQLException | GeneralSecurityException e) { throw new IllegalStateException(e); }
    }

    /** Resolves a session token to a username, or null if unknown/expired. */
    public synchronized String resume(String token) {
        if (token == null) return null;
        try (PreparedStatement ps = db.prepareStatement("SELECT username FROM sessions WHERE token_hash=? AND expires>?")) {
            ps.setString(1, sha256(token)); ps.setLong(2, System.currentTimeMillis());
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : null; }
        } catch (SQLException | GeneralSecurityException e) { throw new IllegalStateException(e); }
    }

    public synchronized void logout(String token) {
        if (token == null) return;
        try (PreparedStatement ps = db.prepareStatement("DELETE FROM sessions WHERE token_hash=?")) { ps.setString(1, sha256(token)); ps.executeUpdate(); } catch (SQLException | GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    /** Test helper: logs the token out and reports whether it no longer resolves. */
    public synchronized boolean logoutAndCheck(String token) { logout(token); return resume(token) == null; }
    public synchronized void recordGame(String user, long xp, int kills) {
        try (PreparedStatement ps = db.prepareStatement("UPDATE stats SET best_xp=MAX(best_xp,?), kills=kills+?, deaths=deaths+1, games=games+1 WHERE username=?")) {
            ps.setLong(1, xp); ps.setInt(2, kills); ps.setString(3, user); ps.executeUpdate();
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    public synchronized long[] stats(String user) {
        try (PreparedStatement ps = db.prepareStatement("SELECT best_xp,kills,deaths,games FROM stats WHERE username=?")) {
            ps.setString(1, user);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? new long[] { rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4) } : null; }
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    // ---- economy (kept separate from gameplay progression; every change is validated here, never trusted from the client)
    public synchronized long coins(String user) {
        try (PreparedStatement ps = db.prepareStatement("SELECT coins FROM wallet WHERE username=?")) { ps.setString(1, user); try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getLong(1) : 0; } }
        catch (SQLException e) { throw new IllegalStateException(e); }
    }
    public synchronized void addCoins(String user, long n) {
        if (n <= 0) return;
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO wallet(username,coins) VALUES(?,?) ON CONFLICT(username) DO UPDATE SET coins = coins + excluded.coins")) { ps.setString(1, user); ps.setLong(2, n); ps.executeUpdate(); }
        catch (SQLException e) { throw new IllegalStateException(e); }
    }
    /** 1v1 Redemption credits (a consumable bought with coins; one per round). */
    public synchronized int credits(String user) {
        try (PreparedStatement ps = db.prepareStatement("SELECT n FROM credits WHERE username=?")) { ps.setString(1, user); try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; } }
        catch (SQLException e) { throw new IllegalStateException(e); }
    }
    /** Atomic: spends `price` coins and adds `n` credits, or does nothing. */
    public synchronized boolean buyCredits(String user, int price, int n) {
        if (price < 0 || n <= 0 || coins(user) < price) return false;
        try {
            db.setAutoCommit(false);
            try (PreparedStatement a = db.prepareStatement("UPDATE wallet SET coins = coins - ? WHERE username=? AND coins >= ?"); PreparedStatement b = db.prepareStatement("INSERT INTO credits(username,n) VALUES(?,?) ON CONFLICT(username) DO UPDATE SET n = n + excluded.n")) {
                a.setInt(1, price); a.setString(2, user); a.setInt(3, price); if (a.executeUpdate() != 1 && price > 0) { db.rollback(); return false; }
                b.setString(1, user); b.setInt(2, n); b.executeUpdate(); db.commit(); return true;
            } catch (SQLException e) { db.rollback(); return false; } finally { db.setAutoCommit(true); }
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    /** Atomically uses one credit; false when there is none. */
    public synchronized boolean useCredit(String user) {
        try (PreparedStatement ps = db.prepareStatement("UPDATE credits SET n = n - 1 WHERE username=? AND n >= 1")) { ps.setString(1, user); return ps.executeUpdate() == 1; }
        catch (SQLException e) { throw new IllegalStateException(e); }
    }
    public synchronized java.util.Set<String> owned(String user) {
        java.util.Set<String> out = new java.util.HashSet<>();
        try (PreparedStatement ps = db.prepareStatement("SELECT item FROM inventory WHERE username=?")) { ps.setString(1, user); try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(rs.getString(1)); } }
        catch (SQLException e) { throw new IllegalStateException(e); }
        return out;
    }
    /** Atomic purchase: succeeds only if the item is not owned and the balance covers the price. */
    public synchronized boolean buy(String user, String item, int price) {
        if (price < 0 || owned(user).contains(item) || coins(user) < price) return false;
        try {
            db.setAutoCommit(false);
            try (PreparedStatement a = db.prepareStatement("UPDATE wallet SET coins = coins - ? WHERE username=? AND coins >= ?"); PreparedStatement b = db.prepareStatement("INSERT INTO inventory(username,item) VALUES(?,?)")) {
                a.setInt(1, price); a.setString(2, user); a.setInt(3, price); if (a.executeUpdate() != 1 && price > 0) { db.rollback(); return false; }
                b.setString(1, user); b.setString(2, item); b.executeUpdate(); db.commit(); return true;
            } catch (SQLException e) { db.rollback(); return false; } finally { db.setAutoCommit(true); }
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    /** Atomic bundle purchase: the bundle id plus every contained item not yet owned are added for one price. */
    public synchronized boolean buyBundle(String user, String bundle, int price, java.util.List<String> contents) {
        if (price < 0 || owned(user).contains(bundle) || coins(user) < price) return false;
        try {
            db.setAutoCommit(false);
            try (PreparedStatement a = db.prepareStatement("UPDATE wallet SET coins = coins - ? WHERE username=? AND coins >= ?"); PreparedStatement b = db.prepareStatement("INSERT OR IGNORE INTO inventory(username,item) VALUES(?,?)")) {
                a.setInt(1, price); a.setString(2, user); a.setInt(3, price); if (a.executeUpdate() != 1 && price > 0) { db.rollback(); return false; }
                java.util.List<String> all = new java.util.ArrayList<>(contents); all.add(bundle);
                for (String it : all) { b.setString(1, user); b.setString(2, it); b.executeUpdate(); }
                db.commit(); return true;
            } catch (SQLException e) { db.rollback(); return false; } finally { db.setAutoCommit(true); }
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    public synchronized java.util.Map<String, String> equipped(String user) {
        java.util.Map<String, String> out = new java.util.HashMap<>();
        try (PreparedStatement ps = db.prepareStatement("SELECT animal,item FROM equipped WHERE username=?")) { ps.setString(1, user); try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.put(rs.getString(1), rs.getString(2)); } }
        catch (SQLException e) { throw new IllegalStateException(e); }
        return out;
    }
    /** Equip an OWNED skin for an animal (item == null unequips). */
    public synchronized boolean setEquipped(String user, String animal, String item) {
        try {
            if (item == null) { try (PreparedStatement ps = db.prepareStatement("DELETE FROM equipped WHERE username=? AND animal=?")) { ps.setString(1, user); ps.setString(2, animal); ps.executeUpdate(); } return true; }
            if (!owned(user).contains(item)) return false;
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO equipped(username,animal,item) VALUES(?,?,?) ON CONFLICT(username,animal) DO UPDATE SET item=excluded.item")) { ps.setString(1, user); ps.setString(2, animal); ps.setString(3, item); ps.executeUpdate(); }
            return true;
        } catch (SQLException e) { throw new IllegalStateException(e); }
    }
    @Override public void close() { try { db.close(); } catch (SQLException ignored) {} }
}
