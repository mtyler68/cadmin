CadminApp.register("patients", function (params) {
    const initialQuery = params[0] ? decodeURIComponent(params[0]) : "";
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Patients</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-patient-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New patient</button>' +
        '</div>' +
        '<div id="patient-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Patient search</h6>' +
                '<form class="d-flex" id="patient-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="patient-query" placeholder="Name or identifier" value="' + CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Gender</th><th>Birth date</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="patient-rows"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-patient-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-patient-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create patient</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Family name</label>' +
                            '<input class="form-control" id="p-family" required></div>' +
                        '<div class="mb-3"><label class="form-label">Given name</label>' +
                            '<input class="form-control" id="p-given" required></div>' +
                        '<div class="mb-3"><label class="form-label">Gender</label>' +
                            '<select class="form-select" id="p-gender">' +
                                '<option value="unknown">Unknown</option>' +
                                '<option value="female">Female</option>' +
                                '<option value="male">Male</option>' +
                                '<option value="other">Other</option>' +
                            '</select></div>' +
                        '<div class="mb-0"><label class="form-label">Birth date</label>' +
                            '<input type="date" class="form-control" id="p-birth"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    '</div>' +
                '</form>' +
            '</div>' +
        '</div>'
    );

    function patientName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function load(query) {
        let path = "/Patient?_count=50&_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(path).done(function (bundle) {
            const entries = (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
            if (!entries.length) {
                $("#patient-rows").html('<tr><td colspan="5" class="text-muted">No patients found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (p) {
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(patientName(p)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(p.gender || "—") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(p.birthDate || "—") + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(p.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/resources/Patient/' +
                        encodeURIComponent(p.id) + '">Open</a></td>' +
                    "</tr>";
            });
            $("#patient-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#patient-rows").html('<tr><td colspan="5" class="text-danger">Unable to load patients from /fhir.</td></tr>');
            CadminApi.showAlert("#patient-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#patient-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#patient-query").val());
    });

    $("#create-patient-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "Patient",
            name: [{ family: $("#p-family").val(), given: [$("#p-given").val()] }],
            gender: $("#p-gender").val()
        };
        const birth = $("#p-birth").val();
        if (birth) {
            resource.birthDate = birth;
        }
        CadminApi.fhir("/Patient", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-patient-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showAlert("#patient-alert", "success", "Patient created.");
            load($("#patient-query").val());
        }).fail(function (xhr) {
            CadminApi.showAlert("#patient-alert", "danger", "Create failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
});
