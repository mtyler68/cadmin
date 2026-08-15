# FHIR Box

FHIR Box is a hands-on explorer for [FHIR](https://hl7.org/fhir/). Use it to browse resources, try search, walk relationships, and inspect what a FHIR server can do.

It runs as a Spring Cloud Gateway host for a Bootstrap / jQuery UI. The gateway authenticates the browser, serves the app, and proxies API calls to [HAPI FHIR JPA Starter](https://github.com/hapifhir/hapi-fhir-jpaserver-starter).

Security is switchable:

- **local** — application-managed users (form login)
- **oidc** — authorization-code login with Keycloak (or any OIDC provider)

## Requirements

- Java 21+
- Docker and Docker Compose v2 (for Keycloak and HAPI FHIR)
- Maven Wrapper is included (`./mvnw`)

## Quick start (local users)

```bash
./mvnw spring-boot:run
```

Open http://localhost:8080 and sign in with `admin` / `admin` (or `clinician` / `clinician`).

The SPA is served from the gateway. Calls to `/fhir/**` are proxied to HAPI FHIR at `http://localhost:8081` (start that stack separately).

## Live reload (DevTools)

`spring-boot-devtools` is on the runtime classpath when you start from Maven or an IDE. It watches `target/classes` and reloads after a compile:

- **Java / configuration** — DevTools performs a fast application restart
- **Static SPA files** (`src/main/resources/static/**`) — copied onto the classpath and served without a restart (caching is disabled in the `local` profile)

Start the gateway and leave it running:

```bash
./mvnw spring-boot:run
```

After you edit Java, YAML, HTML, CSS, or JS, compile so DevTools sees the classpath change:

```bash
./mvnw compile
```

In IntelliJ IDEA use **Build → Build Project** (or enable automatic build while the app is running). In Eclipse, saving a file is enough.

Then refresh the browser. DevTools is not included in the packaged jar (`java -jar`), so production starts are unchanged.

## HAPI FHIR JPA Starter

```bash
docker compose -f docker/fhir/compose.yml up -d
```

| Service | URL / port |
| --- | --- |
| HAPI FHIR | http://localhost:8081 |
| FHIR API (via HAPI) | http://localhost:8081/fhir |
| FHIR API (via gateway) | http://localhost:8080/fhir |
| PostgreSQL | localhost:5432 (`admin` / `admin`, database `hapi`) |

The gateway route `/fhir/**` forwards to `cadmin.fhir.uri` (default `http://localhost:8081`) and strips the browser session cookie so HAPI does not see it. In OIDC mode the same route also applies `TokenRelay` so the access token is sent downstream.

Override the FHIR origin:

```bash
export CADMIN_FHIR_URI=http://localhost:8081
```

## Keycloak (OIDC)

```bash
docker compose -f docker/keycloak/compose.yml up -d
./mvnw spring-boot:run -Dspring-boot.run.profiles=oidc
```

| Service | URL / port |
| --- | --- |
| Keycloak | http://localhost:8180 |
| Admin console | http://localhost:8180 (`admin` / `admin`) |
| Realm | `cadmin` (imported from `docker/keycloak/realm/cadmin-realm.json`) |
| PostgreSQL | localhost:5433 (`keycloak` / `keycloak`, database `keycloak`) |

Imported application users:

- `admin` / `admin` (realm roles `admin`, `user`)
- `clinician` / `clinician` (realm role `user`)

Confidential client `cadmin-gateway` uses secret `cadmin-gateway-secret` and redirect URI `http://localhost:8080/login/oauth2/code/keycloak`.

Issuer and client settings can be overridden:

```bash
export CADMIN_OIDC_ISSUER=http://localhost:8180/realms/cadmin
export CADMIN_OIDC_CLIENT_ID=cadmin-gateway
export CADMIN_OIDC_CLIENT_SECRET=cadmin-gateway-secret
```

## Start both backing stacks

```bash
docker compose up -d
```

That include file starts FHIR and Keycloak together. Run the gateway on the host so the browser, Spring, and Keycloak all share `localhost` hostnames.

## Configuration

| Property | Default | Purpose |
| --- | --- | --- |
| `cadmin.security.mode` | `local` | `local` or `oidc` |
| `cadmin.security.users` | admin, clinician | Local form-login accounts |
| `cadmin.fhir.uri` | `http://localhost:8081` | Downstream HAPI FHIR origin |
| `spring.cloud.gateway.server.webflux.routes` | `/fhir/**` | Additional proxy routes |

Local users are defined in `src/main/resources/application.yml`. Passwords are treated as plaintext unless they already use a Spring `{id}` prefix such as `{bcrypt}...`.

Add another backend by appending a route:

```yaml
spring.cloud.gateway.server.webflux.routes:
  - id: other-api
    uri: http://localhost:8090
    predicates:
      - Path=/other-api/**
    filters:
      - StripPrefix=1
```

## Project layout

```
src/main/java/io/cadmin/gateway/   Gateway, security, JSON API
src/main/resources/static/          FHIR Box UI (Bootstrap / jQuery)
docker/fhir/                        HAPI FHIR + PostgreSQL
docker/keycloak/                    Keycloak + PostgreSQL + realm import
```

## Tests

```bash
./mvnw test
```
