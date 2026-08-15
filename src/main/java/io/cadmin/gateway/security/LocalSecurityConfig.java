package io.cadmin.gateway.security;

import io.cadmin.gateway.config.CadminProperties;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.userdetails.MapReactiveUserDetailsService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.authentication.logout.RedirectServerLogoutSuccessHandler;
import org.springframework.security.web.server.authentication.logout.ServerLogoutSuccessHandler;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;

@Configuration
@EnableWebFluxSecurity
@ConditionalOnProperty(name = "cadmin.security.mode", havingValue = "local", matchIfMissing = true)
public class LocalSecurityConfig {

    @Bean
    SecurityWebFilterChain localSecurityFilterChain(ServerHttpSecurity http) {
        SecuritySupport.common(http)
                .formLogin(form -> form
                        .loginPage("/login.html")
                        // WebFlux defaults the processing URL to loginPage ("/login.html").
                        // The SPA posts to /login, so pin the matcher or login returns 401.
                        .requiresAuthenticationMatcher(
                                ServerWebExchangeMatchers.pathMatchers(HttpMethod.POST, "/login"))
                        .authenticationSuccessHandler(AjaxAuthenticationHandlers.successHandler())
                        .authenticationFailureHandler(AjaxAuthenticationHandlers.failureHandler()))
                .logout(logout -> logout
                        .requiresLogout(SecuritySupport.logoutMatcher())
                        .logoutSuccessHandler(localLogoutSuccessHandler()));
        return http.build();
    }

    @Bean
    MapReactiveUserDetailsService localUserDetailsService(CadminProperties properties, PasswordEncoder encoder) {
        List<UserDetails> users = new ArrayList<>();
        for (CadminProperties.LocalUser user : properties.security().users()) {
            User.UserBuilder builder = User.builder()
                    .username(user.username())
                    .roles(user.roles().toArray(String[]::new));
            if (user.password() != null && user.password().startsWith("{")) {
                builder.password(user.password());
            } else {
                builder.password(user.password()).passwordEncoder(encoder::encode);
            }
            users.add(builder.build());
        }
        if (users.isEmpty()) {
            users.add(User.builder()
                    .username("admin")
                    .password("admin")
                    .roles("ADMIN", "USER")
                    .passwordEncoder(encoder::encode)
                    .build());
        }
        return new MapReactiveUserDetailsService(users);
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    private static ServerLogoutSuccessHandler localLogoutSuccessHandler() {
        RedirectServerLogoutSuccessHandler handler = new RedirectServerLogoutSuccessHandler();
        handler.setLogoutSuccessUrl(URI.create("/login.html?logout"));
        return handler;
    }
}
