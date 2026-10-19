package work.osmosis.homeapp;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Am I signed in?" — the one thing the public page needs to know before it decides whether to offer
 * saving at all.
 *
 * <p>Deliberately public. It falls through to auth-core's chain, where the SSO cookie filter still
 * runs even though every path is permitted, so a request carrying a valid cookie arrives here already
 * authenticated. Asking {@code /api/designs} instead would work but would make a 401 the normal case
 * on first load, which is noise in the console and in the logs for something that is not an error.
 */
@RestController
public class SessionController {

    @GetMapping("/api/session")
    public Map<String, Object> session() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean signedIn = auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(String.valueOf(auth.getPrincipal()));
        return signedIn
                ? Map.of("authenticated", true, "user", String.valueOf(auth.getName()))
                : Map.of("authenticated", false);
    }
}
