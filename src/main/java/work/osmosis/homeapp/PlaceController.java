package work.osmosis.homeapp;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where the flat is: its address. The planner itself is public, but
 * it says where someone lives, so only a signed-in visitor gets it. It is served from here
 * rather than built into the page so a signed-out visitor's download never contains it at all.
 *
 * <p>Checked by hand, like {@link SessionController}: auth-core's chain permits every path but still
 * authenticates a request carrying the shared cookie.
 */
@RestController
public class PlaceController {

    @Value("${app.place.unit:}")
    private String unit;

    @Value("${app.place.street:}")
    private String street;

    @Value("${app.place.postcode:}")
    private String postcode;

    @Value("${app.place.city:}")
    private String city;

    @GetMapping("/api/place")
    public ResponseEntity<Map<String, String>> place() {
        if (!signedIn()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (unit.isBlank()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of("unit", unit, "street", street, "postcode", postcode, "city", city));
    }

    private static boolean signedIn() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(String.valueOf(auth.getPrincipal()));
    }
}
