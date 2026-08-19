window.CadminCaregiverDetail = (function () {
    const genderOptions = [
        { code: "unknown", display: "Unknown" },
        { code: "female", display: "Female" },
        { code: "male", display: "Male" },
        { code: "other", display: "Other" }
    ];
    const participantRoles = [
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

    let caregiver = null;

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
        return CadminApi.referenceId(ref);
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

    function fillSelect(selector, path, labelFn, placeholder) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">' + esc(placeholder || "None") + "</option>"]
                .concat(bundleResources(bundle).map(function (resource) {
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
        const match = (caregiver.telecom || []).find(function (item) {
            return item.system === system && item.value;
        });
        return match ? match.value : "";
    }

    function languagePills() {
        const items = caregiver.communication || [];
        if (!items.length) {
            return '<span class="text-muted">—</span>';
        }
        return items.map(function (item) {
            return '<span class="badge text-bg-secondary me-1 mb-1">' +
                esc(conceptLabel(item.language || item)) + "</span>";
        }).join("");
    }

    function setStat(key, value) {
        const el = document.getElementById("cgd-stat-" + key);
        if (el) {
            el.textContent = value == null ? "—" : String(value);
        }
    }

    function patientRefHtml() {
        const id = refId(caregiver.patient);
        if (!id) {
            return "—";
        }
        return '<a href="#/patients/' + encodeURIComponent(id) + '">' +
            esc(refLabel(caregiver.patient)) + "</a>";
    }

    function renderProfile() {
        $("#cgd-initials").text(initials(caregiver));
        $("#cgd-name").text(personName(caregiver));
        $("#cgd-crumb-name").text(personName(caregiver));
        const parts = [
            genderLabel(caregiver.gender),
            ageLabel(caregiver.birthDate) || caregiver.birthDate,
            caregiver.active !== false ? "Active" : "Inactive"
        ].filter(Boolean);
        $("#cgd-subtitle").text(parts.join(" · "));
        setStat("ids", (caregiver.identifier || []).length);
        $("#cgd-about-patient").html(patientRefHtml());
        $("#cgd-about-relationship").text(conceptLabel(caregiver.relationship));
        const address = (caregiver.address && caregiver.address[0]) || null;
        const place = address
            ? [address.city, address.state].filter(Boolean).join(", ") || formatAddress(address)
            : "";
        $("#cgd-about-location").text(place || "—");
        $("#cgd-about-dob").text(caregiver.birthDate || "—");
        $("#cgd-about-languages").html(languagePills());
        const contact = [primaryTelecom("phone"), primaryTelecom("email")].filter(Boolean).join(" · ");
        $("#cgd-about-contact").html(
            (contact ? esc(contact) + "<br>" : "") +
            "<code>" + esc(caregiver.id) + "</code>"
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

    function isAdmin() {
        return CadminApp.isAdmin();
    }

    function isThisCaregiver(ref) {
        return refId(ref) === caregiver.id;
    }

    function caregiverParticipant(team) {
        return (team.participant || []).find(function (item) {
            return isThisCaregiver(item.member);
        });
    }

    function participantRole(team) {
        const item = caregiverParticipant(team);
        return item ? conceptLabel(item.role) : "—";
    }

    function render(resource) {
        caregiver = resource;
        const admin = isAdmin();
        const $root = $("#app-content");
        $root.html(
            '<div class="d-flex align-items-center justify-content-between mb-3">' +
                "<div>" +
                    '<nav aria-label="breadcrumb">' +
                        '<ol class="breadcrumb mb-1">' +
                            '<li class="breadcrumb-item"><a href="#/caregivers">Caregivers</a></li>' +
                            '<li class="breadcrumb-item active" aria-current="page" id="cgd-crumb-name">' +
                                esc(personName(caregiver)) + "</li>" +
                        "</ol>" +
                    "</nav>" +
                    '<h1 class="h3 mb-0 page-title">Caregiver</h1>' +
                "</div>" +
                CadminResourceSource.button() +
            "</div>" +
            '<div class="row">' +
                '<div class="col-md-3">' +
                    '<div class="card card-primary card-outline mb-4">' +
                        '<div class="card-body box-profile">' +
                            '<div class="text-center">' +
                                '<div class="profile-initials mb-3" id="cgd-initials">' +
                                    esc(initials(caregiver)) + "</div>" +
                            "</div>" +
                            '<h3 class="profile-username text-center mb-1" id="cgd-name">' +
                                esc(personName(caregiver)) + "</h3>" +
                            '<p class="text-muted text-center mb-2" id="cgd-subtitle"></p>' +
                            '<ul class="list-group list-group-unbordered mb-3">' +
                                '<li class="list-group-item">' +
                                    "<b>Identifiers</b> <span class=\"float-end\" id=\"cgd-stat-ids\">0</span></li>" +
                                (admin
                                    ? '<li class="list-group-item">' +
                                        "<b>Patients</b> <span class=\"float-end\" id=\"cgd-stat-patients\">0</span></li>" +
                                        '<li class="list-group-item">' +
                                        "<b>Care teams</b> <span class=\"float-end\" id=\"cgd-stat-teams\">0</span></li>"
                                    : "") +
                            "</ul>" +
                            '<button class="btn btn-primary w-100" type="button" data-bs-toggle="modal" ' +
                                'data-bs-target="#cgd-basic-modal">Edit details</button>' +
                        "</div>" +
                    "</div>" +
                    '<div class="card mb-4">' +
                        '<div class="card-header"><h3 class="card-title">About</h3></div>' +
                        '<div class="card-body">' +
                            "<strong><i class=\"bi bi-person me-1\"></i> Patient</strong>" +
                            '<p class="text-muted" id="cgd-about-patient">—</p><hr>' +
                            "<strong><i class=\"bi bi-person-heart me-1\"></i> Relationship</strong>" +
                            '<p class="text-muted" id="cgd-about-relationship">—</p><hr>' +
                            "<strong><i class=\"bi bi-geo-alt me-1\"></i> Location</strong>" +
                            '<p class="text-muted" id="cgd-about-location">—</p><hr>' +
                            "<strong><i class=\"bi bi-calendar-date me-1\"></i> Birth date</strong>" +
                            '<p class="text-muted" id="cgd-about-dob">—</p><hr>' +
                            "<strong><i class=\"bi bi-translate me-1\"></i> Languages</strong>" +
                            '<p class="text-muted mb-2" id="cgd-about-languages">—</p><hr>' +
                            "<strong><i class=\"bi bi-person-vcard me-1\"></i> Contact</strong>" +
                            '<p class="text-muted mb-0" id="cgd-about-contact">—</p>' +
                        "</div>" +
                    "</div>" +
                "</div>" +
                '<div class="col-md-9">' +
                    '<div class="card">' +
                        '<div class="card-header p-2">' +
                            '<ul class="nav nav-pills" role="tablist">' +
                                tabButton("cgd-tab-details", "Details", true) +
                                (admin ? tabButton("cgd-tab-care", "Care", false) : "") +
                                tabButton("cgd-tab-graph", "Graph", false) +
                            "</ul>" +
                        "</div>" +
                        '<div class="card-body">' +
                            '<div class="tab-content">' +
                                tabPane("cgd-tab-details",
                                    editCard("Basic details", "cgd-basic-details", "#cgd-basic-modal") +
                                    card("Identifiers", "cgd-id-rows",
                                        ["System", "Value", ""], "#cgd-id-modal", "Add") +
                                    '<div class="row">' +
                                        '<div class="col-lg-6">' + card("Contacts", "cgd-telecom-rows",
                                            ["System", "Value", ""], "#cgd-telecom-modal", "Add") + "</div>" +
                                        '<div class="col-lg-6">' + card("Addresses", "cgd-address-rows",
                                            ["Address", ""], "#cgd-address-modal", "Add") + "</div>" +
                                    "</div>" +
                                    card("Languages", "cgd-lang-rows",
                                        ["Language", ""], "#cgd-lang-modal", "Add"),
                                    true) +
                                (admin
                                    ? tabPane("cgd-tab-care",
                                        card("Patients", "cgd-team-rows",
                                            ["Patient", "Care team", "Role", ""], "#cgd-team-modal", "Add"),
                                        false)
                                    : "") +
                                tabPane("cgd-tab-graph", CadminResourceGraph.card(), false) +
                            "</div>" +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            modal("cgd-basic-modal", "Edit basic details",
                field("Prefix", '<input class="form-control" id="cgd-prefix">') +
                field("Given name", '<input class="form-control" id="cgd-given" required>') +
                field("Family name", '<input class="form-control" id="cgd-family" required>') +
                field("Suffix", '<input class="form-control" id="cgd-suffix">') +
                field("Gender", '<select class="form-select" id="cgd-gender">' + optionsHtml(genderOptions) + "</select>") +
                field("Birth date", '<input type="date" class="form-control" id="cgd-birth">') +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="cgd-active">' +
                    '<label class="form-check-label" for="cgd-active">Active</label></div>',
                "cgd-basic-form") +
            modal("cgd-id-modal", "Add identifier",
                field("System", '<input class="form-control" id="cgd-id-system">') +
                field("Value", '<input class="form-control" id="cgd-id-value" required>'),
                "cgd-id-form") +
            modal("cgd-telecom-modal", "Add contact",
                field("System", '<select class="form-select" id="cgd-tel-system">' +
                    '<option value="phone">Phone</option><option value="email">Email</option>' +
                    '<option value="fax">Fax</option><option value="url">URL</option></select>') +
                field("Value", '<input class="form-control" id="cgd-tel-value" required>'),
                "cgd-telecom-form") +
            modal("cgd-address-modal", "Add address",
                field("Street", '<input class="form-control" id="cgd-line">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label><input class="form-control" id="cgd-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label><input class="form-control" id="cgd-state"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Postal code</label><input class="form-control" id="cgd-postal"></div>' +
                '<div class="col-md-6 mb-0"><label class="form-label">Country</label><input class="form-control" id="cgd-country"></div></div>',
                "cgd-address-form") +
            modal("cgd-lang-modal", "Add language",
                field("Language", '<select class="form-select" id="cgd-lang">' + optionsHtml(languageOptions) + "</select>"),
                "cgd-lang-form") +
            (isAdmin()
                ? modal("cgd-team-modal", "Add patient via care team",
                    field("Patient", '<select class="form-select" id="cgd-ct-patient" required><option value="">Select…</option></select>') +
                    field("Care team", '<select class="form-select" id="cgd-ct-team"><option value="">Create new care team</option></select>') +
                    '<div class="mb-3" id="cgd-ct-name-wrap">' +
                        '<label class="form-label">New care team name</label>' +
                        '<input class="form-control" id="cgd-ct-name" placeholder="Optional">' +
                    "</div>" +
                    field("Role", '<select class="form-select" id="cgd-ct-role">' + optionsHtml(participantRoles) + "</select>"),
                    "cgd-team-form")
                : "")
        );
        CadminResourceSource.mount(function () { return caregiver; });
        CadminResourceGraph.mount(caregiver);
        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderLanguages();
        bindForms();
        if (isAdmin()) {
            loadCareTeams();
            $("#cgd-team-modal").on("show.bs.modal", function () {
                CadminApi.bindPatientSelect("#cgd-ct-patient", { placeholder: "Select…" });
                $("#cgd-ct-team").html('<option value="">Create new care team</option>');
                $("#cgd-ct-name").val("");
                $("#cgd-ct-name-wrap").removeClass("d-none");
                $("#cgd-ct-role").val("CARGVR");
            });
        }
    }

    function renderBasics() {
        $("#cgd-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(personName(caregiver)) + "</dd>" +
                '<dt class="col-sm-4">Gender</dt><dd class="col-sm-8">' + esc(genderLabel(caregiver.gender)) + "</dd>" +
                '<dt class="col-sm-4">Birth date</dt><dd class="col-sm-8">' + esc(caregiver.birthDate || "—") + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(caregiver.active !== false) + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(caregiver.id) + "</code></dd>" +
            "</dl>"
        );
        renderProfile();
    }

    function renderIdentifiers() {
        const items = caregiver.identifier || [];
        setStat("ids", items.length);
        if (!items.length) {
            $("#cgd-id-rows").html(emptyRow(3, "No identifiers."));
            return;
        }
        $("#cgd-id-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="identifier" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderTelecom() {
        const items = caregiver.telecom || [];
        if (!items.length) {
            $("#cgd-telecom-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#cgd-telecom-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="telecom" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderAddresses() {
        const items = caregiver.address || [];
        if (!items.length) {
            $("#cgd-address-rows").html(emptyRow(2, "No addresses."));
            return;
        }
        $("#cgd-address-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(formatAddress(item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="address" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderLanguages() {
        const items = caregiver.communication || [];
        if (!items.length) {
            $("#cgd-lang-rows").html(emptyRow(2, "No languages."));
            return;
        }
        $("#cgd-lang-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(conceptLabel(item.language || item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="communication" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadCareTeams() {
        CadminApi.fhir("/CareTeam?participant=" + encodeURIComponent("RelatedPerson/" + caregiver.id) +
            "&_include=CareTeam:subject&_count=50").done(function (bundle) {
            const patients = {};
            const teams = [];
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Patient") {
                    patients[resource.id] = resource;
                } else if (resource.resourceType === "CareTeam") {
                    teams.push(resource);
                }
            });
            setStat("teams", teams.length);
            const seenPatients = {};
            teams.forEach(function (team) {
                const id = refId(team.subject);
                if (id) {
                    seenPatients[id] = true;
                }
            });
            setStat("patients", Object.keys(seenPatients).length);
            if (!teams.length) {
                $("#cgd-team-rows").html(emptyRow(4, "No patients via care teams."));
                return;
            }
            $("#cgd-team-rows").html(teams.map(function (team) {
                const patientId = refId(team.subject);
                const patient = patients[patientId];
                const patientName = patient ? personName(patient) : refLabel(team.subject);
                const patientHtml = patientId
                    ? '<a href="#/patients/' + encodeURIComponent(patientId) + '">' + esc(patientName) + "</a>"
                    : esc(patientName || "—");
                const teamHtml = '<a href="#/care-teams/' + encodeURIComponent(team.id) + '">' +
                    esc(team.name || team.id) + "</a>";
                return "<tr><td>" + patientHtml + "</td><td>" + teamHtml + "</td><td>" + esc(participantRole(team)) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-team="' +
                    esc(team.id) + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
            setStat("teams", 0);
            setStat("patients", 0);
            $("#cgd-team-rows").html(emptyRow(4, "Unable to load care teams."));
            fail("Load care teams", xhr);
        });
    }

    function loadTeamsForPatient(patientId) {
        const $team = $("#cgd-ct-team");
        $team.html('<option value="">Create new care team</option>');
        $("#cgd-ct-name-wrap").removeClass("d-none");
        if (!patientId) {
            return;
        }
        CadminApi.fhir("/CareTeam?patient=" + encodeURIComponent(patientId) + "&_count=50&_sort=name").done(function (bundle) {
            bundleResources(bundle).forEach(function (team) {
                if (caregiverParticipant(team)) {
                    return;
                }
                $team.append('<option value="' + esc(team.id) + '">' + esc(team.name || team.id) + "</option>");
            });
        });
    }

    function participantPayload(role) {
        const participant = {
            member: {
                reference: "RelatedPerson/" + caregiver.id,
                display: personName(caregiver)
            }
        };
        if (role) {
            participant.role = {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    code: role.code,
                    display: role.display
                }],
                text: role.display
            };
        }
        return participant;
    }

    function refreshLists() {
        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderLanguages();
    }

    function saveCaregiver(next) {
        CadminApi.fhir("/RelatedPerson/" + encodeURIComponent(caregiver.id), "PUT", caregiver).done(function (updated) {
            caregiver = updated;
            refreshLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update caregiver", xhr);
        });
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".cgdetail");

        $root.on("shown.bs.tab.cgdetail", "#cgd-tab-graph-btn", function () {
            if (typeof CadminResourceGraph.resize === "function") {
                CadminResourceGraph.resize();
            }
        });

        $root.on("click.cgdetail", "[data-remove]", function () {
            const fieldName = $(this).attr("data-remove");
            const index = Number($(this).attr("data-index"));
            caregiver[fieldName] = (caregiver[fieldName] || []).filter(function (_item, i) { return i !== index; });
            saveCaregiver(function () {
                alertMsg("success", "Removed.");
            });
        });

        $root.on("click.cgdetail", "[data-remove-team]", function () {
            const id = $(this).attr("data-remove-team");
            CadminApi.fhir("/CareTeam/" + encodeURIComponent(id)).done(function (team) {
                team.participant = (team.participant || []).filter(function (item) {
                    return !isThisCaregiver(item.member);
                });
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(id), "PUT", team).done(function () {
                    alertMsg("success", "Removed from care team.");
                    loadCareTeams();
                }).fail(function (xhr) {
                    fail("Remove from care team", xhr);
                });
            }).fail(function (xhr) {
                fail("Remove from care team", xhr);
            });
        });

        $root.on("change.cgdetail", "#cgd-ct-patient", function () {
            loadTeamsForPatient($(this).val());
            const patientName = CadminApi.selectLabel("#cgd-ct-patient");
            if (!$("#cgd-ct-team").val()) {
                $("#cgd-ct-name").val(patientName && patientName !== "Select…" ? patientName + " care team" : "");
            }
        });

        $root.on("change.cgdetail", "#cgd-ct-team", function () {
            if ($(this).val()) {
                $("#cgd-ct-name-wrap").addClass("d-none");
            } else {
                $("#cgd-ct-name-wrap").removeClass("d-none");
            }
        });

        $("#cgd-basic-modal").on("show.bs.modal", function () {
            const name = (caregiver.name && caregiver.name[0]) || {};
            $("#cgd-prefix").val((name.prefix || []).join(" "));
            $("#cgd-given").val((name.given || []).join(" "));
            $("#cgd-family").val(name.family || "");
            $("#cgd-suffix").val((name.suffix || []).join(" "));
            $("#cgd-gender").val(caregiver.gender || "unknown");
            $("#cgd-birth").val(caregiver.birthDate || "");
            $("#cgd-active").prop("checked", caregiver.active !== false);
        });

        $("#cgd-basic-form").on("submit", function (event) {
            event.preventDefault();
            const given = $("#cgd-given").val().trim().split(/\s+/).filter(Boolean);
            const prefix = $("#cgd-prefix").val().trim().split(/\s+/).filter(Boolean);
            const suffix = $("#cgd-suffix").val().trim().split(/\s+/).filter(Boolean);
            const name = { family: $("#cgd-family").val().trim(), given: given };
            if (prefix.length) {
                name.prefix = prefix;
            }
            if (suffix.length) {
                name.suffix = suffix;
            }
            caregiver.name = [name];
            caregiver.gender = $("#cgd-gender").val() || "unknown";
            caregiver.active = $("#cgd-active").is(":checked");
            setOrDelete(caregiver, "birthDate", $("#cgd-birth").val());
            saveCaregiver(function () {
                hideModal("cgd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#cgd-id-form").on("submit", function (event) {
            event.preventDefault();
            const identifier = { value: $("#cgd-id-value").val() };
            const system = $("#cgd-id-system").val();
            if (system) {
                identifier.system = system;
            }
            caregiver.identifier = caregiver.identifier || [];
            caregiver.identifier.push(identifier);
            saveCaregiver(function () {
                hideModal("cgd-id-modal");
                alertMsg("success", "Identifier added.");
            });
        });

        $("#cgd-telecom-form").on("submit", function (event) {
            event.preventDefault();
            caregiver.telecom = caregiver.telecom || [];
            caregiver.telecom.push({
                system: $("#cgd-tel-system").val() || "phone",
                value: $("#cgd-tel-value").val()
            });
            saveCaregiver(function () {
                hideModal("cgd-telecom-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#cgd-address-form").on("submit", function (event) {
            event.preventDefault();
            const address = {};
            const line = $("#cgd-line").val();
            const city = $("#cgd-city").val();
            const state = $("#cgd-state").val();
            const postal = $("#cgd-postal").val();
            const country = $("#cgd-country").val();
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
            caregiver.address = caregiver.address || [];
            caregiver.address.push(address);
            saveCaregiver(function () {
                hideModal("cgd-address-modal");
                alertMsg("success", "Address added.");
            });
        });

        $("#cgd-lang-form").on("submit", function (event) {
            event.preventDefault();
            const option = languageOptions.find(function (item) { return item.code === $("#cgd-lang").val(); });
            if (!option) {
                return;
            }
            caregiver.communication = caregiver.communication || [];
            caregiver.communication.push({
                coding: [{
                    system: "urn:ietf:bcp:47",
                    code: option.code,
                    display: option.display
                }],
                text: option.display
            });
            saveCaregiver(function () {
                hideModal("cgd-lang-modal");
                alertMsg("success", "Language added.");
            });
        });

        $("#cgd-team-form").on("submit", function (event) {
            event.preventDefault();
            const patientId = CadminApi.selectValue("#cgd-ct-patient");
            if (!patientId) {
                alertMsg("danger", "Select a patient.");
                return;
            }
            const role = participantRoles.find(function (item) { return item.code === $("#cgd-ct-role").val(); });
            const teamId = $("#cgd-ct-team").val();
            const patientDisplay = CadminApi.selectLabel("#cgd-ct-patient");
            const participant = participantPayload(role);

            function done() {
                hideModal("cgd-team-modal");
                alertMsg("success", "Added to care team.");
                loadCareTeams();
            }

            if (teamId) {
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId)).done(function (team) {
                    team.participant = team.participant || [];
                    if (caregiverParticipant(team)) {
                        alertMsg("danger", "This caregiver is already on that care team.");
                        return;
                    }
                    team.participant.push(participant);
                    CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId), "PUT", team).done(done).fail(function (xhr) {
                        fail("Add to care team", xhr);
                    });
                }).fail(function (xhr) {
                    fail("Add to care team", xhr);
                });
                return;
            }

            const teamName = ($("#cgd-ct-name").val() || "").trim() || (patientDisplay + " care team");
            const resource = {
                resourceType: "CareTeam",
                status: "active",
                name: teamName,
                subject: {
                    reference: "Patient/" + patientId,
                    display: patientDisplay
                },
                participant: [participant]
            };
            CadminApi.fhir("/CareTeam", "POST", resource).done(done).fail(function (xhr) {
                fail("Create care team", xhr);
            });
        });
    }

    return { render: render };
}());
