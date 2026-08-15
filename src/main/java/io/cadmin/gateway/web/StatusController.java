package io.cadmin.gateway.web;

import io.cadmin.gateway.config.CadminProperties;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping(path = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class StatusController {

    private final CadminProperties properties;
    private final WebClient webClient;

    public StatusController(CadminProperties properties, WebClient.Builder builder) {
        this.properties = properties;
        this.webClient = builder.build();
    }

    @GetMapping("/status")
    public Mono<Map<String, Object>> status() {
        String fhirUri = properties.fhir().uri();
        return webClient.get()
                .uri(fhirUri + "/fhir/metadata")
                .retrieve()
                .toBodilessEntity()
                .map(response -> fhirStatus(fhirUri, true, response.getStatusCode().value(), null))
                .timeout(Duration.ofSeconds(4))
                .onErrorResume(error -> Mono.just(fhirStatus(fhirUri, false, 0, error.getMessage())));
    }

    private Map<String, Object> fhirStatus(String uri, boolean up, int status, String error) {
        Map<String, Object> fhir = new LinkedHashMap<>();
        fhir.put("name", "HAPI FHIR");
        fhir.put("uri", uri);
        fhir.put("proxyPath", "/fhir");
        fhir.put("up", up);
        fhir.put("status", status);
        if (error != null) {
            fhir.put("error", error);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("application", "FHIR Box");
        body.put("securityMode", properties.security().mode());
        body.put("fhir", fhir);
        return body;
    }
}
