package io.cadmin.gateway.security;

import org.springframework.security.web.server.csrf.CsrfToken;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Subscribes to the CSRF token so the XSRF-TOKEN cookie is written for the SPA.
 */
class CsrfCookieWebFilter implements WebFilter {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        Mono<CsrfToken> csrf = exchange.getAttribute(CsrfToken.class.getName());
        if (csrf != null) {
            return csrf.then(chain.filter(exchange));
        }
        return chain.filter(exchange);
    }
}
