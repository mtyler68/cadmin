CadminApp.register("users", function () {
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Application users</h1>' +
        '</div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3"><h6 class="m-0">Configured local users</h6></div>' +
            '<div class="card-body">' +
                '<p class="text-muted">These accounts are managed by the gateway when <code>cadmin.security.mode=local</code>. ' +
                "Switch to the <code>oidc</code> profile to delegate authentication to Keycloak.</p>" +
                '<div class="table-responsive">' +
                    '<table class="table align-middle">' +
                        '<thead><tr><th>Username</th><th>Roles</th></tr></thead>' +
                        '<tbody id="user-rows"><tr><td colspan="2" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>'
    );

    CadminApi.get("/api/auth/users").done(function (users) {
        if (!users || !users.length) {
            $("#user-rows").html('<tr><td colspan="2" class="text-muted">No local users are configured (OIDC mode or empty list).</td></tr>');
            return;
        }
        $("#user-rows").html(users.map(function (user) {
            return "<tr><td>" + CadminApi.escapeHtml(user.username) + "</td><td>" +
                (user.roles || []).map(function (role) {
                    return '<span class="badge text-bg-primary me-1">' + CadminApi.escapeHtml(role) + "</span>";
                }).join(" ") + "</td></tr>";
        }).join(""));
    });
});
