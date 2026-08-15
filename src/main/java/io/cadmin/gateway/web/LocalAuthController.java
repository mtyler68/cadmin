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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@Validated
@RequestMapping(path = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
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

    @PostMapping(path = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Mono<Map<String, Object>> login(@RequestBody LoginRequest request, ServerWebExchange exchange) {
        Authentication unauthenticated = UsernamePasswordAuthenticationToken.unauthenticated(
                request.username(), request.password());
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
}
