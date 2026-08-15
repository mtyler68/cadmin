package io.cadmin.gateway.security;

import java.nio.charset.StandardCharsets;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.security.web.server.WebFilterExchange;
import org.springframework.security.web.server.authentication.RedirectServerAuthenticationSuccessHandler;
import org.springframework.security.web.server.authentication.ServerAuthenticationFailureHandler;
import org.springframework.security.web.server.authentication.ServerAuthenticationSuccessHandler;
import org.springframework.security.web.server.authentication.RedirectServerAuthenticationFailureHandler;
import reactor.core.publisher.Mono;

final class AjaxAuthenticationHandlers {

    private AjaxAuthenticationHandlers() {
    }

    static ServerAuthenticationSuccessHandler successHandler() {
        RedirectServerAuthenticationSuccessHandler browser =
                new RedirectServerAuthenticationSuccessHandler("/");
        return (exchange, authentication) -> {
            if (AjaxRequests.isAjax(exchange.getExchange())) {
                return writeJson(exchange, HttpStatus.OK, "{\"authenticated\":true}");
            }
            return browser.onAuthenticationSuccess(exchange, authentication);
        };
    }

    static ServerAuthenticationFailureHandler failureHandler() {
        RedirectServerAuthenticationFailureHandler browser =
                new RedirectServerAuthenticationFailureHandler("/login.html?error");
        return (exchange, exception) -> {
            if (AjaxRequests.isAjax(exchange.getExchange())) {
                return writeJson(exchange, HttpStatus.UNAUTHORIZED,
                        "{\"authenticated\":false,\"error\":\"Invalid username or password\"}");
            }
            return browser.onAuthenticationFailure(exchange, exception);
        };
    }

    private static Mono<Void> writeJson(WebFilterExchange exchange, HttpStatus status, String body) {
        ServerHttpResponse response = exchange.getExchange().getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
