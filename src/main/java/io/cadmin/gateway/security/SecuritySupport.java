package io.cadmin.gateway.security;

import org.springframework.http.HttpMethod;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.csrf.CookieServerCsrfTokenRepository;
import org.springframework.security.web.server.csrf.CsrfWebFilter;
import org.springframework.security.web.server.csrf.ServerCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.server.util.matcher.AndServerWebExchangeMatcher;
import org.springframework.security.web.server.util.matcher.NegatedServerWebExchangeMatcher;
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
                        .pathMatchers("/fhir/Organization", "/fhir/Organization/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/OrganizationAffiliation", "/fhir/OrganizationAffiliation/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/Location", "/fhir/Location/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/Endpoint", "/fhir/Endpoint/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/PractitionerRole", "/fhir/PractitionerRole/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/CareTeam", "/fhir/CareTeam/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/Library", "/fhir/Library/**").hasRole("ADMIN")
                        .pathMatchers("/fhir/SearchParameter", "/fhir/SearchParameter/**").hasRole("ADMIN")
                        .anyExchange().authenticated())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new SpaAuthenticationEntryPoint()))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(new ServerCsrfTokenRequestAttributeHandler())
                        .requireCsrfProtectionMatcher(new AndServerWebExchangeMatcher(
                                CsrfWebFilter.DEFAULT_CSRF_MATCHER,
                                new NegatedServerWebExchangeMatcher(
                                        ServerWebExchangeMatchers.pathMatchers(
                                                HttpMethod.POST, "/login", "/api/auth/login")))))
                .addFilterAfter(new CsrfCookieWebFilter(), SecurityWebFiltersOrder.CSRF);
    }

    static org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher logoutMatcher() {
        return ServerWebExchangeMatchers.pathMatchers(HttpMethod.POST, "/logout");
    }
}
