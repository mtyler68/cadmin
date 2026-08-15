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

    function fhirWrite(path, method, resource, onSuccess, failAction) {
        CadminApi.fhir(path, method, resource).done(function (body, _status, xhr) {
            onSuccess(body, xhr);
        }).fail(function (xhr) {
            if (xhr.status >= 200 && xhr.status < 300) {
                onSuccess(xhr.responseJSON, xhr);
                return;
            }
            fail(failAction, xhr);
        });
    }

    function createdResourceId(xhr, resourceType) {
        return CadminApi.createdResourceId(null, xhr, resourceType);
    }

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
    }

    function fillSelect(selector, path, labelFn, placeholder, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">' + esc(placeholder || "None") + "</option>"]
                .concat(bundleResources(bundle).map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
            if (selectedId && $select.find('option[value="' + selectedId + '"]').length) {
                $select.val(selectedId);
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
                ? '<div class="row">' +
                    '<div class="col-lg-6">' + card("Organization roles", "prd-role-rows",
                        ["Organization", "Location", "Role", "Status", ""], "#prd-role-modal", "Add") + "</div>" +
                    '<div class="col-lg-6">' + card("Care teams", "prd-team-rows",
                        ["Patient", "Care team", "Role", ""], "#prd-team-modal", "Add") + "</div>" +
                "</div>"
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
            modal("prd-role-modal", "Add organization role",
                field("Organization", '<select class="form-select" id="prd-role-org" required><option value="">Select…</option></select>') +
                field("Location", '<select class="form-select" id="prd-role-loc"><option value="">None</option></select>') +
                field("Role", '<select class="form-select" id="prd-role-code">' + optionsHtml(practitionerRoles) + "</select>") +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="prd-role-active" checked>' +
                    '<label class="form-check-label" for="prd-role-active">Active</label></div>',
                "prd-role-form") +
            modal("prd-team-modal", "Add to care team",
                '<div class="mb-3">' +
                    '<label class="form-label">Membership</label>' +
                    '<div class="form-check">' +
                        '<input class="form-check-input" type="radio" name="prd-ct-mode" id="prd-ct-mode-existing" value="existing" checked>' +
                        '<label class="form-check-label" for="prd-ct-mode-existing">Existing care team</label>' +
                    "</div>" +
                    '<div class="form-check">' +
                        '<input class="form-check-input" type="radio" name="prd-ct-mode" id="prd-ct-mode-new" value="new">' +
                        '<label class="form-check-label" for="prd-ct-mode-new">New care team</label>' +
                    "</div>" +
                "</div>" +
                '<div id="prd-ct-existing-wrap">' +
                    field("Care team", '<select class="form-select" id="prd-ct-team"><option value="">Select…</option></select>') +
                "</div>" +
                '<div id="prd-ct-new-wrap" class="d-none">' +
                    field("Patient", '<select class="form-select" id="prd-ct-patient"><option value="">Select…</option></select>') +
                    field("Care team name", '<input class="form-control" id="prd-ct-name" placeholder="e.g. Home care team">') +
                "</div>" +
                field("Role", '<select class="form-select" id="prd-ct-role">' + optionsHtml(practitionerRoles) + "</select>"),
                "prd-team-form")
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
            loadCareTeams();
            $("#prd-role-modal").on("show.bs.modal", populateRoleForm);
            $("#prd-role-modal").on("hidden.bs.modal", resetRoleEditor);
            $("#prd-team-modal").on("show.bs.modal", function () {
                $("#prd-ct-mode-existing").prop("checked", true);
                toggleCareTeamMode();
                $("#prd-ct-name").val("");
                $("#prd-ct-role").val("doctor");
                loadExistingTeamOptions();
                fillSelect("#prd-ct-patient", "/Patient?_count=200&_sort=name", personName, "Select…");
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

    function isThisPractitioner(ref) {
        const reference = ((ref && ref.reference) || "").replace(/\/$/, "");
        return reference === "Practitioner/" + practitioner.id
            || reference.endsWith("/Practitioner/" + practitioner.id);
    }

    function practitionerParticipant(team) {
        return (team.participant || []).find(function (item) {
            return isThisPractitioner(item.member);
        });
    }

    function participantRole(team) {
        const item = practitionerParticipant(team);
        return item ? conceptLabel(item.role) : "—";
    }

    function renderCareTeamRows(teams, patients) {
        if (!teams.length) {
            $("#prd-team-rows").html(emptyRow(4, "No care teams."));
            return;
        }
        $("#prd-team-rows").html(teams.map(function (team) {
            const patientId = refId(team.subject);
            const patient = patients[patientId];
            const patientLabel = patient ? personName(patient) : refLabel(team.subject);
            const patientHtml = patientId
                ? '<a href="#/resources/Patient/' + encodeURIComponent(patientId) + '">' + esc(patientLabel) + "</a>"
                : esc(patientLabel || "—");
            const teamHtml = '<a href="#/resources/CareTeam/' + encodeURIComponent(team.id) + '">' +
                esc(team.name || team.id) + "</a>";
            return "<tr><td>" + patientHtml + "</td><td>" + teamHtml + "</td><td>" + esc(participantRole(team)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-team="' +
                esc(team.id) + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function teamsFromBundle(bundle) {
        const patients = {};
        const teams = [];
        bundleResources(bundle).forEach(function (resource) {
            if (resource.resourceType === "Patient") {
                patients[resource.id] = resource;
            } else if (resource.resourceType === "CareTeam" && practitionerParticipant(resource)) {
                teams.push(resource);
            }
        });
        return { patients: patients, teams: teams };
    }

    function loadCareTeams(ensureId) {
        function apply(bundle) {
            const parsed = teamsFromBundle(bundle);
            if (ensureId && !parsed.teams.some(function (team) { return team.id === ensureId; })) {
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(ensureId)).done(function (team) {
                    parsed.teams.push(team);
                    renderCareTeamRows(parsed.teams, parsed.patients);
                }).fail(function () {
                    renderCareTeamRows(parsed.teams, parsed.patients);
                });
                return;
            }
            renderCareTeamRows(parsed.teams, parsed.patients);
        }

        CadminApi.fhir("/CareTeam?_count=200&_include=CareTeam:subject").done(apply).fail(function () {
            CadminApi.fhir("/CareTeam?_count=200").done(apply).fail(function (xhr) {
                $("#prd-team-rows").html(emptyRow(4, "Unable to load care teams."));
                fail("Load care teams", xhr);
            });
        });
    }

    function toggleCareTeamMode() {
        const isNew = $("#prd-ct-mode-new").is(":checked");
        $("#prd-ct-existing-wrap").toggleClass("d-none", isNew);
        $("#prd-ct-new-wrap").toggleClass("d-none", !isNew);
        $("#prd-ct-team").prop("required", !isNew);
        $("#prd-ct-patient").prop("required", isNew);
        $("#prd-ct-name").prop("required", isNew);
    }

    function loadExistingTeamOptions() {
        const $team = $("#prd-ct-team");
        $team.html('<option value="">Select…</option>');
        CadminApi.fhir("/CareTeam?_count=200&_include=CareTeam:subject").done(function (bundle) {
            const patients = {};
            const teams = [];
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Patient") {
                    patients[resource.id] = resource;
                } else if (resource.resourceType === "CareTeam") {
                    teams.push(resource);
                }
            });
            teams.sort(function (a, b) {
                return (a.name || a.id || "").localeCompare(b.name || b.id || "");
            });
            teams.forEach(function (team) {
                if (practitionerParticipant(team)) {
                    return;
                }
                const patient = patients[refId(team.subject)];
                const patientLabel = patient ? personName(patient) : refLabel(team.subject);
                const label = (team.name || team.id) +
                    (patientLabel && patientLabel !== "—" ? " — " + patientLabel : "");
                $team.append('<option value="' + esc(team.id) + '">' + esc(label) + "</option>");
            });
        }).fail(function () {
            CadminApi.fhir("/CareTeam?_count=200").done(function (bundle) {
                bundleResources(bundle).filter(function (resource) {
                    return resource.resourceType === "CareTeam" && !practitionerParticipant(resource);
                }).sort(function (a, b) {
                    return (a.name || a.id || "").localeCompare(b.name || b.id || "");
                }).forEach(function (team) {
                    const patientLabel = refLabel(team.subject);
                    const label = (team.name || team.id) +
                        (patientLabel && patientLabel !== "—" ? " — " + patientLabel : "");
                    $team.append('<option value="' + esc(team.id) + '">' + esc(label) + "</option>");
                });
            });
        });
    }

    function participantPayload(role) {
        const participant = {
            member: {
                reference: "Practitioner/" + practitioner.id,
                display: personName(practitioner)
            }
        };
        if (role) {
            participant.role = {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
                    code: role.code,
                    display: role.display
                }],
                text: role.display
            };
        }
        return participant;
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

    function resetRoleEditor() {
        editingRole = null;
        $("#prd-role-modal .modal-title").text("Add organization role");
        $("#prd-role-org").val("");
        $("#prd-role-loc").val("");
        $("#prd-role-code").val(practitionerRoles[0].code);
        $("#prd-role-active").prop("checked", true);
    }

    function populateRoleForm() {
        const role = editingRole;
        $("#prd-role-modal .modal-title").text(role ? "Edit organization role" : "Add organization role");
        fillSelect("#prd-role-org", "/Organization?_count=200&_sort=name", function (orgItem) {
            return orgItem.name || orgItem.id;
        }, "Select…", role ? refId(role.organization) : "");
        fillSelect("#prd-role-loc", "/Location?_count=200&_sort=name", function (loc) {
            return loc.name || loc.id;
        }, "None", role ? refId((role.location || [])[0]) : "");
        const code = role ? currentCode(role.code) : practitionerRoles[0].code;
        ensureRoleOption("#prd-role-code", code, role ? conceptLabel(role.code) : "");
        $("#prd-role-active").prop("checked", !role || role.active !== false);
    }

    function openRoleEditor(role) {
        editingRole = role;
        showModal("prd-role-modal");
    }

    function applyRoleFields(resource, organizationId, locationId, roleOption, active) {
        resource.active = active;
        resource.practitioner = {
            reference: "Practitioner/" + practitioner.id,
            display: personName(practitioner)
        };
        if (organizationId) {
            resource.organization = {
                reference: "Organization/" + organizationId,
                display: $("#prd-role-org option:selected").text()
            };
        } else {
            delete resource.organization;
        }
        if (locationId) {
            resource.location = [{
                reference: "Location/" + locationId,
                display: $("#prd-role-loc option:selected").text()
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
        CadminApi.fhir("/PractitionerRole?practitioner=" + encodeURIComponent(practitioner.id) +
            "&_include=PractitionerRole:organization&_include=PractitionerRole:location&_count=50").done(function (bundle) {
            const orgs = {};
            const locs = {};
            const roles = [];
            rolesById = {};
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Organization") {
                    orgs[resource.id] = resource;
                } else if (resource.resourceType === "Location") {
                    locs[resource.id] = resource;
                } else if (resource.resourceType === "PractitionerRole") {
                    roles.push(resource);
                    rolesById[resource.id] = resource;
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
                    '<td class="text-end">' +
                    '<button class="btn btn-sm btn-outline-primary me-1" type="button" data-edit-role="' +
                    esc(role.id) + '" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>' +
                    '<button class="btn btn-sm btn-outline-danger" type="button" data-delete-role="' +
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

        $root.on("click.prdetail", "[data-edit-role]", function () {
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

        $root.on("click.prdetail", "[data-delete-role]", function () {
            const id = $(this).attr("data-delete-role");
            CadminApi.fhir("/PractitionerRole/" + encodeURIComponent(id), "DELETE").done(function () {
                alertMsg("success", "Role removed.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Remove role", xhr);
            });
        });

        $root.on("click.prdetail", "[data-remove-team]", function () {
            const id = $(this).attr("data-remove-team");
            CadminApi.fhir("/CareTeam/" + encodeURIComponent(id)).done(function (team) {
                team.participant = (team.participant || []).filter(function (item) {
                    return !isThisPractitioner(item.member);
                });
                fhirWrite("/CareTeam/" + encodeURIComponent(id), "PUT", team, function () {
                    alertMsg("success", "Removed from care team.");
                    loadCareTeams();
                }, "Remove from care team");
            }).fail(function (xhr) {
                fail("Remove from care team", xhr);
            });
        });

        $root.on("change.prdetail", "input[name='prd-ct-mode']", toggleCareTeamMode);

        $root.on("change.prdetail", "#prd-ct-patient", function () {
            const patientName = $("#prd-ct-patient option:selected").text();
            if (!$("#prd-ct-name").val() && patientName && patientName !== "Select…") {
                $("#prd-ct-name").val(patientName + " care team");
            }
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
            const roleOption = practitionerRoles.find(function (item) {
                return item.code === $("#prd-role-code").val();
            }) || ($("#prd-role-code").val()
                ? { code: $("#prd-role-code").val(), display: $("#prd-role-code option:selected").text() }
                : null);
            const locationId = $("#prd-role-loc").val();
            const active = $("#prd-role-active").is(":checked");
            if (editingRole && editingRole.id) {
                const resource = applyRoleFields($.extend(true, {}, editingRole),
                    organizationId, locationId, roleOption, active);
                CadminApi.fhir("/PractitionerRole/" + encodeURIComponent(editingRole.id), "PUT", resource)
                    .done(function () {
                        hideModal("prd-role-modal");
                        alertMsg("success", "Organization role updated.");
                        loadRoles();
                    }).fail(function (xhr) {
                        fail("Update role", xhr);
                    });
                return;
            }
            const resource = applyRoleFields({ resourceType: "PractitionerRole" },
                organizationId, locationId, roleOption, active);
            CadminApi.fhir("/PractitionerRole", "POST", resource).done(function () {
                hideModal("prd-role-modal");
                alertMsg("success", "Organization role added.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Add role", xhr);
            });
        });

        $("#prd-team-form").on("submit", function (event) {
            event.preventDefault();
            const isNew = $("#prd-ct-mode-new").is(":checked");
            const role = practitionerRoles.find(function (item) { return item.code === $("#prd-ct-role").val(); });
            const participant = participantPayload(role);

            function done(teamId) {
                hideModal("prd-team-modal");
                alertMsg("success", isNew ? "Care team created." : "Added to care team.");
                loadCareTeams(teamId);
            }

            if (!isNew) {
                const teamId = $("#prd-ct-team").val();
                if (!teamId) {
                    alertMsg("danger", "Select an existing care team.");
                    return;
                }
                CadminApi.fhir("/CareTeam/" + encodeURIComponent(teamId)).done(function (team) {
                    team.participant = team.participant || [];
                    if (practitionerParticipant(team)) {
                        alertMsg("danger", "This practitioner is already on that care team.");
                        return;
                    }
                    team.participant.push(participant);
                    fhirWrite("/CareTeam/" + encodeURIComponent(teamId), "PUT", team, function () {
                        done(teamId);
                    }, "Add to care team");
                }).fail(function (xhr) {
                    fail("Add to care team", xhr);
                });
                return;
            }

            const patientId = $("#prd-ct-patient").val();
            const teamName = ($("#prd-ct-name").val() || "").trim();
            if (!patientId) {
                alertMsg("danger", "Select a patient.");
                return;
            }
            if (!teamName) {
                alertMsg("danger", "Enter a care team name.");
                return;
            }
            const resource = {
                resourceType: "CareTeam",
                status: "active",
                name: teamName,
                subject: {
                    reference: "Patient/" + patientId,
                    display: $("#prd-ct-patient option:selected").text()
                },
                participant: [participant]
            };
            fhirWrite("/CareTeam", "POST", resource, function (created, xhr) {
                done((created && created.id) || createdResourceId(xhr, "CareTeam"));
            }, "Create care team");
        });
    }

    return { render: render };
}());
