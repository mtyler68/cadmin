CadminApp.register("subscriptions", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Subscription/" + encodeURIComponent(token)).done(function (subscription) {
            CadminSubscriptionDetail.render(subscription);
        }).fail(function () {
            renderSubscriptionList(token);
        });
        return;
    }
    renderSubscriptionList("");
});

function renderSubscriptionList(initialQuery) {
    let statusOptions = [
        { code: "requested", display: "Requested" },
        { code: "active", display: "Active" },
        { code: "error", display: "Error" },
        { code: "off", display: "Off" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    let channelTypes = [
        { code: "rest-hook", display: "Rest hook" },
        { code: "websocket", display: "Websocket" },
        { code: "email", display: "Email" },
        { code: "message", display: "Message" }
    ];
    let contentOptions = [
        { code: "empty", display: "Empty" },
        { code: "id-only", display: "ID only" },
        { code: "full-resource", display: "Full resource" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Subscriptions</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-sub-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New subscription</button>' +
        "</div>" +
        '<div id="sub-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Subscription search</h6>' +
                '<form class="d-flex" id="sub-search-form">' +
                    '<select class="form-select form-select-sm me-2" id="sub-status-filter" style="max-width:10rem">' +
                        '<option value="">Any status</option>' +
                        statusOptions.map(function (option) {
                            return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                        }).join("") +
                    "</select>" +
                    '<input class="form-control form-control-sm me-2" id="sub-query" placeholder="Topic or endpoint URL" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Name</th><th>Topic</th><th>Channel</th><th>Endpoint</th><th>Status</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="sub-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="sub-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-sub-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-sub-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create subscription</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Topic</label>' +
                            '<select class="form-select" id="sub-topic" required>' +
                                '<option value="">Loading topics…</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="sub-name"></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="sub-status">' +
                                '<option value="requested" selected>Requested</option>' +
                                '<option value="off">Off</option>' +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Channel type</label>' +
                            '<select class="form-select" id="sub-channel">' +
                                channelTypes.map(function (option) {
                                    return '<option value="' + option.code + '">' +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Endpoint</label>' +
                            '<input class="form-control font-monospace" id="sub-endpoint" ' +
                            'placeholder="https://example.org/fhir/notification"></div>' +
                        '<div class="mb-3"><label class="form-label">Content</label>' +
                            '<select class="form-select" id="sub-content">' +
                                contentOptions.map(function (option) {
                                    const selected = option.code === "id-only" ? " selected" : "";
                                    return '<option value="' + option.code + '"' + selected + ">" +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Content type</label>' +
                            '<input class="form-control font-monospace" id="sub-content-type" value="application/fhir+json"></div>' +
                        '<div class="mb-0"><label class="form-label">Reason</label>' +
                            '<input class="form-control" id="sub-reason"></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function statusLabel(code) {
        const match = statusOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success" : status === "error" ? "danger"
            : status === "off" || status === "entered-in-error" ? "secondary"
                : "warning";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function channelLabel(sub) {
        const coding = sub.channelType || {};
        const match = channelTypes.find(function (option) { return option.code === coding.code; });
        return (match && match.display) || coding.display || coding.code || "—";
    }

    function subscriptionName(sub) {
        return sub.name || sub.reason || sub.id || "Subscription";
    }

    function readPendingTopic() {
        try {
            const raw = sessionStorage.getItem("cadmin.pendingSubscriptionTopic");
            sessionStorage.removeItem("cadmin.pendingSubscriptionTopic");
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    }

    function fillTopicSelect(preferredUrl) {
        const $select = $("#sub-topic");
        CadminApi.fhir("/SubscriptionTopic?status=active&_count=200&_sort=title").done(function (bundle) {
            let topics = CadminApi.bundleResources(bundle, "SubscriptionTopic");
            CadminApi.fhir("/SubscriptionTopic?_count=200&_sort=title").done(function (all) {
                const seen = {};
                topics.forEach(function (item) { seen[item.id] = true; });
                CadminApi.bundleResources(all, "SubscriptionTopic").forEach(function (item) {
                    if (!seen[item.id]) {
                        topics.push(item);
                    }
                });
                if (!topics.length) {
                    $select.html('<option value="">No topics found — create a topic first</option>');
                    return;
                }
                $select.html(topics.map(function (topic) {
                    const label = (topic.title || topic.name || topic.url || topic.id) +
                        (topic.status && topic.status !== "active" ? " (" + topic.status + ")" : "");
                    const selected = topic.url === preferredUrl ? " selected" : "";
                    return '<option value="' + esc(topic.url) + '"' + selected + ">" + esc(label) + "</option>";
                }).join(""));
                if (preferredUrl && !$select.find('option[value="' + preferredUrl.replace(/"/g, "") + '"]').length) {
                    $select.prepend('<option value="' + esc(preferredUrl) + '" selected>' + esc(preferredUrl) + "</option>");
                }
            }).fail(function () {
                if (!topics.length) {
                    $select.html('<option value="">Unable to load topics</option>');
                    return;
                }
                $select.html(topics.map(function (topic) {
                    return '<option value="' + esc(topic.url) + '">' +
                        esc(topic.title || topic.url) + "</option>";
                }).join(""));
            });
        }).fail(function () {
            $select.html('<option value="">Unable to load topics</option>');
        });
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Subscription?_sort=-_lastUpdated";
        const status = $("#sub-status-filter").val();
        if (status) {
            path += "&status=" + encodeURIComponent(status);
        }
        if (query) {
            path += (query.indexOf("://") >= 0 || query.indexOf("/") >= 0 ? "&topic=" : "&url=") +
                encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("subscriptions");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Subscription");
            CadminApi.renderPager("#sub-pager", {
                size: pageSize,
                pageSizeKey: "subscriptions",
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#sub-rows").html('<tr><td colspan="7" class="text-muted">No subscriptions found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (sub) {
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/subscriptions/" + encodeURIComponent(sub.id), subscriptionName(sub)) + "</td>" +
                    "<td><code>" + esc(sub.topic || "—") + "</code></td>" +
                    "<td>" + esc(channelLabel(sub)) + "</td>" +
                    "<td><code>" + esc(sub.endpoint || "—") + "</code></td>" +
                    "<td>" + statusBadge(sub.status) + "</td>" +
                    "<td><code>" + esc(sub.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/subscriptions/' +
                        encodeURIComponent(sub.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#sub-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#sub-pager").empty();
            $("#sub-rows").html('<tr><td colspan="7" class="text-danger">Unable to load subscriptions from /fhir.</td></tr>');
            CadminApi.showAlert("#sub-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#sub-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#sub-query").val());
    });

    $("#create-sub-modal").on("show.bs.modal", function () {
        const pending = $("#sub-topic").data("pending-url");
        fillTopicSelect(pending || "");
    });

    $("#create-sub-form").on("submit", function (event) {
        event.preventDefault();
        const topic = $("#sub-topic").val();
        if (!topic) {
            CadminApi.showToast("danger", "Select a subscription topic.");
            return;
        }
        const channel = channelTypes.find(function (option) { return option.code === $("#sub-channel").val(); })
            || channelTypes[0];
        const resource = {
            resourceType: "Subscription",
            status: $("#sub-status").val() || "requested",
            topic: topic,
            channelType: {
                system: channel.system || "http://terminology.hl7.org/CodeSystem/subscription-channel-type",
                code: channel.code,
                display: channel.display
            }
        };
        const name = $("#sub-name").val().trim();
        const endpoint = $("#sub-endpoint").val().trim();
        const content = $("#sub-content").val();
        const contentType = $("#sub-content-type").val().trim();
        const reason = $("#sub-reason").val().trim();
        if (name) { resource.name = name; }
        if (endpoint) { resource.endpoint = endpoint; }
        if (content) { resource.content = content; }
        if (contentType) { resource.contentType = contentType; }
        if (reason) { resource.reason = reason; }
        CadminApi.fhir("/Subscription", "POST", resource).done(function (created, _status, xhr) {
            const id = CadminApi.createdResourceId(created, xhr, "Subscription");
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-sub-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Subscription created.");
            if (id) {
                window.location.hash = "#/subscriptions/" + encodeURIComponent(id);
                return;
            }
            load($("#sub-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    CadminApi.fillValueSetSelect("#sub-status-filter", CadminApi.valueSets.subscriptionStatus, {
        fallback: statusOptions,
        prepend: [{ code: "", display: "Any status" }],
        selected: "",
        onConcepts: function (concepts) { statusOptions = concepts; }
    });
    CadminApi.expandValueSet(CadminApi.valueSets.subscriptionStatus).done(function (concepts) {
        statusOptions = concepts;
        CadminApi.fillSelectOptions("#sub-status", concepts.filter(function (item) {
            return item.code === "requested" || item.code === "off";
        }), { selected: "requested" });
    });
    CadminApi.fillValueSetSelect("#sub-channel", CadminApi.valueSets.subscriptionChannelType, {
        fallback: channelTypes,
        selected: "rest-hook",
        onConcepts: function (concepts) { channelTypes = concepts; }
    });
    CadminApi.fillValueSetSelect("#sub-content", CadminApi.valueSets.subscriptionPayloadContent, {
        fallback: contentOptions,
        selected: "id-only",
        onConcepts: function (concepts) { contentOptions = concepts; }
    });

    const pending = readPendingTopic();
    if (pending && pending.url) {
        $("#sub-topic").data("pending-url", pending.url);
        if (pending.title) {
            $("#sub-name").val(pending.title + " subscription");
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById("create-sub-modal")).show();
    }

    load(initialQuery);
}
