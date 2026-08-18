CadminApp.register("dashboard", function () {
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<div>' +
                '<h1 class="h3 mb-1 page-title">Dashboard</h1>' +
                '<p class="text-muted mb-0">Explore FHIR resources, search, and what this server can do.</p>' +
            '</div>' +
            '<span class="badge bg-primary badge-mode" id="dash-mode"></span>' +
        '</div>' +
        '<div class="row" id="dash-cards"></div>' +
        '<div class="d-sm-flex align-items-center justify-content-between mb-3">' +
            '<h2 class="h5 mb-0">FHIR resources</h2>' +
            '<span class="text-muted small" id="dash-count-status">Loading counts…</span>' +
        "</div>" +
        '<div class="row" id="dash-counts"></div>' +
        '<div class="card shadow mb-4 d-none" id="dash-other-card">' +
            '<div class="card-header py-3"><h6 class="m-0">Other resource types</h6></div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle mb-0">' +
                        "<thead><tr><th>Type</th><th class=\"text-end\">Count</th><th></th></tr></thead>" +
                        '<tbody id="dash-other-rows"></tbody>' +
                    "</table>" +
                "</div>" +
            "</div>" +
        "</div>" +
        '<div class="row">' +
            '<div class="col-lg-7">' +
                '<div class="card shadow mb-4">' +
                    '<div class="card-header py-3"><h6 class="m-0">Gateway</h6></div>' +
                    '<div class="card-body" id="dash-gateway"></div>' +
                '</div>' +
            '</div>' +
            '<div class="col-lg-5">' +
                '<div class="card shadow mb-4">' +
                    '<div class="card-header py-3"><h6 class="m-0">Quick actions</h6></div>' +
                    '<div class="card-body">' +
                        '<a class="btn btn-primary me-2 mb-2" href="#/patients">Browse patients</a>' +
                        '<a class="btn btn-outline-primary me-2 mb-2" href="#/resources">Open FHIR browser</a>' +
                        '<a class="btn btn-outline-primary me-2 mb-2" href="#/capabilities">FHIR capabilities</a>' +
                        (CadminApp.isAdmin()
                            ? '<a class="btn btn-outline-primary me-2 mb-2" href="#/demo-data">Generate demo data</a>' +
                              '<a class="btn btn-outline-primary me-2 mb-2" href="#/subscription-topics">Subscription topics</a>' +
                              '<a class="btn btn-outline-primary me-2 mb-2" href="#/subscriptions">Subscriptions</a>' +
                              '<a class="btn btn-outline-primary me-2 mb-2" href="#/endpoints">Endpoints</a>' +
                              '<a class="btn btn-outline-primary me-2 mb-2" href="#/questionnaires">Questionnaires</a>' +
                              '<a class="btn btn-outline-primary me-2 mb-2" href="#/consents">Consents</a>'
                            : "") +
                        '<a class="btn btn-outline-secondary mb-2" href="#/settings">Settings</a>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>'
    );

    const user = CadminApp.user() || {};
    const config = CadminApp.config() || {};
    $("#dash-mode").text((config.mode || "local").toUpperCase());

    function card(col, border, label, value, icon) {
        return '<div class="col-xl-3 col-md-6 mb-4">' +
            '<div class="card border-left-' + border + ' shadow h-100 py-2">' +
                '<div class="card-body">' +
                    '<div class="row align-items-center no-gutters">' +
                        '<div class="col me-2">' +
                            '<div class="text-xs text-uppercase text-' + border + ' mb-1">' + label + '</div>' +
                            '<div class="h5 mb-0 stat-value">' + CadminApi.escapeHtml(value) + '</div>' +
                        '</div>' +
                        '<div class="col-auto text-gray-400"><i class="bi ' + icon + ' fs-2"></i></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    const countMetrics = [
        { type: "Patient", label: "Patients", href: "#/patients", icon: "bi-people", border: "primary" },
        { type: "RelatedPerson", label: "Caregivers", href: "#/caregivers", icon: "bi-person-heart", border: "info" },
        { type: "Practitioner", label: "Practitioners", href: "#/practitioners", iconify: "mdi:doctor", border: "success" },
        { type: "Device", label: "Devices", href: "#/devices", iconify: "mdi:devices", border: "warning" },
        { type: "Organization", label: "Organizations", href: "#/organizations", icon: "bi-building", border: "primary", admin: true },
        { type: "Location", label: "Locations", href: "#/locations", icon: "bi-geo-alt", border: "info", admin: true },
        { type: "CareTeam", label: "Care teams", href: "#/care-teams", icon: "bi-people-fill", border: "success", admin: true },
        { type: "Consent", label: "Consents", href: "#/consents", icon: "bi-shield-check", border: "warning", admin: true },
        { type: "Subscription", label: "Subscriptions", href: "#/subscriptions", icon: "bi-broadcast", border: "info", admin: true },
        { type: "Endpoint", label: "Endpoints", href: "#/endpoints", icon: "bi-hdd-network", border: "secondary", admin: true },
        { type: "SubscriptionTopic", label: "Topics", href: "#/subscription-topics", icon: "bi-bookmark-star", border: "primary", admin: true },
        { type: "Library", label: "Libraries", href: "#/pds-policies", icon: "bi-journal-text", border: "success", admin: true },
        { type: "SearchParameter", label: "Search params", href: "#/search-parameters", icon: "bi-search", border: "warning", admin: true },
        { type: "Questionnaire", label: "Questionnaires", href: "#/questionnaires", icon: "bi-ui-checks", border: "info", admin: true }
    ];

    function featuredMetrics() {
        return countMetrics.filter(function (metric) {
            return !metric.admin || CadminApp.isAdmin();
        });
    }

    function formatCount(value) {
        if (value == null) {
            return "—";
        }
        return Number(value).toLocaleString();
    }

    function countIcon(metric) {
        if (metric.iconify) {
            return '<iconify-icon icon="' + metric.iconify + '" class="stat-icon" aria-hidden="true"></iconify-icon>';
        }
        return '<i class="bi ' + metric.icon + ' fs-2"></i>';
    }

    function countCard(metric, value) {
        return '<div class="col-xl-3 col-md-6 mb-4">' +
            '<a class="dash-count-card text-decoration-none" href="' + metric.href + '">' +
                '<div class="card border-left-' + metric.border + ' shadow h-100 py-2">' +
                    '<div class="card-body">' +
                        '<div class="row align-items-center no-gutters">' +
                            '<div class="col me-2">' +
                                '<div class="text-xs text-uppercase text-' + metric.border + ' mb-1">' +
                                    CadminApi.escapeHtml(metric.label) + "</div>" +
                                '<div class="h5 mb-0 stat-value">' + CadminApi.escapeHtml(formatCount(value)) + "</div>" +
                            "</div>" +
                            '<div class="col-auto text-gray-400">' + countIcon(metric) + "</div>" +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</a></div>";
    }

    function parseCountParameters(parameters) {
        const counts = {};
        ((parameters && parameters.parameter) || []).forEach(function (item) {
            if (item && item.name && typeof item.valueInteger === "number") {
                counts[item.name] = item.valueInteger;
            }
        });
        return counts;
    }

    function renderCounts(counts, note) {
        const featured = featuredMetrics();
        const featuredTypes = {};
        $("#dash-counts").html(featured.map(function (metric) {
            featuredTypes[metric.type] = true;
            const value = Object.prototype.hasOwnProperty.call(counts, metric.type) ? counts[metric.type] : 0;
            return countCard(metric, value);
        }).join(""));
        const others = Object.keys(counts).filter(function (type) {
            return !featuredTypes[type] && counts[type] > 0;
        }).sort();
        if (others.length) {
            $("#dash-other-rows").html(others.map(function (type) {
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(type) + "</td>" +
                    '<td class="text-end">' + CadminApi.escapeHtml(formatCount(counts[type])) + "</td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/resources/' +
                        encodeURIComponent(type) + '">Browse</a></td></tr>';
            }).join(""));
            $("#dash-other-card").removeClass("d-none");
        } else {
            $("#dash-other-card").addClass("d-none");
        }
        $("#dash-count-status").text(note || "");
    }

    function loadResourceCounts() {
        const featured = featuredMetrics();
        const cached = {};
        const live = {};
        let pending = featured.length + 1;
        let finished = false;

        function finish() {
            pending -= 1;
            if (pending > 0 || finished) {
                return;
            }
            finished = true;
            const counts = Object.assign({}, cached);
            featured.forEach(function (metric) {
                if (typeof live[metric.type] === "number") {
                    counts[metric.type] = live[metric.type];
                } else if (!Object.prototype.hasOwnProperty.call(counts, metric.type)) {
                    counts[metric.type] = live[metric.type];
                }
            });
            renderCounts(counts);
        }

        CadminApi.fhir("/$get-resource-counts")
            .done(function (parameters) {
                Object.assign(cached, parseCountParameters(parameters));
            })
            .always(finish);

        featured.forEach(function (metric) {
            CadminApi.fhir("/" + encodeURIComponent(metric.type) + "?_summary=count&_count=0")
                .done(function (bundle) {
                    if (typeof bundle.total === "number") {
                        live[metric.type] = bundle.total;
                    }
                })
                .fail(function () {
                    live[metric.type] = Object.prototype.hasOwnProperty.call(cached, metric.type)
                        ? cached[metric.type]
                        : null;
                })
                .always(finish);
        });
    }

    CadminApi.get("/api/status").done(function (status) {
        const fhir = status.fhir || {};
        $("#dash-cards").html(
            card("3", "primary", "Signed in", user.displayName || user.username || "—", "bi-person-check") +
            card("3", "success", "HAPI FHIR", fhir.up ? "Reachable" : "Unavailable", "bi-activity") +
            card("3", "info", "Proxy path", fhir.proxyPath || "/fhir", "bi-diagram-3") +
            card("3", "warning", "Security", (status.securityMode || config.mode || "").toUpperCase(), "bi-shield-lock")
        );
        $("#dash-gateway").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Application</dt><dd class="col-sm-8">' + CadminApi.escapeHtml(status.application) + '</dd>' +
                '<dt class="col-sm-4">FHIR origin</dt><dd class="col-sm-8"><code>' + CadminApi.escapeHtml(fhir.uri) + '</code></dd>' +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' +
                    (fhir.up ? '<span class="badge text-bg-success">Up</span>' : '<span class="badge text-bg-danger">Down</span>') +
                    (fhir.error ? ' <small class="text-muted">' + CadminApi.escapeHtml(fhir.error) + '</small>' : '') +
                '</dd>' +
            '</dl>'
        );
        loadResourceCounts();
    }).fail(function () {
        $("#dash-cards").html(card("3", "danger", "Gateway", "Status check failed", "bi-exclamation-triangle"));
        loadResourceCounts();
    });
});
