CadminApp.register("resources", function (params) {
    const type = params[0] || "Patient";
    const id = params[1] || "";
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">FHIR browser</h1>' +
        '</div>' +
        '<div id="resource-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3"><h6 class="m-0">Read resource</h6></div>' +
            '<div class="card-body">' +
                '<form class="row g-2 align-items-end" id="resource-form">' +
                    '<div class="col-md-4">' +
                        '<label class="form-label">Resource type</label>' +
                        '<input class="form-control" id="res-type" value="' + CadminApi.escapeHtml(type) + '">' +
                    '</div>' +
                    '<div class="col-md-5">' +
                        '<label class="form-label">ID (optional)</label>' +
                        '<input class="form-control" id="res-id" value="' + CadminApi.escapeHtml(id) + '" placeholder="Leave blank to search">' +
                    '</div>' +
                    '<div class="col-md-3">' +
                        '<button class="btn btn-primary w-100" type="submit">Fetch</button>' +
                    '</div>' +
                '</form>' +
                '<pre class="json-view mt-3 mb-0" id="resource-json">Select a type and fetch.</pre>' +
            '</div>' +
        '</div>'
    );

    function fetchResource() {
        const resourceType = $("#res-type").val().trim();
        const resourceId = $("#res-id").val().trim();
        if (!resourceType) {
            return;
        }
        const path = resourceId
            ? "/" + encodeURIComponent(resourceType) + "/" + encodeURIComponent(resourceId)
            : "/" + encodeURIComponent(resourceType) + "?_count=20&_sort=-_lastUpdated";
        $("#resource-json").text("Loading…");
        CadminApi.fhir(path).done(function (body) {
            $("#resource-json").text(JSON.stringify(body, null, 2));
        }).fail(function (xhr) {
            $("#resource-json").text("");
            CadminApi.showAlert("#resource-alert", "danger",
                "FHIR request failed (" + xhr.status + ").");
        });
    }

    $("#resource-form").on("submit", function (event) {
        event.preventDefault();
        const nextType = $("#res-type").val().trim();
        const nextId = $("#res-id").val().trim();
        window.location.hash = "#/resources/" + encodeURIComponent(nextType) + (nextId ? "/" + encodeURIComponent(nextId) : "");
        fetchResource();
    });

    fetchResource();
});
