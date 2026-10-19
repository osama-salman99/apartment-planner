package work.osmosis.homeapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One saved furniture layout. {@code data} is an opaque JSON blob
 * owned entirely by the frontend (items + sun + gridSnap) and the backend never parses its shape.
 * Only the name and the timestamps are the server's business, because those are what the designs
 * list renders without having to download every layout.
 *
 * <p>The "Empty" design is deliberately NOT a row here. It is a fixed, immutable entry the frontend
 * synthesises, so there is nothing to accidentally rename, edit or delete, and a wiped database
 * still opens on an empty apartment rather than on nothing at all.
 */
@Entity
@Table(name = "design")
public class DesignEntity {

    @Id
    private String id;

    @Column(nullable = false, length = 120)
    private String name;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String data;

    private Instant createdAt;

    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
