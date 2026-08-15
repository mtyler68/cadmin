CadminApp.register("caregivers", function (params) {
    const token = params[0] ? decodeURIComponent(params[0]) : "";
    if (token) {
        CadminApi.fhir("/RelatedPerson/" + encodeURIComponent(token)).done(function (person) {
            CadminCaregiverDetail.render(person);
        }).fail(function () {
            renderCaregiverList(token);
        });
        return;
    }
    renderCaregiverList("");
});

function renderCaregiverList(initialQuery) {
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Caregivers</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-caregiver-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New caregiver</button>' +
        '</div>' +
        '<div id="caregiver-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Caregiver search</h6>' +
                '<form class="d-flex" id="caregiver-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="caregiver-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Gender</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="caregiver-rows"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-caregiver-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-caregiver-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create caregiver</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Family name</label>' +
                            '<input class="form-control" id="cg-family" required></div>' +
                        '<div class="mb-3"><label class="form-label">Given name</label>' +
                            '<input class="form-control" id="cg-given" required></div>' +
                        '<div class="mb-3"><label class="form-label">Gender</label>' +
                            '<select class="form-select" id="cg-gender">' +
                                '<option value="unknown">Unknown</option>' +
                                '<option value="female">Female</option>' +
                                '<option value="male">Male</option>' +
                                '<option value="other">Other</option>' +
                            "</select></div>" +
                        '<div class="form-check mb-0">' +
                            '<input class="form-check-input" type="checkbox" id="cg-active" checked>' +
                            '<label class="form-check-label" for="cg-active">Active</label>' +
                        "</div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function personName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function load(query) {
        let path = "/RelatedPerson?_count=50&_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(path).done(function (bundle) {
            const entries = (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
            if (!entries.length) {
                $("#caregiver-rows").html('<tr><td colspan="5" class="text-muted">No caregivers found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (person) {
                const active = person.active !== false;
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(personName(person)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(person.gender || "—") + "</td>" +
                    "<td>" + (active
                        ? '<span class="badge text-bg-success">Active</span>'
                        : '<span class="badge text-bg-secondary">Inactive</span>') + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(person.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/caregivers/' +
                        encodeURIComponent(person.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#caregiver-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#caregiver-rows").html('<tr><td colspan="5" class="text-danger">Unable to load caregivers from /fhir.</td></tr>');
            CadminApi.showAlert("#caregiver-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#caregiver-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#caregiver-query").val());
    });

    $("#create-caregiver-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "RelatedPerson",
            name: [{ family: $("#cg-family").val(), given: [$("#cg-given").val()] }],
            gender: $("#cg-gender").val(),
            active: $("#cg-active").is(":checked")
        };
        CadminApi.fhir("/RelatedPerson", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-caregiver-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Caregiver created.");
            load($("#caregiver-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
}
