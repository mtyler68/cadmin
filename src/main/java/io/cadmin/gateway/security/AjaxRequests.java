package io.cadmin.gateway.security;

import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;

final class AjaxRequests {

    private AjaxRequests() {
    }

    static boolean isAjax(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        String accept = exchange.getRequest().getHeaders().getFirst("Accept");
        boolean api = path.startsWith("/api/") || path.startsWith("/fhir/");
        boolean xhr = "XMLHttpRequest".equals(exchange.getRequest().getHeaders().getFirst("X-Requested-With"));
        boolean json = accept != null && accept.contains(MediaType.APPLICATION_JSON_VALUE);
        return api || xhr || json;
    }
}
