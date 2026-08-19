window.CadminPatientDetail = (function () {
    const genderOptions = [
        { code: "unknown", display: "Unknown" },
        { code: "female", display: "Female" },
        { code: "male", display: "Male" },
        { code: "other", display: "Other" }
    ];
    const identifierTypes = [
        { code: "SS", display: "Social Security Number", system: "http://hl7.org/fhir/sid/us-ssn" },
        { code: "MR", display: "Medical record number", system: "" },
        { code: "", display: "Other", system: "" }
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
    const caregiverRoles = [
        { code: "CARGVR", display: "Caregiver" },
        { code: "PRN", display: "Parent" },
        { code: "FTH", display: "Father" },
        { code: "MTH", display: "Mother" },
        { code: "CHILD", display: "Child" },
        { code: "SPS", display: "Spouse" },
        { code: "DOMPART", display: "Domestic partner" },
        { code: "SIB", display: "Sibling" },
        { code: "GRPRN", display: "Grandparent" },
        { code: "GUARD", display: "Guardian" },
        { code: "NOK", display: "Next of kin" },
        { code: "FRND", display: "Friend" },
        { code: "NBOR", display: "Neighbor" },
        { code: "ECON", display: "Emergency contact" },
        { code: "O", display: "Other" }
    ];
    const practitionerRoles = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" },
        { code: "teacher", display: "Teacher" },
        { code: "ict", display: "ICT professional" }
    ];
    const careTeamStatus = [
        { code: "proposed", display: "Proposed" },
        { code: "active", display: "Active" },
        { code: "suspended", display: "Suspended" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const careTeamCategories = [
        { code: "", display: "Unspecified" },
        { code: "LA27975-4", display: "Event-focused" },
        { code: "LA27976-2", display: "Encounter-focused" },
        { code: "LA27977-0", display: "Episode of care-focused" },
        { code: "LA27978-8", display: "Condition-focused" },
        { code: "LA28865-6", display: "Longitudinal care-coordination" },
        { code: "LA28866-4", display: "Home and community based services" },
        { code: "LA27980-4", display: "Clinical research" },
        { code: "LA28867-2", display: "Public health" }
    ];
    const deviceTypes = [
        { code: "", display: "Unspecified" },
        { code: "86184003", display: "Electrocardiographic monitor" },
        { code: "336602003", display: "Blood pressure cuff" },
        { code: "337414009", display: "Blood glucose meter" },
        { code: "468039003", display: "Infusion pump" },
        { code: "706767009", display: "Pulse oximeter" },
        { code: "609328004", display: "Cardiac pacemaker" },
        { code: "467607003", display: "Implantable defibrillator" },
        { code: "463844008", display: "Ventilator" },
        { code: "6012004", display: "Hearing aid" },
        { code: "26412008", display: "Endoscope" },
        { code: "360006004", display: "Wheelchair" }
    ];
    const consentCategories = [
        { code: "npp", display: "Notice of Privacy Practices",
            system: "http://terminology.hl7.org/CodeSystem/consentcategorycodes" },
        { code: "INFA", display: "Information access",
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode" },
        { code: "patient-privacy", display: "Privacy Consent",
            system: "http://terminology.hl7.org/CodeSystem/consentscope" }
    ];
    const consentDecisions = [
        { code: "deny", display: "Deny" },
        { code: "permit", display: "Permit" }
    ];
    const flagStatuses = [
        { code: "active", display: "Active" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const flagCategories = [
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
    const flagCodes = [
        { code: "fall-risk", display: "Fall risk" },
        { code: "isolation", display: "Isolation precautions" },
        { code: "interpreter", display: "Interpreter needed" },
        { code: "admin-hold", display: "Administrative hold" },
        { code: "advance-directive", display: "Advance directive on file" }
    ];

    let patient = null;
    let careTeams = [];

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function bundleResources(bundle, resourceType) {
        return CadminApi.bundleResources(bundle, resourceType);
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
        const first = Array.isArray(ref) ? ref[0] : ref;
        return first.display || (first.reference || "").replace(/^[^/]+\//, "") || "—";
    }

    function refId(ref) {
        return CadminApi.referenceId(Array.isArray(ref) ? ref[0] : ref);
    }

    function refType(ref) {
        const first = Array.isArray(ref) ? ref[0] : ref;
        const match = ((first && first.reference) || "").match(/^([A-Za-z]+)\//);
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

    function genderLabel(code) {
        const match = genderOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(active) {
        return active
            ? '<span class="badge text-bg-success">Active</span>'
            : '<span class="badge text-bg-secondary">Inactive</span>';
    }

    function codeBadge(status, successCode) {
        const kind = status === (successCode || "active") ? "success"
            : status === "entered-in-error" || status === "inactive" ? "secondary"
                : "warning";
        return '<span class="badge text-bg-' + kind + '">' + esc(status || "—") + "</span>";
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
        CadminApi.showToast(type, message);
    }

    function fail(action, xhr) {
        alertMsg("danger", action + " failed (" + xhr.status + ").");
    }

    function isAdmin() {
        return CadminApp.isAdmin();
    }

    function fillSelect(selector, path, labelFn, placeholder, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">' + esc(placeholder || "None") + "</option>"]
                .concat(bundleResources(bundle).map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
            if (selectedId) {
                $select.val(selectedId);
            }
        });
    }

    function card(title, tableId, cols, addTarget, addLabel) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                (addTarget
                    ? '<button class="btn btn-sm btn-primary" type="button" data-bs-toggle="modal" data-bs-target="' +
                        addTarget + '"><i class="bi bi-plus-lg me-1"></i>' + addLabel + "</button>"
                    : "") +
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
                '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="' +
                    editTarget + '">Edit</button>' +
            "</div>" +
            '<div class="card-body" id="' + bodyId + '"></div>' +
        "</div>";
    }

    function tabButton(id, label, active) {
        return '<li class="nav-item" role="presentation">' +
            '<button class="nav-link' + (active ? " active" : "") + '" id="' + id + '-btn" data-bs-toggle="tab" ' +
            'data-bs-target="#' + id + '" type="button" role="tab" aria-controls="' + id +
            '" aria-selected="' + (active ? "true" : "false") + '">' + label + "</button></li>";
    }

    function tabPane(id, body, active) {
        return '<div class="tab-pane fade' + (active ? " show active" : "") + '" id="' + id +
            '" role="tabpanel" aria-labelledby="' + id + '-btn">' + body + "</div>";
    }

    function initials(resource) {
        const name = (resource && resource.name && resource.name[0]) || {};
        const given = ((name.given && name.given[0]) || "").charAt(0);
        const family = (name.family || "").charAt(0);
        const letters = (given + family) || "?";
        return letters.toUpperCase();
    }

    function ageLabel(birthDate) {
        if (!birthDate) {
            return "";
        }
        const born = new Date(birthDate + "T00:00:00");
        if (isNaN(born.getTime())) {
            return birthDate;
        }
        const now = new Date();
        let years = now.getFullYear() - born.getFullYear();
        const monthDelta = now.getMonth() - born.getMonth();
        if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
            years -= 1;
        }
        return years >= 0 ? years + "y" : birthDate;
    }

    function primaryTelecom(system) {
        const match = (patient.telecom || []).find(function (item) {
            return item.system === system && item.value;
        });
        return match ? match.value : "";
    }

    function languagePills() {
        const items = patient.communication || [];
        if (!items.length) {
            return '<span class="text-muted">—</span>';
        }
        return items.map(function (item) {
            return '<span class="badge text-bg-secondary me-1 mb-1">' +
                esc(conceptLabel(item.language || item)) + "</span>";
        }).join("");
    }

    function setStat(key, value) {
        const el = document.getElementById("pd-stat-" + key);
        if (el) {
            el.textContent = value == null ? "—" : String(value);
        }
    }

    function renderProfile() {
        $("#pd-initials").text(initials(patient));
        $("#pd-name").text(personName(patient));
        $("#pd-crumb-name").text(personName(patient));
        const parts = [
            genderLabel(patient.gender),
            ageLabel(patient.birthDate) || patient.birthDate,
            patient.active !== false ? "Active" : "Inactive"
        ].filter(Boolean);
        $("#pd-subtitle").text(parts.join(" · "));
        const orgId = refId(patient.managingOrganization);
        const orgHtml = orgId && isAdmin()
            ? '<a href="#/organizations/' + encodeURIComponent(orgId) + '">' +
                esc(refLabel(patient.managingOrganization)) + "</a>"
            : esc(refLabel(patient.managingOrganization));
        $("#pd-about-org").html(orgHtml);
        const address = (patient.address && patient.address[0]) || null;
        const place = address
            ? [address.city, address.state].filter(Boolean).join(", ") || formatAddress(address)
            : "";
        $("#pd-about-location").text(place || "—");
        $("#pd-about-dob").text(patient.birthDate || "—");
        $("#pd-about-languages").html(languagePills());
        const contact = [primaryTelecom("phone"), primaryTelecom("email")].filter(Boolean).join(" · ");
        $("#pd-about-contact").html(
            (contact ? esc(contact) + "<br>" : "") +
            "<code>" + esc(patient.id) + "</code>"
        );
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

    function deviceLabel(resource) {
        const names = (resource && (resource.name || resource.deviceName)) || [];
        const preferred = names.find(function (item) { return item.display === true; });
        const named = (preferred || names[0] || {}).value || (names[0] && names[0].name);
        return named || [resource.manufacturer, resource.modelNumber].filter(Boolean).join(" ")
            || (resource && resource.id) || "Unnamed";
    }

    function currentAssociation(resource) {
        return resource && resource.resourceType === "DeviceAssociation"
            && resource.status !== "explanted" && resource.status !== "entered-in-error";
    }

    function participantRole(item) {
        return item ? conceptLabel(item.role) : "—";
    }

    function membersOfType(type) {
        const seen = {};
        const rows = [];
        careTeams.forEach(function (team) {
            (team.participant || []).forEach(function (item) {
                if (refType(item.member) !== type) {
                    return;
                }
                const id = refId(item.member);
                const key = type + "/" + id + "/" + team.id;
                if (seen[key]) {
                    return;
                }
                seen[key] = true;
                rows.push({ team: team, participant: item, id: id });
            });
        });
        return rows;
    }

    function render(resource) {
        patient = resource;
        careTeams = [];
        const admin = isAdmin();
        const $root = $("#app-content");
        $root.html(
            '<div class="d-flex align-items-center justify-content-between mb-3">' +
                "<div>" +
                    '<nav aria-label="breadcrumb">' +
                        '<ol class="breadcrumb mb-1">' +
                            '<li class="breadcrumb-item"><a href="#/patients">Patients</a></li>' +
                            '<li class="breadcrumb-item active" aria-current="page" id="pd-crumb-name">' +
                                esc(personName(patient)) + "</li>" +
                        "</ol>" +
                    "</nav>" +
                    '<h1 class="h3 mb-0 page-title">Patient</h1>' +
                "</div>" +
                CadminResourceSource.button() +
            "</div>" +
            '<div class="row">' +
                '<div class="col-md-3">' +
                    '<div class="card card-primary card-outline mb-4">' +
                        '<div class="card-body box-profile">' +
                            '<div class="text-center">' +
                                '<div class="profile-initials mb-3" id="pd-initials">' +
                                    esc(initials(patient)) + "</div>" +
                            "</div>" +
                            '<h3 class="profile-username text-center mb-1" id="pd-name">' +
                                esc(personName(patient)) + "</h3>" +
                            '<p class="text-muted text-center mb-2" id="pd-subtitle"></p>' +
                            '<div class="text-center mb-3" id="pd-flag-badge"></div>' +
                            '<ul class="list-group list-group-unbordered mb-3">' +
                                '<li class="list-group-item">' +
                                    "<b>Flags</b> <span class=\"float-end\" id=\"pd-stat-flags\">0</span></li>" +
                                '<li class="list-group-item">' +
                                    "<b>Devices</b> <span class=\"float-end\" id=\"pd-stat-devices\">0</span></li>" +
                                (admin
                                    ? '<li class="list-group-item">' +
                                        "<b>Care teams</b> <span class=\"float-end\" id=\"pd-stat-teams\">0</span></li>"
                                    : "") +
                            "</ul>" +
                            '<button class="btn btn-primary w-100" type="button" data-bs-toggle="modal" ' +
                                'data-bs-target="#pd-basic-modal">Edit details</button>' +
                        "</div>" +
                    "</div>" +
                    '<div class="card mb-4">' +
                        '<div class="card-header"><h3 class="card-title">About</h3></div>' +
                        '<div class="card-body">' +
                            (admin
                                ? "<strong><i class=\"bi bi-building me-1\"></i> Organization</strong>" +
                                    '<p class="text-muted" id="pd-about-org">—</p><hr>'
                                : "") +
                            "<strong><i class=\"bi bi-geo-alt me-1\"></i> Location</strong>" +
                            '<p class="text-muted" id="pd-about-location">—</p><hr>' +
                            "<strong><i class=\"bi bi-calendar-date me-1\"></i> Birth date</strong>" +
                            '<p class="text-muted" id="pd-about-dob">—</p><hr>' +
                            "<strong><i class=\"bi bi-translate me-1\"></i> Languages</strong>" +
                            '<p class="text-muted mb-2" id="pd-about-languages">—</p><hr>' +
                            "<strong><i class=\"bi bi-person-vcard me-1\"></i> Contact</strong>" +
                            '<p class="text-muted mb-0" id="pd-about-contact">—</p>' +
                        "</div>" +
                    "</div>" +
                "</div>" +
                '<div class="col-md-9">' +
                    '<div class="card">' +
                        '<div class="card-header p-2">' +
                            '<ul class="nav nav-pills" role="tablist">' +
                                tabButton("pd-tab-clinical", "Clinical", true) +
                                tabButton("pd-tab-details", "Details", false) +
                                (admin
                                    ? tabButton("pd-tab-care", "Care", false) +
                                        tabButton("pd-tab-privacy", "Privacy", false)
                                    : "") +
                                tabButton("pd-tab-graph", "Graph", false) +
                            "</ul>" +
                        "</div>" +
                        '<div class="card-body">' +
                            '<div class="tab-content">' +
                                tabPane("pd-tab-clinical",
                                    card("Flags", "pd-flag-rows",
                                        ["Status", "Category", "Code", "Period", ""], "#pd-flag-modal", "Add") +
                                    card("Devices", "pd-device-rows",
                                        ["Device", "Type", "Status", ""], "#pd-device-modal", "Add"),
                                    true) +
                                tabPane("pd-tab-details",
                                    editCard("Basic details", "pd-basic-details", "#pd-basic-modal") +
                                    card("Identifiers", "pd-id-rows",
                                        ["Type", "System", "Value", ""], "#pd-id-modal", "Add") +
                                    '<div class="row">' +
                                        '<div class="col-lg-6">' + card("Contacts", "pd-telecom-rows",
                                            ["System", "Value", ""], "#pd-telecom-modal", "Add") + "</div>" +
                                        '<div class="col-lg-6">' + card("Addresses", "pd-address-rows",
                                            ["Address", ""], "#pd-address-modal", "Add") + "</div>" +
                                    "</div>" +
                                    card("Languages", "pd-lang-rows",
                                        ["Language", ""], "#pd-lang-modal", "Add"),
                                    false) +
                                (admin
                                    ? tabPane("pd-tab-care",
                                        '<div class="row">' +
                                            '<div class="col-lg-6">' + card("Care teams", "pd-team-rows",
                                                ["Name", "Status", "Organization", ""], "#pd-team-modal", "Add") +
                                            "</div>" +
                                            '<div class="col-lg-6">' + card("Caregivers", "pd-caregiver-rows",
                                                ["Name", "Care team", "Role", ""], "#pd-caregiver-modal", "Add") +
                                            "</div>" +
                                        "</div>" +
                                        card("Practitioners", "pd-practitioner-rows",
                                            ["Name", "Care team", "Role", ""], "#pd-practitioner-modal", "Add"),
                                        false) +
                                        tabPane("pd-tab-privacy",
                                            card("Consents", "pd-consent-rows",
                                                ["Category", "Decision", "Status", ""], "#pd-consent-modal", "Add"),
                                            false)
                                    : "") +
                                tabPane("pd-tab-graph", CadminResourceGraph.card(), false) +
                            "</div>" +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            modal("pd-basic-modal", "Edit basic details",
                field("Prefix", '<input class="form-control" id="pd-prefix">') +
                field("Given name", '<input class="form-control" id="pd-given" required>') +
                field("Family name", '<input class="form-control" id="pd-family" required>') +
                field("Suffix", '<input class="form-control" id="pd-suffix">') +
                field("Gender", '<select class="form-select" id="pd-gender">' + optionsHtml(genderOptions) + "</select>") +
                field("Birth date", '<input type="date" class="form-control" id="pd-birth">') +
                (admin
                    ? field("Managing organization",
                        '<select class="form-select" id="pd-org"><option value="">None</option></select>')
                    : "") +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="pd-active">' +
                    '<label class="form-check-label" for="pd-active">Active</label></div>',
                "pd-basic-form") +
            modal("pd-id-modal", "Add identifier",
                field("Type", '<select class="form-select" id="pd-id-type">' + optionsHtml(identifierTypes) + "</select>") +
                field("System", '<input class="form-control" id="pd-id-system" placeholder="http://hl7.org/fhir/sid/us-ssn">') +
                field("Value", '<input class="form-control" id="pd-id-value" required placeholder="000-00-0000">'),
                "pd-id-form") +
            modal("pd-telecom-modal", "Add contact",
                field("System", '<select class="form-select" id="pd-tel-system">' +
                    '<option value="phone">Phone</option><option value="email">Email</option>' +
                    '<option value="fax">Fax</option><option value="url">URL</option></select>') +
                field("Value", '<input class="form-control" id="pd-tel-value" required>'),
                "pd-telecom-form") +
            modal("pd-address-modal", "Add address",
                field("Street", '<input class="form-control" id="pd-line">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label>' +
                    '<input class="form-control" id="pd-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label>' +
                    '<input class="form-control" id="pd-state"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Postal code</label>' +
                    '<input class="form-control" id="pd-postal"></div>' +
                '<div class="col-md-6 mb-0"><label class="form-label">Country</label>' +
                    '<input class="form-control" id="pd-country"></div></div>',
                "pd-address-form") +
            modal("pd-lang-modal", "Add language",
                field("Language", '<select class="form-select" id="pd-lang">' + optionsHtml(languageOptions) + "</select>"),
                "pd-lang-form") +
            modal("pd-device-modal", "Add device",
                field("Existing device", '<select class="form-select" id="pd-dev-existing">' +
                    '<option value="">Create new device</option></select>') +
                '<div id="pd-dev-new">' +
                    field("Name", '<input class="form-control" id="pd-dev-name">') +
                    field("Type", '<select class="form-select" id="pd-dev-type">' + optionsHtml(deviceTypes) + "</select>") +
                    field("Manufacturer", '<input class="form-control" id="pd-dev-mfg">') +
                "</div>",
                "pd-device-form") +
            modal("pd-flag-modal", "Create flag",
                field("Status", '<select class="form-select" id="pd-flag-status"></select>') +
                field("Category", '<select class="form-select" id="pd-flag-category"></select>') +
                field("Code", '<select class="form-select" id="pd-flag-code"></select>') +
                field("Message", '<input class="form-control" id="pd-flag-text" required>') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Period start</label>' +
                    '<input type="date" class="form-control" id="pd-flag-start"></div>' +
                    '<div class="col-md-6 mb-3"><label class="form-label">Period end</label>' +
                    '<input type="date" class="form-control" id="pd-flag-end"></div></div>' +
                field("Author", '<select class="form-select" id="pd-flag-author">' +
                    '<option value="">None</option></select>'),
                "pd-flag-form") +
            (admin
                ? modal("pd-team-modal", "Create care team",
                    field("Name", '<input class="form-control" id="pd-ct-name" required>') +
                    field("Status", '<select class="form-select" id="pd-ct-status">' +
                        optionsHtml(careTeamStatus) + "</select>") +
                    field("Category", '<select class="form-select" id="pd-ct-category">' +
                        optionsHtml(careTeamCategories) + "</select>") +
                    field("Managing organization",
                        '<select class="form-select" id="pd-ct-org"><option value="">None</option></select>'),
                    "pd-team-form") +
                  modal("pd-caregiver-modal", "Add caregiver",
                    field("Caregiver", '<select class="form-select" id="pd-cg-person" required>' +
                        '<option value="">Select…</option></select>') +
                    field("Care team", '<select class="form-select" id="pd-cg-team">' +
                        '<option value="">Create new care team</option></select>') +
                    '<div class="mb-3" id="pd-cg-name-wrap">' +
                        '<label class="form-label">New care team name</label>' +
                        '<input class="form-control" id="pd-cg-name"></div>' +
                    field("Role", '<select class="form-select" id="pd-cg-role">' +
                        optionsHtml(caregiverRoles) + "</select>"),
                    "pd-caregiver-form") +
                  modal("pd-practitioner-modal", "Add practitioner",
                    field("Practitioner", '<select class="form-select" id="pd-pr-person" required>' +
                        '<option value="">Select…</option></select>') +
                    field("Care team", '<select class="form-select" id="pd-pr-team">' +
                        '<option value="">Create new care team</option></select>') +
                    '<div class="mb-3" id="pd-pr-name-wrap">' +
                        '<label class="form-label">New care team name</label>' +
                        '<input class="form-control" id="pd-pr-name"></div>' +
                    field("Role", '<select class="form-select" id="pd-pr-role">' +
                        optionsHtml(practitionerRoles) + "</select>"),
                    "pd-practitioner-form") +
                  modal("pd-consent-modal", "Create consent",
                    field("Category", '<select class="form-select" id="pd-cons-category"></select>') +
                    field("Decision", '<select class="form-select" id="pd-cons-decision">' +
                        optionsHtml(consentDecisions) + "</select>") +
                    field("Date", '<input type="date" class="form-control" id="pd-cons-date">') +
                    field("Grantee", '<select class="form-select" id="pd-cons-grantee">' +
                        '<option value="">None</option></select>'),
                    "pd-consent-form")
                : "")
        );
        CadminResourceSource.mount(function () { return patient; });
        CadminResourceGraph.mount(patient);
        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderLanguages();
        loadDevices();
        loadFlags();
        bindForms();
        if (admin) {
            loadCareTeams();
            loadConsents();
        }
    }

    function renderBasics() {
        const orgId = refId(patient.managingOrganization);
        const orgHtml = orgId && isAdmin()
            ? '<a href="#/organizations/' + encodeURIComponent(orgId) + '">' +
                esc(refLabel(patient.managingOrganization)) + "</a>"
            : esc(refLabel(patient.managingOrganization));
        $("#pd-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(personName(patient)) + "</dd>" +
                '<dt class="col-sm-4">Gender</dt><dd class="col-sm-8">' + esc(genderLabel(patient.gender)) + "</dd>" +
                '<dt class="col-sm-4">Birth date</dt><dd class="col-sm-8">' + esc(patient.birthDate || "—") + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(patient.active !== false) + "</dd>" +
                (isAdmin()
                    ? '<dt class="col-sm-4">Organization</dt><dd class="col-sm-8">' + orgHtml + "</dd>"
                    : "") +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(patient.id) + "</code></dd>" +
            "</dl>"
        );
        renderProfile();
    }

    function renderIdentifiers() {
        const items = patient.identifier || [];
        if (!items.length) {
            $("#pd-id-rows").html(emptyRow(4, "No identifiers."));
            return;
        }
        $("#pd-id-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.type ? conceptLabel(item.type) : "—") +
                "</td><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="identifier" data-index="' +
                index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderTelecom() {
        const items = patient.telecom || [];
        if (!items.length) {
            $("#pd-telecom-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#pd-telecom-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="telecom" data-index="' +
                index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderAddresses() {
        const items = patient.address || [];
        if (!items.length) {
            $("#pd-address-rows").html(emptyRow(2, "No addresses."));
            return;
        }
        $("#pd-address-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(formatAddress(item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="address" data-index="' +
                index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderLanguages() {
        const items = patient.communication || [];
        if (!items.length) {
            $("#pd-lang-rows").html(emptyRow(2, "No languages."));
            return;
        }
        $("#pd-lang-rows").html(items.map(function (item, index) {
            const lang = item.language || item;
            return "<tr><td>" + esc(conceptLabel(lang)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="communication" data-index="' +
                index + '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function refreshPatientLists() {
        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderLanguages();
    }

    function savePatient(next) {
        CadminApi.fhir("/Patient/" + encodeURIComponent(patient.id), "PUT", patient).done(function (updated) {
            patient = updated || patient;
            refreshPatientLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update patient", xhr);
        });
    }

    function loadDevices() {
        const path = "/DeviceAssociation?subject=" + encodeURIComponent("Patient/" + patient.id) +
            "&_include=DeviceAssociation:device&_count=50";
        CadminApi.fhir(path).done(function (bundle) {
            renderDeviceRows(bundle);
        }).fail(function () {
            CadminApi.fhir("/DeviceAssociation?patient=" + encodeURIComponent(patient.id) +
                "&_include=DeviceAssociation:device&_count=50")
                .done(renderDeviceRows)
                .fail(function (xhr) {
                    setStat("devices", 0);
                    $("#pd-device-rows").html(emptyRow(4, "Unable to load devices."));
                    fail("Load devices", xhr);
                });
        });
    }

    function renderDeviceRows(bundle) {
        const devices = {};
        const associations = [];
        bundleResources(bundle).forEach(function (resource) {
            if (resource.resourceType === "Device") {
                devices[resource.id] = resource;
            } else if (currentAssociation(resource)) {
                associations.push(resource);
            }
        });
        setStat("devices", associations.length);
        if (!associations.length) {
            $("#pd-device-rows").html(emptyRow(4, "No devices assigned."));
            return;
        }
        $("#pd-device-rows").html(associations.map(function (assoc) {
            const device = devices[refId(assoc.device)] || {};
            const label = deviceLabel(device) || refLabel(assoc.device);
            const deviceId = refId(assoc.device);
            const nameHtml = deviceId
                ? CadminApi.resourceLink("#/devices/" + encodeURIComponent(deviceId), label)
                : esc(label);
            return "<tr><td>" + nameHtml + "</td><td>" + esc(conceptLabel(device.type)) + "</td>" +
                "<td>" + codeBadge(assoc.status || device.status, "attached") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-unassign="' +
                esc(assoc.id) + '" title="Unassign"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadCareTeams() {
        CadminApi.fhir("/CareTeam?patient=" + encodeURIComponent(patient.id) + "&_count=50&_sort=name")
            .done(function (bundle) {
                careTeams = bundleResources(bundle, "CareTeam");
                setStat("teams", careTeams.length);
                renderCareTeams();
                renderCaregivers();
                renderPractitioners();
            }).fail(function (xhr) {
                setStat("teams", 0);
                $("#pd-team-rows").html(emptyRow(4, "Unable to load care teams."));
                fail("Load care teams", xhr);
            });
    }

    function renderCareTeams() {
        if (!careTeams.length) {
            $("#pd-team-rows").html(emptyRow(4, "No care teams."));
            return;
        }
        $("#pd-team-rows").html(careTeams.map(function (team) {
            const orgId = refId(team.managingOrganization);
            const orgHtml = orgId
                ? '<a href="#/organizations/' + encodeURIComponent(orgId) + '">' +
                    esc(refLabel(team.managingOrganization)) + "</a>"
                : esc(refLabel(team.managingOrganization));
            return "<tr><td>" + CadminApi.resourceLink("#/care-teams/" + encodeURIComponent(team.id),
                team.name || team.id) + "</td>" +
                "<td>" + codeBadge(team.status) + "</td><td>" + orgHtml + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete-team="' +
                esc(team.id) + '" title="Delete"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderMemberRows(selector, type, hrefPrefix) {
        const rows = membersOfType(type);
        if (!rows.length) {
            $(selector).html(emptyRow(4, "None via care teams."));
            return;
        }
        $(selector).html(rows.map(function (row) {
            const name = refLabel(row.participant.member);
            const nameHtml = row.id
                ? CadminApi.resourceLink(hrefPrefix + encodeURIComponent(row.id), name)
                : esc(name);
            return "<tr><td>" + nameHtml + "</td><td>" +
                CadminApi.resourceLink("#/care-teams/" + encodeURIComponent(row.team.id),
                    row.team.name || row.team.id) + "</td>" +
                "<td>" + esc(participantRole(row.participant)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-member="' +
                esc(row.team.id) + '" data-member="' + esc(type + "/" + row.id) +
                '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderCaregivers() {
        renderMemberRows("#pd-caregiver-rows", "RelatedPerson", "#/caregivers/");
    }

    function renderPractitioners() {
        renderMemberRows("#pd-practitioner-rows", "Practitioner", "#/practitioners/");
    }

    function periodLabel(period) {
        if (!period || (!period.start && !period.end)) {
            return "—";
        }
        return (period.start || "…") + " – " + (period.end || "…");
    }

    function renderFlagBadge(flags) {
        const active = (flags || []).filter(function (item) { return item.status === "active"; });
        if (!active.length) {
            $("#pd-flag-badge").empty();
            return;
        }
        const first = conceptLabel(active[0].code);
        const label = active.length === 1
            ? first
            : active.length + " flags · " + first;
        $("#pd-flag-badge").html(
            '<span class="badge text-bg-warning"><i class="bi bi-flag me-1"></i>' + esc(label) + "</span>"
        );
    }

    function loadFlags() {
        CadminApi.fhir("/Flag?patient=" + encodeURIComponent(patient.id) + "&_sort=-_lastUpdated&_count=50")
            .done(function (bundle) {
                const entries = bundleResources(bundle, "Flag");
                setStat("flags", entries.filter(function (item) { return item.status === "active"; }).length);
                renderFlagBadge(entries);
                if (!entries.length) {
                    $("#pd-flag-rows").html(emptyRow(5, "No flags."));
                    return;
                }
                $("#pd-flag-rows").html(entries.map(function (flag) {
                    const inactivate = flag.status === "active"
                        ? '<button class="btn btn-sm btn-outline-warning" type="button" data-inactivate-flag="' +
                            esc(flag.id) + '" title="Inactivate"><i class="bi bi-flag"></i></button>'
                        : "";
                    const statusKind = flag.status === "active" ? "warning"
                        : flag.status === "entered-in-error" ? "danger" : "secondary";
                    return "<tr><td><span class=\"badge text-bg-" + statusKind + '">' +
                        esc(flag.status || "—") + "</span></td>" +
                        "<td>" + esc(conceptLabel(flag.category)) + "</td>" +
                        "<td>" + CadminApi.resourceLink("#/flags/" + encodeURIComponent(flag.id),
                            conceptLabel(flag.code)) + "</td>" +
                        "<td>" + esc(periodLabel(flag.period)) + "</td>" +
                        '<td class="text-end">' +
                            '<a class="btn btn-sm btn-outline-primary me-1" href="#/flags/' +
                            encodeURIComponent(flag.id) + '" title="Open"><i class="bi bi-eye"></i></a>' +
                            inactivate + "</td></tr>";
                }).join(""));
            }).fail(function (xhr) {
                setStat("flags", 0);
                $("#pd-flag-badge").empty();
                $("#pd-flag-rows").html(emptyRow(5, "Unable to load flags."));
                fail("Load flags", xhr);
            });
    }

    function loadConsents() {
        CadminApi.fhir("/Consent?patient=" + encodeURIComponent(patient.id) + "&_sort=-_lastUpdated&_count=50")
            .done(function (bundle) {
                const entries = bundleResources(bundle, "Consent");
                if (!entries.length) {
                    $("#pd-consent-rows").html(emptyRow(4, "No consents."));
                    return;
                }
                $("#pd-consent-rows").html(entries.map(function (consent) {
                    const decision = consent.decision
                        ? '<span class="badge text-bg-' + (consent.decision === "permit" ? "success" : "danger") + '">' +
                            esc(consent.decision) + "</span>"
                        : "—";
                    return "<tr><td>" + CadminApi.resourceLink("#/consents/" + encodeURIComponent(consent.id),
                        conceptLabel(consent.category)) + "</td>" +
                        "<td>" + decision + "</td><td>" + codeBadge(consent.status) + "</td>" +
                        '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/consents/' +
                        encodeURIComponent(consent.id) + '"><i class="bi bi-eye"></i></a></td></tr>';
                }).join(""));
            }).fail(function (xhr) {
                $("#pd-consent-rows").html(emptyRow(4, "Unable to load consents."));
                fail("Load consents", xhr);
            });
    }

    function fillTeamSelect(selector) {
        const $select = $(selector);
        $select.html('<option value="">Create new care team</option>');
        careTeams.forEach(function (team) {
            $select.append('<option value="' + esc(team.id) + '">' + esc(team.name || team.id) + "</option>");
        });
    }

    function addParticipantToTeam(teamId, newTeamName, participant, done) {
        if (teamId) {
            CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId)).done(function (team) {
                team.participant = team.participant || [];
                const already = team.participant.some(function (item) {
                    return (item.member && item.member.reference) === participant.member.reference;
                });
                if (already) {
                    alertMsg("danger", "Already on that care team.");
                    return;
                }
                team.participant.push(participant);
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId), "PUT", team).done(done)
                    .fail(function (xhr) { fail("Add to care team", xhr); });
            }).fail(function (xhr) { fail("Add to care team", xhr); });
            return;
        }
        const resource = {
            resourceType: "CareTeam",
            status: "active",
            name: newTeamName || (personName(patient) + " care team"),
            subject: {
                reference: "Patient/" + patient.id,
                display: personName(patient)
            },
            participant: [participant]
        };
        CadminApi.fhir("/CareTeam", "POST", resource).done(done).fail(function (xhr) {
            fail("Create care team", xhr);
        });
    }

    function participantFrom(type, id, display, role, system) {
        const participant = {
            member: { reference: type + "/" + id, display: display }
        };
        if (role) {
            participant.role = {
                coding: [{ system: system, code: role.code, display: role.display }],
                text: role.display
            };
        }
        return participant;
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".ptdetail");

        $root.on("shown.bs.tab.ptdetail", "#pd-tab-graph-btn", function () {
            if (typeof CadminResourceGraph.resize === "function") {
                CadminResourceGraph.resize();
            }
        });

        $root.on("click.ptdetail", "[data-remove]", function () {
            const fieldName = $(this).attr("data-remove");
            const index = Number($(this).attr("data-index"));
            patient[fieldName] = (patient[fieldName] || []).filter(function (_item, i) { return i !== index; });
            if (!patient[fieldName].length) {
                delete patient[fieldName];
            }
            savePatient(function () { alertMsg("success", "Removed."); });
        });

        $root.on("click.ptdetail", "[data-inactivate-flag]", function () {
            const id = $(this).attr("data-inactivate-flag");
            CadminApi.fhir("/Flag/" + encodeURIComponent(id)).done(function (flag) {
                flag.status = "inactive";
                flag.period = flag.period || {};
                flag.period.end = new Date().toISOString().slice(0, 10);
                CadminApi.fhir("/Flag/" + encodeURIComponent(id), "PUT", flag).done(function () {
                    alertMsg("success", "Flag inactivated.");
                    loadFlags();
                }).fail(function (xhr) { fail("Inactivate flag", xhr); });
            }).fail(function (xhr) { fail("Inactivate flag", xhr); });
        });

        $root.on("click.ptdetail", "[data-unassign]", function () {
            const id = $(this).attr("data-unassign");
            CadminApi.fhir("/DeviceAssociation/" + encodeURIComponent(id), "DELETE").done(function () {
                alertMsg("success", "Device unassigned.");
                loadDevices();
            }).fail(function (xhr) { fail("Unassign device", xhr); });
        });

        $root.on("click.ptdetail", "[data-delete-team]", function () {
            const id = $(this).attr("data-delete-team");
            CadminApi.fhir("/CareTeam/" + encodeURIComponent(id), "DELETE").done(function () {
                alertMsg("success", "Care team deleted.");
                loadCareTeams();
            }).fail(function (xhr) { fail("Delete care team", xhr); });
        });

        $root.on("click.ptdetail", "[data-remove-member]", function () {
            const teamId = $(this).attr("data-remove-member");
            const member = $(this).attr("data-member");
            CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId)).done(function (team) {
                team.participant = (team.participant || []).filter(function (item) {
                    return (item.member && item.member.reference) !== member;
                });
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId), "PUT", team).done(function () {
                    alertMsg("success", "Removed from care team.");
                    loadCareTeams();
                }).fail(function (xhr) { fail("Remove member", xhr); });
            }).fail(function (xhr) { fail("Remove member", xhr); });
        });

        $root.on("change.ptdetail", "#pd-dev-existing", function () {
            if ($(this).val()) {
                $("#pd-dev-new").addClass("d-none");
            } else {
                $("#pd-dev-new").removeClass("d-none");
            }
        });

        $root.on("change.ptdetail", "#pd-cg-team", function () {
            $("#pd-cg-name-wrap").toggleClass("d-none", !!$(this).val());
        });
        $root.on("change.ptdetail", "#pd-pr-team", function () {
            $("#pd-pr-name-wrap").toggleClass("d-none", !!$(this).val());
        });

        $("#pd-id-modal").on("show.bs.modal", function () {
            const selected = identifierTypes.find(function (item) { return item.code === $("#pd-id-type").val(); });
            if (selected && selected.system && !$("#pd-id-system").val()) {
                $("#pd-id-system").val(selected.system);
            }
        });

        $("#pd-basic-modal").on("show.bs.modal", function () {
            const name = (patient.name && patient.name[0]) || {};
            $("#pd-prefix").val((name.prefix || []).join(" "));
            $("#pd-given").val((name.given || []).join(" "));
            $("#pd-family").val(name.family || "");
            $("#pd-suffix").val((name.suffix || []).join(" "));
            $("#pd-gender").val(patient.gender || "unknown");
            $("#pd-birth").val(patient.birthDate || "");
            $("#pd-active").prop("checked", patient.active !== false);
            if (isAdmin()) {
                CadminApi.bindOrganizationSelect("#pd-org", {
                    placeholder: "None",
                    selectedId: refId(patient.managingOrganization),
                    selectedLabel: refLabel(patient.managingOrganization)
                });
            }
        });

        $("#pd-device-modal").on("show.bs.modal", function () {
            $("#pd-dev-existing").html('<option value="">Create new device</option>');
            $("#pd-dev-new").removeClass("d-none");
            $("#pd-dev-name").val("");
            CadminApi.fhir("/Device?_count=200").done(function (bundle) {
                bundleResources(bundle, "Device").forEach(function (device) {
                    $("#pd-dev-existing").append(
                        '<option value="' + esc(device.id) + '">' + esc(deviceLabel(device)) + "</option>"
                    );
                });
            });
        });

        $("#pd-team-modal").on("show.bs.modal", function () {
            $("#pd-ct-name").val(personName(patient) + " care team");
            $("#pd-ct-status").val("active");
            CadminApi.bindOrganizationSelect("#pd-ct-org", { placeholder: "None" });
        });

        $("#pd-caregiver-modal").on("show.bs.modal", function () {
            CadminApi.bindCaregiverSelect("#pd-cg-person", { placeholder: "Select…" });
            fillTeamSelect("#pd-cg-team");
            $("#pd-cg-name").val(personName(patient) + " care team");
            $("#pd-cg-name-wrap").removeClass("d-none");
            $("#pd-cg-role").val("CARGVR");
        });

        $("#pd-practitioner-modal").on("show.bs.modal", function () {
            CadminApi.bindPractitionerSelect("#pd-pr-person", { placeholder: "Select…" });
            fillTeamSelect("#pd-pr-team");
            $("#pd-pr-name").val(personName(patient) + " care team");
            $("#pd-pr-name-wrap").removeClass("d-none");
            $("#pd-pr-role").val("doctor");
        });

        $("#pd-flag-modal").on("show.bs.modal", function () {
            CadminApi.fillValueSetSelect("#pd-flag-status", CadminApi.valueSets.flagStatus, {
                fallback: flagStatuses,
                selected: "active"
            });
            CadminApi.fillSelectOptions("#pd-flag-category", flagCategories, { selected: "safety" });
            CadminApi.expandValueSet(CadminApi.valueSets.flagCategory).done(function (concepts) {
                const usable = concepts.filter(function (item) {
                    return item.code && item.code.charAt(0) !== "_";
                });
                if (usable.length) {
                    flagCategories = usable;
                }
                CadminApi.fillSelectOptions("#pd-flag-category", flagCategories, { selected: "safety" });
            });
            CadminApi.fillSelectOptions("#pd-flag-code", flagCodes, {
                prepend: [{ code: "", display: "Custom message" }],
                selected: "fall-risk"
            });
            $("#pd-flag-text").val("Fall risk");
            $("#pd-flag-start").val("");
            $("#pd-flag-end").val("");
            CadminApi.bindPractitionerSelect("#pd-flag-author", { placeholder: "None" });
        });

        $("#pd-flag-code").on("change", function () {
            const match = flagCodes.find(function (item) { return item.code === $("#pd-flag-code").val(); });
            if (match) {
                $("#pd-flag-text").val(match.display);
            }
        });

        $("#pd-consent-modal").on("show.bs.modal", function () {
            CadminApi.fillSelectOptions("#pd-cons-category", consentCategories, { selected: "npp" });
            CadminApi.expandValueSet(CadminApi.valueSets.consentCategory).done(function (concepts) {
                const usable = concepts.filter(function (item) {
                    return item.code && item.code.charAt(0) !== "_";
                });
                CadminApi.fillSelectOptions("#pd-cons-category", usable, { selected: "npp" });
            });
            CadminApi.fillValueSetSelect("#pd-cons-decision", CadminApi.valueSets.consentProvisionType, {
                fallback: consentDecisions,
                selected: "deny"
            });
            $("#pd-cons-date").val(new Date().toISOString().slice(0, 10));
            CadminApi.bindOrganizationSelect("#pd-cons-grantee", { placeholder: "None" });
        });

        $("#pd-basic-form").on("submit", function (event) {
            event.preventDefault();
            const given = $("#pd-given").val().trim().split(/\s+/).filter(Boolean);
            const prefix = $("#pd-prefix").val().trim().split(/\s+/).filter(Boolean);
            const suffix = $("#pd-suffix").val().trim().split(/\s+/).filter(Boolean);
            const name = { family: $("#pd-family").val().trim(), given: given };
            if (prefix.length) { name.prefix = prefix; }
            if (suffix.length) { name.suffix = suffix; }
            patient.name = [name];
            patient.gender = $("#pd-gender").val() || "unknown";
            patient.active = $("#pd-active").is(":checked");
            setOrDelete(patient, "birthDate", $("#pd-birth").val());
            if (isAdmin()) {
                const orgId = CadminApi.selectValue("#pd-org");
                if (orgId) {
                    patient.managingOrganization = {
                        reference: "Organization/" + orgId,
                        display: CadminApi.selectLabel("#pd-org")
                    };
                } else {
                    delete patient.managingOrganization;
                }
            }
            savePatient(function () {
                hideModal("pd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#pd-id-type").on("change", function () {
            const selected = identifierTypes.find(function (item) { return item.code === $("#pd-id-type").val(); });
            if (selected && selected.system) {
                $("#pd-id-system").val(selected.system);
            }
        });

        $("#pd-id-form").on("submit", function (event) {
            event.preventDefault();
            const identifier = { value: $("#pd-id-value").val().trim() };
            const type = identifierTypes.find(function (item) { return item.code === $("#pd-id-type").val(); });
            const system = $("#pd-id-system").val().trim() || (type && type.system) || "";
            if (type && type.code) {
                identifier.type = {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                        code: type.code,
                        display: type.display
                    }],
                    text: type.display
                };
                if (type.code === "SS") {
                    identifier.use = "official";
                }
            }
            if (system) {
                identifier.system = system;
            }
            patient.identifier = patient.identifier || [];
            patient.identifier.push(identifier);
            savePatient(function () {
                hideModal("pd-id-modal");
                $("#pd-id-value").val("");
                alertMsg("success", "Identifier added.");
            });
        });

        $("#pd-telecom-form").on("submit", function (event) {
            event.preventDefault();
            patient.telecom = patient.telecom || [];
            patient.telecom.push({
                system: $("#pd-tel-system").val() || "phone",
                value: $("#pd-tel-value").val()
            });
            savePatient(function () {
                hideModal("pd-telecom-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#pd-address-form").on("submit", function (event) {
            event.preventDefault();
            const address = {};
            const line = $("#pd-line").val();
            const city = $("#pd-city").val();
            const state = $("#pd-state").val();
            const postal = $("#pd-postal").val();
            const country = $("#pd-country").val();
            if (line) { address.line = [line]; }
            if (city) { address.city = city; }
            if (state) { address.state = state; }
            if (postal) { address.postalCode = postal; }
            if (country) { address.country = country; }
            if (!Object.keys(address).length) {
                alertMsg("danger", "Enter an address.");
                return;
            }
            patient.address = patient.address || [];
            patient.address.push(address);
            savePatient(function () {
                hideModal("pd-address-modal");
                alertMsg("success", "Address added.");
            });
        });

        $("#pd-lang-form").on("submit", function (event) {
            event.preventDefault();
            const option = languageOptions.find(function (item) { return item.code === $("#pd-lang").val(); });
            if (!option) {
                return;
            }
            patient.communication = patient.communication || [];
            patient.communication.push({
                language: {
                    coding: [{ system: "urn:ietf:bcp:47", code: option.code, display: option.display }],
                    text: option.display
                }
            });
            savePatient(function () {
                hideModal("pd-lang-modal");
                alertMsg("success", "Language added.");
            });
        });

        $("#pd-device-form").on("submit", function (event) {
            event.preventDefault();
            const existingId = $("#pd-dev-existing").val();
            const subject = {
                reference: "Patient/" + patient.id,
                display: personName(patient)
            };

            function associate(deviceId, display) {
                CadminApi.fhir("/DeviceAssociation", "POST", {
                    resourceType: "DeviceAssociation",
                    status: "attached",
                    device: { reference: "Device/" + deviceId, display: display },
                    subject: subject
                }).done(function () {
                    hideModal("pd-device-modal");
                    alertMsg("success", "Device assigned.");
                    loadDevices();
                }).fail(function (xhr) { fail("Assign device", xhr); });
            }

            if (existingId) {
                associate(existingId, $("#pd-dev-existing option:selected").text());
                return;
            }
            const name = $("#pd-dev-name").val().trim();
            if (!name) {
                alertMsg("danger", "Enter a device name or pick an existing device.");
                return;
            }
            const resource = {
                resourceType: "Device",
                status: "active",
                name: [{ value: name, type: "user-friendly-name", display: true }]
            };
            const mfg = $("#pd-dev-mfg").val().trim();
            if (mfg) { resource.manufacturer = mfg; }
            const type = deviceTypes.find(function (item) { return item.code === $("#pd-dev-type").val(); });
            if (type && type.code) {
                resource.type = [{
                    coding: [{ system: "http://snomed.info/sct", code: type.code, display: type.display }],
                    text: type.display
                }];
            }
            CadminApi.fhir("/Device", "POST", resource).done(function (created, _status, xhr) {
                const id = CadminApi.createdResourceId(created, xhr, "Device");
                if (!id) {
                    hideModal("pd-device-modal");
                    alertMsg("success", "Device created.");
                    loadDevices();
                    return;
                }
                associate(id, name);
            }).fail(function (xhr) { fail("Create device", xhr); });
        });

        $("#pd-team-form").on("submit", function (event) {
            event.preventDefault();
            const resource = {
                resourceType: "CareTeam",
                name: $("#pd-ct-name").val().trim(),
                status: $("#pd-ct-status").val() || "active",
                subject: { reference: "Patient/" + patient.id, display: personName(patient) }
            };
            const category = careTeamCategories.find(function (item) {
                return item.code === $("#pd-ct-category").val();
            });
            if (category && category.code) {
                resource.category = [{
                    coding: [{ system: "http://loinc.org", code: category.code, display: category.display }]
                }];
            }
            const orgId = CadminApi.selectValue("#pd-ct-org");
            if (orgId) {
                resource.managingOrganization = [{
                    reference: "Organization/" + orgId,
                    display: CadminApi.selectLabel("#pd-ct-org")
                }];
            }
            CadminApi.fhir("/CareTeam", "POST", resource).done(function () {
                hideModal("pd-team-modal");
                alertMsg("success", "Care team created.");
                loadCareTeams();
            }).fail(function (xhr) { fail("Create care team", xhr); });
        });

        $("#pd-caregiver-form").on("submit", function (event) {
            event.preventDefault();
            const id = CadminApi.selectValue("#pd-cg-person");
            if (!id) {
                alertMsg("danger", "Select a caregiver.");
                return;
            }
            const role = caregiverRoles.find(function (item) { return item.code === $("#pd-cg-role").val(); });
            const participant = participantFrom("RelatedPerson", id, CadminApi.selectLabel("#pd-cg-person"),
                role, "http://terminology.hl7.org/CodeSystem/v3-RoleCode");
            addParticipantToTeam($("#pd-cg-team").val(), $("#pd-cg-name").val().trim(), participant, function () {
                hideModal("pd-caregiver-modal");
                alertMsg("success", "Caregiver added.");
                loadCareTeams();
            });
        });

        $("#pd-practitioner-form").on("submit", function (event) {
            event.preventDefault();
            const id = CadminApi.selectValue("#pd-pr-person");
            if (!id) {
                alertMsg("danger", "Select a practitioner.");
                return;
            }
            const role = practitionerRoles.find(function (item) { return item.code === $("#pd-pr-role").val(); });
            const participant = participantFrom("Practitioner", id, CadminApi.selectLabel("#pd-pr-person"),
                role, "http://terminology.hl7.org/CodeSystem/practitioner-role");
            addParticipantToTeam($("#pd-pr-team").val(), $("#pd-pr-name").val().trim(), participant, function () {
                hideModal("pd-practitioner-modal");
                alertMsg("success", "Practitioner added.");
                loadCareTeams();
            });
        });

        $("#pd-flag-form").on("submit", function (event) {
            event.preventDefault();
            const text = $("#pd-flag-text").val().trim();
            if (!text) {
                alertMsg("danger", "Enter a flag message.");
                return;
            }
            const categoryCode = $("#pd-flag-category").val();
            const category = flagCategories.find(function (item) { return item.code === categoryCode; })
                || { code: categoryCode, display: $("#pd-flag-category option:selected").text(),
                    system: "http://terminology.hl7.org/CodeSystem/flag-category" };
            const resource = {
                resourceType: "Flag",
                status: $("#pd-flag-status").val() || "active",
                subject: { reference: "Patient/" + patient.id, display: personName(patient) },
                code: { text: text }
            };
            if (category && category.code) {
                resource.category = [{
                    coding: [{
                        system: category.system || "http://terminology.hl7.org/CodeSystem/flag-category",
                        code: category.code,
                        display: category.display
                    }]
                }];
            }
            const code = $("#pd-flag-code").val();
            const catalog = flagCodes.find(function (item) { return item.code === code; });
            if (catalog) {
                resource.code.coding = [{
                    system: "https://cadmin.io/fhir/CodeSystem/flag-code",
                    code: catalog.code,
                    display: catalog.display
                }];
            }
            const start = $("#pd-flag-start").val();
            const end = $("#pd-flag-end").val();
            if (start || end) {
                resource.period = {};
                if (start) { resource.period.start = start; }
                if (end) { resource.period.end = end; }
            }
            const authorId = CadminApi.selectValue("#pd-flag-author");
            if (authorId) {
                resource.author = {
                    reference: "Practitioner/" + authorId,
                    display: CadminApi.selectLabel("#pd-flag-author")
                };
            }
            CadminApi.fhir("/Flag", "POST", resource).done(function (created, _status, xhr) {
                const id = CadminApi.createdResourceId(created, xhr, "Flag");
                hideModal("pd-flag-modal");
                alertMsg("success", "Flag created.");
                if (id) {
                    window.location.hash = "#/flags/" + encodeURIComponent(id);
                    return;
                }
                loadFlags();
            }).fail(function (xhr) { fail("Create flag", xhr); });
        });

        $("#pd-consent-form").on("submit", function (event) {
            event.preventDefault();
            const categoryCode = $("#pd-cons-category").val();
            const category = consentCategories.find(function (item) { return item.code === categoryCode; })
                || { code: categoryCode, display: $("#pd-cons-category option:selected").text() };
            const resource = {
                resourceType: "Consent",
                status: "draft",
                subject: { reference: "Patient/" + patient.id, display: personName(patient) },
                grantor: [{ reference: "Patient/" + patient.id, display: personName(patient) }]
            };
            if (category && category.code) {
                resource.category = [{
                    coding: [{
                        system: category.system || "http://terminology.hl7.org/CodeSystem/consentcategorycodes",
                        code: category.code,
                        display: category.display
                    }]
                }];
            }
            const decision = $("#pd-cons-decision").val();
            if (decision) { resource.decision = decision; }
            const date = $("#pd-cons-date").val();
            if (date) { resource.date = date; }
            const granteeId = CadminApi.selectValue("#pd-cons-grantee");
            if (granteeId) {
                resource.grantee = [{
                    reference: "Organization/" + granteeId,
                    display: CadminApi.selectLabel("#pd-cons-grantee")
                }];
            }
            CadminApi.fhir("/Consent", "POST", resource).done(function (created, _status, xhr) {
                const id = CadminApi.createdResourceId(created, xhr, "Consent");
                hideModal("pd-consent-modal");
                alertMsg("success", "Consent created.");
                if (id) {
                    window.location.hash = "#/consents/" + encodeURIComponent(id);
                    return;
                }
                loadConsents();
            }).fail(function (xhr) { fail("Create consent", xhr); });
        });
    }

    return { render: render };
}());
