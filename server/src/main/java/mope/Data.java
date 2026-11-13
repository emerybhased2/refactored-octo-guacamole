package mope;

import com.google.gson.*;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;

/** JSON loading helpers. Project root comes from -Dmope.root (default: cwd). */
public final class Data {
    public static final Gson GSON = new GsonBuilder().create();
    public static Path root = Paths.get(System.getProperty("mope.root", ".")).toAbsolutePath().normalize();

    private Data() {}

    public static JsonElement read(String rel) {
        try { return JsonParser.parseString(Files.readString(root.resolve(rel))); }
        catch (IOException e) { throw new IllegalStateException("Cannot read " + rel + ": " + e.getMessage(), e); }
    }
    public static <T> T read(String rel, Class<T> c) { return GSON.fromJson(read(rel), c); }
    public static LocalDate date(String s) { return s == null ? null : LocalDate.parse(s); }

    /** True when date is within [release, removal). Null release = never available (unverified). */
    public static boolean active(String release, String removal, LocalDate at) {
        if (release == null) return false;
        if (at.isBefore(date(release))) return false;
        return removal == null || at.isBefore(date(removal));
    }
}
