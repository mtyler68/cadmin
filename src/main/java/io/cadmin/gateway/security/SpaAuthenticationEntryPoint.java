package io.cadmin.gateway.security;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.authentication.RedirectServerAuthenticationEntryPoint;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Returns 401 for XHR/API/FHIR calls so the SPA can redirect; otherwise sends the browser to login.
 */
class SpaAuthenticationEntryPoint implements ServerAuthenticationEntryPoint {

    private final ServerAuthenticationEntryPoint browserEntryPoint =
            new RedirectServerAuthenticationEntryPoint("/login.html");

    @Override
    public Mono<Void> commence(ServerWebExchange exchange, AuthenticationException ex) {
        if (AjaxRequests.isAjax(exchange)) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
        return browserEntryPoint.commence(exchange, ex);
    }
}
