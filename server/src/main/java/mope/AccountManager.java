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
    @Override public void close() { try { db.close(); } catch (SQLException ignored) {} }
}
