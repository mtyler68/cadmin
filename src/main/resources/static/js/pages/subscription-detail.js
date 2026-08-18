window.CadminSubscriptionDetail = (function () {
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

    let subscription = null;
    let topicResource = null;

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
        const kind = status === "active" ? "success" : status === "error" ? "danger"
            : status === "off" || status === "entered-in-error" ? "secondary"
                : "warning";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function channelLabel(sub) {
        const coding = (sub && sub.channelType) || {};
        const match = channelTypes.find(function (option) { return option.code === coding.code; });
        return (match && match.display) || coding.display || coding.code || "—";
    }

    function contentLabel(code) {
        const match = contentOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function subscriptionName() {
        return subscription.name || subscription.reason || subscription.id || "Subscription";
    }

    function hideModal(id) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function fail(action, xhr) {
        CadminApi.showAlert("#sub-detail-alert", "danger", action + " failed (" + xhr.status + ").");
    }

    function saveSubscription(next) {
        CadminApi.fhir("/Subscription/" + encodeURIComponent(subscription.id), "PUT", subscription)
            .done(function (updated) {
                subscription = updated || subscription;
                renderHeader();
                renderBasics();
                renderChannel();
                renderFilters();
                renderParameters();
                if (next) {
                    next();
                }
            }).fail(function (xhr) {
                fail("Update subscription", xhr);
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
                        addTarget + '" id="' + bodyId + '-add">' + addLabel + "</button>"
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

    function topicFilters() {
        return ((topicResource && topicResource.trigger && topicResource.trigger[0]) || {}).canFilterBy || [];
    }

    function filterDef(name) {
        return topicFilters().find(function (item) { return item.filterParameter === name; }) || null;
    }

    function refLabel(ref) {
        if (!ref) {
            return "—";
        }
        return ref.display || (ref.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        return CadminApi.referenceId(ref);
    }

    function toLocalInput(instant) {
        if (!instant) {
            return "";
        }
        const date = new Date(instant);
        if (isNaN(date.getTime())) {
            return "";
        }
        const pad = function (n) { return String(n).padStart(2, "0"); };
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
            "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function fromLocalInput(value) {
        if (!value) {
            return "";
        }
        const date = new Date(value);
        return isNaN(date.getTime()) ? "" : date.toISOString();
    }

    function formatInstant(instant) {
        if (!instant) {
            return "—";
        }
        const date = new Date(instant);
        return isNaN(date.getTime()) ? instant : date.toLocaleString();
    }

    function render(resource) {
        subscription = resource;
        topicResource = null;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/subscriptions">' +
                        '<i class="bi bi-arrow-left me-1"></i>Subscriptions</a>' +
                    '<h1 class="h3 mb-0 page-title" id="sd-title"></h1>' +
                "</div>" +
                '<div class="d-flex flex-wrap gap-2" id="sd-actions"></div>' +
            "</div>" +
            '<div id="sub-detail-alert" class="alert d-none"></div>' +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Basics</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#sd-basic-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="sd-basics"></div>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Channel</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#sd-channel-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="sd-channel"></div>' +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' +
                    card("Filters", "sd-filter-rows",
                        ["Parameter", "Comparator", "Value", ""], "#sd-filter-modal", "Add") +
                "</div>" +
                '<div class="col-lg-6">' +
                    card("Channel parameters", "sd-param-rows",
                        ["Name", "Value", ""], "#sd-param-modal", "Add") +
                "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("sd-basic-modal", "Edit basics",
                field("Name", '<input class="form-control" id="sd-name">') +
                field("Topic", '<select class="form-select" id="sd-topic" required></select>') +
                field("Reason", '<input class="form-control" id="sd-reason">') +
                field("Managing organization",
                    '<select class="form-select" id="sd-org"><option value="">None</option></select>'),
                "sd-basic-form") +
            modal("sd-channel-modal", "Edit channel",
                field("Channel type", '<select class="form-select" id="sd-channel-type">' +
                    optionsHtml(channelTypes) + "</select>") +
                field("Endpoint", '<input class="form-control font-monospace" id="sd-endpoint" ' +
                    'placeholder="https://example.org/fhir/notification">') +
                field("Content", '<select class="form-select" id="sd-content">' +
                    optionsHtml(contentOptions) + "</select>") +
                field("Content type", '<input class="form-control font-monospace" id="sd-content-type">') +
                field("Heartbeat period (seconds)",
                    '<input class="form-control" id="sd-heartbeat" type="number" min="0" step="1">') +
                field("Timeout (seconds)",
                    '<input class="form-control" id="sd-timeout" type="number" min="0" step="1">') +
                field("Max count",
                    '<input class="form-control" id="sd-max-count" type="number" min="1" step="1">') +
                field("End", '<input class="form-control" id="sd-end" type="datetime-local">'),
                "sd-channel-form") +
            modal("sd-filter-modal", "Add filter",
                field("Filter parameter", '<select class="form-select" id="sd-fp-name" required></select>') +
                field("Resource", '<input class="form-control font-monospace" id="sd-fp-resource" readonly>') +
                field("Comparator", '<select class="form-select" id="sd-fp-cmp"></select>') +
                field("Modifier", '<select class="form-select" id="sd-fp-mod"></select>') +
                field("Value", '<input class="form-control font-monospace" id="sd-fp-value" required>'),
                "sd-filter-form") +
            modal("sd-param-modal", "Add channel parameter",
                field("Name", '<input class="form-control font-monospace" id="sd-pn-name" required placeholder="Authorization">') +
                field("Value", '<input class="form-control font-monospace" id="sd-pn-value" required>'),
                "sd-param-form")
        );
        CadminResourceGraph.mount(subscription);
        renderHeader();
        renderBasics();
        renderChannel();
        renderFilters();
        renderParameters();
        loadTopic();
        bind();
        CadminApi.fillValueSetSelect("#sd-channel-type", CadminApi.valueSets.subscriptionChannelType, {
            fallback: channelTypes,
            selected: (subscription.channelType && subscription.channelType.code) || "rest-hook",
            onConcepts: function (concepts) { channelTypes = concepts; }
        });
        CadminApi.fillValueSetSelect("#sd-content", CadminApi.valueSets.subscriptionPayloadContent, {
            fallback: contentOptions,
            selected: subscription.content || "id-only",
            onConcepts: function (concepts) { contentOptions = concepts; }
        });
        CadminApi.expandValueSet(CadminApi.valueSets.subscriptionStatus).done(function (concepts) {
            statusOptions = concepts;
            renderHeader();
            renderBasics();
        });
        CadminApi.expandValueSet(CadminApi.valueSets.searchComparator).done(function (concepts) {
            comparatorOptions = concepts;
        });
        CadminApi.expandValueSet(CadminApi.valueSets.searchModifierCode).done(function (concepts) {
            modifierOptions = concepts;
        });
    }

    function renderHeader() {
        $("#sd-title").text(subscriptionName());
        const status = subscription.status;
        let actions = statusBadge(status);
        if (status === "error") {
            actions += ' <span class="text-muted small align-middle">Server reported an error. Re-request to retry.</span>';
        }
        if (status !== "off" && status !== "entered-in-error") {
            actions += '<button class="btn btn-outline-secondary" type="button" id="sd-off">' +
                '<i class="bi bi-pause-circle me-1"></i>Turn off</button>';
        }
        if (status === "off" || status === "error") {
            actions += '<button class="btn btn-outline-primary" type="button" id="sd-rerequest">' +
                '<i class="bi bi-arrow-repeat me-1"></i>Re-request</button>';
        }
        actions += '<a class="btn btn-outline-primary" href="#/resources/Subscription/' +
            encodeURIComponent(subscription.id) + '">' +
            '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>';
        $("#sd-actions").html(actions);
    }

    function topicHtml() {
        const url = subscription.topic || "";
        if (!url) {
            return "—";
        }
        if (topicResource && topicResource.id) {
            return CadminApi.resourceLink("#/subscription-topics/" + encodeURIComponent(topicResource.id),
                topicResource.title || topicResource.name || url);
        }
        return "<code>" + esc(url) + "</code>";
    }

    function managingHtml() {
        const ref = subscription.managingEntity;
        const id = refId(ref);
        if (id && CadminApp.isAdmin()) {
            return '<a href="#/organizations/' + encodeURIComponent(id) + '">' + esc(refLabel(ref)) + "</a>";
        }
        return esc(refLabel(ref));
    }

    function renderBasics() {
        $("#sd-basics").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Name</dt><dd class="col-sm-9">' + esc(subscription.name || "—") + "</dd>" +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(subscription.status) + "</dd>" +
                '<dt class="col-sm-3">Topic</dt><dd class="col-sm-9">' + topicHtml() + "</dd>" +
                '<dt class="col-sm-3">Reason</dt><dd class="col-sm-9">' + esc(subscription.reason || "—") + "</dd>" +
                '<dt class="col-sm-3">Managing entity</dt><dd class="col-sm-9">' + managingHtml() + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(subscription.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function renderChannel() {
        $("#sd-channel").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Type</dt><dd class="col-sm-9">' + esc(channelLabel(subscription)) + "</dd>" +
                '<dt class="col-sm-3">Endpoint</dt><dd class="col-sm-9"><code>' +
                    esc(subscription.endpoint || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Content</dt><dd class="col-sm-9">' +
                    esc(contentLabel(subscription.content)) + "</dd>" +
                '<dt class="col-sm-3">Content type</dt><dd class="col-sm-9"><code>' +
                    esc(subscription.contentType || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Heartbeat</dt><dd class="col-sm-9">' +
                    esc(subscription.heartbeatPeriod != null ? subscription.heartbeatPeriod + " s" : "—") + "</dd>" +
                '<dt class="col-sm-3">Timeout</dt><dd class="col-sm-9">' +
                    esc(subscription.timeout != null ? subscription.timeout + " s" : "—") + "</dd>" +
                '<dt class="col-sm-3">Max count</dt><dd class="col-sm-9">' +
                    esc(subscription.maxCount != null ? String(subscription.maxCount) : "—") + "</dd>" +
                '<dt class="col-sm-3">End</dt><dd class="col-sm-9">' + esc(formatInstant(subscription.end)) + "</dd>" +
            "</dl>"
        );
    }

    function renderFilters() {
        const filters = subscription.filterBy || [];
        const allowed = topicFilters();
        const $add = $("#sd-filter-rows-add");
        if (topicResource && !allowed.length) {
            $add.prop("disabled", true).attr("title", "This topic does not define filter parameters.");
        } else if (!subscription.topic) {
            $add.prop("disabled", true).attr("title", "Select a topic before adding filters.");
        } else {
            $add.prop("disabled", false).removeAttr("title");
        }
        if (!filters.length) {
            $("#sd-filter-rows").html(emptyRow(4, allowed.length
                ? "No filters. Notifications match the whole topic."
                : "No filters. Topic canFilterBy defines which parameters are allowed."));
            return;
        }
        $("#sd-filter-rows").html(filters.map(function (item, index) {
            const cmp = [item.comparator, item.modifier].filter(Boolean).join(" / ") || "—";
            return "<tr>" +
                "<td><code>" + esc(item.filterParameter || "—") + "</code>" +
                    (item.resource ? ' <span class="text-muted">' + esc(item.resource) + "</span>" : "") + "</td>" +
                "<td>" + esc(cmp) + "</td>" +
                "<td><code>" + esc(item.value || "—") + "</code></td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-filter="' +
                    index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderParameters() {
        const params = subscription.parameter || [];
        if (!params.length) {
            $("#sd-param-rows").html(emptyRow(3, "No channel parameters (for example Authorization headers)."));
            return;
        }
        $("#sd-param-rows").html(params.map(function (item, index) {
            return "<tr>" +
                "<td><code>" + esc(item.name || "—") + "</code></td>" +
                "<td><code>" + esc(item.value || "—") + "</code></td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-param="' +
                    index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadTopic() {
        if (!subscription.topic) {
            return;
        }
        CadminApi.fhir("/SubscriptionTopic?url=" + encodeURIComponent(subscription.topic) + "&_count=1")
            .done(function (bundle) {
                topicResource = CadminApi.bundleResources(bundle, "SubscriptionTopic")[0] || null;
                renderBasics();
                renderFilters();
            });
    }

    function fillTopicSelect(preferredUrl) {
        const $select = $("#sd-topic");
        $select.html('<option value="">Loading topics…</option>');
        CadminApi.fhir("/SubscriptionTopic?_count=200&_sort=title").done(function (bundle) {
            const topics = CadminApi.bundleResources(bundle, "SubscriptionTopic");
            if (!topics.length) {
                $select.html('<option value="">No topics found</option>');
                return;
            }
            $select.html(topics.map(function (topic) {
                const label = (topic.title || topic.name || topic.url || topic.id) +
                    (topic.status && topic.status !== "active" ? " (" + topic.status + ")" : "");
                const selected = topic.url === preferredUrl ? " selected" : "";
                return '<option value="' + esc(topic.url) + '"' + selected + ">" + esc(label) + "</option>";
            }).join(""));
            if (preferredUrl && $select.val() !== preferredUrl) {
                $select.prepend('<option value="' + esc(preferredUrl) + '" selected>' + esc(preferredUrl) + "</option>");
            }
        }).fail(function () {
            $select.html('<option value="' + esc(preferredUrl || "") + '">' +
                esc(preferredUrl || "Unable to load topics") + "</option>");
        });
    }

    function fillOrgSelect(selectedId) {
        const $select = $("#sd-org");
        CadminApi.fhir("/Organization?_count=200&_sort=name").done(function (bundle) {
            const orgs = CadminApi.bundleResources(bundle, "Organization");
            const options = ['<option value="">None</option>'].concat(orgs.map(function (org) {
                return '<option value="' + esc(org.id) + '">' + esc(org.name || org.id) + "</option>";
            }));
            $select.html(options.join(""));
            if (selectedId) {
                $select.val(selectedId);
            }
        });
    }

    function applyFilterDef() {
        const def = filterDef($("#sd-fp-name").val());
        $("#sd-fp-resource").val(def && def.resource ? def.resource : "");
        const comparators = (def && def.comparator && def.comparator.length)
            ? def.comparator.map(function (code) {
                return { code: code, display: CadminApi.valueSetDisplay(comparatorOptions, code) };
            })
            : comparatorOptions;
        const modifiers = (def && def.modifier && def.modifier.length)
            ? def.modifier.map(function (code) {
                return { code: code, display: CadminApi.valueSetDisplay(modifierOptions, code) };
            })
            : modifierOptions;
        $("#sd-fp-cmp").html('<option value="">None</option>' + optionsHtml(comparators));
        $("#sd-fp-mod").html('<option value="">None</option>' + optionsHtml(modifiers));
    }

    function parseUnsigned(selector) {
        const raw = $(selector).val().trim();
        if (!raw) {
            return null;
        }
        const value = Number(raw);
        return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
    }

    function bind() {
        const $root = $("#app-content");
        $root.off(".subdetail");

        $root.on("click.subdetail", "#sd-off", function () {
            subscription.status = "off";
            saveSubscription(function () {
                CadminApi.showToast("success", "Subscription turned off.");
            });
        });

        $root.on("click.subdetail", "#sd-rerequest", function () {
            subscription.status = "requested";
            saveSubscription(function () {
                CadminApi.showToast("success", "Subscription re-requested.");
            });
        });

        $("#sd-basic-modal").on("show.bs.modal", function () {
            $("#sd-name").val(subscription.name || "");
            $("#sd-reason").val(subscription.reason || "");
            fillTopicSelect(subscription.topic || "");
            fillOrgSelect(refId(subscription.managingEntity));
        });

        $("#sd-channel-modal").on("show.bs.modal", function () {
            $("#sd-channel-type").val((subscription.channelType && subscription.channelType.code) || "rest-hook");
            $("#sd-endpoint").val(subscription.endpoint || "");
            $("#sd-content").val(subscription.content || "id-only");
            $("#sd-content-type").val(subscription.contentType || "application/fhir+json");
            $("#sd-heartbeat").val(subscription.heartbeatPeriod != null ? subscription.heartbeatPeriod : "");
            $("#sd-timeout").val(subscription.timeout != null ? subscription.timeout : "");
            $("#sd-max-count").val(subscription.maxCount != null ? subscription.maxCount : "");
            $("#sd-end").val(toLocalInput(subscription.end));
        });

        $("#sd-filter-modal").on("show.bs.modal", function () {
            const allowed = topicFilters();
            if (!allowed.length) {
                $("#sd-fp-name").html('<option value="">This topic has no canFilterBy parameters</option>');
                return;
            }
            $("#sd-fp-name").html(allowed.map(function (item) {
                return '<option value="' + esc(item.filterParameter) + '">' +
                    esc(item.filterParameter) +
                    (item.description ? " — " + item.description : "") +
                    "</option>";
            }).join(""));
            $("#sd-fp-value").val("");
            applyFilterDef();
        });

        $("#sd-fp-name").on("change", applyFilterDef);

        $("#sd-basic-form").on("submit", function (event) {
            event.preventDefault();
            const name = $("#sd-name").val().trim();
            const reason = $("#sd-reason").val().trim();
            const topic = $("#sd-topic").val();
            const orgId = $("#sd-org").val();
            if (!topic) {
                CadminApi.showToast("danger", "Select a subscription topic.");
                return;
            }
            if (name) { subscription.name = name; } else { delete subscription.name; }
            if (reason) { subscription.reason = reason; } else { delete subscription.reason; }
            subscription.topic = topic;
            if (orgId) {
                const label = $("#sd-org option:selected").text();
                subscription.managingEntity = {
                    reference: "Organization/" + orgId,
                    display: label
                };
            } else {
                delete subscription.managingEntity;
            }
            saveSubscription(function () {
                hideModal("sd-basic-modal");
                CadminApi.showToast("success", "Subscription updated.");
                loadTopic();
            });
        });

        $("#sd-channel-form").on("submit", function (event) {
            event.preventDefault();
            const channel = channelTypes.find(function (option) {
                return option.code === $("#sd-channel-type").val();
            }) || channelTypes[0];
            subscription.channelType = {
                system: channel.system || "http://terminology.hl7.org/CodeSystem/subscription-channel-type",
                code: channel.code,
                display: channel.display
            };
            const endpoint = $("#sd-endpoint").val().trim();
            const content = $("#sd-content").val();
            const contentType = $("#sd-content-type").val().trim();
            const heartbeat = parseUnsigned("#sd-heartbeat");
            const timeout = parseUnsigned("#sd-timeout");
            const maxCount = parseUnsigned("#sd-max-count");
            const end = fromLocalInput($("#sd-end").val());
            if (endpoint) { subscription.endpoint = endpoint; } else { delete subscription.endpoint; }
            if (content) { subscription.content = content; } else { delete subscription.content; }
            if (contentType) { subscription.contentType = contentType; } else { delete subscription.contentType; }
            if (heartbeat != null) { subscription.heartbeatPeriod = heartbeat; } else { delete subscription.heartbeatPeriod; }
            if (timeout != null) { subscription.timeout = timeout; } else { delete subscription.timeout; }
            if (maxCount != null && maxCount >= 1) { subscription.maxCount = maxCount; } else { delete subscription.maxCount; }
            if (end) { subscription.end = end; } else { delete subscription.end; }
            saveSubscription(function () {
                hideModal("sd-channel-modal");
                CadminApi.showToast("success", "Channel updated.");
            });
        });

        $("#sd-filter-form").on("submit", function (event) {
            event.preventDefault();
            const allowed = topicFilters();
            const name = $("#sd-fp-name").val();
            if (!name || !allowed.length) {
                CadminApi.showToast("danger", "Choose a filter parameter defined by the topic.");
                return;
            }
            const filter = { filterParameter: name, value: $("#sd-fp-value").val().trim() };
            const resource = $("#sd-fp-resource").val().trim();
            const comparator = $("#sd-fp-cmp").val();
            const modifier = $("#sd-fp-mod").val();
            if (resource) { filter.resource = resource; }
            if (comparator) { filter.comparator = comparator; }
            if (modifier) { filter.modifier = modifier; }
            subscription.filterBy = subscription.filterBy || [];
            subscription.filterBy.push(filter);
            saveSubscription(function () {
                hideModal("sd-filter-modal");
                CadminApi.showToast("success", "Filter added.");
            });
        });

        $("#sd-param-form").on("submit", function (event) {
            event.preventDefault();
            const param = {
                name: $("#sd-pn-name").val().trim(),
                value: $("#sd-pn-value").val().trim()
            };
            subscription.parameter = subscription.parameter || [];
            subscription.parameter.push(param);
            saveSubscription(function () {
                hideModal("sd-param-modal");
                $("#sd-pn-name").val("");
                $("#sd-pn-value").val("");
                CadminApi.showToast("success", "Channel parameter added.");
            });
        });

        $root.on("click.subdetail", "[data-remove-filter]", function () {
            const index = Number($(this).attr("data-remove-filter"));
            subscription.filterBy = (subscription.filterBy || []).filter(function (_item, i) { return i !== index; });
            if (!subscription.filterBy.length) {
                delete subscription.filterBy;
            }
            saveSubscription(function () {
                CadminApi.showToast("success", "Filter removed.");
            });
        });

        $root.on("click.subdetail", "[data-remove-param]", function () {
            const index = Number($(this).attr("data-remove-param"));
            subscription.parameter = (subscription.parameter || []).filter(function (_item, i) { return i !== index; });
            if (!subscription.parameter.length) {
                delete subscription.parameter;
            }
            saveSubscription(function () {
                CadminApi.showToast("success", "Channel parameter removed.");
            });
        });
    }

    return { render: render };
}());
