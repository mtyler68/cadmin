package io.cadmin.gateway.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "cadmin")
public record CadminProperties(
        @DefaultValue Security security,
        @DefaultValue Fhir fhir
) {

    public record Security(
            @DefaultValue("local") String mode,
            @DefaultValue List<LocalUser> users
    ) {
        public Security {
            if (users == null) {
                users = new ArrayList<>();
            }
        }

        public boolean local() {
            return "local".equalsIgnoreCase(mode);
        }

        public boolean oidc() {
            return "oidc".equalsIgnoreCase(mode);
        }
    }

    public record LocalUser(
            String username,
            String password,
            @DefaultValue List<String> roles
    ) {
        public LocalUser {
            if (roles == null) {
                roles = new ArrayList<>();
            }
        }
    }

    public record Fhir(@DefaultValue("http://localhost:8081") String uri) {
    }
}
