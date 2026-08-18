package io.cadmin.gateway.web;

import io.cadmin.gateway.geocode.GeocodeResult;
import io.cadmin.gateway.geocode.GeocodeService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping(path = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class GeocodeController {

    private final GeocodeService geocodeService;

    public GeocodeController(GeocodeService geocodeService) {
        this.geocodeService = geocodeService;
    }

    @GetMapping("/geocode")
    public Mono<GeocodeResult> geocode(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String line,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String postalCode,
            @RequestParam(required = false) String country
    ) {
        return geocodeService.geocode(q, line, city, state, postalCode, country);
    }
}
