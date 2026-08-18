CadminApp.register("consents", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Consent/" + encodeURIComponent(token)).done(function (consent) {
            CadminConsentDetail.render(consent);
        }).fail(function () {
            renderConsentList();
        });
        return;
    }
    renderConsentList();
});

function renderConsentList() {
    let statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "inactive", display: "Inactive" },
        { code: "not-done", display: "Not done" },
        { code: "entered-in-error", display: "Entered in error" },
        { code: "unknown", display: "Unknown" }
    ];
    let decisionOptions = [
        { code: "deny", display: "Deny" },
        { code: "permit", display: "Permit" }
    ];
    let categoryOptions = [
        { code: "npp", display: "Notice of Privacy Practices",
            system: "http://terminology.hl7.org/CodeSystem/consentcategorycodes" },
        { code: "INFA", display: "Information access",
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode" },
        { code: "patient-privacy", display: "Privacy Consent",
            system: "http://terminology.hl7.org/CodeSystem/consentscope" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Consents</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-consent-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New consent</button>' +
        "</div>" +
        '<div id="consent-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Consent search</h6>' +
                '<form class="d-flex flex-wrap gap-2" id="consent-search-form">' +
                    '<select class="form-select form-select-sm" id="consent-status-filter" style="max-width:10rem">' +
                        '<option value="">Any status</option></select>' +
                    '<select class="form-select form-select-sm" id="consent-category-filter" style="max-width:14rem">' +
                        '<option value="">Any category</option></select>' +
                    '<select class="form-select form-select-sm" id="consent-patient-filter" style="max-width:14rem">' +
                        '<option value="">Any patient</option></select>' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Subject</th><th>Category</th><th>Decision</th><th>Status</th>" +
                        "<th>Period</th><th>Grantee</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="consent-rows"><tr><td colspan="8" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="consent-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-consent-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-consent-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create consent</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Subject</label>' +
                            '<select class="form-select" id="c-subject" required>' +
                                '<option value="">Loading patients…</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Category</label>' +
                            '<select class="form-select" id="c-category" required></select></div>' +
                        '<div class="mb-3"><label class="form-label">Decision</label>' +
                            '<select class="form-select" id="c-decision"></select>' +
                            '<div class="form-text">Deny is opt-in (exceptions permit). Permit is opt-out (exceptions deny).</div></div>' +
                        '<div class="mb-3"><label class="form-label">Date</label>' +
                            '<input type="date" class="form-control" id="c-date"></div>' +
                        '<div class="mb-0"><label class="form-label">Grantee</label>' +
                            '<select class="form-select" id="c-grantee">' +
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

    function periodLabel(period) {
        if (!period || (!period.start && !period.end)) {
            return "—";
        }
        return (period.start || "…") + " – " + (period.end || "…");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "entered-in-error" || status === "not-done" ? "danger"
                : status === "inactive" ? "secondary"
                    : "warning";
        return '<span class="badge text-bg-' + kind + '">' +
            esc(CadminApi.valueSetDisplay(statusOptions, status)) + "</span>";
    }

    function decisionBadge(decision) {
        if (!decision) {
            return "—";
        }
        const kind = decision === "permit" ? "success" : "danger";
        return '<span class="badge text-bg-' + kind + '">' +
            esc(CadminApi.valueSetDisplay(decisionOptions, decision)) + "</span>";
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

    let listPage = 0;

    function load(page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Consent?_sort=-_lastUpdated";
        const status = $("#consent-status-filter").val();
        const category = $("#consent-category-filter").val();
        const patient = $("#consent-patient-filter").val();
        if (status) {
            path += "&status=" + encodeURIComponent(status);
        }
        if (category) {
            path += "&category=" + encodeURIComponent(category);
        }
        if (patient) {
            path += "&patient=" + encodeURIComponent(patient);
        }
        CadminApi.fhir(CadminApi.pagedPath(path, listPage)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Consent");
            CadminApi.renderPager("#consent-pager", {
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(nextPage); }
            });
            if (!entries.length) {
                $("#consent-rows").html('<tr><td colspan="8" class="text-muted">No consents found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (consent) {
                const title = refLabel(consent.subject) + " · " + conceptLabel(consent.category);
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/consents/" + encodeURIComponent(consent.id), title) + "</td>" +
                    "<td>" + esc(conceptLabel(consent.category)) + "</td>" +
                    "<td>" + decisionBadge(consent.decision) + "</td>" +
                    "<td>" + statusBadge(consent.status) + "</td>" +
                    "<td>" + esc(periodLabel(consent.period)) + "</td>" +
                    "<td>" + esc(refLabel(consent.grantee)) + "</td>" +
                    "<td><code>" + esc(consent.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/consents/' +
                        encodeURIComponent(consent.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#consent-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#consent-pager").empty();
            $("#consent-rows").html('<tr><td colspan="8" class="text-danger">Unable to load consents from /fhir.</td></tr>');
            CadminApi.showAlert("#consent-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#consent-search-form").on("submit", function (event) {
        event.preventDefault();
        load(0);
    });

    $("#create-consent-modal").on("show.bs.modal", function () {
        fillRefSelect("#c-subject", "/Patient?_count=200&_sort=name", "Patient", personName, "Select patient…");
        fillRefSelect("#c-grantee", "/Organization?_count=200&_sort=name", "Organization", function (org) {
            return org.name || org.id;
        }, "None");
        if (!$("#c-date").val()) {
            $("#c-date").val(new Date().toISOString().slice(0, 10));
        }
    });

    $("#create-consent-form").on("submit", function (event) {
        event.preventDefault();
        const subjectId = $("#c-subject").val();
        if (!subjectId) {
            CadminApi.showToast("danger", "Select a patient.");
            return;
        }
        const subjectDisplay = $("#c-subject option:selected").text();
        const categoryCoding = codingFromSelect("#c-category", categoryOptions,
            "http://terminology.hl7.org/CodeSystem/consentcategorycodes");
        const resource = {
            resourceType: "Consent",
            status: "draft",
            subject: { reference: "Patient/" + subjectId, display: subjectDisplay },
            grantor: [{ reference: "Patient/" + subjectId, display: subjectDisplay }]
        };
        if (categoryCoding) {
            resource.category = [{ coding: [categoryCoding] }];
        }
        const decision = $("#c-decision").val();
        if (decision) {
            resource.decision = decision;
        }
        const date = $("#c-date").val();
        if (date) {
            resource.date = date;
        }
        const granteeId = $("#c-grantee").val();
        if (granteeId) {
            resource.grantee = [{
                reference: "Organization/" + granteeId,
                display: $("#c-grantee option:selected").text()
            }];
        }
        CadminApi.fhir("/Consent", "POST", resource).done(function (created, _status, xhr) {
            const id = CadminApi.createdResourceId(created, xhr, "Consent");
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-consent-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Consent created.");
            if (id) {
                window.location.hash = "#/consents/" + encodeURIComponent(id);
                return;
            }
            load(0);
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    CadminApi.fillValueSetSelect("#consent-status-filter", CadminApi.valueSets.consentState, {
        fallback: statusOptions,
        prepend: [{ code: "", display: "Any status" }],
        selected: "",
        onConcepts: function (concepts) { statusOptions = concepts; }
    });
    CadminApi.fillSelectOptions("#c-category", categoryOptions, { selected: "npp" });
    CadminApi.fillSelectOptions("#consent-category-filter", categoryOptions, {
        prepend: [{ code: "", display: "Any category" }],
        selected: ""
    });
    CadminApi.expandValueSet(CadminApi.valueSets.consentCategory).done(function (concepts) {
        categoryOptions = usableCategories(concepts);
        CadminApi.fillSelectOptions("#consent-category-filter", categoryOptions, {
            prepend: [{ code: "", display: "Any category" }],
            selected: ""
        });
        CadminApi.fillSelectOptions("#c-category", categoryOptions, { selected: "npp" });
    }).fail(function () {
        CadminApi.fillSelectOptions("#consent-category-filter", categoryOptions, {
            prepend: [{ code: "", display: "Any category" }],
            selected: ""
        });
        CadminApi.fillSelectOptions("#c-category", categoryOptions, { selected: "npp" });
    });
    CadminApi.fillValueSetSelect("#c-decision", CadminApi.valueSets.consentProvisionType, {
        fallback: decisionOptions,
        selected: "deny",
        onConcepts: function (concepts) { decisionOptions = concepts; }
    });
    fillRefSelect("#consent-patient-filter", "/Patient?_count=200&_sort=name", "Patient", personName, "Any patient");

    load(0);
}
