CadminApp.register("settings", function () {
    const user = CadminApp.user() || {};
    const config = CadminApp.config() || {};
    $("#app-content").html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Settings</h1>' +
        '</div>' +
        '<div class="row">' +
            '<div class="col-lg-6">' +
                '<div class="card shadow mb-4">' +
                    '<div class="card-header py-3"><h6 class="m-0">Security</h6></div>' +
                    '<div class="card-body">' +
                        '<dl class="row mb-0">' +
                            '<dt class="col-sm-4">Mode</dt><dd class="col-sm-8"><code>' + CadminApi.escapeHtml(config.mode) + "</code></dd>" +
                            '<dt class="col-sm-4">Signed in as</dt><dd class="col-sm-8">' + CadminApi.escapeHtml(user.username) + "</dd>" +
                            '<dt class="col-sm-4">Roles</dt><dd class="col-sm-8">' + CadminApi.escapeHtml((user.roles || []).join(", ")) + "</dd>" +
                        "</dl>" +
                        '<hr>' +
                        "<p class=\"small text-muted mb-0\">Change mode with Spring profiles: " +
                        "<code>local</code> (application users) or <code>oidc</code> (Keycloak). " +
                        "See the project README for Docker Compose bootstrap commands.</p>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            '<div class="col-lg-6">' +
                '<div class="card shadow mb-4">' +
                    '<div class="card-header py-3"><h6 class="m-0">Downstream proxies</h6></div>' +
                    '<div class="card-body">' +
                        "<p>FHIR Box serves the UI and proxies browser calls so exploration stays same-origin.</p>" +
                        '<ul class="mb-0">' +
                            "<li><code>/fhir/**</code> → HAPI FHIR JPA Starter (<code>cadmin.fhir.uri</code>)</li>" +
                            "<li><code>/api/**</code> → gateway JSON endpoints</li>" +
                        "</ul>" +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>"
    );
});
