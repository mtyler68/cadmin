CadminApp.register("flags", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminWorkspace.openRoute("flags", token, function (resource, $root) {
            CadminFlagDetail.render(resource, $root);
        }, function () {
            renderFlagList();
        });
        return;
    }
    renderFlagList();
});

function renderFlagList() {
    let statusOptions = [
        { code: "active", display: "Active" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    let categoryOptions = [
        { code: "diet", display: "Diet", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "drug", display: "Drug", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "lab", display: "Lab", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "admin", display: "Administrative", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "contact", display: "Subject contact", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "clinical", display: "Clinical", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "behavioral", display: "Behavioral", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "research", display: "Research", system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "advance-directive", display: "Advance directive",
            system: "http://terminology.hl7.org/CodeSystem/flag-category" },
        { code: "safety", display: "Safety", system: "http://terminology.hl7.org/CodeSystem/flag-category" }
    ];
    const codeCatalog = [
        { code: "fall-risk", display: "Fall risk" },
        { code: "isolation", display: "Isolation precautions" },
        { code: "interpreter", display: "Interpreter needed" },
        { code: "admin-hold", display: "Administrative hold" },
        { code: "advance-directive", display: "Advance directive on file" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Flags</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-flag-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New flag</button>' +
        "</div>" +
        '<div id="flag-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Flag search</h6>' +
                '<form class="d-flex flex-wrap gap-2" id="flag-search-form">' +
                    '<select class="form-select form-select-sm" id="flag-status-filter" style="max-width:10rem">' +
                        '<option value="">Any status</option></select>' +
                    '<select class="form-select form-select-sm" id="flag-category-filter" style="max-width:14rem">' +
                        '<option value="">Any category</option></select>' +
                    '<select class="form-select form-select-sm" id="flag-patient-filter" style="max-width:14rem">' +
                        '<option value="">Any patient</option></select>' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Patient</th><th>Code</th><th>Category</th><th>Status</th>" +
                        "<th>Period</th><th>Author</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="flag-rows"><tr><td colspan="8" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="flag-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-flag-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-flag-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create flag</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Patient</label>' +
                            '<select class="form-select" id="f-subject" required>' +
                                '<option value="">Loading patients…</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="f-status"></select></div>' +
                        '<div class="mb-3"><label class="form-label">Category</label>' +
                            '<select class="form-select" id="f-category" required></select></div>' +
                        '<div class="mb-3"><label class="form-label">Code</label>' +
                            '<select class="form-select" id="f-code">' +
                                '<option value="">Custom message</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Message</label>' +
                            '<input class="form-control" id="f-text" required placeholder="What should staff see?"></div>' +
                        '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Period start</label>' +
                            '<input type="date" class="form-control" id="f-start"></div>' +
                            '<div class="col-md-6 mb-3"><label class="form-label">Period end</label>' +
                            '<input type="date" class="form-control" id="f-end"></div></div>' +
                        '<div class="mb-0"><label class="form-label">Author</label>' +
                            '<select class="form-select" id="f-author">' +
                                '<option value="">None</option></select></div>' +
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

    function usableCategories(concepts) {
        return (concepts || []).filter(function (item) {
            return item.code && item.code.charAt(0) !== "_";
        });
    }

    function personName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function conceptLabel(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item) {
            return "—";
        }
        const coding = (item.coding && item.coding[0]) || item;
        return item.text || coding.display || coding.code || "—";
    }

    function refLabel(ref) {
        if (!ref) {
            return "—";
        }
        const first = Array.isArray(ref) ? ref[0] : ref;
        return first.display || (first.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        return CadminApi.referenceId(Array.isArray(ref) ? ref[0] : ref);
    }

    function periodLabel(period) {
        if (!period || (!period.start && !period.end)) {
            return "—";
        }
        return (period.start || "…") + " – " + (period.end || "…");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "warning"
            : status === "entered-in-error" ? "danger"
                : "secondary";
        return '<span class="badge text-bg-' + kind + '">' +
            esc(CadminApi.valueSetDisplay(statusOptions, status)) + "</span>";
    }

    function fillRefSelect(selector, path, resourceType, labelFn, emptyLabel) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const resources = CadminApi.bundleResources(bundle, resourceType);
            const options = ['<option value="">' + esc(emptyLabel) + "</option>"].concat(resources.map(function (resource) {
                return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
            }));
            $select.html(options.join(""));
        }).fail(function () {
            $select.html('<option value="">' + esc(emptyLabel) + "</option>");
        });
    }

    function codingFromSelect(selector, catalog, fallbackSystem) {
        const code = $(selector).val();
        if (!code) {
            return null;
        }
        const match = catalog.find(function (item) { return item.code === code; }) || { code: code, display: code };
        return {
            system: match.system || fallbackSystem,
            code: match.code,
            display: match.display
        };
    }

    function applyCodeText() {
        const match = codeCatalog.find(function (item) { return item.code === $("#f-code").val(); });
        if (match) {
            $("#f-text").val(match.display);
        }
    }

    let listPage = 0;

    function load(page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Flag?_sort=-_lastUpdated";
        const status = $("#flag-status-filter").val();
        const category = $("#flag-category-filter").val();
        const patient = CadminApi.selectValue("#flag-patient-filter");
        if (status) {
            path += "&status=" + encodeURIComponent(status);
        }
        if (category) {
            path += "&category=" + encodeURIComponent(category);
        }
        if (patient) {
            path += "&patient=" + encodeURIComponent(patient);
        }
        const pageSize = CadminApi.listPageSize("flags");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Flag");
            CadminApi.renderPager("#flag-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "flags",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(nextPage); }
            });
            if (!entries.length) {
                $("#flag-rows").html('<tr><td colspan="8" class="text-muted">No flags found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (flag) {
                const patientId = refId(flag.subject);
                const patientHtml = patientId
                    ? CadminApi.resourceLink("#/patients/" + encodeURIComponent(patientId), refLabel(flag.subject))
                    : esc(refLabel(flag.subject));
                const codeLabel = conceptLabel(flag.code);
                return "<tr>" +
                    "<td>" + patientHtml + "</td>" +
                    "<td>" + CadminApi.resourceLink("#/flags/" + encodeURIComponent(flag.id), codeLabel) + "</td>" +
                    "<td>" + esc(conceptLabel(flag.category)) + "</td>" +
                    "<td>" + statusBadge(flag.status) + "</td>" +
                    "<td>" + esc(periodLabel(flag.period)) + "</td>" +
                    "<td>" + esc(refLabel(flag.author)) + "</td>" +
                    "<td><code>" + esc(flag.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/flags/' +
                        encodeURIComponent(flag.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#flag-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#flag-pager").empty();
            $("#flag-rows").html('<tr><td colspan="8" class="text-danger">Unable to load flags from /fhir.</td></tr>');
            CadminApi.showAlert("#flag-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#flag-search-form").on("submit", function (event) {
        event.preventDefault();
        load(0);
    });

    $("#f-code").on("change", applyCodeText);

    $("#create-flag-modal").on("show.bs.modal", function () {
        CadminApi.bindPatientSelect("#f-subject", { placeholder: "Select patient…" });
        CadminApi.bindPractitionerSelect("#f-author", { placeholder: "None" });
        $("#f-status").val("active");
        if (!$("#f-text").val()) {
            applyCodeText();
        }
    });

    $("#create-flag-form").on("submit", function (event) {
        event.preventDefault();
        const subjectId = CadminApi.selectValue("#f-subject");
        const text = $("#f-text").val().trim();
        if (!subjectId) {
            CadminApi.showToast("danger", "Select a patient.");
            return;
        }
        if (!text) {
            CadminApi.showToast("danger", "Enter a flag message.");
            return;
        }
        const subjectDisplay = CadminApi.selectLabel("#f-subject");
        const categoryCoding = codingFromSelect("#f-category", categoryOptions,
            "http://terminology.hl7.org/CodeSystem/flag-category");
        const resource = {
            resourceType: "Flag",
            status: $("#f-status").val() || "active",
            subject: { reference: "Patient/" + subjectId, display: subjectDisplay },
            code: { text: text }
        };
        if (categoryCoding) {
            resource.category = [{ coding: [categoryCoding] }];
        }
        const code = codingFromSelect("#f-code", codeCatalog, "https://cadmin.io/fhir/CodeSystem/flag-code");
        if (code) {
            resource.code.coding = [code];
        }
        const start = $("#f-start").val();
        const end = $("#f-end").val();
        if (start || end) {
            resource.period = {};
            if (start) {
                resource.period.start = start;
            }
            if (end) {
                resource.period.end = end;
            }
        }
        const authorId = CadminApi.selectValue("#f-author");
        if (authorId) {
            resource.author = {
                reference: "Practitioner/" + authorId,
                display: CadminApi.selectLabel("#f-author")
            };
        }
        CadminApi.fhir("/Flag", "POST", resource).done(function (created, _status, xhr) {
            const id = CadminApi.createdResourceId(created, xhr, "Flag");
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-flag-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Flag created.");
            if (id) {
                window.location.hash = "#/flags/" + encodeURIComponent(id);
                return;
            }
            load(0);
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    CadminApi.fillValueSetSelect("#flag-status-filter", CadminApi.valueSets.flagStatus, {
        fallback: statusOptions,
        prepend: [{ code: "", display: "Any status" }],
        selected: "",
        onConcepts: function (concepts) { statusOptions = concepts; }
    });
    CadminApi.fillValueSetSelect("#f-status", CadminApi.valueSets.flagStatus, {
        fallback: statusOptions,
        selected: "active"
    });
    CadminApi.fillSelectOptions("#f-category", categoryOptions, { selected: "safety" });
    CadminApi.fillSelectOptions("#flag-category-filter", categoryOptions, {
        prepend: [{ code: "", display: "Any category" }],
        selected: ""
    });
    CadminApi.fillSelectOptions("#f-code", codeCatalog, {
        prepend: [{ code: "", display: "Custom message" }],
        selected: "fall-risk"
    });
    CadminApi.expandValueSet(CadminApi.valueSets.flagCategory).done(function (concepts) {
        categoryOptions = usableCategories(concepts);
        CadminApi.fillSelectOptions("#flag-category-filter", categoryOptions, {
            prepend: [{ code: "", display: "Any category" }],
            selected: ""
        });
        CadminApi.fillSelectOptions("#f-category", categoryOptions, { selected: "safety" });
    }).fail(function () {
        CadminApi.fillSelectOptions("#flag-category-filter", categoryOptions, {
            prepend: [{ code: "", display: "Any category" }],
            selected: ""
        });
        CadminApi.fillSelectOptions("#f-category", categoryOptions, { selected: "safety" });
    });
    CadminApi.bindPatientSelect("#flag-patient-filter", { placeholder: "Any patient" });

    load(0);
}
