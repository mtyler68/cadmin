CadminApp.register("care-teams", function (params) {
    const initialQuery = params[0] ? decodeURIComponent(params[0]) : "";
    const statusOptions = [
        { code: "proposed", display: "Proposed" },
        { code: "active", display: "Active" },
        { code: "suspended", display: "Suspended" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const categoryOptions = [
        { code: "", display: "Unspecified" },
        { code: "LA27975-4", display: "Event-focused" },
        { code: "LA27976-2", display: "Encounter-focused" },
        { code: "LA27977-0", display: "Episode of care-focused" },
        { code: "LA27978-8", display: "Condition-focused" },
        { code: "LA28865-6", display: "Longitudinal care-coordination" },
        { code: "LA28866-4", display: "Home and community based services" },
        { code: "LA27980-4", display: "Clinical research" },
        { code: "LA28867-2", display: "Public health" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Care Teams</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-care-team-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New care team</button>' +
        '</div>' +
        '<div id="care-team-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Care team search</h6>' +
                '<form class="d-flex" id="care-team-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="care-team-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Category</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="care-team-rows"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-care-team-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-care-team-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create care team</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="ct-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="ct-status">' +
                                statusOptions.map(function (option) {
                                    const selected = option.code === "active" ? " selected" : "";
                                    return '<option value="' + option.code + '"' + selected + ">" +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Category</label>' +
                            '<select class="form-select" id="ct-category">' +
                                categoryOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Patient</label>' +
                            '<select class="form-select" id="ct-patient">' +
                                '<option value="">None</option>' +
                            "</select></div>" +
                        '<div class="mb-0"><label class="form-label">Managing organization</label>' +
                            '<select class="form-select" id="ct-organization">' +
                                '<option value="">None</option>' +
                            "</select></div>" +
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
        const kind = status === "active" ? "success"
            : status === "inactive" || status === "entered-in-error" ? "secondary"
                : status === "suspended" ? "warning"
                    : "info";
        return '<span class="badge text-bg-' + kind + '">' + CadminApi.escapeHtml(statusLabel(status)) + "</span>";
    }

    function careTeamCategory(resource) {
        const category = (resource.category && resource.category[0]) || {};
        const coding = (category.coding && category.coding[0]) || {};
        return category.text || coding.display || coding.code || "—";
    }

    function categoryByCode(code) {
        return categoryOptions.find(function (option) { return option.code === code; });
    }

    function bundleResources(bundle) {
        return (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
    }

    function personName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function fillReferenceSelect(selector, path, label) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle).map(function (resource) {
                return '<option value="' + CadminApi.escapeHtml(resource.id) + '">' +
                    CadminApi.escapeHtml(label(resource)) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function loadCreateOptions() {
        fillReferenceSelect("#ct-patient", "/Patient?_count=200&_sort=name", personName);
        fillReferenceSelect("#ct-organization", "/Organization?_count=200&_sort=name", function (org) {
            return org.name || org.id;
        });
    }

    function load(query) {
        let path = "/CareTeam?_count=50&_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(path).done(function (bundle) {
            const entries = bundleResources(bundle);
            if (!entries.length) {
                $("#care-team-rows").html('<tr><td colspan="5" class="text-muted">No care teams found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (team) {
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(team.name || "Unnamed") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(careTeamCategory(team)) + "</td>" +
                    "<td>" + statusBadge(team.status) + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(team.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/resources/CareTeam/' +
                        encodeURIComponent(team.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#care-team-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#care-team-rows").html('<tr><td colspan="5" class="text-danger">Unable to load care teams from /fhir.</td></tr>');
            CadminApi.showAlert("#care-team-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#care-team-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#care-team-query").val());
    });

    $("#create-care-team-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "CareTeam",
            name: $("#ct-name").val(),
            status: $("#ct-status").val() || "active"
        };
        const selected = categoryByCode($("#ct-category").val());
        if (selected && selected.code) {
            resource.category = [{
                coding: [{
                    system: "http://loinc.org",
                    code: selected.code,
                    display: selected.display
                }]
            }];
        }
        const patientId = $("#ct-patient").val();
        if (patientId) {
            resource.subject = {
                reference: "Patient/" + patientId,
                display: $("#ct-patient option:selected").text()
            };
        }
        const organizationId = $("#ct-organization").val();
        if (organizationId) {
            resource.managingOrganization = [{
                reference: "Organization/" + organizationId,
                display: $("#ct-organization option:selected").text()
            }];
        }
        CadminApi.fhir("/CareTeam", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-care-team-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Care team created.");
            load($("#care-team-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#create-care-team-modal").on("show.bs.modal", loadCreateOptions);

    load(initialQuery);
});
