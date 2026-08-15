package io.cadmin.gateway.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.client.oidc.web.server.logout.OidcClientInitiatedServerLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ReactiveClientRegistrationRepository;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.authentication.logout.ServerLogoutSuccessHandler;

@Configuration
@EnableWebFluxSecurity
@ConditionalOnProperty(name = "cadmin.security.mode", havingValue = "oidc")
public class OidcSecurityConfig {

    @Bean
    SecurityWebFilterChain oidcSecurityFilterChain(
            ServerHttpSecurity http,
            ReactiveClientRegistrationRepository clients,
            @Value("${cadmin.security.oidc.post-logout-redirect-uri:{baseUrl}/login.html}") String postLogoutRedirectUri
    ) {
        SecuritySupport.common(http)
                .oauth2Login(oauth -> oauth
                        .authenticationSuccessHandler(AjaxAuthenticationHandlers.successHandler()))
                .logout(logout -> logout
                        .requiresLogout(SecuritySupport.logoutMatcher())
                        .logoutSuccessHandler(oidcLogoutSuccessHandler(clients, postLogoutRedirectUri)));
        return http.build();
    }

    private static ServerLogoutSuccessHandler oidcLogoutSuccessHandler(
            ReactiveClientRegistrationRepository clients,
            String postLogoutRedirectUri
    ) {
        OidcClientInitiatedServerLogoutSuccessHandler handler =
                new OidcClientInitiatedServerLogoutSuccessHandler(clients);
        handler.setPostLogoutRedirectUri(postLogoutRedirectUri);
        return handler;
    }
}
