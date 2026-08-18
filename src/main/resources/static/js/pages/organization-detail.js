window.CadminOrganizationDetail = (function () {
    const typeOptions = [
        { code: "", display: "Unspecified" },
        { code: "prov", display: "Healthcare Provider" },
        { code: "dept", display: "Hospital Department" },
        { code: "team", display: "Organizational team" },
        { code: "govt", display: "Government" },
        { code: "ins", display: "Insurance Company" },
        { code: "pay", display: "Payer" },
        { code: "edu", display: "Educational Institute" },
        { code: "crs", display: "Clinical Research Sponsor" },
        { code: "other", display: "Other" }
    ];
    const contactPurposes = [
        { code: "ADMIN", display: "Administrative" },
        { code: "BILL", display: "Billing" },
        { code: "HR", display: "Human resources" },
        { code: "PAYOR", display: "Payor" },
        { code: "PATINF", display: "Patient" },
        { code: "PRESS", display: "Press" }
    ];
    const affiliationRoles = [
        { code: "provider", display: "Provider" },
        { code: "agency", display: "Agency" },
        { code: "research", display: "Research" },
        { code: "payer", display: "Payer" },
        { code: "diagnostics", display: "Diagnostics" },
        { code: "supplier", display: "Supplier" },
        { code: "HIE/HIO", display: "HIE/HIO" },
        { code: "member", display: "Member" }
    ];
    const connectionTypes = [
        { code: "hl7-fhir-rest", display: "HL7 FHIR REST" },
        { code: "hl7-fhir-msg", display: "HL7 FHIR Messaging" },
        { code: "hl7v2-mllp", display: "HL7 v2 MLLP" },
        { code: "direct-project", display: "Direct Project" },
        { code: "secure-email", display: "Secure email" },
        { code: "ihe-xds", display: "IHE XDS" }
    ];
    const practitionerRoles = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" },
        { code: "teacher", display: "Teacher" },
        { code: "ict", display: "ICT professional" }
    ];

    let org = null;
    let editingRole = null;
    let rolesById = {};

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function bundleResources(bundle) {
        return (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
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
        return ref.display || (ref.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        return CadminApi.referenceId(ref);
    }

    function personName(resource) {
        const name = (resource && resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function formatAddress(address) {
        if (!address) {
            return "—";
        }
        return [(address.line || []).join(", "), address.city, address.state, address.postalCode, address.country]
            .filter(Boolean).join(", ") || "—";
    }

    function formatTelecom(list) {
        return (list || []).map(function (item) {
            return [item.system, item.value].filter(Boolean).join(": ");
        }).filter(Boolean).join(" · ") || "—";
    }

    function contactNameList(contact) {
        if (!contact || !contact.name) {
            return [];
        }
        return Array.isArray(contact.name) ? contact.name : [contact.name];
    }

    function contactNameLabel(contact) {
        const names = contactNameList(contact);
        return names.length ? personName({ name: names }) : "—";
    }

    function orgTelecomList() {
        const list = [];
        (org.contact || []).forEach(function (contact) {
            (contact.telecom || []).forEach(function (item) {
                list.push(item);
            });
        });
        return list;
    }

    function orgAddress() {
        const contact = (org.contact || []).find(function (item) { return item.address; });
        return contact ? contact.address : null;
    }

    function directoryContact() {
        org.contact = org.contact || [];
        let found = org.contact.find(function (contact) {
            return !contact.purpose && !contactNameList(contact).length;
        });
        if (!found) {
            found = {};
            org.contact.unshift(found);
        }
        return found;
    }

    function pruneContacts() {
        org.contact = (org.contact || []).filter(function (contact) {
            return (contact.telecom && contact.telecom.length) || contact.address
                || contact.purpose || contactNameList(contact).length;
        });
        if (!org.contact.length) {
            delete org.contact;
        }
    }

    function statusBadge(active) {
        return active
            ? '<span class="badge text-bg-success">Active</span>'
            : '<span class="badge text-bg-secondary">Inactive</span>';
    }

    function codeStatusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "error" ? "danger"
                : status === "limited" || status === "suspended" ? "warning"
                    : "secondary";
        return '<span class="badge text-bg-' + kind + '">' + esc(status || "—") + "</span>";
    }

    function emptyRow(cols, text) {
        return '<tr><td colspan="' + cols + '" class="text-muted">' + text + "</td></tr>";
    }

    function optionsHtml(items, valueKey, labelKey) {
        return items.map(function (item) {
            return '<option value="' + esc(item[valueKey]) + '">' + esc(item[labelKey]) + "</option>";
        }).join("");
    }

    function hideModal(id) {
        const el = document.getElementById(id);
        const instance = el ? bootstrap.Modal.getInstance(el) : null;
        if (instance) {
            instance.hide();
        }
    }

    function showModal(id) {
        const el = document.getElementById(id);
        if (!el) {
            return;
        }
        bootstrap.Modal.getOrCreateInstance(el).show();
    }

    function alertMsg(type, message) {
        CadminApi.showToast(type, message);
    }

    function fail(action, xhr) {
        alertMsg("danger", action + " failed (" + xhr.status + ").");
    }

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
    }

    function fillSelect(selector, path, labelFn, excludeId, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle)
                .filter(function (resource) { return resource.id !== excludeId; })
                .map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
            if (selectedId && $select.find('option[value="' + selectedId + '"]').length) {
                $select.val(selectedId);
            }
        });
    }

    function card(title, tableId, cols, addTarget, addLabel, extraHeader) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                '<div class="d-flex gap-2">' +
                    (extraHeader || "") +
                    '<button class="btn btn-sm btn-primary" type="button" data-bs-toggle="modal" data-bs-target="' + addTarget + '">' +
                        '<i class="bi bi-plus-lg me-1"></i>' + addLabel + "</button>" +
                "</div>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle mb-0">' +
                        "<thead><tr>" + cols.map(function (col) { return "<th>" + col + "</th>"; }).join("") + "</tr></thead>" +
                        '<tbody id="' + tableId + '">' + emptyRow(cols.length, "Loading…") + "</tbody>" +
                    "</table>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function editCard(title, bodyId, editTarget) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="' + editTarget + '">Edit</button>' +
            "</div>" +
            '<div class="card-body" id="' + bodyId + '"></div>' +
        "</div>";
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

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function render(resource) {
        org = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/organizations"><i class="bi bi-arrow-left me-1"></i>Organizations</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(org.name || "Organization") + "</h1>" +
                "</div>" +
                '<a class="btn btn-outline-primary" href="#/resources/Organization/' + encodeURIComponent(org.id) + '">' +
                    '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
            "</div>" +
            editCard("Basic details", "org-basic-details", "#od-basic-modal") +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Sub-organizations", "org-child-rows",
                    ["Name", "Type", "Status", ""], "#od-child-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Locations", "org-location-rows",
                    ["Name", "Status", "Address", ""], "#od-location-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Organization affiliations", "org-affil-rows",
                    ["Organization", "Role", "Status", ""], "#od-affil-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Endpoints", "org-endpoint-rows",
                    ["Name", "Type", "Address", "Status", ""], "#od-endpoint-modal", "Add",
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#od-ep-attach-modal">Attach</button>') + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Contacts", "org-contact-rows",
                    ["Purpose", "Name", "Telecom", ""], "#od-contact-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Practitioners", "org-role-rows",
                    ["Practitioner", "Role", "Status", ""], "#od-role-modal", "Add") + "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("od-basic-modal", "Edit basic details",
                field("Name", '<input class="form-control" id="od-name" required>') +
                '<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="od-active">' +
                    '<label class="form-check-label" for="od-active">Active</label></div>' +
                field("Type", '<select class="form-select" id="od-type">' + optionsHtml(typeOptions, "code", "display") + "</select>") +
                field("Part of", '<select class="form-select" id="od-part-of"><option value="">None</option></select>') +
                field("Alias", '<input class="form-control" id="od-alias" placeholder="Comma-separated">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Identifier system</label>' +
                    '<input class="form-control" id="od-id-system"></div>' +
                    '<div class="col-md-6 mb-3"><label class="form-label">Identifier value</label>' +
                    '<input class="form-control" id="od-id-value"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Phone</label>' +
                    '<input class="form-control" id="od-phone"></div>' +
                    '<div class="col-md-6 mb-3"><label class="form-label">Email</label>' +
                    '<input class="form-control" id="od-email" type="email"></div></div>' +
                field("Street", '<input class="form-control" id="od-line">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label><input class="form-control" id="od-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label><input class="form-control" id="od-state"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Postal code</label><input class="form-control" id="od-postal"></div>' +
                '<div class="col-md-6 mb-0"><label class="form-label">Country</label><input class="form-control" id="od-country"></div></div>',
                "od-basic-form") +
            modal("od-child-modal", "Add sub-organization",
                field("Name", '<input class="form-control" id="od-child-name" required>') +
                field("Type", '<select class="form-select" id="od-child-type">' + optionsHtml(typeOptions, "code", "display") + "</select>"),
                "od-child-form") +
            modal("od-location-modal", "Add location",
                field("Name", '<input class="form-control" id="od-loc-name" required>') +
                field("Status", '<select class="form-select" id="od-loc-status"><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select>') +
                field("Address", '<input class="form-control" id="od-loc-line" placeholder="Street">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label><input class="form-control" id="od-loc-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label><input class="form-control" id="od-loc-state"></div></div>',
                "od-location-form") +
            modal("od-affil-modal", "Add organization affiliation",
                field("Participating organization", '<select class="form-select" id="od-affil-org" required><option value="">Select…</option></select>') +
                field("Role", '<select class="form-select" id="od-affil-role">' + optionsHtml(affiliationRoles, "code", "display") + "</select>"),
                "od-affil-form") +
            modal("od-endpoint-modal", "Add endpoint",
                field("Name", '<input class="form-control" id="od-ep-name" required>') +
                field("Connection type", '<select class="form-select" id="od-ep-type">' + optionsHtml(connectionTypes, "code", "display") + "</select>") +
                field("Address", '<input class="form-control" id="od-ep-address" required placeholder="https://example.org/fhir">') +
                field("Status", '<select class="form-select" id="od-ep-status">' +
                    '<option value="active">Active</option><option value="limited">Limited</option>' +
                    '<option value="suspended">Suspended</option><option value="error">Error</option>' +
                    '<option value="off">Off</option><option value="entered-in-error">Entered in error</option></select>'),
                "od-endpoint-form") +
            modal("od-ep-attach-modal", "Attach endpoint",
                field("Endpoint", '<select class="form-select" id="od-ep-attach" required><option value="">Select…</option></select>'),
                "od-ep-attach-form") +
            modal("od-contact-modal", "Add contact",
                field("Purpose", '<select class="form-select" id="od-ct-purpose">' + optionsHtml(contactPurposes, "code", "display") + "</select>") +
                field("Name", '<input class="form-control" id="od-ct-name" required>') +
                field("Phone", '<input class="form-control" id="od-ct-phone">') +
                field("Email", '<input class="form-control" id="od-ct-email" type="email">'),
                "od-contact-form") +
            modal("od-role-modal", "Add practitioner role",
                field("Practitioner", '<select class="form-select" id="od-pr-practitioner"><option value="">Select existing…</option></select>') +
                '<p class="text-muted small">Or create a new practitioner</p>' +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Family name</label><input class="form-control" id="od-pr-family"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">Given name</label><input class="form-control" id="od-pr-given"></div></div>' +
                field("Role", '<select class="form-select" id="od-pr-role">' + optionsHtml(practitionerRoles, "code", "display") + "</select>"),
                "od-role-form") +
            modal("od-role-edit-modal", "Edit practitioner role",
                field("Practitioner", '<input class="form-control" id="od-pr-edit-name" readonly>') +
                field("Location", '<select class="form-select" id="od-pr-edit-loc"><option value="">None</option></select>') +
                field("Role", '<select class="form-select" id="od-pr-edit-role">' + optionsHtml(practitionerRoles, "code", "display") + "</select>") +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="od-pr-edit-active">' +
                    '<label class="form-check-label" for="od-pr-edit-active">Active</label></div>',
                "od-role-edit-form")
        );
        CadminResourceGraph.mount(org);
        renderBasics();
        loadChildren();
        loadLocations();
        loadAffiliations();
        loadEndpoints();
        renderContacts();
        loadRoles();
        bindForms();

        $("#od-basic-modal").on("show.bs.modal", function () {
            populateBasicForm();
            CadminApi.bindOrganizationSelect("#od-part-of", {
                placeholder: "None",
                excludeId: org.id,
                selectedId: refId(org.partOf),
                selectedLabel: refLabel(org.partOf)
            });
        });
        $("#od-affil-modal").on("show.bs.modal", function () {
            CadminApi.bindOrganizationSelect("#od-affil-org", {
                placeholder: "None",
                excludeId: org.id
            });
        });
        $("#od-role-modal").on("show.bs.modal", function () {
            CadminApi.bindPractitionerSelect("#od-pr-practitioner", { placeholder: "Select…" });
        });
        $("#od-ep-attach-modal").on("show.bs.modal", fillEndpointAttach);
        $("#od-role-edit-modal").on("show.bs.modal", populateRoleEditForm);
        $("#od-role-edit-modal").on("hidden.bs.modal", function () {
            editingRole = null;
        });
    }

    function renderBasics() {
        const type = conceptLabel(org.type);
        const aliases = (org.alias || []).join(", ") || "—";
        const partOf = org.partOf
            ? (refId(org.partOf)
                ? '<a href="#/organizations/' + encodeURIComponent(refId(org.partOf)) + '">' + esc(refLabel(org.partOf)) + "</a>"
                : esc(refLabel(org.partOf)))
            : "—";
        const identifiers = (org.identifier || []).map(function (id) {
            return (id.system ? id.system + " / " : "") + (id.value || "");
        }).filter(Boolean).join(", ") || "—";
        $("#org-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Name</dt><dd class="col-sm-9">' + esc(org.name || "—") + "</dd>" +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(org.active !== false) + "</dd>" +
                '<dt class="col-sm-3">Type</dt><dd class="col-sm-9">' + esc(type) + "</dd>" +
                '<dt class="col-sm-3">Part of</dt><dd class="col-sm-9">' + partOf + "</dd>" +
                '<dt class="col-sm-3">Alias</dt><dd class="col-sm-9">' + esc(aliases) + "</dd>" +
                '<dt class="col-sm-3">Identifier</dt><dd class="col-sm-9">' + esc(identifiers) + "</dd>" +
                '<dt class="col-sm-3">Telecom</dt><dd class="col-sm-9">' + esc(formatTelecom(orgTelecomList())) + "</dd>" +
                '<dt class="col-sm-3">Address</dt><dd class="col-sm-9">' + esc(formatAddress(orgAddress())) + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(org.id) + "</code></dd>" +
            "</dl>"
        );
        $(".page-title").first().text(org.name || "Organization");
    }

    function loadChildren() {
        CadminApi.fhir("/Organization?partof=" + encodeURIComponent(org.id) + "&_count=50&_sort=name").done(function (bundle) {
            const rows = bundleResources(bundle);
            if (!rows.length) {
                $("#org-child-rows").html(emptyRow(4, "No sub-organizations."));
                return;
            }
            $("#org-child-rows").html(rows.map(function (child) {
                return "<tr>" +
                    '<td><a href="#/organizations/' + encodeURIComponent(child.id) + '">' + esc(child.name || child.id) + "</a></td>" +
                    "<td>" + esc(conceptLabel(child.type)) + "</td>" +
                    "<td>" + statusBadge(child.active !== false) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-secondary" type="button" data-unlink-org="' +
                        esc(child.id) + '">Unlink</button></td>' +
                    "</tr>";
            }).join(""));
        }).fail(function (xhr) {
            $("#org-child-rows").html(emptyRow(4, "Unable to load sub-organizations."));
            fail("Load sub-organizations", xhr);
        });
    }

    function loadLocations() {
        CadminApi.fhir("/Location?organization=" + encodeURIComponent(org.id) + "&_count=50&_sort=name").done(function (bundle) {
            const rows = bundleResources(bundle);
            if (!rows.length) {
                $("#org-location-rows").html(emptyRow(4, "No locations."));
                return;
            }
            $("#org-location-rows").html(rows.map(function (loc) {
                return "<tr>" +
                    '<td><a href="#/locations/' + encodeURIComponent(loc.id) + '">' + esc(loc.name || loc.id) + "</a></td>" +
                    "<td>" + codeStatusBadge(loc.status) + "</td>" +
                    "<td>" + esc(formatAddress(loc.address)) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete="/Location/' +
                        encodeURIComponent(loc.id) + '" data-reload="locations" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                    "</tr>";
            }).join(""));
        }).fail(function (xhr) {
            $("#org-location-rows").html(emptyRow(4, "Unable to load locations."));
            fail("Load locations", xhr);
        });
    }

    function mergeAffiliations(primary, participating) {
        const byId = {};
        bundleResources(primary).concat(bundleResources(participating)).forEach(function (item) {
            if (item && item.id) {
                byId[item.id] = item;
            }
        });
        return Object.keys(byId).map(function (id) { return byId[id]; });
    }

    function loadAffiliations() {
        const id = encodeURIComponent(org.id);
        $.when(
            CadminApi.fhir("/OrganizationAffiliation?primary-organization=" + id + "&_count=50"),
            CadminApi.fhir("/OrganizationAffiliation?participating-organization=" + id + "&_count=50")
        ).done(function (primaryRes, participatingRes) {
            const rows = mergeAffiliations(primaryRes[0], participatingRes[0]);
            if (!rows.length) {
                $("#org-affil-rows").html(emptyRow(4, "No affiliations."));
                return;
            }
            $("#org-affil-rows").html(rows.map(function (affil) {
                const other = refId(affil.organization) === org.id ? affil.participatingOrganization : affil.organization;
                return "<tr>" +
                    "<td>" + esc(refLabel(other)) + "</td>" +
                    "<td>" + esc(conceptLabel(affil.code)) + "</td>" +
                    "<td>" + statusBadge(affil.active !== false) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete="/OrganizationAffiliation/' +
                        encodeURIComponent(affil.id) + '" data-reload="affiliations" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                    "</tr>";
            }).join(""));
        }).fail(function (xhr) {
            $("#org-affil-rows").html(emptyRow(4, "Unable to load affiliations."));
            fail("Load affiliations", xhr);
        });
    }

    function endpointRow(ep, linked) {
        return "<tr>" +
            '<td><a href="#/endpoints/' + encodeURIComponent(ep.id) + '">' + esc(ep.name || ep.id) + "</a></td>" +
            "<td>" + esc(conceptLabel(ep.connectionType)) + "</td>" +
            "<td><code>" + esc(ep.address || "—") + "</code></td>" +
            "<td>" + codeStatusBadge(ep.status) + "</td>" +
            '<td class="text-end">' + (linked
                ? '<button class="btn btn-sm btn-outline-secondary" type="button" data-unlink-endpoint="' +
                    esc(ep.id) + '" title="Unlink" aria-label="Unlink"><i class="bi bi-x-lg"></i></button>'
                : "") + "</td>" +
            "</tr>";
    }

    function fillEndpointAttach() {
        const linked = (org.endpoint || []).map(refId).filter(Boolean);
        CadminApi.fhir("/Endpoint?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">Select…</option>'].concat(bundleResources(bundle)
                .filter(function (ep) { return linked.indexOf(ep.id) === -1; })
                .map(function (ep) {
                    const label = (ep.name || ep.id) + (ep.address ? " · " + ep.address : "");
                    return '<option value="' + esc(ep.id) + '">' + esc(label) + "</option>";
                }));
            $("#od-ep-attach").html(options.join(""));
        });
    }

    function loadEndpoints() {
        const refIds = (org.endpoint || []).map(refId).filter(Boolean);
        CadminApi.fhir("/Endpoint?organization=" + encodeURIComponent(org.id) + "&_count=50&_sort=name").done(function (bundle) {
            const byId = {};
            bundleResources(bundle).forEach(function (ep) {
                byId[ep.id] = ep;
            });
            const missing = refIds.filter(function (id) { return !byId[id]; });

            function renderRows() {
                const rows = Object.keys(byId).map(function (id) { return byId[id]; });
                if (!rows.length) {
                    $("#org-endpoint-rows").html(emptyRow(5, "No endpoints."));
                    return;
                }
                $("#org-endpoint-rows").html(rows.map(function (ep) {
                    return endpointRow(ep, refIds.indexOf(ep.id) !== -1);
                }).join(""));
            }

            if (!missing.length) {
                renderRows();
                return;
            }
            CadminApi.fhir("/Endpoint?_id=" + missing.map(encodeURIComponent).join(",") + "&_count=50").done(function (extra) {
                bundleResources(extra).forEach(function (ep) {
                    byId[ep.id] = ep;
                });
                renderRows();
            }).fail(function () {
                renderRows();
            });
        }).fail(function (xhr) {
            $("#org-endpoint-rows").html(emptyRow(5, "Unable to load endpoints."));
            fail("Load endpoints", xhr);
        });
    }

    function renderContacts() {
        const contacts = org.contact || [];
        if (!contacts.length) {
            $("#org-contact-rows").html(emptyRow(4, "No contacts."));
            return;
        }
        $("#org-contact-rows").html(contacts.map(function (contact, index) {
            return "<tr>" +
                "<td>" + esc(conceptLabel(contact.purpose)) + "</td>" +
                "<td>" + esc(contactNameLabel(contact)) + "</td>" +
                "<td>" + esc(formatTelecom(contact.telecom)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-contact="' +
                    index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                "</tr>";
        }).join(""));
    }

    function roleCoding(option) {
        if (!option || !option.code) {
            return undefined;
        }
        return [{
            coding: [{
                system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
                code: option.code,
                display: option.display
            }]
        }];
    }

    function ensureRoleOption(selector, code, label) {
        const $select = $(selector);
        if (code && !$select.find('option[value="' + code + '"]').length) {
            $select.append('<option value="' + esc(code) + '">' + esc(label || code) + "</option>");
        }
        if (code) {
            $select.val(code);
        }
    }

    function populateRoleEditForm() {
        const role = editingRole;
        if (!role) {
            return;
        }
        $("#od-pr-edit-name").val(refLabel(role.practitioner) || "—");
        const locId = refId((role.location || [])[0]);
        const locLabel = refLabel((role.location || [])[0]);
        const $loc = $("#od-pr-edit-loc");
        CadminApi.fhir("/Location?organization=" + encodeURIComponent(org.id) +
            "&_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle).map(function (resource) {
                return '<option value="' + esc(resource.id) + '">' + esc(resource.name || resource.id) + "</option>";
            }));
            $loc.html(options.join(""));
            if (locId && !$loc.find('option[value="' + locId + '"]').length) {
                $loc.append('<option value="' + esc(locId) + '">' + esc(locLabel || locId) + "</option>");
            }
            if (locId) {
                $loc.val(locId);
            }
        });
        const code = currentCode(role.code);
        ensureRoleOption("#od-pr-edit-role", code || practitionerRoles[0].code,
            role.code ? conceptLabel(role.code) : "");
        $("#od-pr-edit-active").prop("checked", role.active !== false);
    }

    function openRoleEditor(role) {
        editingRole = role;
        showModal("od-role-edit-modal");
    }

    function applyRoleEditFields(resource, locationId, roleOption, active) {
        resource.active = active;
        resource.organization = {
            reference: "Organization/" + org.id,
            display: org.name
        };
        if (locationId) {
            resource.location = [{
                reference: "Location/" + locationId,
                display: $("#od-pr-edit-loc option:selected").text()
            }];
        } else {
            delete resource.location;
        }
        const coding = roleCoding(roleOption);
        if (coding) {
            resource.code = coding;
        } else if (!roleOption) {
            delete resource.code;
        }
        return resource;
    }

    function loadRoles() {
        CadminApi.fhir("/PractitionerRole?organization=" + encodeURIComponent(org.id) +
            "&_include=PractitionerRole:practitioner&_include=PractitionerRole:location&_count=50")
            .done(function (bundle) {
            const practitioners = {};
            const roles = [];
            rolesById = {};
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Practitioner") {
                    practitioners[resource.id] = resource;
                } else if (resource.resourceType === "PractitionerRole") {
                    roles.push(resource);
                    rolesById[resource.id] = resource;
                }
            });
            roles.forEach(function (role) {
                const included = practitioners[refId(role.practitioner)];
                if (included) {
                    role.practitioner = role.practitioner || {};
                    role.practitioner.display = personName(included);
                }
            });
            if (!roles.length) {
                $("#org-role-rows").html(emptyRow(4, "No practitioners with roles."));
                return;
            }
            $("#org-role-rows").html(roles.map(function (role) {
                const prId = refId(role.practitioner);
                const practitioner = practitioners[prId] || {};
                const name = personName(practitioner) !== "Unnamed" ? personName(practitioner) : refLabel(role.practitioner);
                const nameHtml = prId
                    ? '<a href="#/practitioners/' + encodeURIComponent(prId) + '">' + esc(name) + "</a>"
                    : esc(name);
                return "<tr>" +
                    "<td>" + nameHtml + "</td>" +
                    "<td>" + esc(conceptLabel(role.code)) + "</td>" +
                    "<td>" + statusBadge(role.active !== false) + "</td>" +
                    '<td class="text-end">' +
                    '<button class="btn btn-sm btn-outline-primary me-1" type="button" data-edit-role="' +
                        esc(role.id) + '" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>' +
                    '<button class="btn btn-sm btn-outline-danger" type="button" data-delete="/PractitionerRole/' +
                        encodeURIComponent(role.id) + '" data-reload="roles" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                    "</tr>";
            }).join(""));
        }).fail(function (xhr) {
            $("#org-role-rows").html(emptyRow(4, "Unable to load practitioners."));
            fail("Load practitioners", xhr);
        });
    }

    function reload(which) {
        if (which === "locations") {
            loadLocations();
        } else if (which === "affiliations") {
            loadAffiliations();
        } else if (which === "endpoints") {
            loadEndpoints();
        } else if (which === "roles") {
            loadRoles();
        }
    }

    function saveOrg(next) {
        delete org.telecom;
        delete org.address;
        CadminApi.fhir("/Organization/" + encodeURIComponent(org.id), "PUT", org).done(function (updated) {
            org = updated || org;
            renderBasics();
            renderContacts();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update organization", xhr);
        });
    }

    function typeByCode(code) {
        return typeOptions.find(function (option) { return option.code === code; });
    }

    function telecomValue(system) {
        const item = orgTelecomList().find(function (entry) { return entry.system === system; });
        return item && item.value ? item.value : "";
    }

    function setTelecom(system, value) {
        const contact = directoryContact();
        contact.telecom = (contact.telecom || []).filter(function (entry) { return entry.system !== system; });
        if (value) {
            contact.telecom.push({ system: system, value: value });
        }
        pruneContacts();
    }

    function populateBasicForm() {
        const identifier = (org.identifier && org.identifier[0]) || {};
        const address = orgAddress() || {};
        const typeCode = currentCode(org.type);
        $("#od-name").val(org.name || "");
        $("#od-active").prop("checked", org.active !== false);
        if (typeCode && !$("#od-type option[value='" + typeCode + "']").length) {
            $("#od-type").append('<option value="' + esc(typeCode) + '">' + esc(conceptLabel(org.type)) + "</option>");
        }
        $("#od-type").val(typeCode);
        $("#od-alias").val((org.alias || []).join(", "));
        $("#od-id-system").val(identifier.system || "");
        $("#od-id-value").val(identifier.value || "");
        $("#od-phone").val(telecomValue("phone"));
        $("#od-email").val(telecomValue("email"));
        $("#od-line").val((address.line || [])[0] || "");
        $("#od-city").val(address.city || "");
        $("#od-state").val(address.state || "");
        $("#od-postal").val(address.postalCode || "");
        $("#od-country").val(address.country || "");
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".orgdetail");

        $root.on("click.orgdetail", "[data-edit-role]", function () {
            const id = $(this).attr("data-edit-role");
            const role = rolesById[id];
            if (role) {
                openRoleEditor(role);
                return;
            }
            CadminApi.fhir("/PractitionerRole/" + encodeURIComponent(id)).done(function (resource) {
                openRoleEditor(resource);
            }).fail(function (xhr) {
                fail("Load role", xhr);
            });
        });

        $root.on("click.orgdetail", "[data-delete]", function () {
            const path = $(this).attr("data-delete");
            const which = $(this).attr("data-reload");
            CadminApi.fhir(path, "DELETE").done(function () {
                alertMsg("success", "Removed.");
                reload(which);
            }).fail(function (xhr) {
                fail("Remove", xhr);
            });
        });

        $root.on("click.orgdetail", "[data-unlink-endpoint]", function () {
            const id = $(this).attr("data-unlink-endpoint");
            org.endpoint = (org.endpoint || []).filter(function (ref) {
                return refId(ref) !== id;
            });
            if (!org.endpoint.length) {
                delete org.endpoint;
            }
            saveOrg(function () {
                alertMsg("success", "Endpoint unlinked.");
                loadEndpoints();
            });
        });

        $root.on("click.orgdetail", "[data-unlink-org]", function () {
            const id = $(this).attr("data-unlink-org");
            CadminApi.fhir("/Organization/" + encodeURIComponent(id)).done(function (child) {
                delete child.partOf;
                CadminApi.fhir("/Organization/" + encodeURIComponent(id), "PUT", child).done(function () {
                    alertMsg("success", "Sub-organization unlinked.");
                    loadChildren();
                }).fail(function (xhr) {
                    fail("Unlink", xhr);
                });
            }).fail(function (xhr) {
                fail("Unlink", xhr);
            });
        });

        $root.on("click.orgdetail", "[data-remove-contact]", function () {
            const index = Number($(this).attr("data-remove-contact"));
            org.contact = (org.contact || []).filter(function (_item, i) { return i !== index; });
            saveOrg(function () {
                alertMsg("success", "Contact removed.");
            });
        });

        $("#od-basic-form").on("submit", function (event) {
            event.preventDefault();
            org.name = $("#od-name").val().trim();
            org.active = $("#od-active").is(":checked");
            const selected = typeByCode($("#od-type").val());
            if (selected && selected.code) {
                org.type = [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/organization-type",
                        code: selected.code,
                        display: selected.display
                    }],
                    text: selected.display
                }];
            } else if (!$("#od-type").val()) {
                delete org.type;
            }
            const partOfId = CadminApi.selectValue("#od-part-of");
            if (partOfId) {
                org.partOf = {
                    reference: "Organization/" + partOfId,
                    display: CadminApi.selectLabel("#od-part-of")
                };
            } else {
                delete org.partOf;
            }
            const aliases = $("#od-alias").val().split(",").map(function (item) {
                return item.trim();
            }).filter(Boolean);
            if (aliases.length) {
                org.alias = aliases;
            } else {
                delete org.alias;
            }
            const idSystem = $("#od-id-system").val().trim();
            const idValue = $("#od-id-value").val().trim();
            if (idValue) {
                const identifier = { value: idValue };
                if (idSystem) {
                    identifier.system = idSystem;
                }
                org.identifier = [identifier].concat((org.identifier || []).slice(1));
            } else if (idSystem) {
                alertMsg("danger", "Enter an identifier value.");
                return;
            } else if (org.identifier && org.identifier.length) {
                org.identifier = org.identifier.slice(1);
                if (!org.identifier.length) {
                    delete org.identifier;
                }
            }
            setTelecom("phone", $("#od-phone").val().trim());
            setTelecom("email", $("#od-email").val().trim());
            const address = {};
            const line = $("#od-line").val().trim();
            const city = $("#od-city").val().trim();
            const state = $("#od-state").val().trim();
            const postal = $("#od-postal").val().trim();
            const country = $("#od-country").val().trim();
            if (line) {
                address.line = [line];
            }
            if (city) {
                address.city = city;
            }
            if (state) {
                address.state = state;
            }
            if (postal) {
                address.postalCode = postal;
            }
            if (country) {
                address.country = country;
            }
            if (Object.keys(address).length) {
                directoryContact().address = address;
            } else {
                const existing = (org.contact || []).find(function (item) { return item.address; });
                if (existing) {
                    delete existing.address;
                }
            }
            pruneContacts();
            saveOrg(function () {
                hideModal("od-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#od-child-form").on("submit", function (event) {
            event.preventDefault();
            const selected = typeByCode($("#od-child-type").val());
            const resource = {
                resourceType: "Organization",
                name: $("#od-child-name").val(),
                active: true,
                partOf: { reference: "Organization/" + org.id, display: org.name }
            };
            if (selected && selected.code) {
                resource.type = [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/organization-type",
                        code: selected.code,
                        display: selected.display
                    }]
                }];
            }
            CadminApi.fhir("/Organization", "POST", resource).done(function () {
                hideModal("od-child-modal");
                alertMsg("success", "Sub-organization created.");
                loadChildren();
            }).fail(function (xhr) {
                fail("Create sub-organization", xhr);
            });
        });

        $("#od-location-form").on("submit", function (event) {
            event.preventDefault();
            const resource = {
                resourceType: "Location",
                name: $("#od-loc-name").val(),
                status: $("#od-loc-status").val() || "active",
                managingOrganization: { reference: "Organization/" + org.id, display: org.name }
            };
            const line = $("#od-loc-line").val();
            const city = $("#od-loc-city").val();
            const state = $("#od-loc-state").val();
            if (line || city || state) {
                resource.address = {
                    line: line ? [line] : undefined,
                    city: city || undefined,
                    state: state || undefined
                };
            }
            CadminApi.fhir("/Location", "POST", resource).done(function () {
                hideModal("od-location-modal");
                alertMsg("success", "Location created.");
                loadLocations();
            }).fail(function (xhr) {
                fail("Create location", xhr);
            });
        });

        $("#od-affil-form").on("submit", function (event) {
            event.preventDefault();
            const otherId = CadminApi.selectValue("#od-affil-org");
            if (!otherId) {
                return;
            }
            const role = affiliationRoles.find(function (item) { return item.code === $("#od-affil-role").val(); });
            const resource = {
                resourceType: "OrganizationAffiliation",
                active: true,
                organization: { reference: "Organization/" + org.id, display: org.name },
                participatingOrganization: {
                    reference: "Organization/" + otherId,
                    display: CadminApi.selectLabel("#od-affil-org")
                }
            };
            if (role) {
                resource.code = [{
                    coding: [{
                        system: "http://hl7.org/fhir/organization-role",
                        code: role.code,
                        display: role.display
                    }]
                }];
            }
            CadminApi.fhir("/OrganizationAffiliation", "POST", resource).done(function () {
                hideModal("od-affil-modal");
                alertMsg("success", "Affiliation created.");
                loadAffiliations();
            }).fail(function (xhr) {
                fail("Create affiliation", xhr);
            });
        });

        $("#od-ep-attach-form").on("submit", function (event) {
            event.preventDefault();
            const id = $("#od-ep-attach").val();
            if (!id) {
                return;
            }
            const label = ($("#od-ep-attach option:selected").text() || "").split(" · ")[0];
            org.endpoint = org.endpoint || [];
            org.endpoint.push({
                reference: "Endpoint/" + id,
                display: label
            });
            saveOrg(function () {
                hideModal("od-ep-attach-modal");
                alertMsg("success", "Endpoint attached.");
                loadEndpoints();
            });
        });

        $("#od-endpoint-form").on("submit", function (event) {
            event.preventDefault();
            const conn = connectionTypes.find(function (item) { return item.code === $("#od-ep-type").val(); });
            const resource = {
                resourceType: "Endpoint",
                status: $("#od-ep-status").val() || "active",
                name: $("#od-ep-name").val(),
                address: $("#od-ep-address").val(),
                connectionType: [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                        code: conn ? conn.code : "hl7-fhir-rest",
                        display: conn ? conn.display : "HL7 FHIR REST"
                    }]
                }],
                payload: [{
                    type: [{
                        coding: [{
                            system: "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                            code: "any",
                            display: "Any"
                        }]
                    }]
                }],
                managingOrganization: { reference: "Organization/" + org.id, display: org.name }
            };
            CadminApi.fhir("/Endpoint", "POST", resource).done(function (created) {
                org.endpoint = org.endpoint || [];
                org.endpoint.push({
                    reference: "Endpoint/" + created.id,
                    display: created.name
                });
                saveOrg(function () {
                    hideModal("od-endpoint-modal");
                    alertMsg("success", "Endpoint created.");
                    loadEndpoints();
                });
            }).fail(function (xhr) {
                fail("Create endpoint", xhr);
            });
        });

        $("#od-contact-form").on("submit", function (event) {
            event.preventDefault();
            const purpose = contactPurposes.find(function (item) { return item.code === $("#od-ct-purpose").val(); });
            const contactName = $("#od-ct-name").val().trim();
            const contact = {
                telecom: []
            };
            if (contactName) {
                contact.name = [{ text: contactName }];
            }
            if (purpose) {
                contact.purpose = {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/contactentity-type",
                        code: purpose.code,
                        display: purpose.display
                    }]
                };
            }
            const phone = $("#od-ct-phone").val();
            const email = $("#od-ct-email").val();
            if (phone) {
                contact.telecom.push({ system: "phone", value: phone });
            }
            if (email) {
                contact.telecom.push({ system: "email", value: email });
            }
            org.contact = org.contact || [];
            org.contact.push(contact);
            saveOrg(function () {
                hideModal("od-contact-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#od-role-form").on("submit", function (event) {
            event.preventDefault();
            const existingId = CadminApi.selectValue("#od-pr-practitioner");
            const family = $("#od-pr-family").val();
            const given = $("#od-pr-given").val();
            const role = practitionerRoles.find(function (item) { return item.code === $("#od-pr-role").val(); });

            function createRole(practitionerId, display) {
                const resource = {
                    resourceType: "PractitionerRole",
                    active: true,
                    practitioner: { reference: "Practitioner/" + practitionerId, display: display },
                    organization: { reference: "Organization/" + org.id, display: org.name }
                };
                if (role) {
                    resource.code = [{
                        coding: [{
                            system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
                            code: role.code,
                            display: role.display
                        }]
                    }];
                }
                CadminApi.fhir("/PractitionerRole", "POST", resource).done(function () {
                    hideModal("od-role-modal");
                    alertMsg("success", "Practitioner role created.");
                    loadRoles();
                }).fail(function (xhr) {
                    fail("Create practitioner role", xhr);
                });
            }

            if (existingId) {
                createRole(existingId, CadminApi.selectLabel("#od-pr-practitioner"));
                return;
            }
            if (!family && !given) {
                alertMsg("danger", "Select a practitioner or enter a name.");
                return;
            }
            CadminApi.fhir("/Practitioner", "POST", {
                resourceType: "Practitioner",
                active: true,
                name: [{ family: family, given: given ? [given] : [] }]
            }).done(function (created) {
                createRole(created.id, personName(created));
            }).fail(function (xhr) {
                fail("Create practitioner", xhr);
            });
        });

        $("#od-role-edit-form").on("submit", function (event) {
            event.preventDefault();
            if (!editingRole || !editingRole.id) {
                return;
            }
            const roleOption = practitionerRoles.find(function (item) {
                return item.code === $("#od-pr-edit-role").val();
            }) || ($("#od-pr-edit-role").val()
                ? { code: $("#od-pr-edit-role").val(), display: $("#od-pr-edit-role option:selected").text() }
                : null);
            const resource = applyRoleEditFields($.extend(true, {}, editingRole),
                $("#od-pr-edit-loc").val(), roleOption, $("#od-pr-edit-active").is(":checked"));
            CadminApi.fhir("/PractitionerRole/" + encodeURIComponent(editingRole.id), "PUT", resource)
                .done(function () {
                    hideModal("od-role-edit-modal");
                    alertMsg("success", "Practitioner role updated.");
                    loadRoles();
                }).fail(function (xhr) {
                    fail("Update practitioner role", xhr);
                });
        });
    }

    return { render: render };
}());
