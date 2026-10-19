package work.osmosis.homeapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Tiny key/value table for the handful of app-wide preferences that aren't part of any one design —
 * today just which design opens by default. A table rather than a column on some other entity so
 * the next preference costs a row, not a migration.
 */
@Entity
@Table(name = "app_setting")
public class AppSettingEntity {

    /** Which design id opens by default. May be {@code empty}, the synthetic immutable design. */
    public static final String DEFAULT_DESIGN = "defaultDesign";

    @Id
    @Column(name = "setting_key", length = 64)
    private String key;

    // Both columns are explicitly named: `key` and `value` are RESERVED WORDS in H2 2.x, and
    // Hibernate quotes neither by default, so the generated DDL and every later SELECT fail with a
    // bare "expected identifier" syntax error.
    @Column(name = "setting_value", length = 200)
    private String value;

    public AppSettingEntity() {}

    public AppSettingEntity(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
