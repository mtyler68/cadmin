window.CadminPractitionerDetail = (function () {
    const genderOptions = [
        { code: "unknown", display: "Unknown" },
        { code: "female", display: "Female" },
        { code: "male", display: "Male" },
        { code: "other", display: "Other" }
    ];
    const practitionerRoles = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" },
        { code: "teacher", display: "Teacher" },
        { code: "ict", display: "ICT professional" }
    ];
    const qualificationOptions = [
        { code: "MD", display: "Medical Doctor" },
        { code: "DO", display: "Doctor of Osteopathy" },
        { code: "RN", display: "Registered Nurse" },
        { code: "NP", display: "Nurse Practitioner" },
        { code: "PA", display: "Physician Assistant" },
        { code: "PharmD", display: "Doctor of Pharmacy" },
        { code: "DDS", display: "Doctor of Dental Surgery" },
        { code: "PhD", display: "Doctor of Philosophy" }
    ];
    const languageOptions = [
        { code: "en", display: "English" },
        { code: "es", display: "Spanish" },
        { code: "fr", display: "French" },
        { code: "de", display: "German" },
        { code: "zh", display: "Chinese" },
        { code: "ar", display: "Arabic" },
        { code: "hi", display: "Hindi" },
        { code: "pt", display: "Portuguese" },
        { code: "ru", display: "Russian" },
        { code: "vi", display: "Vietnamese" }
    ];

    let practitioner = null;

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
        return [name.prefix && name.prefix.join(" "), given, name.family, name.suffix && name.suffix.join(" ")]
            .filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function formatAddress(address) {
        if (!address) {
            return "—";
        }
        return [(address.line || []).join(", "), address.city, address.state, address.postalCode, address.country]
            .filter(Boolean).join(", ") || "—";
    }

    function formatPeriod(period) {
        if (!period || (!period.start && !period.end)) {
            return "—";
        }
        return (period.start || "—") + " – " + (period.end || "—");
    }

    function genderLabel(code) {
        const match = genderOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(active) {
        return active
            ? '<span class="badge text-bg-success">Active</span>'
            : '<span class="badge text-bg-secondary">Inactive</span>';
    }

    function emptyRow(cols, text) {
        return '<tr><td colspan="' + cols + '" class="text-muted">' + text + "</td></tr>";
    }

    function optionsHtml(items) {
        return items.map(function (item) {
            return '<option value="' + esc(item.code) + '">' + esc(item.display) + "</option>";
        }).join("");
    }

    function hideModal(id) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(id));
        if (modal) {
            modal.hide();
        }
    }

    function alertMsg(type, message) {
        CadminApi.showAlert("#prd-detail-alert", type, message);
    }

    function fail(action, xhr) {
        alertMsg("danger", action + " failed (" + xhr.status + ").");
    }

    function fillSelect(selector, path, labelFn) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle).map(function (resource) {
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
                        '<tbody id="' + tableId + '">' + emptyRow(cols.length, "None") + "</tbody>" +
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

    function setOrDelete(obj, key, value) {
        if (value) {
            obj[key] = value;
        } else {
            delete obj[key];
        }
    }

    function isAdmin() {
        return CadminApp.isAdmin();
    }

    function render(resource) {
        practitioner = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/practitioners"><i class="bi bi-arrow-left me-1"></i>Practitioners</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(personName(practitioner)) + "</h1>" +
                "</div>" +
                '<a class="btn btn-outline-primary" href="#/resources/Practitioner/' + encodeURIComponent(practitioner.id) + '">' +
                    '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
            "</div>" +
            '<div id="prd-detail-alert" class="alert d-none"></div>' +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "prd-basic-details", "#prd-basic-modal") + "</div>" +
                '<div class="col-lg-6">' + card("Identifiers", "prd-id-rows",
                    ["System", "Value", ""], "#prd-id-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Contacts", "prd-telecom-rows",
                    ["System", "Value", ""], "#prd-telecom-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Addresses", "prd-address-rows",
                    ["Address", ""], "#prd-address-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Qualifications", "prd-qual-rows",
                    ["Qualification", "Period", ""], "#prd-qual-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Languages", "prd-lang-rows",
                    ["Language", ""], "#prd-lang-modal", "Add") + "</div>" +
            "</div>" +
            (isAdmin()
                ? '<div class="row"><div class="col-lg-12">' + card("Organization roles", "prd-role-rows",
                    ["Organization", "Location", "Role", "Status", ""], "#prd-role-modal", "Add") + "</div></div>"
                : "") +
            modal("prd-basic-modal", "Edit basic details",
                field("Prefix", '<input class="form-control" id="prd-prefix" placeholder="Dr">') +
                field("Given name", '<input class="form-control" id="prd-given" required>') +
                field("Family name", '<input class="form-control" id="prd-family" required>') +
                field("Suffix", '<input class="form-control" id="prd-suffix" placeholder="MD">') +
                field("Gender", '<select class="form-select" id="prd-gender">' + optionsHtml(genderOptions) + "</select>") +
                field("Birth date", '<input type="date" class="form-control" id="prd-birth">') +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="prd-active">' +
                    '<label class="form-check-label" for="prd-active">Active</label></div>',
                "prd-basic-form") +
            modal("prd-id-modal", "Add identifier",
                field("System", '<input class="form-control" id="prd-id-system">') +
                field("Value", '<input class="form-control" id="prd-id-value" required>'),
                "prd-id-form") +
            modal("prd-telecom-modal", "Add contact",
                field("System", '<select class="form-select" id="prd-tel-system">' +
                    '<option value="phone">Phone</option><option value="email">Email</option>' +
                    '<option value="fax">Fax</option><option value="url">URL</option></select>') +
                field("Value", '<input class="form-control" id="prd-tel-value" required>'),
                "prd-telecom-form") +
            modal("prd-address-modal", "Add address",
                field("Street", '<input class="form-control" id="prd-line">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label><input class="form-control" id="prd-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label><input class="form-control" id="prd-state"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Postal code</label><input class="form-control" id="prd-postal"></div>' +
                '<div class="col-md-6 mb-0"><label class="form-label">Country</label><input class="form-control" id="prd-country"></div></div>',
                "prd-address-form") +
            modal("prd-qual-modal", "Add qualification",
                field("Qualification", '<select class="form-select" id="prd-qual-code">' + optionsHtml(qualificationOptions) + "</select>") +
                field("Start", '<input type="date" class="form-control" id="prd-qual-start">') +
                field("End", '<input type="date" class="form-control" id="prd-qual-end">'),
                "prd-qual-form") +
            modal("prd-lang-modal", "Add language",
                field("Language", '<select class="form-select" id="prd-lang">' + optionsHtml(languageOptions) + "</select>"),
                "prd-lang-form") +
            (isAdmin()
                ? modal("prd-role-modal", "Add organization role",
                    field("Organization", '<select class="form-select" id="prd-role-org" required><option value="">Select…</option></select>') +
                    field("Location", '<select class="form-select" id="prd-role-loc"><option value="">None</option></select>') +
                    field("Role", '<select class="form-select" id="prd-role-code">' + optionsHtml(practitionerRoles) + "</select>"),
                    "prd-role-form")
                : "")
        );

        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderQualifications();
        renderLanguages();
        bindForms();
        if (isAdmin()) {
            loadRoles();
            $("#prd-role-modal").on("show.bs.modal", function () {
                fillSelect("#prd-role-org", "/Organization?_count=200&_sort=name", function (org) {
                    return org.name || org.id;
                });
                fillSelect("#prd-role-loc", "/Location?_count=200&_sort=name", function (loc) {
                    return loc.name || loc.id;
                });
            });
        }
    }

    function renderBasics() {
        $("#prd-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(personName(practitioner)) + "</dd>" +
                '<dt class="col-sm-4">Gender</dt><dd class="col-sm-8">' + esc(genderLabel(practitioner.gender)) + "</dd>" +
                '<dt class="col-sm-4">Birth date</dt><dd class="col-sm-8">' + esc(practitioner.birthDate || "—") + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(practitioner.active !== false) + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(practitioner.id) + "</code></dd>" +
            "</dl>"
        );
        $(".page-title").first().text(personName(practitioner));
    }

    function renderIdentifiers() {
        const items = practitioner.identifier || [];
        if (!items.length) {
            $("#prd-id-rows").html(emptyRow(3, "No identifiers."));
            return;
        }
        $("#prd-id-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="identifier" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderTelecom() {
        const items = practitioner.telecom || [];
        if (!items.length) {
            $("#prd-telecom-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#prd-telecom-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="telecom" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderAddresses() {
        const items = practitioner.address || [];
        if (!items.length) {
            $("#prd-address-rows").html(emptyRow(2, "No addresses."));
            return;
        }
        $("#prd-address-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(formatAddress(item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="address" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderQualifications() {
        const items = practitioner.qualification || [];
        if (!items.length) {
            $("#prd-qual-rows").html(emptyRow(3, "No qualifications."));
            return;
        }
        $("#prd-qual-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(conceptLabel(item.code)) + "</td><td>" + esc(formatPeriod(item.period)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="qualification" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderLanguages() {
        const items = practitioner.communication || [];
        if (!items.length) {
            $("#prd-lang-rows").html(emptyRow(2, "No languages."));
            return;
        }
        $("#prd-lang-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(conceptLabel(item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="communication" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadRoles() {
        CadminApi.fhir("/PractitionerRole?practitioner=" + encodeURIComponent(practitioner.id) +
            "&_include=PractitionerRole:organization&_include=PractitionerRole:location&_count=50").done(function (bundle) {
            const orgs = {};
            const locs = {};
            const roles = [];
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Organization") {
                    orgs[resource.id] = resource;
                } else if (resource.resourceType === "Location") {
                    locs[resource.id] = resource;
                } else if (resource.resourceType === "PractitionerRole") {
                    roles.push(resource);
                }
            });
            if (!roles.length) {
                $("#prd-role-rows").html(emptyRow(5, "No organization roles."));
                return;
            }
            $("#prd-role-rows").html(roles.map(function (role) {
                const orgId = refId(role.organization);
                const locRef = (role.location || [])[0];
                const locId = refId(locRef);
                const orgName = (orgs[orgId] && orgs[orgId].name) || refLabel(role.organization);
                const locName = (locs[locId] && locs[locId].name) || refLabel(locRef);
                const orgHtml = orgId
                    ? '<a href="#/organizations/' + encodeURIComponent(orgId) + '">' + esc(orgName) + "</a>"
                    : esc(orgName || "—");
                const locHtml = locId
                    ? '<a href="#/locations/' + encodeURIComponent(locId) + '">' + esc(locName) + "</a>"
                    : esc(locName || "—");
                return "<tr><td>" + orgHtml + "</td><td>" + locHtml + "</td><td>" + esc(conceptLabel(role.code)) + "</td><td>" +
                    statusBadge(role.active !== false) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete-role="' +
                    esc(role.id) + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
            $("#prd-role-rows").html(emptyRow(5, "Unable to load roles."));
            fail("Load roles", xhr);
        });
    }

    function refreshLists() {
        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderQualifications();
        renderLanguages();
    }

    function savePractitioner(next) {
        CadminApi.fhir("/Practitioner/" + encodeURIComponent(practitioner.id), "PUT", practitioner).done(function (updated) {
            practitioner = updated;
            refreshLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update practitioner", xhr);
        });
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".prdetail");

        $root.on("click.prdetail", "[data-remove]", function () {
            const fieldName = $(this).attr("data-remove");
            const index = Number($(this).attr("data-index"));
            practitioner[fieldName] = (practitioner[fieldName] || []).filter(function (_item, i) { return i !== index; });
            savePractitioner(function () {
                alertMsg("success", "Removed.");
            });
        });

        $root.on("click.prdetail", "[data-delete-role]", function () {
            const id = $(this).attr("data-delete-role");
            CadminApi.fhir("/PractitionerRole/" + encodeURIComponent(id), "DELETE").done(function () {
                alertMsg("success", "Role removed.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Remove role", xhr);
            });
        });

        $("#prd-basic-modal").on("show.bs.modal", function () {
            const name = (practitioner.name && practitioner.name[0]) || {};
            $("#prd-prefix").val((name.prefix || []).join(" "));
            $("#prd-given").val((name.given || []).join(" "));
            $("#prd-family").val(name.family || "");
            $("#prd-suffix").val((name.suffix || []).join(" "));
            $("#prd-gender").val(practitioner.gender || "unknown");
            $("#prd-birth").val(practitioner.birthDate || "");
            $("#prd-active").prop("checked", practitioner.active !== false);
        });

        $("#prd-basic-form").on("submit", function (event) {
            event.preventDefault();
            const given = $("#prd-given").val().trim().split(/\s+/).filter(Boolean);
            const prefix = $("#prd-prefix").val().trim().split(/\s+/).filter(Boolean);
            const suffix = $("#prd-suffix").val().trim().split(/\s+/).filter(Boolean);
            const name = { family: $("#prd-family").val().trim(), given: given };
            if (prefix.length) {
                name.prefix = prefix;
            }
            if (suffix.length) {
                name.suffix = suffix;
            }
            practitioner.name = [name];
            practitioner.gender = $("#prd-gender").val() || "unknown";
            practitioner.active = $("#prd-active").is(":checked");
            setOrDelete(practitioner, "birthDate", $("#prd-birth").val());
            savePractitioner(function () {
                hideModal("prd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#prd-id-form").on("submit", function (event) {
            event.preventDefault();
            const identifier = { value: $("#prd-id-value").val() };
            const system = $("#prd-id-system").val();
            if (system) {
                identifier.system = system;
            }
            practitioner.identifier = practitioner.identifier || [];
            practitioner.identifier.push(identifier);
            savePractitioner(function () {
                hideModal("prd-id-modal");
                alertMsg("success", "Identifier added.");
            });
        });

        $("#prd-telecom-form").on("submit", function (event) {
            event.preventDefault();
            practitioner.telecom = practitioner.telecom || [];
            practitioner.telecom.push({
                system: $("#prd-tel-system").val() || "phone",
                value: $("#prd-tel-value").val()
            });
            savePractitioner(function () {
                hideModal("prd-telecom-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#prd-address-form").on("submit", function (event) {
            event.preventDefault();
            const address = {};
            const line = $("#prd-line").val();
            const city = $("#prd-city").val();
            const state = $("#prd-state").val();
            const postal = $("#prd-postal").val();
            const country = $("#prd-country").val();
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
            if (!Object.keys(address).length) {
                alertMsg("danger", "Enter an address.");
                return;
            }
            practitioner.address = practitioner.address || [];
            practitioner.address.push(address);
            savePractitioner(function () {
                hideModal("prd-address-modal");
                alertMsg("success", "Address added.");
            });
        });

        $("#prd-qual-form").on("submit", function (event) {
            event.preventDefault();
            const option = qualificationOptions.find(function (item) { return item.code === $("#prd-qual-code").val(); });
            const qualification = {
                code: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0360",
                        code: option ? option.code : $("#prd-qual-code").val(),
                        display: option ? option.display : $("#prd-qual-code").val()
                    }],
                    text: option ? option.display : $("#prd-qual-code").val()
                }
            };
            const start = $("#prd-qual-start").val();
            const end = $("#prd-qual-end").val();
            if (start || end) {
                qualification.period = {};
                if (start) {
                    qualification.period.start = start;
                }
                if (end) {
                    qualification.period.end = end;
                }
            }
            practitioner.qualification = practitioner.qualification || [];
            practitioner.qualification.push(qualification);
            savePractitioner(function () {
                hideModal("prd-qual-modal");
                alertMsg("success", "Qualification added.");
            });
        });

        $("#prd-lang-form").on("submit", function (event) {
            event.preventDefault();
            const option = languageOptions.find(function (item) { return item.code === $("#prd-lang").val(); });
            if (!option) {
                return;
            }
            practitioner.communication = practitioner.communication || [];
            practitioner.communication.push({
                coding: [{
                    system: "urn:ietf:bcp:47",
                    code: option.code,
                    display: option.display
                }],
                text: option.display
            });
            savePractitioner(function () {
                hideModal("prd-lang-modal");
                alertMsg("success", "Language added.");
            });
        });

        $("#prd-role-form").on("submit", function (event) {
            event.preventDefault();
            const organizationId = $("#prd-role-org").val();
            if (!organizationId) {
                alertMsg("danger", "Select an organization.");
                return;
            }
            const role = practitionerRoles.find(function (item) { return item.code === $("#prd-role-code").val(); });
            const resource = {
                resourceType: "PractitionerRole",
                active: true,
                practitioner: {
                    reference: "Practitioner/" + practitioner.id,
                    display: personName(practitioner)
                },
                organization: {
                    reference: "Organization/" + organizationId,
                    display: $("#prd-role-org option:selected").text()
                }
            };
            const locationId = $("#prd-role-loc").val();
            if (locationId) {
                resource.location = [{
                    reference: "Location/" + locationId,
                    display: $("#prd-role-loc option:selected").text()
                }];
            }
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
                hideModal("prd-role-modal");
                alertMsg("success", "Organization role added.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Add role", xhr);
            });
        });
    }

    return { render: render };
}());
