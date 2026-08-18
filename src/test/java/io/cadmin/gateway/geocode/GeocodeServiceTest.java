package io.cadmin.gateway.geocode;

import static org.assertj.core.api.Assertions.assertThat;

import io.cadmin.gateway.config.CadminProperties;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class GeocodeServiceTest {

    @Test
    void queryPrefersFreeTextThenJoinsAddressParts() {
        assertThat(GeocodeService.queryOf("  1 Oak St  ", "ignored", "Portland", "OR", "97201", "US"))
                .isEqualTo("1 Oak St");
        assertThat(GeocodeService.queryOf(null, "1 Oak St", "Portland", "OR", "97201", "US"))
                .isEqualTo("1 Oak St, Portland, OR, 97201, US");
        assertThat(GeocodeService.queryOf(" ", "", null, "  ", null, null)).isBlank();
    }

    @Test
    void lookupUsesNominatimUserAgentAndCachesRepeats() {
        AtomicInteger calls = new AtomicInteger();
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            calls.incrementAndGet();
            assertThat(request.headers().getFirst(HttpHeaders.USER_AGENT)).contains("FHIR-Box");
            assertThat(java.net.URLDecoder.decode(request.url().getQuery(), java.nio.charset.StandardCharsets.UTF_8))
                    .contains("q=1 Oak St")
                    .contains("limit=1");
            return Mono.just(ClientResponse.create(HttpStatus.OK)
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .body("[{\"lat\":\"45.5\",\"lon\":\"-122.6\",\"display_name\":\"1 Oak St, Portland\"}]")
                    .build());
        });
        GeocodeService service = new GeocodeService(properties(), builder);

        StepVerifier.create(service.geocode(null, "1 Oak St", "Portland", "OR", null, null))
                .assertNext(result -> {
                    assertThat(result.latitude()).isEqualTo(45.5);
                    assertThat(result.longitude()).isEqualTo(-122.6);
                    assertThat(result.displayName()).isEqualTo("1 Oak St, Portland");
                    assertThat(result.cached()).isFalse();
                })
                .verifyComplete();
        StepVerifier.create(service.geocode(null, "1 Oak St", "Portland", "OR", null, null))
                .assertNext(result -> assertThat(result.cached()).isTrue())
                .verifyComplete();
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void emptyAddressIsBadRequest() {
        GeocodeService service = new GeocodeService(properties(), WebClient.builder());
        StepVerifier.create(service.geocode("  ", null, null, null, null, null))
                .expectErrorSatisfies(error -> {
                    assertThat(error).isInstanceOf(ResponseStatusException.class);
                    assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                })
                .verify();
    }

    @Test
    void noNominatimHitIsNotFound() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request ->
                Mono.just(ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, "application/json")
                        .body("[]")
                        .build()));
        GeocodeService service = new GeocodeService(properties(), builder);
        StepVerifier.create(service.geocode("Unknown Place", null, null, null, null, null))
                .expectErrorSatisfies(error -> {
                    assertThat(error).isInstanceOf(ResponseStatusException.class);
                    assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                })
                .verify();
    }

    private static CadminProperties properties() {
        return new CadminProperties(
                new CadminProperties.Security("local", java.util.List.of()),
                new CadminProperties.Fhir("http://localhost:8081"),
                new CadminProperties.Geocode(
                        "https://nominatim.openstreetmap.org",
                        "FHIR-Box/0.1 (io.cadmin.gateway; location-geocoder)"));
    }
}
