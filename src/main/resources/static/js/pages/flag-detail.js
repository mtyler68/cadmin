window.CadminFlagDetail = (function () {
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

    let flag = null;

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function usableCategories(concepts) {
        return (concepts || []).filter(function (item) {
            return item.code && item.code.charAt(0) !== "_";
        });
    }

    function personName(resource) {
        const name = (resource && resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function conceptLabel(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item) {
            return "—";
        }
        const coding = (item.coding && item.coding[0]) || item;
        return item.text || coding.display || coding.code || "—";
    }

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
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

    function flagTitle() {
        return conceptLabel(flag.code) !== "—"
            ? conceptLabel(flag.code)
            : (refLabel(flag.subject) + " flag");
    }

    function hideModal(id) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function fail(action, xhr) {
        CadminApi.showAlert("#flag-detail-alert", "danger", action + " failed (" + xhr.status + ").");
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function fillRefSelect(selector, path, resourceType, labelFn, emptyLabel, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const resources = CadminApi.bundleResources(bundle, resourceType);
            const options = ['<option value="">' + esc(emptyLabel) + "</option>"].concat(resources.map(function (resource) {
                return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
            }));
            $select.html(options.join(""));
            if (selectedId) {
                $select.val(selectedId);
            }
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

    function saveFlag(next) {
        CadminApi.fhir("/Flag/" + encodeURIComponent(flag.id), "PUT", flag).done(function (updated) {
            flag = updated || flag;
            renderHeader();
            renderBasics();
            CadminResourceGraph.mount(flag);
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update flag", xhr);
        });
    }

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function renderHeader() {
        $("#fd-title").text(flagTitle());
        $("#fd-inactivate").toggleClass("d-none", flag.status !== "active");
    }

    function subjectHtml() {
        const id = refId(flag.subject);
        if (id) {
            return CadminApi.resourceLink("#/patients/" + encodeURIComponent(id), refLabel(flag.subject));
        }
        return esc(refLabel(flag.subject));
    }

    function authorHtml() {
        const id = refId(flag.author);
        if (id) {
            return CadminApi.resourceLink("#/practitioners/" + encodeURIComponent(id), refLabel(flag.author));
        }
        return esc(refLabel(flag.author));
    }

    function codeHtml() {
        const text = flag.code && flag.code.text ? flag.code.text : "";
        const coding = flag.code && flag.code.coding && flag.code.coding[0];
        const parts = [];
        if (text) {
            parts.push(esc(text));
        }
        if (coding && (coding.display || coding.code) && (coding.display || coding.code) !== text) {
            parts.push('<span class="text-muted">(' + esc(coding.display || coding.code) + ")</span>");
        } else if (!text && coding) {
            parts.push(esc(coding.display || coding.code));
        }
        return parts.join(" ") || "—";
    }

    function renderBasics() {
        $("#fd-basics").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(flag.status) + "</dd>" +
                '<dt class="col-sm-3">Patient</dt><dd class="col-sm-9">' + subjectHtml() + "</dd>" +
                '<dt class="col-sm-3">Code</dt><dd class="col-sm-9">' + codeHtml() + "</dd>" +
                '<dt class="col-sm-3">Category</dt><dd class="col-sm-9">' + esc(conceptLabel(flag.category)) + "</dd>" +
                '<dt class="col-sm-3">Period</dt><dd class="col-sm-9">' + esc(periodLabel(flag.period)) + "</dd>" +
                '<dt class="col-sm-3">Author</dt><dd class="col-sm-9">' + authorHtml() + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(flag.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function populateForm() {
        CadminApi.fillValueSetSelect("#fd-status", CadminApi.valueSets.flagStatus, {
            fallback: statusOptions,
            selected: flag.status || "active",
            onConcepts: function (concepts) { statusOptions = concepts; }
        });
        const categoryCode = currentCode(flag.category);
        CadminApi.fillSelectOptions("#fd-category", categoryOptions, { selected: categoryCode });
        CadminApi.expandValueSet(CadminApi.valueSets.flagCategory).done(function (concepts) {
            categoryOptions = usableCategories(concepts);
            CadminApi.fillSelectOptions("#fd-category", categoryOptions, { selected: categoryCode });
        });
        const code = currentCode(flag.code);
        CadminApi.fillSelectOptions("#fd-code", codeCatalog, {
            prepend: [{ code: "", display: "Custom message" }],
            selected: code
        });
        $("#fd-text").val((flag.code && flag.code.text) || conceptLabel(flag.code) || "");
        $("#fd-start").val((flag.period && flag.period.start) || "");
        $("#fd-end").val((flag.period && flag.period.end) || "");
        CadminApi.bindPatientSelect("#fd-subject", {
            placeholder: "Select patient…",
            selectedId: refId(flag.subject),
            selectedLabel: refLabel(flag.subject)
        });
        CadminApi.bindPractitionerSelect("#fd-author", {
            placeholder: "None",
            selectedId: refId(flag.author),
            selectedLabel: refLabel(flag.author)
        });
    }

    function applyCodeText() {
        const match = codeCatalog.find(function (item) { return item.code === $("#fd-code").val(); });
        if (match) {
            $("#fd-text").val(match.display);
        }
    }

    function applyForm() {
        const subjectId = CadminApi.selectValue("#fd-subject");
        const text = $("#fd-text").val().trim();
        if (!subjectId) {
            CadminApi.showToast("danger", "Select a patient.");
            return false;
        }
        if (!text) {
            CadminApi.showToast("danger", "Enter a flag message.");
            return false;
        }
        flag.status = $("#fd-status").val() || "active";
        flag.subject = {
            reference: "Patient/" + subjectId,
            display: CadminApi.selectLabel("#fd-subject")
        };
        flag.code = { text: text };
        const code = codingFromSelect("#fd-code", codeCatalog, "https://cadmin.io/fhir/CodeSystem/flag-code");
        if (code) {
            flag.code.coding = [code];
        }
        const categoryCoding = codingFromSelect("#fd-category", categoryOptions,
            "http://terminology.hl7.org/CodeSystem/flag-category");
        if (categoryCoding) {
            flag.category = [{ coding: [categoryCoding] }];
        } else {
            delete flag.category;
        }
        const start = $("#fd-start").val();
        const end = $("#fd-end").val();
        if (start || end) {
            flag.period = {};
            if (start) {
                flag.period.start = start;
            }
            if (end) {
                flag.period.end = end;
            }
        } else {
            delete flag.period;
        }
        const authorId = CadminApi.selectValue("#fd-author");
        if (authorId) {
            flag.author = {
                reference: "Practitioner/" + authorId,
                display: CadminApi.selectLabel("#fd-author")
            };
        } else {
            delete flag.author;
        }
        return true;
    }

    function inactivate() {
        flag.status = "inactive";
        flag.period = flag.period || {};
        flag.period.end = today();
        saveFlag(function () {
            CadminApi.showToast("success", "Flag inactivated.");
        });
    }

    function render(resource) {
        flag = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/flags">' +
                        '<i class="bi bi-arrow-left me-1"></i>Flags</a>' +
                    '<h1 class="h3 mb-0 page-title" id="fd-title"></h1>' +
                "</div>" +
                '<div class="d-flex flex-wrap gap-2">' +
                    '<button class="btn btn-outline-warning" type="button" id="fd-inactivate">' +
                        '<i class="bi bi-flag me-1"></i>Inactivate</button>' +
                    '<button class="btn btn-outline-danger" type="button" id="fd-delete">' +
                        '<i class="bi bi-trash me-1"></i>Delete</button>' +
                    '<a class="btn btn-outline-primary" href="#/resources/Flag/' +
                        encodeURIComponent(flag.id) + '">' +
                        '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
                "</div>" +
            "</div>" +
            '<div id="flag-detail-alert" class="alert d-none"></div>' +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Flag</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#fd-edit-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="fd-basics"></div>' +
            "</div>" +
            CadminResourceGraph.card() +
            '<div class="modal fade" id="fd-edit-modal" tabindex="-1">' +
                '<div class="modal-dialog">' +
                    '<form class="modal-content" id="fd-edit-form">' +
                        '<div class="modal-header"><h5 class="modal-title">Edit flag</h5>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                        '<div class="modal-body">' +
                            field("Patient", '<select class="form-select" id="fd-subject" required></select>') +
                            field("Status", '<select class="form-select" id="fd-status"></select>') +
                            field("Category", '<select class="form-select" id="fd-category"></select>') +
                            field("Code", '<select class="form-select" id="fd-code"></select>') +
                            field("Message", '<input class="form-control" id="fd-text" required>') +
                            '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Period start</label>' +
                                '<input type="date" class="form-control" id="fd-start"></div>' +
                                '<div class="col-md-6 mb-3"><label class="form-label">Period end</label>' +
                                '<input type="date" class="form-control" id="fd-end"></div></div>' +
                            field("Author", '<select class="form-select" id="fd-author"></select>') +
                        "</div>" +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                            '<button type="submit" class="btn btn-primary">Save</button>' +
                        "</div>" +
                    "</form>" +
                "</div>" +
            "</div>"
        );
        CadminResourceGraph.mount(flag);
        renderHeader();
        renderBasics();
        bind();
    }

    function bind() {
        const $root = $("#app-content");
        $root.off(".flagdetail");

        $("#fd-edit-modal").on("show.bs.modal", populateForm);
        $("#fd-code").on("change", applyCodeText);

        $("#fd-edit-form").on("submit", function (event) {
            event.preventDefault();
            if (!applyForm()) {
                return;
            }
            saveFlag(function () {
                hideModal("fd-edit-modal");
                CadminApi.showToast("success", "Flag updated.");
            });
        });

        $root.on("click.flagdetail", "#fd-inactivate", function () {
            if (!window.confirm("Inactivate this flag?")) {
                return;
            }
            inactivate();
        });

        $root.on("click.flagdetail", "#fd-delete", function () {
            if (!window.confirm("Delete this flag?")) {
                return;
            }
            CadminApi.fhir("/Flag/" + encodeURIComponent(flag.id), "DELETE").done(function () {
                CadminApi.showToast("success", "Flag deleted.");
                window.location.hash = "#/flags";
            }).fail(function (xhr) {
                fail("Delete flag", xhr);
            });
        });
    }

    return { render: render };
}());
