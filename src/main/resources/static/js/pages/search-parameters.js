CadminApp.register("search-parameters", function (params) {
    const initialQuery = params[0] ? decodeURIComponent(params[0]) : "";
    let statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "retired", display: "Retired" },
        { code: "unknown", display: "Unknown" }
    ];
    let typeOptions = [
        { code: "string", display: "String" },
        { code: "token", display: "Token" },
        { code: "reference", display: "Reference" },
        { code: "date", display: "Date" },
        { code: "number", display: "Number" },
        { code: "quantity", display: "Quantity" },
        { code: "uri", display: "URI" },
        { code: "composite", display: "Composite" },
        { code: "special", display: "Special" }
    ];
    const baseOptions = [
        "Patient", "Practitioner", "PractitionerRole", "Organization", "Location",
        "Encounter", "Observation", "Condition", "Procedure", "AllergyIntolerance",
        "MedicationRequest", "DiagnosticReport", "DocumentReference", "Library",
        "SearchParameter", "Questionnaire", "ValueSet", "CodeSystem", "Appointment",
        "Coverage", "Device", "DeviceAssociation", "CareTeam", "Group", "HealthcareService",
        "RelatedPerson", "Task", "Subscription", "SubscriptionTopic", "Consent", "Flag"
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Search Parameters</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-search-parameter-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New search parameter</button>' +
        '</div>' +
        '<div id="search-parameter-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Search parameter search</h6>' +
                '<form class="d-flex" id="search-parameter-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="search-parameter-query" placeholder="Name or code" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Code</th><th>Base</th><th>Type</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="search-parameter-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
                '<div class="list-pager" id="search-parameter-pager"></div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-search-parameter-modal" tabindex="-1">' +
            '<div class="modal-dialog modal-lg">' +
                '<form class="modal-content" id="create-search-parameter-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create search parameter</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="sp-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Code</label>' +
                            '<input class="form-control" id="sp-code" required placeholder="Used in search URLs"></div>' +
                        '<div class="mb-3"><label class="form-label">Description</label>' +
                            '<textarea class="form-control" id="sp-description" rows="2" required></textarea></div>' +
                        '<div class="row">' +
                            '<div class="col-md-4 mb-3"><label class="form-label">Status</label>' +
                                '<select class="form-select" id="sp-status">' +
                                    statusOptions.map(function (option) {
                                        return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                    }).join("") +
                                "</select></div>" +
                            '<div class="col-md-4 mb-3"><label class="form-label">Type</label>' +
                                '<select class="form-select" id="sp-type">' +
                                    typeOptions.map(function (option) {
                                        return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                    }).join("") +
                                "</select></div>" +
                            '<div class="col-md-4 mb-3"><label class="form-label">Base</label>' +
                                '<select class="form-select" id="sp-base">' +
                                    baseOptions.map(function (type) {
                                        return '<option value="' + type + '">' + type + "</option>";
                                    }).join("") +
                                "</select></div>" +
                        "</div>" +
                        '<div class="mb-3"><label class="form-label">URL</label>' +
                            '<input class="form-control" id="sp-url" placeholder="https://fhirbox.local/fhir/SearchParameter/{code}"></div>' +
                        '<div class="mb-0"><label class="form-label">Expression</label>' +
                            '<input class="form-control" id="sp-expression" placeholder="FHIRPath, e.g. Patient.name"></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function statusLabel(code) {
        const match = statusOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success" : status === "retired" ? "secondary" : status === "draft" ? "warning" : "info";
        return '<span class="badge text-bg-' + kind + '">' + CadminApi.escapeHtml(statusLabel(status)) + "</span>";
    }

    function typeLabel(code) {
        const match = typeOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function baseLabel(resource) {
        return (resource.base || []).join(", ") || "—";
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/SearchParameter?_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("search-parameters");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "SearchParameter");
            CadminApi.renderPager("#search-parameter-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "search-parameters",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#search-parameter-rows").html('<tr><td colspan="7" class="text-muted">No search parameters found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (sp) {
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/resources/SearchParameter/" + encodeURIComponent(sp.id), sp.title || sp.name || "Untitled") + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(sp.code || "—") + "</code></td>" +
                    "<td>" + CadminApi.escapeHtml(baseLabel(sp)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(typeLabel(sp.type)) + "</td>" +
                    "<td>" + statusBadge(sp.status) + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(sp.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/resources/SearchParameter/' +
                        encodeURIComponent(sp.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#search-parameter-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#search-parameter-pager").empty();
            $("#search-parameter-rows").html('<tr><td colspan="7" class="text-danger">Unable to load search parameters from /fhir.</td></tr>');
            CadminApi.showAlert("#search-parameter-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#search-parameter-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#search-parameter-query").val());
    });

    $("#create-search-parameter-form").on("submit", function (event) {
        event.preventDefault();
        const code = $("#sp-code").val().trim();
        const name = $("#sp-name").val().trim();
        const resource = {
            resourceType: "SearchParameter",
            url: $("#sp-url").val().trim() || ("https://fhirbox.local/fhir/SearchParameter/" + encodeURIComponent(code)),
            name: name,
            status: $("#sp-status").val() || "draft",
            description: $("#sp-description").val(),
            code: code,
            base: [$("#sp-base").val()],
            type: $("#sp-type").val()
        };
        const expression = $("#sp-expression").val().trim();
        if (expression) {
            resource.expression = expression;
        }
        CadminApi.fhir("/SearchParameter", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-search-parameter-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Search parameter created.");
            load($("#search-parameter-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    CadminApi.fillValueSetSelect("#sp-status", CadminApi.valueSets.publicationStatus, {
        fallback: statusOptions,
        selected: "draft",
        onConcepts: function (concepts) { statusOptions = concepts; }
    });
    CadminApi.fillValueSetSelect("#sp-type", CadminApi.valueSets.searchParamType, {
        fallback: typeOptions,
        selected: "string",
        onConcepts: function (concepts) { typeOptions = concepts; }
    });
    CadminApi.fillValueSetSelect("#sp-base", CadminApi.valueSets.resourceTypes, {
        fallback: baseOptions.map(function (type) { return { code: type, display: type }; }),
        selected: "Patient",
        count: 300
    });

    load(initialQuery);
});
