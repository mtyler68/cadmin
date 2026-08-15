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
        const coding = (item.coding && item.coding[0]) || {};
        return item.text || coding.display || coding.code || "—";
    }

    function refLabel(ref) {
        if (!ref) {
            return "—";
        }
        return ref.display || (ref.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        const match = ((ref && ref.reference) || "").match(/\/([^/]+)$/);
        return match ? match[1] : "";
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

    function statusBadge(active) {
        return active
            ? '<span class="badge text-bg-success">Active</span>'
            : '<span class="badge text-bg-secondary">Inactive</span>';
    }

    function codeStatusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "suspended" || status === "error" || status === "off" ? "warning"
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
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function alertMsg(type, message) {
        CadminApi.showAlert("#org-detail-alert", type, message);
    }

    function fail(action, xhr) {
        alertMsg("danger", action + " failed (" + xhr.status + ").");
    }

    function fillSelect(selector, path, labelFn, excludeId) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle)
                .filter(function (resource) { return resource.id !== excludeId; })
                .map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function card(title, tableId, cols, addTarget, addLabel) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                '<button class="btn btn-sm btn-primary" type="button" data-bs-toggle="modal" data-bs-target="' + addTarget + '">' +
                    '<i class="bi bi-plus-lg me-1"></i>' + addLabel + "</button>" +
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
            '<div id="org-detail-alert" class="alert d-none"></div>' +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3"><h6 class="m-0">Basic details</h6></div>' +
                '<div class="card-body" id="org-basic-details"></div>' +
            "</div>" +
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
                    ["Name", "Type", "Address", "Status", ""], "#od-endpoint-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Contacts", "org-contact-rows",
                    ["Purpose", "Name", "Telecom", ""], "#od-contact-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Practitioners", "org-role-rows",
                    ["Practitioner", "Role", "Status", ""], "#od-role-modal", "Add") + "</div>" +
            "</div>" +
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
                field("Status", '<select class="form-select" id="od-ep-status"><option value="active">Active</option><option value="off">Off</option><option value="test">Test</option><option value="suspended">Suspended</option></select>'),
                "od-endpoint-form") +
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
                "od-role-form")
        );

        renderBasics();
        loadChildren();
        loadLocations();
        loadAffiliations();
        loadEndpoints();
        renderContacts();
        loadRoles();
        bindForms();

        $("#od-affil-modal").on("show.bs.modal", function () {
            fillSelect("#od-affil-org", "/Organization?_count=200&_sort=name", function (item) {
                return item.name || item.id;
            }, org.id);
        });
        $("#od-role-modal").on("show.bs.modal", function () {
            fillSelect("#od-pr-practitioner", "/Practitioner?_count=200&_sort=name", personName);
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
                '<dt class="col-sm-3">Telecom</dt><dd class="col-sm-9">' + esc(formatTelecom(org.telecom)) + "</dd>" +
                '<dt class="col-sm-3">Address</dt><dd class="col-sm-9">' + esc(formatAddress((org.address || [])[0])) + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(org.id) + "</code></dd>" +
            "</dl>"
        );
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

    function loadEndpoints() {
        CadminApi.fhir("/Endpoint?organization=" + encodeURIComponent(org.id) + "&_count=50&_sort=name").done(function (bundle) {
            const rows = bundleResources(bundle);
            if (!rows.length) {
                $("#org-endpoint-rows").html(emptyRow(5, "No endpoints."));
                return;
            }
            $("#org-endpoint-rows").html(rows.map(function (ep) {
                return "<tr>" +
                    "<td>" + esc(ep.name || ep.id) + "</td>" +
                    "<td>" + esc(conceptLabel(ep.connectionType)) + "</td>" +
                    "<td><code>" + esc(ep.address || "—") + "</code></td>" +
                    "<td>" + codeStatusBadge(ep.status) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete="/Endpoint/' +
                        encodeURIComponent(ep.id) + '" data-reload="endpoints" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                    "</tr>";
            }).join(""));
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
                "<td>" + esc(personName({ name: contact.name ? [contact.name] : [] })) + "</td>" +
                "<td>" + esc(formatTelecom(contact.telecom)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-contact="' +
                    index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td>' +
                "</tr>";
        }).join(""));
    }

    function loadRoles() {
        CadminApi.fhir("/PractitionerRole?organization=" + encodeURIComponent(org.id) +
            "&_include=PractitionerRole:practitioner&_count=50").done(function (bundle) {
            const practitioners = {};
            const roles = [];
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Practitioner") {
                    practitioners[resource.id] = resource;
                } else if (resource.resourceType === "PractitionerRole") {
                    roles.push(resource);
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
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete="/PractitionerRole/' +
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
        CadminApi.fhir("/Organization/" + encodeURIComponent(org.id), "PUT", org).done(function (updated) {
            org = updated;
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

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".orgdetail");

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
            const otherId = $("#od-affil-org").val();
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
                    display: $("#od-affil-org option:selected").text()
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

        $("#od-endpoint-form").on("submit", function (event) {
            event.preventDefault();
            const conn = connectionTypes.find(function (item) { return item.code === $("#od-ep-type").val(); });
            const resource = {
                resourceType: "Endpoint",
                status: $("#od-ep-status").val() || "active",
                name: $("#od-ep-name").val(),
                address: $("#od-ep-address").val(),
                connectionType: {
                    system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                    code: conn ? conn.code : "hl7-fhir-rest",
                    display: conn ? conn.display : "HL7 FHIR REST"
                },
                payloadType: [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                        code: "any",
                        display: "Any"
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
            const contact = {
                name: { text: $("#od-ct-name").val() },
                telecom: []
            };
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
            const existingId = $("#od-pr-practitioner").val();
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
                createRole(existingId, $("#od-pr-practitioner option:selected").text());
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
    }

    return { render: render };
}());
