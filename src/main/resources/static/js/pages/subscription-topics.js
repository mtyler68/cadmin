CadminApp.register("subscription-topics", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/SubscriptionTopic/" + encodeURIComponent(token)).done(function (topic) {
            CadminSubscriptionTopicDetail.render(topic);
        }).fail(function () {
            renderSubscriptionTopicList(token);
        });
        return;
    }
    renderSubscriptionTopicList("");
});

function renderSubscriptionTopicList(initialQuery) {
    let statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "retired", display: "Retired" },
        { code: "unknown", display: "Unknown" }
    ];
    const resourceTypes = [
        "Patient", "Practitioner", "PractitionerRole", "Organization", "Location",
        "Encounter", "Observation", "Condition", "Procedure", "AllergyIntolerance",
        "MedicationRequest", "DiagnosticReport", "DocumentReference", "Library",
        "Device", "DeviceAssociation", "CareTeam", "RelatedPerson", "Task",
        "Appointment", "Coverage", "Group", "HealthcareService", "Subscription",
        "SearchParameter"
    ];
    let interactionOptions = [
        { code: "create", display: "Create" },
        { code: "update", display: "Update" },
        { code: "delete", display: "Delete" }
    ];
    let pendingTopic = null;
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Subscription topics</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-topic-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New topic</button>' +
        "</div>" +
        '<div id="topic-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Topic search</h6>' +
                '<form class="d-flex" id="topic-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="topic-query" placeholder="Title or URL" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Title</th><th>URL</th><th>Resource</th><th>Status</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="topic-rows"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="topic-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-topic-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-topic-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create subscription topic</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">URL</label>' +
                            '<input class="form-control font-monospace" id="topic-url" required ' +
                            'placeholder="https://cadmin.io/fhir/SubscriptionTopic/patient-changes"></div>' +
                        '<div class="mb-3"><label class="form-label">Title</label>' +
                            '<input class="form-control" id="topic-title" required></div>' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control font-monospace" id="topic-name" placeholder="Optional computer name"></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="topic-status">' +
                                statusOptions.map(function (option) {
                                    const selected = option.code === "draft" ? " selected" : "";
                                    return '<option value="' + option.code + '"' + selected + ">" +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Description</label>' +
                            '<textarea class="form-control" id="topic-description" rows="2"></textarea></div>' +
                        '<div class="mb-3"><label class="form-label">Resource</label>' +
                            '<select class="form-select" id="topic-resource" required>' +
                                resourceTypes.map(function (type) {
                                    return '<option value="' + type + '">' + type + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-0"><label class="form-label">Interactions</label>' +
                            '<div id="topic-interactions">' + interactionOptions.map(function (option) {
                                return '<div class="form-check">' +
                                    '<input class="form-check-input topic-interaction" type="checkbox" value="' +
                                    option.code + '" id="topic-ix-' + option.code + '" checked>' +
                                    '<label class="form-check-label" for="topic-ix-' + option.code + '">' +
                                    CadminApi.escapeHtml(option.display) + "</label></div>";
                            }).join("") + "</div></div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="offer-subscription-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<div class="modal-content">' +
                    '<div class="modal-header"><h5 class="modal-title">Create subscription?</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<p class="mb-0">Topic <strong id="offer-topic-name"></strong> was created. Create a subscription for it?</p>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Not now</button>' +
                        '<button type="button" class="btn btn-primary" id="offer-subscription-yes">Create subscription</button>' +
                    "</div>" +
                "</div>" +
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
        const kind = status === "active" ? "success" : status === "retired" ? "secondary"
            : status === "draft" ? "warning" : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function triggerResource(topic) {
        const trigger = (topic.trigger && topic.trigger[0]) || {};
        return trigger.resource || "—";
    }

    function topicLabel(topic) {
        return topic.title || topic.name || topic.url || topic.id || "Untitled";
    }

    function hideModal(id, then) {
        const el = document.getElementById(id);
        const modal = bootstrap.Modal.getInstance(el);
        if (!modal) {
            if (then) {
                then();
            }
            return;
        }
        if (then) {
            $(el).one("hidden.bs.modal", then);
        }
        modal.hide();
    }

    function showModal(id) {
        bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/SubscriptionTopic?_sort=-_lastUpdated";
        if (query) {
            path += (query.indexOf("://") >= 0 ? "&url=" : "&title=") + encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("subscription-topics");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "SubscriptionTopic");
            CadminApi.renderPager("#topic-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "subscription-topics",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#topic-rows").html('<tr><td colspan="6" class="text-muted">No subscription topics found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (topic) {
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/subscription-topics/" + encodeURIComponent(topic.id), topicLabel(topic)) + "</td>" +
                    "<td><code>" + esc(topic.url || "—") + "</code></td>" +
                    "<td>" + esc(triggerResource(topic)) + "</td>" +
                    "<td>" + statusBadge(topic.status) + "</td>" +
                    "<td><code>" + esc(topic.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/subscription-topics/' +
                        encodeURIComponent(topic.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#topic-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#topic-pager").empty();
            $("#topic-rows").html('<tr><td colspan="6" class="text-danger">Unable to load subscription topics from /fhir.</td></tr>');
            CadminApi.showAlert("#topic-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#topic-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#topic-query").val());
    });

    $("#create-topic-form").on("submit", function (event) {
        event.preventDefault();
        const interactions = [];
        $(".topic-interaction:checked").each(function () {
            interactions.push($(this).val());
        });
        const resource = {
            resourceType: "SubscriptionTopic",
            url: $("#topic-url").val().trim(),
            title: $("#topic-title").val().trim(),
            status: $("#topic-status").val() || "draft",
            trigger: [{
                resource: $("#topic-resource").val(),
                supportedInteraction: interactions
            }]
        };
        const name = $("#topic-name").val().trim();
        const description = $("#topic-description").val().trim();
        if (name) {
            resource.name = name;
        }
        if (description) {
            resource.description = description;
        }
        CadminApi.fhir("/SubscriptionTopic", "POST", resource).done(function (created, _status, xhr) {
            const id = CadminApi.createdResourceId(created, xhr, "SubscriptionTopic");
            hideModal("create-topic-modal", function () {
                CadminApi.showToast("success", "Subscription topic created.");
                load($("#topic-query").val());
                if (id) {
                    pendingTopic = {
                        id: id,
                        url: resource.url,
                        title: resource.title
                    };
                    $("#offer-topic-name").text(resource.title || resource.url);
                    showModal("offer-subscription-modal");
                }
            });
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#offer-subscription-yes").on("click", function () {
        const topic = pendingTopic;
        hideModal("offer-subscription-modal", function () {
            if (topic && topic.url) {
                try {
                    sessionStorage.setItem("cadmin.pendingSubscriptionTopic", JSON.stringify(topic));
                } catch (err) {
                    /* ignore */
                }
                window.location.hash = "#/subscriptions";
            }
        });
    });

    CadminApi.fillValueSetSelect("#topic-status", CadminApi.valueSets.publicationStatus, {
        fallback: statusOptions,
        selected: "draft",
        onConcepts: function (concepts) { statusOptions = concepts; }
    });
    CadminApi.fillValueSetSelect("#topic-resource", CadminApi.valueSets.resourceTypes, {
        fallback: resourceTypes.map(function (type) { return { code: type, display: type }; }),
        selected: "Patient",
        count: 300
    });
    CadminApi.fillValueSetChecks("#topic-interactions", CadminApi.valueSets.interactionTrigger, {
        fallback: interactionOptions,
        name: "topic-ix",
        inputClass: "topic-interaction",
        selected: ["create", "update", "delete"],
        onConcepts: function (concepts) { interactionOptions = concepts; }
    });

    load(initialQuery);
}
