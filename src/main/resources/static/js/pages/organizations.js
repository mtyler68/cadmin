CadminApp.register("organizations", function (params) {
    const token = params[0] ? decodeURIComponent(params[0]) : "";
    if (token) {
        CadminApi.fhir("/Organization/" + encodeURIComponent(token)).done(function (org) {
            CadminOrganizationDetail.render(org);
        }).fail(function () {
            renderOrganizationList(token);
        });
        return;
    }
    renderOrganizationList("");
});

function renderOrganizationList(initialQuery) {
    const typeOptions = [
        { code: "", display: "Unspecified" },
        { code: "prov", display: "Healthcare Provider" },
        { code: "dept", display: "Hospital Department" },
        { code: "team", display: "Organizational team" },
        { code: "govt", display: "Government" },
        { code: "ins", display: "Insurance Company" },
        { code: "pay", display: "Payer" },
        { code: "edu", display: "Educational Institute" },
        { code: "crs", display: "Clinical Research Sponsor" },
        { code: "other", display: "Other" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Organizations</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-organization-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New organization</button>' +
        '</div>' +
        '<div id="organization-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Organization search</h6>' +
                '<form class="d-flex" id="organization-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="organization-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Part of</th><th>Type</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="organization-rows"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-organization-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-organization-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create organization</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="org-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Type</label>' +
                            '<select class="form-select" id="org-type">' +
                                typeOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Part of</label>' +
                            '<select class="form-select" id="org-part-of">' +
                                '<option value="">None</option>' +
                            "</select></div>" +
                        '<div class="form-check mb-0">' +
                            '<input class="form-check-input" type="checkbox" id="org-active" checked>' +
                            '<label class="form-check-label" for="org-active">Active</label>' +
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

    function organizationType(resource) {
        const type = (resource.type && resource.type[0]) || {};
        const coding = (type.coding && type.coding[0]) || {};
        return type.text || coding.display || coding.code || "—";
    }

    function organizationPartOf(resource) {
        const partOf = resource.partOf || {};
        if (partOf.display) {
            return partOf.display;
        }
        const reference = partOf.reference || "";
        return reference.replace(/^Organization\//, "") || "—";
    }

    function typeByCode(code) {
        return typeOptions.find(function (option) { return option.code === code; });
    }

    function organizationEntries(bundle) {
        return (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
    }

    function loadPartOfOptions() {
        const $select = $("#org-part-of");
        const previous = $select.val();
        CadminApi.fhir("/Organization?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(organizationEntries(bundle).map(function (org) {
                return '<option value="' + CadminApi.escapeHtml(org.id) + '">' +
                    CadminApi.escapeHtml(org.name || org.id) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function load(query) {
        let path = "/Organization?_count=50&_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(path).done(function (bundle) {
            const entries = organizationEntries(bundle);
            if (!entries.length) {
                $("#organization-rows").html('<tr><td colspan="6" class="text-muted">No organizations found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (org) {
                const active = org.active !== false;
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(org.name || "Unnamed") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(organizationPartOf(org)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(organizationType(org)) + "</td>" +
                    "<td>" + (active
                        ? '<span class="badge text-bg-success">Active</span>'
                        : '<span class="badge text-bg-secondary">Inactive</span>') + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(org.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/organizations/' +
                        encodeURIComponent(org.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#organization-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#organization-rows").html('<tr><td colspan="6" class="text-danger">Unable to load organizations from /fhir.</td></tr>');
            CadminApi.showAlert("#organization-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#organization-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#organization-query").val());
    });

    $("#create-organization-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "Organization",
            name: $("#org-name").val(),
            active: $("#org-active").is(":checked")
        };
        const typeCode = $("#org-type").val();
        const selected = typeByCode(typeCode);
        if (selected && selected.code) {
            resource.type = [{
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/organization-type",
                    code: selected.code,
                    display: selected.display
                }]
            }];
        }
        const partOfId = $("#org-part-of").val();
        if (partOfId) {
            const partOfName = $("#org-part-of option:selected").text();
            resource.partOf = {
                reference: "Organization/" + partOfId,
                display: partOfName
            };
        }
        CadminApi.fhir("/Organization", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-organization-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showAlert("#organization-alert", "success", "Organization created.");
            load($("#organization-query").val());
            loadPartOfOptions();
        }).fail(function (xhr) {
            CadminApi.showAlert("#organization-alert", "danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#create-organization-modal").on("show.bs.modal", loadPartOfOptions);

    load(initialQuery);
}
