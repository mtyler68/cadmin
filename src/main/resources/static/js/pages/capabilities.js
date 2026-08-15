CadminApp.register("capabilities", function () {
    const interactions = [
        { code: "read", label: "Read" },
        { code: "vread", label: "VRead" },
        { code: "update", label: "Update" },
        { code: "patch", label: "Patch" },
        { code: "delete", label: "Delete" },
        { code: "history-instance", label: "Hx inst" },
        { code: "history-type", label: "Hx type" },
        { code: "create", label: "Create" },
        { code: "search-type", label: "Search" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">FHIR Capabilities</h1>' +
            '<button class="btn btn-outline-primary" type="button" id="cap-toggle-json">' +
                '<i class="bi bi-code-slash me-1"></i>View JSON</button>' +
        "</div>" +
        '<div id="cap-alert" class="alert d-none"></div>' +
        '<div class="row" id="cap-stats">' +
            '<div class="col-12"><p class="text-muted">Loading CapabilityStatement…</p></div>' +
        "</div>" +
        '<div id="cap-body"></div>' +
        '<div class="card shadow mb-4 d-none" id="cap-json-card">' +
            '<div class="card-header py-3"><h6 class="m-0">CapabilityStatement JSON</h6></div>' +
            '<div class="card-body"><pre class="json-view mb-0" id="cap-json"></pre></div>' +
        "</div>"
    );

    let statement = null;

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function conceptLabel(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item) {
            return "";
        }
        const coding = (item.coding && item.coding[0]) || item;
        return item.text || coding.display || coding.code || "";
    }

    function chips(values) {
        if (!values.length) {
            return "";
        }
        return values.map(function (value) {
            return '<span class="cap-chip">' + esc(value) + "</span>";
        }).join("");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "retired" ? "secondary"
                : status === "draft" ? "warning"
                    : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(status || "—") + "</span>";
    }

    function flag(yes) {
        return yes
            ? '<i class="bi bi-check-circle-fill cap-yes" title="Supported" aria-label="Supported"></i>'
            : '<i class="bi bi-dash cap-no" title="Not supported" aria-label="Not supported"></i>';
    }

    function hasInteraction(resource, code) {
        return (resource.interaction || []).some(function (item) {
            return item.code === code;
        });
    }

    function rest() {
        return (statement && statement.rest && statement.rest[0]) || {};
    }

    function resources() {
        return rest().resource || [];
    }

    function statCard(border, label, value, icon) {
        return '<div class="col-xl-3 col-md-6 mb-4">' +
            '<div class="card border-left-' + border + ' shadow h-100 py-2">' +
                '<div class="card-body">' +
                    '<div class="row align-items-center no-gutters">' +
                        '<div class="col me-2">' +
                            '<div class="text-xs text-uppercase text-' + border + ' mb-1">' + label + "</div>" +
                            '<div class="h5 mb-0 stat-value">' + esc(value) + "</div>" +
                        "</div>" +
                        '<div class="col-auto text-gray-400"><i class="bi ' + icon + ' fs-2"></i></div>' +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function renderOverview() {
        const server = rest();
        const software = statement.software || {};
        const impl = statement.implementation || {};
        const formats = (statement.format || []).concat(statement.patchFormat || []);
        const security = server.security || {};
        const services = (security.service || []).map(conceptLabel).filter(Boolean);
        const systemOps = (server.interaction || []).map(function (item) { return item.code; })
            .concat((server.operation || []).map(function (item) {
                return item.name ? (item.name.charAt(0) === "$" ? item.name : "$" + item.name) : "";
            })).filter(Boolean);
        const resourceCount = resources().length;
        const searchable = resources().filter(function (item) {
            return hasInteraction(item, "search-type");
        }).length;
        $("#cap-stats").html(
            statCard("primary", "FHIR version", statement.fhirVersion || "—", "bi-file-earmark-medical") +
            statCard("success", "Software", [software.name, software.version].filter(Boolean).join(" ") || "—", "bi-hdd-stack") +
            statCard("info", "Resource types", String(resourceCount), "bi-collection") +
            statCard("warning", "Searchable", searchable + " of " + resourceCount, "bi-search")
        );
        $("#cap-body").html(
            '<div class="row">' +
                '<div class="col-lg-7">' +
                    '<div class="card shadow mb-4">' +
                        '<div class="card-header py-3"><h6 class="m-0">Server</h6></div>' +
                        '<div class="card-body">' +
                            '<dl class="row mb-0">' +
                                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(statement.status) + "</dd>" +
                                '<dt class="col-sm-3">Kind</dt><dd class="col-sm-9">' + esc(statement.kind || "—") + "</dd>" +
                                '<dt class="col-sm-3">Mode</dt><dd class="col-sm-9">' + esc(server.mode || "—") + "</dd>" +
                                '<dt class="col-sm-3">Publisher</dt><dd class="col-sm-9">' + esc(statement.publisher || "—") + "</dd>" +
                                '<dt class="col-sm-3">Date</dt><dd class="col-sm-9">' + esc((statement.date || "").replace("T", " ").slice(0, 19) || "—") + "</dd>" +
                                '<dt class="col-sm-3">Implementation</dt><dd class="col-sm-9">' +
                                    esc(impl.description || impl.url || "—") +
                                    (impl.url ? ' <code>' + esc(impl.url) + "</code>" : "") +
                                "</dd>" +
                                '<dt class="col-sm-3">Formats</dt><dd class="col-sm-9">' +
                                    (formats.length ? chips(formats) : "—") + "</dd>" +
                                '<dt class="col-sm-3">Security</dt><dd class="col-sm-9">' +
                                    (security.cors ? '<span class="badge text-bg-success me-1">CORS</span>' : "") +
                                    chips(services) +
                                    (security.description ? '<div class="small text-muted mt-1">' + esc(security.description) + "</div>" : "") +
                                    (!security.cors && !services.length && !security.description ? "—" : "") +
                                "</dd>" +
                            "</dl>" +
                        "</div>" +
                    "</div>" +
                "</div>" +
                '<div class="col-lg-5">' +
                    '<div class="card shadow mb-4">' +
                        '<div class="card-header py-3"><h6 class="m-0">System interactions</h6></div>' +
                        '<div class="card-body">' +
                            (systemOps.length ? chips(systemOps) : '<p class="text-muted mb-0">No system-level interactions advertised.</p>') +
                            (server.documentation ? '<p class="small text-muted mt-3 mb-0">' + esc(server.documentation) + "</p>" : "") +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Resource capabilities</h6>' +
                    '<input class="form-control form-control-sm cap-filter" id="cap-filter" placeholder="Filter resource type">' +
                "</div>" +
                '<div class="card-body">' +
                    '<div class="table-responsive">' +
                        '<table class="table table-hover align-middle cap-matrix mb-0">' +
                            "<thead><tr>" +
                                "<th class=\"text-start\">Resource</th>" +
                                interactions.map(function (item) {
                                    return "<th>" + esc(item.label) + "</th>";
                                }).join("") +
                                "<th>Params</th><th>Ops</th>" +
                            "</tr></thead>" +
                            '<tbody id="cap-rows"></tbody>' +
                        "</table>" +
                    "</div>" +
                "</div>" +
            "</div>"
        );
        renderMatrix($("#cap-filter").val());
        $("#cap-filter").on("input", function () {
            renderMatrix($(this).val());
        });
        $("#cap-rows").on("click", "tr.cap-row", function () {
            const type = $(this).attr("data-type");
            const $detail = $('#cap-detail-' + type);
            const open = !$detail.hasClass("d-none");
            $root.find("tr.cap-detail").addClass("d-none");
            $root.find("tr.cap-row .bi-chevron-down").removeClass("bi-chevron-down").addClass("bi-chevron-right");
            if (!open) {
                $detail.removeClass("d-none");
                $(this).find(".cap-chevron").removeClass("bi-chevron-right").addClass("bi-chevron-down");
            }
        });
    }

    function detailHtml(resource) {
        const params = resource.searchParam || [];
        const ops = resource.operation || [];
        const includes = (resource.searchInclude || []).concat(resource.searchRevInclude || []);
        const extras = [
            resource.versioning ? "versioning: " + resource.versioning : "",
            resource.conditionalCreate ? "conditional create" : "",
            resource.conditionalUpdate ? "conditional update" : "",
            resource.conditionalDelete && resource.conditionalDelete !== "not-supported"
                ? "conditional delete: " + resource.conditionalDelete : "",
            resource.readHistory ? "instance history" : "",
            resource.updateCreate ? "update-as-create" : ""
        ].filter(Boolean);
        let html = '<div class="mb-2">' +
            '<a class="small" href="#/resources/' + encodeURIComponent(resource.type) + '">' +
                '<i class="bi bi-box-arrow-up-right me-1"></i>Open in FHIR browser</a>' +
            "</div>";
        if (extras.length) {
            html += '<div class="mb-2">' + chips(extras) + "</div>";
        }
        if (includes.length) {
            html += '<div class="mb-2"><span class="text-xs text-uppercase text-gray-600">Includes</span><div>' +
                chips(includes) + "</div></div>";
        }
        if (params.length) {
            html += '<div class="table-responsive mb-2"><table class="table table-sm mb-0">' +
                "<thead><tr><th>Search parameter</th><th>Type</th><th>Documentation</th></tr></thead><tbody>" +
                params.map(function (param) {
                    return "<tr><td><code>" + esc(param.name) + "</code></td><td>" +
                        esc(param.type || "—") + "</td><td>" + esc(param.documentation || "—") + "</td></tr>";
                }).join("") +
                "</tbody></table></div>";
        }
        if (ops.length) {
            html += '<div class="table-responsive"><table class="table table-sm mb-0">' +
                "<thead><tr><th>Operation</th><th>Definition</th></tr></thead><tbody>" +
                ops.map(function (op) {
                    const name = op.name ? (op.name.charAt(0) === "$" ? op.name : "$" + op.name) : "—";
                    return "<tr><td><code>" + esc(name) + "</code></td><td>" +
                        esc(op.definition || "—") + "</td></tr>";
                }).join("") +
                "</tbody></table></div>";
        }
        if (!params.length && !ops.length && !includes.length && !extras.length) {
            html += '<p class="text-muted mb-0">No additional search parameters or operations advertised.</p>';
        }
        return html;
    }

    function renderMatrix(query) {
        const needle = (query || "").trim().toLowerCase();
        const rows = resources().filter(function (resource) {
            return !needle || (resource.type || "").toLowerCase().indexOf(needle) >= 0;
        });
        if (!rows.length) {
            $("#cap-rows").html('<tr><td colspan="' + (interactions.length + 3) +
                '" class="text-muted">No resource types match.</td></tr>');
            return;
        }
        $("#cap-rows").html(rows.map(function (resource) {
            const type = resource.type || "Unknown";
            const paramCount = (resource.searchParam || []).length;
            const opCount = (resource.operation || []).length;
            return '<tr class="cap-row" data-type="' + esc(type) + '">' +
                '<td class="text-start"><i class="bi bi-chevron-right cap-chevron me-1 text-gray-400"></i>' +
                    "<strong>" + esc(type) + "</strong></td>" +
                interactions.map(function (item) {
                    return '<td class="cap-flag">' + flag(hasInteraction(resource, item.code)) + "</td>";
                }).join("") +
                '<td class="cap-flag">' + esc(String(paramCount)) + "</td>" +
                '<td class="cap-flag">' + esc(String(opCount)) + "</td>" +
                "</tr>" +
                '<tr class="cap-detail d-none" id="cap-detail-' + esc(type) + '">' +
                    '<td colspan="' + (interactions.length + 3) + '">' + detailHtml(resource) + "</td>" +
                "</tr>";
        }).join(""));
    }

    $("#cap-toggle-json").on("click", function () {
        const hidden = $("#cap-json-card").toggleClass("d-none").hasClass("d-none");
        $(this).html(hidden
            ? '<i class="bi bi-code-slash me-1"></i>View JSON'
            : '<i class="bi bi-x-lg me-1"></i>Hide JSON');
    });

    CadminApi.fhir("/metadata").done(function (body) {
        statement = body || {};
        $("#cap-json").text(JSON.stringify(statement, null, 2));
        renderOverview();
    }).fail(function (xhr) {
        $("#cap-stats").html("");
        CadminApi.showAlert("#cap-alert", "danger",
            "Unable to load /fhir/metadata (" + xhr.status + "). Is the HAPI FHIR stack running?");
    });
});
