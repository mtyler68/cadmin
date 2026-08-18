CadminApp.register("endpoints", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Endpoint/" + encodeURIComponent(token)).done(function (endpoint) {
            CadminEndpointDetail.render(endpoint);
        }).fail(function () {
            renderEndpointList(token);
        });
        return;
    }
    renderEndpointList("");
});

function renderEndpointList(initialQuery) {
    const statusOptions = [
        { code: "active", display: "Active" },
        { code: "limited", display: "Limited" },
        { code: "suspended", display: "Suspended" },
        { code: "error", display: "Error" },
        { code: "off", display: "Off" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const connectionTypes = [
        { code: "hl7-fhir-rest", display: "HL7 FHIR REST" },
        { code: "hl7-fhir-msg", display: "HL7 FHIR Messaging" },
        { code: "hl7v2-mllp", display: "HL7 v2 MLLP" },
        { code: "direct-project", display: "Direct Project" },
        { code: "secure-email", display: "Secure email" },
        { code: "ihe-xds", display: "IHE XDS" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Endpoints</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-endpoint-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New endpoint</button>' +
        "</div>" +
        '<div id="endpoint-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Endpoint search</h6>' +
                '<form class="d-flex" id="endpoint-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="endpoint-query" placeholder="Name or address" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Organization</th><th>Status</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="endpoint-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="endpoint-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-endpoint-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-endpoint-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create endpoint</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="ep-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="ep-status">' +
                                statusOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Connection type</label>' +
                            '<select class="form-select" id="ep-type">' +
                                connectionTypes.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Address</label>' +
                            '<input class="form-control font-monospace" id="ep-address" required placeholder="https://example.org/fhir"></div>' +
                        '<div class="mb-0"><label class="form-label">Managing organization</label>' +
                            '<select class="form-select" id="ep-organization"><option value="">None</option></select></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function conceptLabel(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item) {
            return "—";
        }
        const coding = (item.coding && item.coding[0]) || {};
        return item.text || coding.display || coding.code || "—";
    }

    function refLabel(ref) {
        if (!ref) {
            return "—";
        }
        return ref.display || (ref.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "error" ? "danger"
                : status === "limited" || status === "suspended" ? "warning"
                    : "secondary";
        const match = statusOptions.find(function (option) { return option.code === status; });
        return '<span class="badge text-bg-' + kind + '">' +
            CadminApi.escapeHtml((match && match.display) || status || "—") + "</span>";
    }

    function fillOrganizations() {
        const $select = $("#ep-organization");
        const previous = $select.val();
        CadminApi.fhir("/Organization?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(CadminApi.bundleResources(bundle).map(function (org) {
                return '<option value="' + CadminApi.escapeHtml(org.id) + '">' +
                    CadminApi.escapeHtml(org.name || org.id) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Endpoint?_sort=-_lastUpdated";
        const q = (query || "").trim();
        if (q) {
            path += (/^https?:/i.test(q) ? "&address=" : "&name=") + encodeURIComponent(q);
        }
        CadminApi.fhir(CadminApi.pagedPath(path, listPage)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Endpoint");
            CadminApi.renderPager("#endpoint-pager", {
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#endpoint-rows").html('<tr><td colspan="7" class="text-muted">No endpoints found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (ep) {
                const orgId = CadminApi.referenceId(ep.managingOrganization);
                const orgHtml = orgId
                    ? CadminApi.resourceLink("#/organizations/" + encodeURIComponent(orgId), refLabel(ep.managingOrganization))
                    : CadminApi.escapeHtml(refLabel(ep.managingOrganization));
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/endpoints/" + encodeURIComponent(ep.id), ep.name || "Unnamed") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(conceptLabel(ep.connectionType)) + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(ep.address || "—") + "</code></td>" +
                    "<td>" + orgHtml + "</td>" +
                    "<td>" + statusBadge(ep.status) + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(ep.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/endpoints/' +
                        encodeURIComponent(ep.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#endpoint-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#endpoint-pager").empty();
            $("#endpoint-rows").html('<tr><td colspan="7" class="text-danger">Unable to load endpoints from /fhir.</td></tr>');
            CadminApi.showAlert("#endpoint-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#endpoint-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#endpoint-query").val());
    });

    $("#create-endpoint-form").on("submit", function (event) {
        event.preventDefault();
        const conn = connectionTypes.find(function (item) { return item.code === $("#ep-type").val(); });
        const resource = {
            resourceType: "Endpoint",
            status: $("#ep-status").val() || "active",
            name: $("#ep-name").val(),
            address: $("#ep-address").val(),
            connectionType: [{
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                    code: conn ? conn.code : "hl7-fhir-rest",
                    display: conn ? conn.display : "HL7 FHIR REST"
                }]
            }],
            payload: [{
                type: [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                        code: "any",
                        display: "Any"
                    }]
                }]
            }]
        };
        const orgId = $("#ep-organization").val();
        if (orgId) {
            resource.managingOrganization = {
                reference: "Organization/" + orgId,
                display: $("#ep-organization option:selected").text()
            };
        }
        CadminApi.fhir("/Endpoint", "POST", resource).done(function (created) {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-endpoint-modal"));
            if (modal) {
                modal.hide();
            }
            if (created && created.id && orgId) {
                CadminApi.fhir("/Organization/" + encodeURIComponent(orgId)).done(function (org) {
                    org.endpoint = org.endpoint || [];
                    org.endpoint.push({
                        reference: "Endpoint/" + created.id,
                        display: created.name
                    });
                    CadminApi.fhir("/Organization/" + encodeURIComponent(orgId), "PUT", org);
                });
            }
            CadminApi.showToast("success", "Endpoint created.");
            load($("#endpoint-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#create-endpoint-modal").on("show.bs.modal", fillOrganizations);

    load(initialQuery);
}
