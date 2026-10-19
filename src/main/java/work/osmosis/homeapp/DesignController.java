package work.osmosis.homeapp;

import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD for saved designs, plus which one opens by default.
 *
 * <p>Every path here is walled by {@link DesignSecurityConfig} — the planner itself is public, but a
 * design is the user's own work and only they may read or write it. Unauthenticated callers get a
 * 401, never a redirect, so the public page can quietly fall back to the read-only Empty design
 * instead of bouncing a casual visitor to a login screen.
 *
 * <p>{@code data} is passed through verbatim: it is the frontend's layout blob and the shape of it
 * is not this service's business.
 */
@RestController
public class DesignController {

    /** The synthetic, immutable design. Never a row; accepted only as a default-design pointer. */
    static final String EMPTY_ID = "empty";

    private static final int MAX_DESIGNS = 100;

    private final DesignRepository designs;
    private final AppSettingRepository settings;
    private final ObjectMapper objectMapper;

    public DesignController(DesignRepository designs, AppSettingRepository settings,
            ObjectMapper objectMapper) {
        this.designs = designs;
        this.settings = settings;
        this.objectMapper = objectMapper;
    }

    // ---------- list ----------

    @GetMapping("/api/designs")
    public Map<String, Object> list() {
        List<Map<String, Object>> out = designs.findAllByOrderByCreatedAtAsc().stream()
                .map(DesignController::meta)
                .toList();
        return Map.of("designs", out, "defaultId", defaultDesignId());
    }

    // ---------- one design ----------

    @GetMapping("/api/designs/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String id) throws Exception {
        var found = designs.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        DesignEntity d = found.get();
        Map<String, Object> body = new LinkedHashMap<>(meta(d));
        body.put("data", d.getData() == null ? null : objectMapper.readValue(d.getData(), Object.class));
        return ResponseEntity.ok(body);
    }

    public record CreateRequest(String name, Object data) {}

    @PostMapping("/api/designs")
    public ResponseEntity<Map<String, Object>> create(@RequestBody(required = false) CreateRequest req)
            throws Exception {
        if (designs.count() >= MAX_DESIGNS) {
            return ResponseEntity.status(409).body(Map.of("error", "Too many designs"));
        }
        Instant now = Instant.now();
        DesignEntity d = new DesignEntity();
        d.setId(UUID.randomUUID().toString());
        d.setName(cleanName(req == null ? null : req.name()));
        d.setData(objectMapper.writeValueAsString(
                req == null || req.data() == null ? Map.of("items", List.of()) : req.data()));
        d.setCreatedAt(now);
        d.setUpdatedAt(now);
        designs.save(d);
        return ResponseEntity.ok(meta(d));
    }

    public record SaveRequest(Object data) {}

    /** Autosave. The frontend PUTs the whole blob after each edit, debounced. */
    @PutMapping("/api/designs/{id}")
    public ResponseEntity<Map<String, Object>> save(@PathVariable String id,
            @RequestBody SaveRequest req) throws Exception {
        var found = designs.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        DesignEntity d = found.get();
        d.setData(objectMapper.writeValueAsString(req.data() == null ? Map.of("items", List.of()) : req.data()));
        d.setUpdatedAt(Instant.now());
        designs.save(d);
        return ResponseEntity.ok(meta(d));
    }

    public record RenameRequest(String name) {}

    @PatchMapping("/api/designs/{id}")
    public ResponseEntity<Map<String, Object>> rename(@PathVariable String id,
            @RequestBody RenameRequest req) {
        var found = designs.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        DesignEntity d = found.get();
        d.setName(cleanName(req.name()));
        d.setUpdatedAt(Instant.now());
        designs.save(d);
        return ResponseEntity.ok(meta(d));
    }

    @DeleteMapping("/api/designs/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        if (!designs.existsById(id)) return ResponseEntity.notFound().build();
        designs.deleteById(id);
        // Deleting the default would otherwise leave the app opening on a design that isn't there.
        if (id.equals(defaultDesignId())) {
            settings.save(new AppSettingEntity(AppSettingEntity.DEFAULT_DESIGN, EMPTY_ID));
        }
        return ResponseEntity.noContent().build();
    }

    // ---------- default design ----------

    public record DefaultRequest(String id) {}

    @PutMapping("/api/default-design")
    public ResponseEntity<Map<String, String>> setDefault(@RequestBody DefaultRequest req) {
        String id = req.id() == null ? EMPTY_ID : req.id();
        if (!EMPTY_ID.equals(id) && !designs.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        settings.save(new AppSettingEntity(AppSettingEntity.DEFAULT_DESIGN, id));
        return ResponseEntity.ok(Map.of("defaultId", id));
    }

    // ---------- helpers ----------

    private String defaultDesignId() {
        return settings.findById(AppSettingEntity.DEFAULT_DESIGN)
                .map(AppSettingEntity::getValue)
                .filter(id -> EMPTY_ID.equals(id) || designs.existsById(id))
                .orElse(EMPTY_ID);
    }

    private static Map<String, Object> meta(DesignEntity d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("name", d.getName());
        m.put("createdAt", d.getCreatedAt());
        m.put("updatedAt", d.getUpdatedAt());
        return m;
    }

    /** Trimmed, never blank, and short enough for the column and for the panel that renders it. */
    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) name = "Untitled design";
        return name.length() > 120 ? name.substring(0, 120) : name;
    }
}
