package io.cadmin.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.reactive.function.BodyInserters;

@SpringBootTest
@AutoConfigureWebTestClient
@ActiveProfiles("local")
class CadminGatewayApplicationTests {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void contextLoads() {
    }

    @Test
    void authConfigIsPublic() {
        webTestClient.get()
                .uri("/api/auth/config")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.mode").isEqualTo("local")
                .jsonPath("$.fhirBaseUrl").isEqualTo("/fhir");
    }

    @Test
    void fhirRequiresAuthentication() {
        webTestClient.get()
                .uri("/fhir/Patient")
                .header("Accept", "application/json")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void currentUserRequiresAuthentication() {
        webTestClient.get()
                .uri("/api/auth/me")
                .header("Accept", "application/json")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void currentUserReturnsAuthenticatedPrincipal() {
        webTestClient.get()
                .uri("/api/auth/me")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.username").isEqualTo("admin")
                .jsonPath("$.mode").isEqualTo("local");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void localUsersAreListedForAuthenticatedCaller() {
        webTestClient.get()
                .uri("/api/auth/users")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$[0].username").isEqualTo("admin")
                .jsonPath("$[1].username").isEqualTo("clinician");
    }

    @Test
    void adminCanSignInViaFormLogin() {
        webTestClient.post()
                .uri("/login")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData("username", "admin").with("password", "admin"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.authenticated").isEqualTo(true)
                .jsonPath("$.username").isEqualTo("admin");
    }

    @Test
    void adminCanSignInViaJsonLoginAtRoot() {
        webTestClient.post()
                .uri("/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"username\":\"admin\",\"password\":\"admin\"}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.authenticated").isEqualTo(true)
                .jsonPath("$.username").isEqualTo("admin");
    }

    @Test
    void adminCanSignInViaJsonLogin() {
        webTestClient.post()
                .uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"username\":\"admin\",\"password\":\"admin\"}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.authenticated").isEqualTo(true)
                .jsonPath("$.username").isEqualTo("admin");
    }

    @Test
    void unknownUserIsRejected() {
        webTestClient.post()
                .uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"username\":\"admin\",\"password\":\"wrong\"}")
                .exchange()
                .expectStatus().isUnauthorized();
    }
}
