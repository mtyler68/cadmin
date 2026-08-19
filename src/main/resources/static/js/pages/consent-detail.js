window.CadminConsentDetail = (function () {
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
            system: "http://terminology.hl7.org/CodeSystem/consentcategorycodes" }
    ];
    let actionOptions = [
        { code: "access", display: "Access", system: "http://terminology.hl7.org/CodeSystem/consentaction" },
        { code: "use", display: "Use", system: "http://terminology.hl7.org/CodeSystem/consentaction" },
        { code: "collect", display: "Collect", system: "http://terminology.hl7.org/CodeSystem/consentaction" },
        { code: "disclose", display: "Disclose", system: "http://terminology.hl7.org/CodeSystem/consentaction" },
        { code: "correct", display: "Access and Correct", system: "http://terminology.hl7.org/CodeSystem/consentaction" }
    ];
    let dataMeaningOptions = [
        { code: "instance", display: "Instance" },
        { code: "related", display: "Related" },
        { code: "dependents", display: "Dependents" },
        { code: "authoredby", display: "Authored by" }
    ];
    const purposeOptions = [
        { code: "TREAT", display: "Treatment", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "HPAYMT", display: "Healthcare payment", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "HOPERAT", display: "Healthcare operations", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "HRESCH", display: "Healthcare research", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "PATRQT", display: "Patient requested", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "PUBHLTH", display: "Public health", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        { code: "ETREAT", display: "Emergency treatment", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" }
    ];
    const partyTypes = [
        { type: "Patient", path: "/Patient?_count=200&_sort=name", person: true },
        { type: "RelatedPerson", path: "/RelatedPerson?_count=200&_sort=name", person: true },
        { type: "Organization", path: "/Organization?_count=200&_sort=name", person: false },
        { type: "Practitioner", path: "/Practitioner?_count=200&_sort=name", person: true }
    ];

    let consent = null;
    let resourceTypeOptions = [];
    let provisionDraft = emptyProvision();
    let editingPath = null;

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function usableCategories(concepts) {
        return (concepts || []).filter(function (item) {
            return item.code && item.code.charAt(0) !== "_";
        });
    }

    function personName(resource) {
        if (resource.name) {
            const name = Array.isArray(resource.name) ? resource.name[0] : resource.name;
            const given = (name.given || []).join(" ");
            return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
        }
        return resource.name || resource.id || "Unnamed";
    }

    function conceptLabel(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item) {
            return "—";
        }
        const coding = (item.coding && item.coding[0]) || item;
        return item.text || coding.display || coding.code || "—";
    }

    function codingListLabel(items) {
        return (items || []).map(function (item) {
            return conceptLabel(item);
        }).filter(function (label) { return label !== "—"; }).join(", ") || "—";
    }

    function refLabel(ref) {
        if (!ref) {
            return "—";
        }
        const first = Array.isArray(ref) ? ref[0] : ref;
        if (!first) {
            return "—";
        }
        return first.display || (first.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        return CadminApi.referenceId(Array.isArray(ref) ? ref[0] : ref);
    }

    function refType(ref) {
        const first = Array.isArray(ref) ? ref[0] : ref;
        const reference = (first && first.reference) || "";
        const match = reference.match(/^([A-Za-z]+)\//);
        return match ? match[1] : "";
    }

    function refHref(ref) {
        const type = refType(ref);
        const id = refId(ref);
        if (!type || !id) {
            return "";
        }
        if (type === "Patient") {
            return "#/patients/" + encodeURIComponent(id);
        }
        if (type === "Organization") {
            return "#/organizations/" + encodeURIComponent(id);
        }
        if (type === "Practitioner") {
            return "#/practitioners/" + encodeURIComponent(id);
        }
        if (type === "RelatedPerson") {
            return "#/caregivers/" + encodeURIComponent(id);
        }
        if (type === "CareTeam") {
            return "#/care-teams/" + encodeURIComponent(id);
        }
        return "#/resources/" + encodeURIComponent(type) + "/" + encodeURIComponent(id);
    }

    function refHtml(ref) {
        if (Array.isArray(ref)) {
            if (!ref.length) {
                return "—";
            }
            return ref.map(refHtml).join(", ");
        }
        const href = refHref(ref);
        const label = refLabel(ref);
        return href ? CadminApi.resourceLink(href, label) : esc(label);
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

    function impliedEffect(depth) {
        const base = consent.decision;
        if (!base) {
            return "—";
        }
        const opposite = base === "permit" ? "deny" : "permit";
        return depth % 2 === 0 ? opposite : base;
    }

    function consentTitle() {
        return refLabel(consent.subject) + " · " + conceptLabel(consent.category);
    }

    function hideModal(id) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function fail(action, xhr) {
        CadminApi.showAlert("#consent-detail-alert", "danger", action + " failed (" + xhr.status + ").");
    }

    function saveConsent(next) {
        CadminApi.fhir("/Consent/" + encodeURIComponent(consent.id), "PUT", consent).done(function (updated) {
            consent = updated || consent;
            renderHeader();
            renderBasics();
            renderParties();
            renderSource();
            renderProvisions();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update consent", xhr);
        });
    }

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function modal(id, title, body, formId, wide) {
        return '<div class="modal fade" id="' + id + '" tabindex="-1">' +
            '<div class="modal-dialog' + (wide ? " modal-lg" : "") + '">' +
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

    function emptyProvision() {
        return { actor: [], action: [], purpose: [], resourceType: [], data: [], provision: [] };
    }

    function optionsHtml(items, selected) {
        return (items || []).map(function (item) {
            const code = item.code != null ? item.code : item;
            const display = item.display != null ? item.display : item;
            const mark = String(code) === String(selected) ? " selected" : "";
            return '<option value="' + esc(code) + '"' + mark + ">" + esc(display) + "</option>";
        }).join("");
    }

    function findConcept(catalog, code) {
        return (catalog || []).find(function (item) { return item.code === code; }) || null;
    }

    function codingFromCode(code, catalog, fallbackSystem) {
        const match = findConcept(catalog, code) || { code: code, display: code };
        return {
            system: match.system || fallbackSystem,
            code: match.code,
            display: match.display
        };
    }

    function fillRefSelect(selector, path, resourceType, labelFn, emptyLabel, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const resources = CadminApi.bundleResources(bundle, resourceType);
            const options = ['<option value="">' + esc(emptyLabel || "Select…") + "</option>"].concat(
                resources.map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                })
            );
            $select.html(options.join(""));
            if (selectedId) {
                $select.val(selectedId);
            }
        }).fail(function () {
            $select.html('<option value="">' + esc(emptyLabel || "Select…") + "</option>");
        });
    }

    function fillPartyResourceSelect(typeSelect, resourceSelect, selectedRef) {
        const type = $(typeSelect).val() || refType(selectedRef) || "Patient";
        $(typeSelect).val(type);
        const spec = partyTypes.find(function (item) { return item.type === type; }) || partyTypes[0];
        CadminApi.destroySelect(resourceSelect);
        if (CadminApi.bindFhirSelect) {
            CadminApi.bindFhirSelect(resourceSelect, spec.type, {
                placeholder: "Select…",
                selectedId: refId(selectedRef),
                selectedLabel: refLabel(selectedRef)
            });
            return;
        }
        fillRefSelect(resourceSelect, spec.path, spec.type,
            spec.person ? personName : function (resource) { return resource.name || resource.id; },
            "Select…", refId(selectedRef));
    }

    function selectedPartyRef(typeSelect, resourceSelect) {
        const type = $(typeSelect).val();
        const id = CadminApi.selectValue(resourceSelect);
        if (!type || !id) {
            return null;
        }
        return {
            reference: type + "/" + id,
            display: CadminApi.selectLabel(resourceSelect)
        };
    }

    function render(resource) {
        consent = resource;
        provisionDraft = emptyProvision();
        editingPath = null;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/consents">' +
                        '<i class="bi bi-arrow-left me-1"></i>Consents</a>' +
                    '<h1 class="h3 mb-0 page-title" id="cd-title"></h1>' +
                "</div>" +
                '<div class="d-flex flex-wrap gap-2" id="cd-actions"></div>' +
            "</div>" +
            '<div id="consent-detail-alert" class="alert d-none"></div>' +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Basics</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#cd-basic-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="cd-basics"></div>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Parties</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#cd-party-modal">Add</button>' +
                "</div>" +
                '<div class="card-body" id="cd-parties"></div>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Source and verification</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#cd-source-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="cd-source"></div>' +
            "</div>" +
            card("Provisions", "cd-provision-rows",
                ["Effect", "Period", "Actions", "Resources", "Actors", ""], "#cd-provision-modal", "Add") +
            CadminResourceGraph.card() +
            modal("cd-basic-modal", "Edit basics",
                field("Category", '<select class="form-select" id="cd-category"></select>') +
                field("Decision", '<select class="form-select" id="cd-decision">' +
                    '<option value="">Unspecified</option></select>') +
                field("Date", '<input type="date" class="form-control" id="cd-date">') +
                field("Period start", '<input type="date" class="form-control" id="cd-period-start">') +
                field("Period end", '<input type="date" class="form-control" id="cd-period-end">'),
                "cd-basic-form") +
            modal("cd-party-modal", "Add party",
                field("Role", '<select class="form-select" id="cd-party-role">' +
                    '<option value="grantor">Grantor</option>' +
                    '<option value="grantee">Grantee</option>' +
                    '<option value="manager">Manager</option>' +
                    '<option value="controller">Controller</option></select>') +
                field("Type", '<select class="form-select" id="cd-party-type">' +
                    optionsHtml(partyTypes.map(function (item) { return { code: item.type, display: item.type }; })) +
                    "</select>") +
                field("Resource", '<select class="form-select" id="cd-party-resource" required></select>'),
                "cd-party-form") +
            modal("cd-source-modal", "Edit source and verification",
                field("Source reference", '<input class="form-control font-monospace" id="cd-source-ref" ' +
                    'placeholder="DocumentReference/id">') +
                field("Attachment title", '<input class="form-control" id="cd-att-title">') +
                field("Attachment URL", '<input class="form-control font-monospace" id="cd-att-url">') +
                field("Backing policy URL", '<input class="form-control font-monospace" id="cd-policy-url">') +
                '<div class="form-check mb-3">' +
                    '<input class="form-check-input" type="checkbox" id="cd-verified">' +
                    '<label class="form-check-label" for="cd-verified">Verified</label></div>' +
                field("Verified with", '<select class="form-select" id="cd-verified-with">' +
                    '<option value="">None</option></select>') +
                field("Verified by", '<select class="form-select" id="cd-verified-by">' +
                    '<option value="">None</option></select>') +
                field("Verification date", '<input type="datetime-local" class="form-control" id="cd-verified-date">'),
                "cd-source-form") +
            modal("cd-provision-modal", "Provision",
                '<p class="text-muted small" id="cd-provision-effect"></p>' +
                field("Period start", '<input type="date" class="form-control" id="cd-pr-start">') +
                field("Period end", '<input type="date" class="form-control" id="cd-pr-end">') +
                '<div class="mb-3"><label class="form-label">Actions</label>' +
                    '<div id="cd-pr-actions"></div></div>' +
                field("Purpose", '<select class="form-select" id="cd-pr-purpose" multiple size="5"></select>') +
                '<div class="mb-3"><label class="form-label">Resource types</label>' +
                    '<div class="d-flex gap-2 mb-2">' +
                        '<select class="form-select" id="cd-pr-rt"></select>' +
                        '<button class="btn btn-outline-primary" type="button" id="cd-pr-rt-add">Add</button></div>' +
                    '<div id="cd-pr-rt-chips"></div></div>' +
                '<div class="mb-3"><label class="form-label">Actors</label>' +
                    '<div class="row g-2 mb-2">' +
                        '<div class="col-4"><select class="form-select" id="cd-pr-actor-type">' +
                            optionsHtml(partyTypes.map(function (item) {
                                return { code: item.type, display: item.type };
                            })) + "</select></div>" +
                        '<div class="col"><select class="form-select" id="cd-pr-actor-resource"></select></div>' +
                        '<div class="col-auto"><button class="btn btn-outline-primary" type="button" id="cd-pr-actor-add">Add</button></div>' +
                    "</div>" +
                    '<div id="cd-pr-actor-list"></div></div>' +
                '<div class="mb-0"><label class="form-label">Data</label>' +
                    '<div class="row g-2 mb-2">' +
                        '<div class="col-4"><select class="form-select" id="cd-pr-data-meaning"></select></div>' +
                        '<div class="col"><input class="form-control font-monospace" id="cd-pr-data-ref" placeholder="Observation/id"></div>' +
                        '<div class="col-auto"><button class="btn btn-outline-primary" type="button" id="cd-pr-data-add">Add</button></div>' +
                    "</div>" +
                    '<div id="cd-pr-data-list"></div></div>',
                "cd-provision-form", true)
        );
        CadminResourceSource.mount(function () { return consent; });
        CadminResourceGraph.mount(consent);
        renderHeader();
        renderBasics();
        renderParties();
        renderSource();
        renderProvisions();
        bind();
        bindValueSets();
    }

    function renderHeader() {
        $("#cd-title").text(consentTitle());
        let actions = statusBadge(consent.status);
        if (consent.status === "draft" || consent.status === "inactive") {
            actions += '<button class="btn btn-outline-primary" type="button" id="cd-activate">' +
                '<i class="bi bi-play-circle me-1"></i>Activate</button>';
        }
        if (consent.status === "active") {
            actions += '<button class="btn btn-outline-secondary" type="button" id="cd-inactivate">' +
                '<i class="bi bi-pause-circle me-1"></i>Inactivate</button>';
        }
        actions += CadminResourceSource.button();
        $("#cd-actions").html(actions);
    }

    function renderBasics() {
        $("#cd-basics").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Subject</dt><dd class="col-sm-9">' + refHtml(consent.subject) + "</dd>" +
                '<dt class="col-sm-3">Category</dt><dd class="col-sm-9">' + esc(conceptLabel(consent.category)) + "</dd>" +
                '<dt class="col-sm-3">Decision</dt><dd class="col-sm-9">' + decisionBadge(consent.decision) + "</dd>" +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(consent.status) + "</dd>" +
                '<dt class="col-sm-3">Date</dt><dd class="col-sm-9">' + esc(consent.date || "—") + "</dd>" +
                '<dt class="col-sm-3">Period</dt><dd class="col-sm-9">' + esc(periodLabel(consent.period)) + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(consent.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function partyRows(label, refs, fieldName) {
        return (refs || []).map(function (ref, index) {
            return "<tr>" +
                "<td>" + esc(label) + "</td>" +
                "<td>" + refHtml(ref) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-party="' +
                    fieldName + '" data-index="' + index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join("");
    }

    function renderParties() {
        const rows = partyRows("Grantor", consent.grantor, "grantor") +
            partyRows("Grantee", consent.grantee, "grantee") +
            partyRows("Manager", consent.manager, "manager") +
            partyRows("Controller", consent.controller, "controller");
        if (!rows) {
            $("#cd-parties").html('<p class="text-muted mb-0">No parties yet. Add a grantor or grantee.</p>');
            return;
        }
        $("#cd-parties").html(
            '<div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
                "<thead><tr><th>Role</th><th>Party</th><th></th></tr></thead>" +
                "<tbody>" + rows + "</tbody></table></div>"
        );
    }

    function firstSourceRef() {
        const ref = (consent.sourceReference && consent.sourceReference[0]) || null;
        return ref ? (ref.reference || "") : "";
    }

    function firstAttachment() {
        return (consent.sourceAttachment && consent.sourceAttachment[0]) || {};
    }

    function firstVerification() {
        return (consent.verification && consent.verification[0]) || null;
    }

    function renderSource() {
        const attachment = firstAttachment();
        const verification = firstVerification();
        $("#cd-source").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Source</dt><dd class="col-sm-9">' +
                    (firstSourceRef() ? "<code>" + esc(firstSourceRef()) + "</code>" : "—") + "</dd>" +
                '<dt class="col-sm-3">Attachment</dt><dd class="col-sm-9">' +
                    esc(attachment.title || attachment.url || "—") + "</dd>" +
                '<dt class="col-sm-3">Backing policy</dt><dd class="col-sm-9">' +
                    (consent.policyBasis && consent.policyBasis.url
                        ? "<code>" + esc(consent.policyBasis.url) + "</code>" : "—") + "</dd>" +
                '<dt class="col-sm-3">Verified</dt><dd class="col-sm-9">' +
                    (verification ? (verification.verified ? "Yes" : "No") : "—") + "</dd>" +
                '<dt class="col-sm-3">Verified with</dt><dd class="col-sm-9">' +
                    refHtml(verification && verification.verifiedWith) + "</dd>" +
                '<dt class="col-sm-3">Verified by</dt><dd class="col-sm-9">' +
                    refHtml(verification && verification.verifiedBy) + "</dd>" +
            "</dl>"
        );
    }

    function provisionRow(item, path, depth) {
        const effect = impliedEffect(depth);
        const kind = effect === "permit" ? "success" : effect === "deny" ? "danger" : "secondary";
        const indent = depth ? ' class="table-light"' : "";
        const prefix = depth ? '<span class="text-muted me-2">↳</span>' : "";
        let buttons = '<button class="btn btn-sm btn-outline-primary me-1" type="button" data-edit-provision="' +
            path + '" title="Edit"><i class="bi bi-pencil"></i></button>';
        if (depth === 0) {
            buttons += '<button class="btn btn-sm btn-outline-primary me-1" type="button" data-add-nested="' +
                path + '" title="Add exception"><i class="bi bi-plus-lg"></i></button>';
        }
        buttons += '<button class="btn btn-sm btn-outline-danger" type="button" data-remove-provision="' +
            path + '" title="Remove"><i class="bi bi-trash"></i></button>';
        return "<tr" + indent + ">" +
            "<td>" + prefix + '<span class="badge text-bg-' + kind + '">' + esc(effect) + "</span></td>" +
            "<td>" + esc(periodLabel(item.period)) + "</td>" +
            "<td>" + esc(codingListLabel(item.action)) + "</td>" +
            "<td>" + esc(codingListLabel(item.resourceType)) + "</td>" +
            "<td>" + esc((item.actor || []).map(function (actor) { return refLabel(actor.reference); }).join(", ") || "—") + "</td>" +
            '<td class="text-end text-nowrap">' + buttons + "</td></tr>";
    }

    function renderProvisions() {
        const rows = [];
        (consent.provision || []).forEach(function (item, index) {
            rows.push(provisionRow(item, String(index), 0));
            (item.provision || []).forEach(function (child, childIndex) {
                rows.push(provisionRow(child, index + "." + childIndex, 1));
            });
        });
        $("#cd-provision-rows").html(rows.length
            ? rows.join("")
            : emptyRow(6, "No provisions. Exceptions to the base decision go here."));
    }

    function renderDraftLists() {
        $("#cd-pr-rt-chips").html((provisionDraft.resourceType || []).map(function (item, index) {
            return '<span class="badge text-bg-light border me-1 mb-1">' + esc(conceptLabel(item)) +
                ' <button type="button" class="btn-close btn-close-sm" data-remove-rt="' + index +
                '" aria-label="Remove"></button></span>';
        }).join("") || '<span class="text-muted">None</span>');
        $("#cd-pr-actor-list").html((provisionDraft.actor || []).map(function (item, index) {
            return '<div class="d-flex justify-content-between align-items-center mb-1">' +
                "<span>" + esc(refLabel(item.reference)) + "</span>" +
                '<button class="btn btn-sm btn-outline-danger" type="button" data-remove-actor="' +
                index + '"><i class="bi bi-trash"></i></button></div>';
        }).join("") || '<span class="text-muted">None</span>');
        $("#cd-pr-data-list").html((provisionDraft.data || []).map(function (item, index) {
            return '<div class="d-flex justify-content-between align-items-center mb-1">' +
                "<span>" + esc(item.meaning || "instance") + " · <code>" +
                esc((item.reference && item.reference.reference) || "—") + "</code></span>" +
                '<button class="btn btn-sm btn-outline-danger" type="button" data-remove-data="' +
                index + '"><i class="bi bi-trash"></i></button></div>';
        }).join("") || '<span class="text-muted">None</span>');
    }

    function provisionAt(path) {
        const parts = String(path).split(".").map(Number);
        let current = (consent.provision || [])[parts[0]];
        if (parts.length > 1 && current) {
            current = (current.provision || [])[parts[1]];
        }
        return current || null;
    }

    function cloneProvision(item) {
        return JSON.parse(JSON.stringify(item || emptyProvision()));
    }

    function compactProvision(item) {
        const next = {};
        if (item.period && (item.period.start || item.period.end)) {
            next.period = {};
            if (item.period.start) { next.period.start = item.period.start; }
            if (item.period.end) { next.period.end = item.period.end; }
        }
        ["actor", "action", "purpose", "resourceType", "data", "provision"].forEach(function (key) {
            if (item[key] && item[key].length) {
                next[key] = item[key];
            }
        });
        return next;
    }

    function selectedChecks(name) {
        const values = [];
        $('input[name="' + name + '"]:checked').each(function () {
            values.push($(this).val());
        });
        return values;
    }

    function bindValueSets() {
        CadminApi.expandValueSet(CadminApi.valueSets.consentState).done(function (concepts) {
            statusOptions = concepts;
            renderHeader();
            renderBasics();
        });
        CadminApi.expandValueSet(CadminApi.valueSets.consentProvisionType).done(function (concepts) {
            decisionOptions = concepts;
            renderBasics();
            renderProvisions();
        });
        CadminApi.expandValueSet(CadminApi.valueSets.consentCategory).done(function (concepts) {
            categoryOptions = usableCategories(concepts);
        });
        CadminApi.expandValueSet(CadminApi.valueSets.consentAction).done(function (concepts) {
            actionOptions = concepts;
        });
        CadminApi.expandValueSet(CadminApi.valueSets.consentDataMeaning).done(function (concepts) {
            dataMeaningOptions = concepts;
        });
        CadminApi.expandValueSet(CadminApi.valueSets.resourceTypes, { count: 300 }).done(function (concepts) {
            resourceTypeOptions = concepts;
        });
    }

    function populateProvisionModal(path, nestedParent) {
        editingPath = path;
        const depth = nestedParent != null ? 1 : (path && String(path).indexOf(".") >= 0 ? 1 : 0);
        const effect = impliedEffect(depth);
        $("#cd-provision-effect").text("Implied effect: " + effect +
            " (exception to the " + (depth ? "parent provision" : "base decision") + ").");
        const item = path != null ? cloneProvision(provisionAt(path)) : emptyProvision();
        provisionDraft = item;
        $("#cd-pr-start").val((item.period && item.period.start) || "");
        $("#cd-pr-end").val((item.period && item.period.end) || "");
        CadminApi.fillValueSetChecks("#cd-pr-actions", CadminApi.valueSets.consentAction, {
            fallback: actionOptions,
            name: "cd-pr-action",
            selected: (item.action || []).map(function (cc) {
                return ((cc.coding && cc.coding[0]) || cc).code;
            })
        });
        CadminApi.fillSelectOptions("#cd-pr-purpose", purposeOptions, { selected: "" });
        $("#cd-pr-purpose").val((item.purpose || []).map(function (coding) {
            return coding.code;
        }));
        CadminApi.fillValueSetSelect("#cd-pr-rt", CadminApi.valueSets.resourceTypes, {
            fallback: resourceTypeOptions.length
                ? resourceTypeOptions
                : ["Patient", "Observation", "Condition", "Encounter", "MedicationRequest"].map(function (type) {
                    return { code: type, display: type };
                }),
            count: 300,
            onConcepts: function (concepts) { resourceTypeOptions = concepts; }
        });
        CadminApi.fillSelectOptions("#cd-pr-data-meaning", dataMeaningOptions, { selected: "instance" });
        fillPartyResourceSelect("#cd-pr-actor-type", "#cd-pr-actor-resource");
        renderDraftLists();
    }

    function bind() {
        const $root = $("#app-content");
        $root.off(".consentdetail");

        $root.on("click.consentdetail", "#cd-activate", function () {
            consent.status = "active";
            saveConsent(function () {
                CadminApi.showToast("success", "Consent activated.");
            });
        });
        $root.on("click.consentdetail", "#cd-inactivate", function () {
            consent.status = "inactive";
            saveConsent(function () {
                CadminApi.showToast("success", "Consent inactivated.");
            });
        });

        $("#cd-basic-modal").on("show.bs.modal", function () {
            const categoryCode = ((((consent.category || [])[0] || {}).coding || [])[0] || {}).code;
            CadminApi.fillSelectOptions("#cd-category", categoryOptions, { selected: categoryCode || "npp" });
            CadminApi.fillSelectOptions("#cd-decision", decisionOptions, {
                prepend: [{ code: "", display: "Unspecified" }],
                selected: consent.decision || ""
            });
            $("#cd-date").val(consent.date || "");
            $("#cd-period-start").val((consent.period && consent.period.start) || "");
            $("#cd-period-end").val((consent.period && consent.period.end) || "");
        });

        $("#cd-party-modal").on("show.bs.modal", function () {
            fillPartyResourceSelect("#cd-party-type", "#cd-party-resource");
        });
        $("#cd-party-type").on("change", function () {
            fillPartyResourceSelect("#cd-party-type", "#cd-party-resource");
        });

        $("#cd-source-modal").on("show.bs.modal", function () {
            const attachment = firstAttachment();
            const verification = firstVerification() || {};
            $("#cd-source-ref").val(firstSourceRef());
            $("#cd-att-title").val(attachment.title || "");
            $("#cd-att-url").val(attachment.url || "");
            $("#cd-policy-url").val((consent.policyBasis && consent.policyBasis.url) || "");
            $("#cd-verified").prop("checked", !!verification.verified);
            CadminApi.bindPatientSelect("#cd-verified-with", {
                placeholder: "None",
                selectedId: refId(verification.verifiedWith),
                selectedLabel: refLabel(verification.verifiedWith)
            });
            CadminApi.bindOrganizationSelect("#cd-verified-by", {
                placeholder: "None",
                selectedId: refId(verification.verifiedBy),
                selectedLabel: refLabel(verification.verifiedBy)
            });
            const verifiedDate = (verification.verificationDate && verification.verificationDate[0]) || "";
            $("#cd-verified-date").val(verifiedDate ? verifiedDate.slice(0, 16) : "");
        });

        $("#cd-provision-modal").on("show.bs.modal", function (event) {
            const trigger = event.relatedTarget;
            if (trigger && trigger.getAttribute("data-bs-target") === "#cd-provision-modal" && !editingPath) {
                populateProvisionModal(null, null);
            }
        });

        $("#cd-pr-actor-type").on("change", function () {
            fillPartyResourceSelect("#cd-pr-actor-type", "#cd-pr-actor-resource");
        });

        $root.on("click.consentdetail", "#cd-pr-rt-add", function () {
            const code = $("#cd-pr-rt").val();
            if (!code) {
                return;
            }
            provisionDraft.resourceType = provisionDraft.resourceType || [];
            if (provisionDraft.resourceType.some(function (item) {
                return ((item.coding && item.coding[0]) || item).code === code;
            })) {
                return;
            }
            provisionDraft.resourceType.push({
                system: "http://hl7.org/fhir/resource-types",
                code: code,
                display: $("#cd-pr-rt option:selected").text()
            });
            renderDraftLists();
        });
        $root.on("click.consentdetail", "[data-remove-rt]", function () {
            const index = Number($(this).attr("data-remove-rt"));
            provisionDraft.resourceType.splice(index, 1);
            renderDraftLists();
        });
        $root.on("click.consentdetail", "#cd-pr-actor-add", function () {
            const ref = selectedPartyRef("#cd-pr-actor-type", "#cd-pr-actor-resource");
            if (!ref) {
                CadminApi.showToast("danger", "Select an actor.");
                return;
            }
            provisionDraft.actor = provisionDraft.actor || [];
            provisionDraft.actor.push({ reference: ref });
            renderDraftLists();
        });
        $root.on("click.consentdetail", "[data-remove-actor]", function () {
            provisionDraft.actor.splice(Number($(this).attr("data-remove-actor")), 1);
            renderDraftLists();
        });
        $root.on("click.consentdetail", "#cd-pr-data-add", function () {
            const reference = $("#cd-pr-data-ref").val().trim();
            if (!reference) {
                CadminApi.showToast("danger", "Enter a resource reference.");
                return;
            }
            provisionDraft.data = provisionDraft.data || [];
            provisionDraft.data.push({
                meaning: $("#cd-pr-data-meaning").val() || "instance",
                reference: { reference: reference }
            });
            $("#cd-pr-data-ref").val("");
            renderDraftLists();
        });
        $root.on("click.consentdetail", "[data-remove-data]", function () {
            provisionDraft.data.splice(Number($(this).attr("data-remove-data")), 1);
            renderDraftLists();
        });

        $root.on("click.consentdetail", "[data-edit-provision]", function () {
            populateProvisionModal($(this).attr("data-edit-provision"), null);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("cd-provision-modal")).show();
        });
        $root.on("click.consentdetail", "[data-add-nested]", function () {
            const parent = $(this).attr("data-add-nested");
            populateProvisionModal(null, parent);
            editingPath = "nested:" + parent;
            bootstrap.Modal.getOrCreateInstance(document.getElementById("cd-provision-modal")).show();
        });
        $root.on("click.consentdetail", "[data-remove-provision]", function () {
            const parts = String($(this).attr("data-remove-provision")).split(".").map(Number);
            if (parts.length === 1) {
                consent.provision.splice(parts[0], 1);
                if (!consent.provision.length) {
                    delete consent.provision;
                }
            } else {
                const parent = consent.provision[parts[0]];
                parent.provision.splice(parts[1], 1);
                if (!parent.provision.length) {
                    delete parent.provision;
                }
            }
            saveConsent(function () {
                CadminApi.showToast("success", "Provision removed.");
            });
        });
        $root.on("click.consentdetail", "[data-remove-party]", function () {
            const fieldName = $(this).attr("data-remove-party");
            const index = Number($(this).attr("data-index"));
            consent[fieldName].splice(index, 1);
            if (!consent[fieldName].length) {
                delete consent[fieldName];
            }
            saveConsent(function () {
                CadminApi.showToast("success", "Party removed.");
            });
        });

        $("#cd-basic-form").on("submit", function (event) {
            event.preventDefault();
            const category = codingFromCode($("#cd-category").val(), categoryOptions,
                "http://terminology.hl7.org/CodeSystem/consentcategorycodes");
            if (category && category.code) {
                consent.category = [{ coding: [category] }];
            } else {
                delete consent.category;
            }
            const decision = $("#cd-decision").val();
            if (decision) { consent.decision = decision; } else { delete consent.decision; }
            const date = $("#cd-date").val();
            if (date) { consent.date = date; } else { delete consent.date; }
            const start = $("#cd-period-start").val();
            const end = $("#cd-period-end").val();
            if (start || end) {
                consent.period = {};
                if (start) { consent.period.start = start; }
                if (end) { consent.period.end = end; }
            } else {
                delete consent.period;
            }
            saveConsent(function () {
                hideModal("cd-basic-modal");
                CadminApi.showToast("success", "Consent updated.");
            });
        });

        $("#cd-party-form").on("submit", function (event) {
            event.preventDefault();
            const ref = selectedPartyRef("#cd-party-type", "#cd-party-resource");
            if (!ref) {
                CadminApi.showToast("danger", "Select a party.");
                return;
            }
            const role = $("#cd-party-role").val();
            consent[role] = consent[role] || [];
            consent[role].push(ref);
            saveConsent(function () {
                hideModal("cd-party-modal");
                CadminApi.showToast("success", "Party added.");
            });
        });

        $("#cd-source-form").on("submit", function (event) {
            event.preventDefault();
            const sourceRef = $("#cd-source-ref").val().trim();
            if (sourceRef) {
                consent.sourceReference = [{ reference: sourceRef }];
            } else {
                delete consent.sourceReference;
            }
            const title = $("#cd-att-title").val().trim();
            const url = $("#cd-att-url").val().trim();
            if (title || url) {
                const attachment = {};
                if (title) { attachment.title = title; }
                if (url) { attachment.url = url; }
                consent.sourceAttachment = [attachment];
            } else {
                delete consent.sourceAttachment;
            }
            const policyUrl = $("#cd-policy-url").val().trim();
            if (policyUrl) {
                consent.policyBasis = { url: policyUrl };
            } else {
                delete consent.policyBasis;
            }
            const verified = $("#cd-verified").is(":checked");
            const verifiedWith = CadminApi.selectValue("#cd-verified-with");
            const verifiedBy = CadminApi.selectValue("#cd-verified-by");
            const verifiedDate = $("#cd-verified-date").val();
            if (verified || verifiedWith || verifiedBy || verifiedDate) {
                const verification = { verified: verified };
                if (verifiedWith) {
                    verification.verifiedWith = {
                        reference: "Patient/" + verifiedWith,
                        display: CadminApi.selectLabel("#cd-verified-with")
                    };
                }
                if (verifiedBy) {
                    verification.verifiedBy = {
                        reference: "Organization/" + verifiedBy,
                        display: CadminApi.selectLabel("#cd-verified-by")
                    };
                }
                if (verifiedDate) {
                    verification.verificationDate = [new Date(verifiedDate).toISOString()];
                }
                consent.verification = [verification];
            } else {
                delete consent.verification;
            }
            saveConsent(function () {
                hideModal("cd-source-modal");
                CadminApi.showToast("success", "Source updated.");
            });
        });

        $("#cd-provision-form").on("submit", function (event) {
            event.preventDefault();
            const start = $("#cd-pr-start").val();
            const end = $("#cd-pr-end").val();
            if (start || end) {
                provisionDraft.period = {};
                if (start) { provisionDraft.period.start = start; }
                if (end) { provisionDraft.period.end = end; }
            } else {
                delete provisionDraft.period;
            }
            provisionDraft.action = selectedChecks("cd-pr-action").map(function (code) {
                return { coding: [codingFromCode(code, actionOptions,
                    "http://terminology.hl7.org/CodeSystem/consentaction")] };
            });
            const purposes = $("#cd-pr-purpose").val() || [];
            provisionDraft.purpose = purposes.map(function (code) {
                return codingFromCode(code, purposeOptions, "http://terminology.hl7.org/CodeSystem/v3-ActReason");
            });
            const compact = compactProvision(provisionDraft);
            if (editingPath && String(editingPath).indexOf("nested:") === 0) {
                const parentIndex = Number(editingPath.replace("nested:", ""));
                consent.provision = consent.provision || [];
                const parent = consent.provision[parentIndex];
                parent.provision = parent.provision || [];
                parent.provision.push(compact);
            } else if (editingPath != null && provisionAt(editingPath)) {
                const parts = String(editingPath).split(".").map(Number);
                if (parts.length === 1) {
                    compact.provision = (consent.provision[parts[0]].provision || []).slice();
                    consent.provision[parts[0]] = compact;
                    if (!compact.provision.length) {
                        delete compact.provision;
                    }
                } else {
                    consent.provision[parts[0]].provision[parts[1]] = compact;
                }
            } else {
                consent.provision = consent.provision || [];
                consent.provision.push(compact);
            }
            editingPath = null;
            saveConsent(function () {
                hideModal("cd-provision-modal");
                CadminApi.showToast("success", "Provision saved.");
            });
        });

        $("#cd-provision-modal").on("hidden.bs.modal", function () {
            editingPath = null;
        });
    }

    return { render: render };
}());
