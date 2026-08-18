CadminApp.register("demo-data", function () {
    const $root = $("#app-content");
    const state = {
        step: 1,
        selection: CadminDemoData.defaultSelection(),
        continueOnError: true,
        seed: Date.now() % 2147483647,
        plan: null,
        running: false,
        created: 0,
        failed: 0
    };

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function typeIcon(item) {
        if (item.icon.indexOf(":") >= 0) {
            return '<iconify-icon icon="' + esc(item.icon) + '" aria-hidden="true"></iconify-icon>';
        }
        return '<i class="bi ' + esc(item.icon) + '" aria-hidden="true"></i>';
    }

    function stepperHtml() {
        const steps = [
            { n: 1, label: "Select types" },
            { n: 2, label: "Preview" },
            { n: 3, label: "Generate" }
        ];
        return '<ol class="demo-stepper list-unstyled">' + steps.map(function (step) {
            const cls = step.n === state.step ? "active" : (step.n < state.step ? "done" : "");
            return '<li class="demo-step ' + cls + '">' +
                '<span class="demo-step-num">' + step.n + "</span>" +
                "<span>" + step.label + "</span></li>";
        }).join("") + "</ol>";
    }

    function selectionRows() {
        return CadminDemoData.PRIMARY_TYPES.map(function (item) {
            const entry = state.selection[item.key];
            return "<tr>" +
                "<td>" + typeIcon(item) + " " + esc(item.label) + "</td>" +
                '<td><div class="form-check mb-0">' +
                    '<input class="form-check-input demo-type" type="checkbox" id="demo-type-' + item.key +
                        '" data-key="' + item.key + '"' + (entry.enabled ? " checked" : "") + ">" +
                "</div></td>" +
                '<td style="max-width:7rem"><input class="form-control form-control-sm demo-count" type="number" min="1" max="250" ' +
                    'id="demo-count-' + item.key + '" data-key="' + item.key + '" value="' + entry.count + '"' +
                    (entry.enabled ? "" : " disabled") + "></td>" +
                "</tr>";
        }).join("");
    }

    function impliedNote() {
        const normalized = CadminDemoData.normalizeSelection(state.selection);
        const extras = [];
        Object.keys(normalized.implied).forEach(function (key) {
            const item = CadminDemoData.PRIMARY_TYPES.find(function (entry) { return entry.key === key; });
            if (item) {
                extras.push(item.label + " (" + normalized.counts[key] + ")");
            }
        });
        if (normalized.counts.practitioner && normalized.counts.organization) {
            extras.push("PractitionerRole");
        }
        if (normalized.counts.device && normalized.counts.patient) {
            extras.push("DeviceAssociation");
        }
        if (normalized.counts.organization >= 2) {
            extras.push("OrganizationAffiliation");
        }
        if (normalized.counts.organization) {
            extras.push("Endpoint");
        }
        if (normalized.counts.patient) {
            extras.push("Flag");
        }
        if (CadminDemoData.PRIMARY_TYPES.some(function (entry) {
            return normalized.counts[entry.key] > 0;
        })) {
            extras.push("Questionnaire");
        }
        if (!extras.length) {
            return '<p class="text-muted mb-0">Association resources are added automatically when the selected types need them.</p>';
        }
        return '<p class="mb-0">Also creating: <strong>' + extras.map(esc).join(", ") + "</strong></p>";
    }

    function readForm() {
        CadminDemoData.PRIMARY_TYPES.forEach(function (item) {
            state.selection[item.key] = {
                enabled: $("#demo-type-" + item.key).is(":checked"),
                count: CadminDemoData.clampCount($("#demo-count-" + item.key).val())
            };
        });
        state.continueOnError = $("#demo-continue").is(":checked");
    }

    function previewRows() {
        const plan = state.plan;
        if (!plan || !plan.drafts.length) {
            return '<tr><td colspan="4" class="text-muted">Nothing to generate.</td></tr>';
        }
        const byType = {};
        plan.drafts.forEach(function (draft) {
            byType[draft.type] = byType[draft.type] || [];
            byType[draft.type].push(draft);
        });
        const rows = [];
        Object.keys(byType).forEach(function (type) {
            const list = byType[type];
            const samples = list.slice(0, 5).map(function (draft) {
                return esc(draft.display) + (draft.detail ? ' <span class="text-muted">· ' + esc(draft.detail) + "</span>" : "");
            });
            const more = list.length > 5 ? ' <span class="text-muted">+' + (list.length - 5) + " more</span>" : "";
            const implied = list.some(function (draft) { return draft.implied; });
            rows.push("<tr>" +
                "<td><code>" + esc(type) + "</code></td>" +
                "<td>" + list.length + (implied ? ' <span class="badge text-bg-info">Association</span>' : "") + "</td>" +
                "<td>" + samples.join("<br>") + more + "</td>" +
                "</tr>");
        });
        return rows.join("");
    }

    function render() {
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<h1 class="h3 mb-1 page-title">Demo data</h1>' +
                    '<p class="text-muted mb-0">Generate realistic people, organizations, and the association resources that link them.</p>' +
                "</div>" +
            "</div>" +
            '<div id="demo-alert" class="alert d-none"></div>' +
            stepperHtml() +
            '<div class="card shadow mb-4" id="demo-step-1">' +
                '<div class="card-header py-3"><h6 class="m-0">Resource types</h6></div>' +
                '<div class="card-body">' +
                    '<div class="table-responsive">' +
                        '<table class="table align-middle mb-3">' +
                            "<thead><tr><th>Type</th><th>Generate</th><th>Count</th></tr></thead>" +
                            "<tbody>" + selectionRows() + "</tbody>" +
                        "</table>" +
                    "</div>" +
                    '<div class="form-check mb-3">' +
                        '<input class="form-check-input" type="checkbox" id="demo-continue"' +
                            (state.continueOnError ? " checked" : "") + ">" +
                        '<label class="form-check-label" for="demo-continue">Continue if a create fails</label>' +
                    "</div>" +
                    '<div class="alert alert-info mb-0" id="demo-implied">' + impliedNote() + "</div>" +
                "</div>" +
                '<div class="card-footer d-flex justify-content-end">' +
                    '<button class="btn btn-primary" type="button" id="demo-next-1">Preview</button>' +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4 d-none" id="demo-step-2">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Preview</h6>' +
                    '<button class="btn btn-sm btn-outline-secondary" type="button" id="demo-shuffle">' +
                        '<i class="bi bi-shuffle me-1"></i>Shuffle names</button>' +
                "</div>" +
                '<div class="card-body">' +
                    '<p class="text-muted" id="demo-assoc-note"></p>' +
                    '<div class="table-responsive">' +
                        '<table class="table table-hover align-middle">' +
                            "<thead><tr><th>Resource</th><th>Count</th><th>Sample</th></tr></thead>" +
                            '<tbody id="demo-preview-rows"></tbody>' +
                        "</table>" +
                    "</div>" +
                "</div>" +
                '<div class="card-footer d-flex justify-content-between">' +
                    '<button class="btn btn-outline-secondary" type="button" id="demo-back-2">Back</button>' +
                    '<button class="btn btn-primary" type="button" id="demo-next-2">Generate</button>' +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4 d-none" id="demo-step-3">' +
                '<div class="card-header py-3"><h6 class="m-0">Progress</h6></div>' +
                '<div class="card-body">' +
                    '<div class="progress mb-3" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
                        '<div class="progress-bar" id="demo-progress" style="width:0%">0%</div>' +
                    "</div>" +
                    '<p class="mb-2" id="demo-run-summary">Preparing…</p>' +
                    '<div class="demo-log list-group" id="demo-log"></div>' +
                "</div>" +
                '<div class="card-footer d-flex justify-content-between">' +
                    '<button class="btn btn-outline-secondary" type="button" id="demo-back-3" disabled>Start over</button>' +
                    '<a class="btn btn-outline-primary" href="#/resources">Open FHIR browser</a>' +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3"><h6 class="m-0">Existing demo data</h6></div>' +
                '<div class="card-body">' +
                    '<p class="text-muted">Resources tagged <code>' + esc(CadminDemoData.TAG_CODE) +
                        "</code> can be removed without touching other FHIR data.</p>" +
                    '<div id="demo-existing">Loading…</div>' +
                "</div>" +
                '<div class="card-footer d-flex justify-content-end">' +
                    '<button class="btn btn-outline-danger" type="button" id="demo-purge" disabled>' +
                        '<i class="bi bi-trash me-1"></i>Remove demo data</button>' +
                "</div>" +
            "</div>" +
            '<div class="modal fade" id="demo-purge-modal" tabindex="-1">' +
                '<div class="modal-dialog">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header"><h5 class="modal-title">Remove demo data</h5>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                        '<div class="modal-body">Delete every resource tagged as demo data? This cannot be undone.</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                            '<button type="button" class="btn btn-danger" id="demo-purge-confirm">Delete</button>' +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</div>"
        );
        bind();
        showStep(state.step);
        loadExisting();
    }

    function showStep(step) {
        state.step = step;
        $root.find(".demo-stepper").replaceWith(stepperHtml());
        $("#demo-step-1").toggleClass("d-none", step !== 1);
        $("#demo-step-2").toggleClass("d-none", step !== 2);
        $("#demo-step-3").toggleClass("d-none", step !== 3);
    }

    function refreshImplied() {
        $("#demo-implied").html(impliedNote());
    }

    function fillPreview() {
        state.plan = CadminDemoData.buildPlan(state.selection, state.seed);
        $("#demo-preview-rows").html(previewRows());
        const notes = (state.plan.associations || []).map(function (item) {
            return "<li>" + esc(item) + "</li>";
        }).join("");
        $("#demo-assoc-note").html(
            notes
                ? "Each generated resource is tagged <code>" + esc(CadminDemoData.TAG_CODE) +
                    "</code>. Association resources:" +
                    '<ul class="mb-0 mt-2">' + notes + "</ul>"
                : "Each generated resource is tagged <code>" + esc(CadminDemoData.TAG_CODE) + "</code>."
        );
    }

    function setProgress(done, total) {
        const pct = total ? Math.round((done / total) * 100) : 0;
        $("#demo-progress").css("width", pct + "%").text(pct + "%");
    }

    function logLine(ok, message) {
        const cls = ok ? "list-group-item-success" : "list-group-item-danger";
        const icon = ok ? "bi-check-circle" : "bi-x-circle";
        $("#demo-log").prepend(
            '<div class="list-group-item ' + cls + '">' +
                '<i class="bi ' + icon + ' me-2"></i>' + esc(message) +
            "</div>"
        );
    }

    function runPlan() {
        const plan = state.plan;
        const drafts = plan.drafts || [];
        const created = {};
        state.running = true;
        state.created = 0;
        state.failed = 0;
        $("#demo-log").empty();
        $("#demo-back-3").prop("disabled", true);
        $("#demo-run-summary").text("Creating " + drafts.length + " resources…");
        setProgress(0, drafts.length);

        function finish() {
            state.running = false;
            $("#demo-back-3").prop("disabled", false);
            const summary = "Created " + state.created + " resource" + (state.created === 1 ? "" : "s") +
                (state.failed ? " (" + state.failed + " failed)." : ".");
            $("#demo-run-summary").text(summary);
            CadminApi.showToast(state.failed ? "warning" : "success", summary);
            loadExisting();
        }

        function attachCreated(draft, createdItem) {
            const targets = draft.attachTo;
            if (!targets || !createdItem || !createdItem.id) {
                return $.Deferred().resolve().promise();
            }
            const epRef = {
                reference: createdItem.type + "/" + createdItem.id,
                display: createdItem.display
            };
            const jobs = [];
            function pushRef(type, key) {
                const target = created[key];
                if (!key || !target || !target.id) {
                    return;
                }
                jobs.push(CadminApi.fhir("/" + type + "/" + encodeURIComponent(target.id)).then(function (resource) {
                    resource.endpoint = resource.endpoint || [];
                    resource.endpoint.push(epRef);
                    return CadminApi.fhir("/" + type + "/" + encodeURIComponent(target.id), "PUT", resource);
                }));
            }
            pushRef("Organization", targets.organization);
            pushRef("Location", targets.location);
            if (!jobs.length) {
                return $.Deferred().resolve().promise();
            }
            return $.when.apply($, jobs);
        }

        function recordCreated(draft, id, index) {
            created[draft.key] = { id: id, display: draft.display, type: draft.type };
            attachCreated(draft, created[draft.key]).always(function () {
                state.created += 1;
                logLine(true, draft.type + " “" + draft.display + "”");
                setProgress(index + 1, drafts.length);
                postAt(index + 1);
            });
        }

        function postAt(index) {
            if (index >= drafts.length) {
                finish();
                return;
            }
            const draft = drafts[index];
            const resource = CadminDemoData.applyBindings(draft, created);
            CadminApi.fhir("/" + draft.type, "POST", resource).done(function (body, _status, xhr) {
                recordCreated(draft, CadminApi.createdResourceId(body, xhr, draft.type), index);
            }).fail(function (xhr) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    recordCreated(draft, CadminApi.createdResourceId(xhr.responseJSON, xhr, draft.type), index);
                    return;
                }
                state.failed += 1;
                logLine(false, draft.type + " “" + draft.display + "” failed (" + xhr.status + ")");
                setProgress(index + 1, drafts.length);
                if (state.continueOnError) {
                    postAt(index + 1);
                    return;
                }
                finish();
            });
        }

        if (!drafts.length) {
            finish();
            return;
        }
        postAt(0);
    }

    function loadExisting() {
        const $box = $("#demo-existing");
        const types = CadminDemoData.PURGE_TYPES;
        let pending = types.length;
        const counts = {};
        let total = 0;
        types.forEach(function (type) {
            CadminApi.fhir("/" + type + "?_tag=" + encodeURIComponent(CadminDemoData.tagToken()) +
                    "&_count=1&_total=accurate").done(function (bundle) {
                const n = typeof bundle.total === "number" ? bundle.total : ((bundle.entry || []).length);
                counts[type] = n;
                total += n;
            }).fail(function () {
                counts[type] = 0;
            }).always(function () {
                pending -= 1;
                if (pending) {
                    return;
                }
                if (!total) {
                    $box.html('<p class="text-muted mb-0">No tagged demo resources on this server.</p>');
                    $("#demo-purge").prop("disabled", true);
                    return;
                }
                const chips = types.filter(function (type) { return counts[type]; }).map(function (type) {
                    return '<span class="cap-chip">' + esc(type) + " · " + counts[type] + "</span>";
                }).join("");
                $box.html("<p class=\"mb-2\">" + total + " tagged resource" + (total === 1 ? "" : "s") + "</p>" + chips);
                $("#demo-purge").prop("disabled", false);
            });
        });
    }

    function deleteTagged(type, onDone) {
        CadminApi.fhir("/" + type + "?_tag=" + encodeURIComponent(CadminDemoData.tagToken()) + "&_count=50")
            .done(function (bundle) {
                const resources = (bundle.entry || []).map(function (entry) { return entry.resource; }).filter(Boolean);
                if (!resources.length) {
                    onDone(0);
                    return;
                }
                let deleted = 0;
                let index = 0;
                function next() {
                    if (index >= resources.length) {
                        deleteTagged(type, function (more) {
                            onDone(deleted + more);
                        });
                        return;
                    }
                    const resource = resources[index];
                    index += 1;
                    CadminApi.fhir("/" + type + "/" + encodeURIComponent(resource.id) + "?_cascade=delete", "DELETE")
                        .always(function () {
                            deleted += 1;
                            next();
                        });
                }
                next();
            }).fail(function () {
                onDone(0);
            });
    }

    function purgeAll() {
        const types = CadminDemoData.PURGE_TYPES.slice();
        let removed = 0;
        $("#demo-purge, #demo-purge-confirm").prop("disabled", true);
        function nextType() {
            if (!types.length) {
                CadminApi.showToast("success", "Removed " + removed + " demo resource" + (removed === 1 ? "" : "s") + ".");
                loadExisting();
                return;
            }
            const type = types.shift();
            deleteTagged(type, function (count) {
                removed += count;
                nextType();
            });
        }
        nextType();
    }

    function bind() {
        $root.off(".demo");
        $root.on("change.demo", ".demo-type", function () {
            const key = $(this).data("key");
            $("#demo-count-" + key).prop("disabled", !$(this).is(":checked"));
            readForm();
            refreshImplied();
        });
        $root.on("change.demo", ".demo-count, #demo-continue", function () {
            readForm();
            refreshImplied();
        });
        $("#demo-next-1").on("click", function () {
            readForm();
            if (!CadminDemoData.hasPrimarySelection(state.selection)) {
                CadminApi.showToast("warning", "Select at least one resource type.");
                return;
            }
            fillPreview();
            showStep(2);
        });
        $("#demo-back-2").on("click", function () {
            showStep(1);
        });
        $("#demo-shuffle").on("click", function () {
            state.seed = (state.seed + 7919) % 2147483647;
            fillPreview();
        });
        $("#demo-next-2").on("click", function () {
            if (!state.plan || !state.plan.drafts.length) {
                CadminApi.showToast("warning", "Nothing to generate.");
                return;
            }
            showStep(3);
            runPlan();
        });
        $("#demo-back-3").on("click", function () {
            if (state.running) {
                return;
            }
            showStep(1);
        });
        $("#demo-purge").on("click", function () {
            bootstrap.Modal.getOrCreateInstance(document.getElementById("demo-purge-modal")).show();
        });
        $("#demo-purge-confirm").on("click", function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("demo-purge-modal"));
            if (modal) {
                modal.hide();
            }
            purgeAll();
        });
    }

    render();
});
