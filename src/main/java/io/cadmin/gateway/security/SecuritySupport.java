package io.cadmin.gateway.security;

import org.springframework.http.HttpMethod;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.csrf.CookieServerCsrfTokenRepository;
import org.springframework.security.web.server.csrf.ServerCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;

final class SecuritySupport {

    private SecuritySupport() {
    }

    static ServerHttpSecurity common(ServerHttpSecurity http) {
        CookieServerCsrfTokenRepository csrfRepo = CookieServerCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookieCustomizer(cookie -> cookie.path("/").sameSite("Lax"));
        return http
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .pathMatchers(SecurityPaths.PUBLIC).permitAll()
                        .anyExchange().authenticated())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new SpaAuthenticationEntryPoint()))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(new ServerCsrfTokenRequestAttributeHandler()))
                .addFilterAfter(new CsrfCookieWebFilter(), SecurityWebFiltersOrder.CSRF);
    }

    static org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher logoutMatcher() {
        return ServerWebExchangeMatchers.pathMatchers(HttpMethod.POST, "/logout");
    }
}
