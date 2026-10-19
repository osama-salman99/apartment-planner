package work.osmosis.homeapp;

import eu.osmosis.auth.core.SsoCookieAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Walls <i>writing</i> designs. Reading them is public: anyone can open home.osmosis.work, see every
 * saved layout and walk around inside it — only creating, saving, renaming, deleting and choosing the
 * default need the shared session. auth-core's chain permits {@code /**} and Spring matches chains
 * in order, so this needs its own higher-precedence chain rather than a later rule.
 *
 * <p>Unlike the fleet's walled <i>pages</i>, which redirect to the central login, these are XHR
 * endpoints behind a deliberately public page, so they answer <b>401</b> — a redirect would either
 * be followed silently (the frontend would
 * parse auth.osmosis.work's HTML as a design list) or bounce a casual visitor off a page that is
 * supposed to work without an account. On a 401 the frontend keeps the design open read-only and
 * offers a sign-in link.
 */
@Configuration
public class DesignSecurityConfig {

    static final String[] PROTECTED = {"/api/designs", "/api/designs/**", "/api/default-design"};

    @Value("${SSO_SIGNING_KEY:}")
    private String ssoKey;

    @Value("${app.admin.username:osmosis}")
    private String adminUsername;

    @Bean
    @Order(2)
    SecurityFilterChain designSecurityFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher(PROTECTED)
                .authorizeHttpRequests(auth -> auth
                        // Looking is free — the list and any single design read out to anyone.
                        .requestMatchers(HttpMethod.GET, "/api/designs", "/api/designs/**").permitAll()
                        // Everything that changes something needs the session.
                        .anyRequest().authenticated())
                .addFilterBefore(new SsoCookieAuthFilter(ssoKey, adminUsername),
                        UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                // Same-origin JSON from our own page carrying the SSO cookie; there is no CSRF token
                // in play, which is the treatment the layout API already gets.
                .csrf(csrf -> csrf.disable())
                // No session to create: every request re-proves itself with the signed SSO cookie.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
