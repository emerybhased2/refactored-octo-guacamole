package mope;

import java.nio.file.*;

public final class GameServer {
    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("MOPE_PORT", "8081"));
        VersionManager vm = new VersionManager();
        Files.createDirectories(Data.root.resolve("database"));
        String dbPath = System.getenv("MOPE_DB"); // optional override (tests use a throwaway database)
        AccountManager am = new AccountManager("jdbc:sqlite:" + (dbPath != null ? dbPath : Data.root.resolve("database/mope.db").toString()));
        NetworkManager net = new NetworkManager(port, vm, am, System.nanoTime());
        net.start();
        System.out.println("[server] root=" + Data.root + " versions=" + vm.all().stream().map(c -> c.id).toList());
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { net.stop(1000); } catch (Exception ignored) {}
            am.close();
            System.out.println("[server] stopped");
        }));
        Thread.currentThread().join();
    }
}
