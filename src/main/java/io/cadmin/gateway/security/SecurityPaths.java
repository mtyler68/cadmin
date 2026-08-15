package io.cadmin.gateway.security;

final class SecurityPaths {

    static final String[] PUBLIC = {
            "/login",
            "/login.html",
            "/css/**",
            "/js/**",
            "/img/**",
            "/vendor/**",
            "/webjars/**",
            "/favicon.ico",
            "/api/auth/config",
            "/actuator/health",
            "/actuator/health/**",
            "/actuator/info"
    };

    private SecurityPaths() {
    }
}
