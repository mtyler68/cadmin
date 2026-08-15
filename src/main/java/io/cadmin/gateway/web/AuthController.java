package io.cadmin.gateway.web;

import io.cadmin.gateway.config.CadminProperties;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping(path = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
public class AuthController {

    private final CadminProperties properties;

    public AuthController(CadminProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        boolean oidc = properties.security().oidc();
        return Map.of(
                "mode", properties.security().mode(),
                "oidcLoginUrl", oidc ? "/oauth2/authorization/keycloak" : "",
                "fhirBaseUrl", "/fhir"
        );
    }

    @GetMapping("/me")
    public Mono<Map<String, Object>> me() {
        return ReactiveSecurityContextHolder.getContext()
                .map(SecurityContext::getAuthentication)
                .map(this::toUser);
    }

    @GetMapping("/users")
    public Mono<List<Map<String, Object>>> users() {
        if (!properties.security().local()) {
            return Mono.just(List.of());
        }
        return Mono.just(properties.security().users().stream()
                .map(user -> Map.<String, Object>of(
                        "username", user.username(),
                        "roles", user.roles()))
                .toList());
    }

    private Map<String, Object> toUser(Authentication authentication) {
        String username = authentication.getName();
        String displayName = username;
        if (authentication instanceof OAuth2AuthenticationToken oauth
                && oauth.getPrincipal() instanceof OidcUser oidcUser) {
            username = firstNonBlank(oidcUser.getPreferredUsername(), oidcUser.getName(), username);
            displayName = firstNonBlank(oidcUser.getFullName(), oidcUser.getGivenName(), username);
        }
        return Map.of(
                "username", username,
                "displayName", displayName,
                "roles", authorities(authentication.getAuthorities()),
                "mode", properties.security().mode()
        );
    }

    private static List<String> authorities(Collection<? extends GrantedAuthority> authorities) {
        return authorities.stream().map(GrantedAuthority::getAuthority).collect(Collectors.toList());
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
