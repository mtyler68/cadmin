package io.cadmin.gateway.web;

import io.cadmin.gateway.config.CadminProperties;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.server.context.ServerSecurityContextRepository;
import org.springframework.security.web.server.context.WebSessionServerSecurityContextRepository;
import org.springframework.util.MultiValueMap;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@Validated
@ConditionalOnProperty(name = "cadmin.security.mode", havingValue = "local", matchIfMissing = true)
public class LocalAuthController {

    private final ReactiveAuthenticationManager authenticationManager;
    private final ServerSecurityContextRepository securityContextRepository;
    private final CadminProperties properties;

    public LocalAuthController(
            ReactiveAuthenticationManager authenticationManager,
            CadminProperties properties
    ) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = new WebSessionServerSecurityContextRepository();
        this.properties = properties;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    @PostMapping(
            path = {"/login", "/api/auth/login"},
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Mono<Map<String, Object>> loginJson(@RequestBody LoginRequest request, ServerWebExchange exchange) {
        return authenticate(request.username(), request.password(), exchange);
    }

    @PostMapping(
            path = {"/login", "/api/auth/login"},
            consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Mono<Map<String, Object>> loginForm(ServerWebExchange exchange) {
        return exchange.getFormData().flatMap(form -> authenticate(
                first(form, "username"),
                first(form, "password"),
                exchange));
    }

    private Mono<Map<String, Object>> authenticate(String username, String password, ServerWebExchange exchange) {
        if (username == null || username.isBlank() || password == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        }
        Authentication unauthenticated = UsernamePasswordAuthenticationToken.unauthenticated(username, password);
        return authenticationManager.authenticate(unauthenticated)
                .flatMap(authentication -> securityContextRepository
                        .save(exchange, new SecurityContextImpl(authentication))
                        .thenReturn(Map.<String, Object>of(
                                "authenticated", true,
                                "username", authentication.getName(),
                                "mode", properties.security().mode())))
                .onErrorMap(ex -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid username or password", ex));
    }

    private static String first(MultiValueMap<String, String> form, String name) {
        return form.getFirst(name);
    }
}
