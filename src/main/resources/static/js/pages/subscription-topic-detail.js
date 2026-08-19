window.CadminSubscriptionTopicDetail = (function () {
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
    const resultOptions = [
        { code: "", display: "Unspecified" },
        { code: "test-passes", display: "Test passes" },
        { code: "test-fails", display: "Test fails" }
    ];
    let comparatorOptions = [
        { code: "eq", display: "eq" }, { code: "ne", display: "ne" },
        { code: "gt", display: "gt" }, { code: "lt", display: "lt" },
        { code: "ge", display: "ge" }, { code: "le", display: "le" },
        { code: "sa", display: "sa" }, { code: "eb", display: "eb" }, { code: "ap", display: "ap" }
    ];
    let modifierOptions = [
        { code: "missing", display: "missing" }, { code: "exact", display: "exact" },
        { code: "contains", display: "contains" }, { code: "not", display: "not" },
        { code: "text", display: "text" }, { code: "in", display: "in" },
        { code: "not-in", display: "not-in" }, { code: "below", display: "below" },
        { code: "above", display: "above" }, { code: "type", display: "type" },
        { code: "identifier", display: "identifier" }
    ];

    let topic = null;

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function optionsHtml(items, selected) {
        return items.map(function (item) {
            const code = item.code != null ? item.code : item;
            const display = item.display != null ? item.display : item;
            const mark = code === selected ? " selected" : "";
            return '<option value="' + esc(code) + '"' + mark + ">" + esc(display) + "</option>";
        }).join("");
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

    function firstTrigger() {
        topic.trigger = topic.trigger || [];
        if (!topic.trigger.length) {
            topic.trigger.push({});
        }
        return topic.trigger[0];
    }

    function hideModal(id) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function fail(action, xhr) {
        CadminApi.showAlert("#topic-detail-alert", "danger", action + " failed (" + xhr.status + ").");
    }

    function saveTopic(next) {
        CadminApi.fhir("/SubscriptionTopic/" + encodeURIComponent(topic.id), "PUT", topic).done(function (updated) {
            topic = updated || topic;
            renderBasics();
            renderTrigger();
            renderFilters();
            renderShapes();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update topic", xhr);
        });
    }

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function modal(id, title, body, formId) {
        return '<div class="modal fade" id="' + id + '" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="' + formId + '">' +
                    '<div class="modal-header"><h5 class="modal-title">' + title + "</h5>" +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' + body + "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Save</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>";
    }

    function card(title, bodyId, columns, addTarget, addLabel) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                (addTarget
                    ? '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="' +
                        addTarget + '">' + addLabel + "</button>"
                    : "") +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle mb-0">' +
                        "<thead><tr>" + columns.map(function (col) { return "<th>" + col + "</th>"; }).join("") +
                        "</tr></thead>" +
                        '<tbody id="' + bodyId + '"></tbody>' +
                    "</table>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function emptyRow(cols, text) {
        return '<tr><td colspan="' + cols + '" class="text-muted">' + text + "</td></tr>";
    }

    function checkboxList(name, options, selected) {
        const chosen = selected || [];
        return options.map(function (option) {
            const checked = chosen.indexOf(option.code) >= 0 ? " checked" : "";
            const id = name + "-" + option.code;
            return '<div class="form-check">' +
                '<input class="form-check-input" type="checkbox" name="' + name + '" value="' +
                option.code + '" id="' + id + '"' + checked + ">" +
                '<label class="form-check-label" for="' + id + '">' + esc(option.display) + "</label></div>";
        }).join("");
    }

    function selectedChecks(name) {
        const values = [];
        $('input[name="' + name + '"]:checked').each(function () {
            values.push($(this).val());
        });
        return values;
    }

    function render(resource) {
        topic = resource;
        const $root = $(CadminWorkspace.root());
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/subscription-topics">' +
                        '<i class="bi bi-arrow-left me-1"></i>Subscription topics</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(topic.title || topic.name || topic.url || "Subscription topic") + "</h1>" +
                "</div>" +
                '<div class="d-flex gap-2">' +
                    '<button class="btn btn-outline-primary" type="button" id="topic-new-sub">' +
                        '<i class="bi bi-broadcast me-1"></i>New subscription</button>' +
                    CadminResourceSource.button() +
                "</div>" +
            "</div>" +
            '<div id="topic-detail-alert" class="alert d-none"></div>' +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Basics</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#td-basic-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="td-basics"></div>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Resource trigger</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#td-trigger-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="td-trigger"></div>' +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' +
                    card("Can filter by", "td-filter-rows",
                        ["Parameter", "Resource", "Comparators", ""], "#td-filter-modal", "Add") +
                "</div>" +
                '<div class="col-lg-6">' +
                    card("Notification shape", "td-shape-rows",
                        ["Resource", "Include", ""], "#td-shape-modal", "Add") +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3"><h6 class="m-0">Subscriptions using this topic</h6></div>' +
                '<div class="card-body">' +
                    '<div class="table-responsive">' +
                        '<table class="table table-hover align-middle mb-0">' +
                            "<thead><tr><th>Name</th><th>Status</th><th>Channel</th><th>Endpoint</th></tr></thead>" +
                            '<tbody id="td-sub-rows"><tr><td colspan="4" class="text-muted">Loading…</td></tr></tbody>' +
                        "</table>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("td-basic-modal", "Edit basics",
                field("URL", '<input class="form-control font-monospace" id="td-url" required>') +
                field("Title", '<input class="form-control" id="td-title">') +
                field("Name", '<input class="form-control font-monospace" id="td-name">') +
                field("Status", '<select class="form-select" id="td-status">' + optionsHtml(statusOptions) + "</select>") +
                field("Description", '<textarea class="form-control" id="td-description" rows="3"></textarea>') +
                field("Purpose", '<textarea class="form-control" id="td-purpose" rows="2"></textarea>'),
                "td-basic-form") +
            modal("td-trigger-modal", "Edit resource trigger",
                field("Resource", '<select class="form-select" id="td-resource">' + optionsHtml(resourceTypes) + "</select>") +
                '<div class="mb-3"><label class="form-label">Interactions</label>' +
                    '<div id="td-ix-list">' + checkboxList("td-ix", interactionOptions, []) + "</div></div>" +
                field("Previous query", '<input class="form-control font-monospace" id="td-prev" placeholder="FHIR search string">') +
                field("Current query", '<input class="form-control font-monospace" id="td-current" placeholder="FHIR search string">') +
                field("Result for create", '<select class="form-select" id="td-create-result">' + optionsHtml(resultOptions) + "</select>") +
                field("Result for delete", '<select class="form-select" id="td-delete-result">' + optionsHtml(resultOptions) + "</select>") +
                '<div class="form-check mb-3">' +
                    '<input class="form-check-input" type="checkbox" id="td-require-both">' +
                    '<label class="form-check-label" for="td-require-both">Require both previous and current</label></div>' +
                field("FHIRPath criteria", '<textarea class="form-control font-monospace" id="td-fhirpath" rows="3"></textarea>'),
                "td-trigger-form") +
            modal("td-filter-modal", "Add filter parameter",
                field("Filter parameter", '<input class="form-control font-monospace" id="td-fp-name" required placeholder="e.g. patient">') +
                field("Resource", '<select class="form-select" id="td-fp-resource">' +
                    '<option value="">Same as trigger</option>' + optionsHtml(resourceTypes) + "</select>") +
                field("Description", '<input class="form-control" id="td-fp-desc">') +
                '<div class="mb-3"><label class="form-label">Comparators</label>' +
                    '<div id="td-fp-cmp-list">' + checkboxList("td-fp-cmp", comparatorOptions, []) + "</div></div>" +
                '<div class="mb-0"><label class="form-label">Modifiers</label>' +
                    '<div id="td-fp-mod-list">' + checkboxList("td-fp-mod", modifierOptions, []) + "</div></div>",
                "td-filter-form") +
            modal("td-shape-modal", "Add notification shape",
                field("Resource", '<select class="form-select" id="td-ns-resource" required>' + optionsHtml(resourceTypes) + "</select>") +
                field("Include", '<input class="form-control font-monospace" id="td-ns-include" placeholder="Patient:organization">') +
                field("Revinclude", '<input class="form-control font-monospace" id="td-ns-revinclude" placeholder="Observation:subject">'),
                "td-shape-form")
        );
        CadminResourceSource.mount(function () { return topic; });
        CadminResourceGraph.mount(topic);
        renderBasics();
        renderTrigger();
        renderFilters();
        renderShapes();
        loadSubscriptions();
        bind();
        bindValueSets();
    }

    function bindValueSets() {
        const resourceFallback = resourceTypes.map(function (type) {
            return { code: type, display: type };
        });
        CadminApi.fillValueSetSelect("#td-status", CadminApi.valueSets.publicationStatus, {
            fallback: statusOptions,
            selected: topic.status || "draft",
            onConcepts: function (concepts) { statusOptions = concepts; }
        });
        CadminApi.fillValueSetSelect("#td-resource", CadminApi.valueSets.resourceTypes, {
            fallback: resourceFallback,
            selected: ((topic.trigger && topic.trigger[0]) || {}).resource || "Patient",
            count: 300
        });
        CadminApi.fillValueSetSelect("#td-fp-resource", CadminApi.valueSets.resourceTypes, {
            fallback: resourceFallback,
            prepend: [{ code: "", display: "Same as trigger" }],
            selected: "",
            count: 300
        });
        CadminApi.fillValueSetSelect("#td-ns-resource", CadminApi.valueSets.resourceTypes, {
            fallback: resourceFallback,
            count: 300
        });
        CadminApi.fillValueSetSelect("#td-create-result", CadminApi.valueSets.subscriptiontopicCrBehavior, {
            fallback: resultOptions.filter(function (item) { return item.code; }),
            prepend: [{ code: "", display: "Unspecified" }],
            selected: ""
        });
        CadminApi.fillValueSetSelect("#td-delete-result", CadminApi.valueSets.subscriptiontopicCrBehavior, {
            fallback: resultOptions.filter(function (item) { return item.code; }),
            prepend: [{ code: "", display: "Unspecified" }],
            selected: ""
        });
        CadminApi.fillValueSetChecks("#td-ix-list", CadminApi.valueSets.interactionTrigger, {
            fallback: interactionOptions,
            name: "td-ix",
            onConcepts: function (concepts) { interactionOptions = concepts; }
        });
        CadminApi.fillValueSetChecks("#td-fp-cmp-list", CadminApi.valueSets.searchComparator, {
            fallback: comparatorOptions,
            name: "td-fp-cmp",
            onConcepts: function (concepts) { comparatorOptions = concepts; }
        });
        CadminApi.fillValueSetChecks("#td-fp-mod-list", CadminApi.valueSets.searchModifierCode, {
            fallback: modifierOptions,
            name: "td-fp-mod",
            onConcepts: function (concepts) { modifierOptions = concepts; }
        });
    }

    function renderBasics() {
        $("#td-basics").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">URL</dt><dd class="col-sm-9"><code>' + esc(topic.url || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Title</dt><dd class="col-sm-9">' + esc(topic.title || "—") + "</dd>" +
                '<dt class="col-sm-3">Name</dt><dd class="col-sm-9">' + esc(topic.name || "—") + "</dd>" +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(topic.status) + "</dd>" +
                '<dt class="col-sm-3">Description</dt><dd class="col-sm-9">' + esc(topic.description || "—") + "</dd>" +
                '<dt class="col-sm-3">Purpose</dt><dd class="col-sm-9">' + esc(topic.purpose || "—") + "</dd>" +
            "</dl>"
        );
    }

    function renderTrigger() {
        const trigger = (topic.trigger && topic.trigger[0]) || {};
        const criteria = trigger.queryCriteria || {};
        const interactions = (trigger.supportedInteraction || []).join(", ") || "—";
        $("#td-trigger").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Resource</dt><dd class="col-sm-9">' + esc(trigger.resource || "—") + "</dd>" +
                '<dt class="col-sm-3">Interactions</dt><dd class="col-sm-9">' + esc(interactions) + "</dd>" +
                '<dt class="col-sm-3">Previous</dt><dd class="col-sm-9"><code>' + esc(criteria.previous || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Current</dt><dd class="col-sm-9"><code>' + esc(criteria.current || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Create result</dt><dd class="col-sm-9">' + esc(criteria.resultForCreate || "—") + "</dd>" +
                '<dt class="col-sm-3">Delete result</dt><dd class="col-sm-9">' + esc(criteria.resultForDelete || "—") + "</dd>" +
                '<dt class="col-sm-3">Require both</dt><dd class="col-sm-9">' + (criteria.requireBoth ? "Yes" : "No") + "</dd>" +
                '<dt class="col-sm-3">FHIRPath</dt><dd class="col-sm-9"><code>' + esc(trigger.fhirPathCriteria || "—") + "</code></dd>" +
            "</dl>"
        );
    }

    function renderFilters() {
        const filters = ((topic.trigger && topic.trigger[0]) || {}).canFilterBy || [];
        if (!filters.length) {
            $("#td-filter-rows").html(emptyRow(4, "No filter parameters. Subscriptions can still bind to this topic."));
            return;
        }
        $("#td-filter-rows").html(filters.map(function (item, index) {
            return "<tr>" +
                "<td><code>" + esc(item.filterParameter || "—") + "</code></td>" +
                "<td>" + esc(item.resource || "—") + "</td>" +
                "<td>" + esc((item.comparator || []).join(", ") || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-filter="' +
                    index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderShapes() {
        const shapes = ((topic.trigger && topic.trigger[0]) || {}).notificationShape || [];
        if (!shapes.length) {
            $("#td-shape-rows").html(emptyRow(3, "No notification shapes."));
            return;
        }
        $("#td-shape-rows").html(shapes.map(function (item, index) {
            return "<tr>" +
                "<td>" + esc(item.resource || "—") + "</td>" +
                "<td><code>" + esc((item.include || []).concat(item.revInclude || []).join(", ") || "—") + "</code></td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-shape="' +
                    index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadSubscriptions() {
        if (!topic.url) {
            $("#td-sub-rows").html(emptyRow(4, "Topic URL is required to find subscriptions."));
            return;
        }
        CadminApi.fhir("/Subscription?topic=" + encodeURIComponent(topic.url) + "&_count=50&_sort=-_lastUpdated")
            .done(function (bundle) {
                const entries = CadminApi.bundleResources(bundle, "Subscription");
                if (!entries.length) {
                    $("#td-sub-rows").html(emptyRow(4, "No subscriptions use this topic yet."));
                    return;
                }
                $("#td-sub-rows").html(entries.map(function (sub) {
                    const channel = ((sub.channelType || {}).code) || "—";
                    return "<tr>" +
                        "<td>" + CadminApi.resourceLink("#/subscriptions/" + encodeURIComponent(sub.id),
                            sub.name || sub.id) + "</td>" +
                        "<td>" + esc(sub.status || "—") + "</td>" +
                        "<td>" + esc(channel) + "</td>" +
                        "<td><code>" + esc(sub.endpoint || "—") + "</code></td></tr>";
                }).join(""));
            }).fail(function () {
                $("#td-sub-rows").html(emptyRow(4, "Unable to load subscriptions."));
            });
    }

    function bind() {
        const $root = $(CadminWorkspace.root());
        $root.off(".topicdetail");

        $("#td-basic-modal").on("show.bs.modal", function () {
            $("#td-url").val(topic.url || "");
            $("#td-title").val(topic.title || "");
            $("#td-name").val(topic.name || "");
            $("#td-status").val(topic.status || "draft");
            $("#td-description").val(topic.description || "");
            $("#td-purpose").val(topic.purpose || "");
        });

        $("#td-trigger-modal").on("show.bs.modal", function () {
            const trigger = firstTrigger();
            const criteria = trigger.queryCriteria || {};
            $("#td-resource").val(trigger.resource || "Patient");
            $('input[name="td-ix"]').prop("checked", false);
            (trigger.supportedInteraction || []).forEach(function (code) {
                $('input[name="td-ix"][value="' + code + '"]').prop("checked", true);
            });
            $("#td-prev").val(criteria.previous || "");
            $("#td-current").val(criteria.current || "");
            $("#td-create-result").val(criteria.resultForCreate || "");
            $("#td-delete-result").val(criteria.resultForDelete || "");
            $("#td-require-both").prop("checked", !!criteria.requireBoth);
            $("#td-fhirpath").val(trigger.fhirPathCriteria || "");
        });

        $("#td-basic-form").on("submit", function (event) {
            event.preventDefault();
            topic.url = $("#td-url").val().trim();
            const title = $("#td-title").val().trim();
            const name = $("#td-name").val().trim();
            const description = $("#td-description").val().trim();
            const purpose = $("#td-purpose").val().trim();
            topic.status = $("#td-status").val() || "draft";
            if (title) { topic.title = title; } else { delete topic.title; }
            if (name) { topic.name = name; } else { delete topic.name; }
            if (description) { topic.description = description; } else { delete topic.description; }
            if (purpose) { topic.purpose = purpose; } else { delete topic.purpose; }
            saveTopic(function () {
                hideModal("td-basic-modal");
                CadminApi.showToast("success", "Topic updated.");
            });
        });

        $("#td-trigger-form").on("submit", function (event) {
            event.preventDefault();
            const trigger = firstTrigger();
            trigger.resource = $("#td-resource").val();
            const interactions = selectedChecks("td-ix");
            if (interactions.length) {
                trigger.supportedInteraction = interactions;
            } else {
                delete trigger.supportedInteraction;
            }
            const previous = $("#td-prev").val().trim();
            const current = $("#td-current").val().trim();
            const resultForCreate = $("#td-create-result").val();
            const resultForDelete = $("#td-delete-result").val();
            const requireBoth = $("#td-require-both").is(":checked");
            if (previous || current || resultForCreate || resultForDelete || requireBoth) {
                trigger.queryCriteria = {};
                if (previous) { trigger.queryCriteria.previous = previous; }
                if (current) { trigger.queryCriteria.current = current; }
                if (resultForCreate) { trigger.queryCriteria.resultForCreate = resultForCreate; }
                if (resultForDelete) { trigger.queryCriteria.resultForDelete = resultForDelete; }
                if (requireBoth) { trigger.queryCriteria.requireBoth = true; }
            } else {
                delete trigger.queryCriteria;
            }
            const fhirPath = $("#td-fhirpath").val().trim();
            if (fhirPath) {
                trigger.fhirPathCriteria = fhirPath;
            } else {
                delete trigger.fhirPathCriteria;
            }
            saveTopic(function () {
                hideModal("td-trigger-modal");
                CadminApi.showToast("success", "Trigger updated.");
            });
        });

        $("#td-filter-form").on("submit", function (event) {
            event.preventDefault();
            const trigger = firstTrigger();
            const filter = { filterParameter: $("#td-fp-name").val().trim() };
            const resource = $("#td-fp-resource").val();
            const description = $("#td-fp-desc").val().trim();
            const comparators = selectedChecks("td-fp-cmp");
            const modifiers = selectedChecks("td-fp-mod");
            if (resource) { filter.resource = resource; }
            if (description) { filter.description = description; }
            if (comparators.length) { filter.comparator = comparators; }
            if (modifiers.length) { filter.modifier = modifiers; }
            trigger.canFilterBy = trigger.canFilterBy || [];
            trigger.canFilterBy.push(filter);
            saveTopic(function () {
                hideModal("td-filter-modal");
                CadminApi.showToast("success", "Filter parameter added.");
            });
        });

        $("#td-shape-form").on("submit", function (event) {
            event.preventDefault();
            const trigger = firstTrigger();
            const shape = { resource: $("#td-ns-resource").val() };
            const include = $("#td-ns-include").val().trim();
            const revInclude = $("#td-ns-revinclude").val().trim();
            if (include) { shape.include = include.split(/\s*,\s*/).filter(Boolean); }
            if (revInclude) { shape.revInclude = revInclude.split(/\s*,\s*/).filter(Boolean); }
            trigger.notificationShape = trigger.notificationShape || [];
            trigger.notificationShape.push(shape);
            saveTopic(function () {
                hideModal("td-shape-modal");
                CadminApi.showToast("success", "Notification shape added.");
            });
        });

        $root.on("click.topicdetail", "[data-remove-filter]", function () {
            const index = Number($(this).attr("data-remove-filter"));
            const trigger = firstTrigger();
            trigger.canFilterBy = (trigger.canFilterBy || []).filter(function (_item, i) { return i !== index; });
            if (!trigger.canFilterBy.length) {
                delete trigger.canFilterBy;
            }
            saveTopic(function () {
                CadminApi.showToast("success", "Filter parameter removed.");
            });
        });

        $root.on("click.topicdetail", "[data-remove-shape]", function () {
            const index = Number($(this).attr("data-remove-shape"));
            const trigger = firstTrigger();
            trigger.notificationShape = (trigger.notificationShape || []).filter(function (_item, i) { return i !== index; });
            if (!trigger.notificationShape.length) {
                delete trigger.notificationShape;
            }
            saveTopic(function () {
                CadminApi.showToast("success", "Notification shape removed.");
            });
        });

        $("#topic-new-sub").on("click", function () {
            try {
                sessionStorage.setItem("cadmin.pendingSubscriptionTopic", JSON.stringify({
                    id: topic.id,
                    url: topic.url,
                    title: topic.title || topic.name || topic.url
                }));
            } catch (err) {
                /* ignore */
            }
            window.location.hash = "#/subscriptions";
        });
    }

    return { render: render };
}());
