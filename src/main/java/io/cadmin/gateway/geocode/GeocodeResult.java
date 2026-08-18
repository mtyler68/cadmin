package io.cadmin.gateway.geocode;

public record GeocodeResult(
        double latitude,
        double longitude,
        String displayName,
        boolean cached
) {
}
