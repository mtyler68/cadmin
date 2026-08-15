package io.cadmin.gateway;

import io.cadmin.gateway.config.CadminProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CadminProperties.class)
public class CadminGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(CadminGatewayApplication.class, args);
    }
}
