package io.cadmin.gateway.geocode;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.cadmin.gateway.config.CadminProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@Service
public class GeocodeService {

    private static final Duration MIN_INTERVAL = Duration.ofSeconds(1);

    private final WebClient webClient;
    private final ConcurrentHashMap<String, GeocodeResult> cache = new ConcurrentHashMap<>();
    private final Object throttleLock = new Object();
    private Instant nextAllowed = Instant.EPOCH;

    public GeocodeService(CadminProperties properties, WebClient.Builder builder) {
        this.webClient = builder.clone()
                .baseUrl(properties.geocode().uri())
                .defaultHeader(HttpHeaders.USER_AGENT, properties.geocode().userAgent())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public Mono<GeocodeResult> geocode(
            String q,
            String line,
            String city,
            String state,
            String postalCode,
            String country
    ) {
        String query = queryOf(q, line, city, state, postalCode, country);
        if (query.isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Address is required"));
        }
        String key = normalize(query);
        GeocodeResult cached = cache.get(key);
        if (cached != null) {
            return Mono.just(new GeocodeResult(cached.latitude(), cached.longitude(), cached.displayName(), true));
        }
        return throttle()
                .then(lookup(query))
                .doOnNext(result -> cache.putIfAbsent(key, result));
    }

    static String queryOf(String q, String line, String city, String state, String postalCode, String country) {
        if (q != null && !q.isBlank()) {
            return q.trim();
        }
        return Stream.of(line, city, state, postalCode, country)
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .collect(Collectors.joining(", "));
    }

    static String normalize(String query) {
        return query.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private Mono<Void> throttle() {
        return Mono.defer(() -> {
            long waitMs;
            synchronized (throttleLock) {
                Instant now = Instant.now();
                if (now.isBefore(nextAllowed)) {
                    waitMs = Duration.between(now, nextAllowed).toMillis();
                    nextAllowed = nextAllowed.plus(MIN_INTERVAL);
                } else {
                    waitMs = 0;
                    nextAllowed = now.plus(MIN_INTERVAL);
                }
            }
            return waitMs > 0 ? Mono.delay(Duration.ofMillis(waitMs)).then() : Mono.empty();
        });
    }

    private Mono<GeocodeResult> lookup(String query) {
        return webClient.get()
                .uri(uri -> uri.path("/search")
                        .queryParam("q", query)
                        .queryParam("format", "json")
                        .queryParam("limit", 1)
                        .build())
                .retrieve()
                .onStatus(HttpStatusCode::isError, response -> Mono.error(new ResponseStatusException(
                        response.statusCode().value() == 429
                                ? HttpStatus.TOO_MANY_REQUESTS
                                : HttpStatus.BAD_GATEWAY,
                        "Geocoding service failed")))
                .bodyToFlux(NominatimHit.class)
                .next()
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "No matching location")))
                .map(GeocodeService::toResult);
    }

    private static GeocodeResult toResult(NominatimHit hit) {
        try {
            return new GeocodeResult(
                    Double.parseDouble(hit.lat()),
                    Double.parseDouble(hit.lon()),
                    hit.displayName(),
                    false);
        } catch (NullPointerException | NumberFormatException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Geocoding service failed");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record NominatimHit(
            String lat,
            String lon,
            @JsonProperty("display_name") String displayName
    ) {
    }
}
