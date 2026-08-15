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
        CadminApi.showAlert("#cgd-detail-alert", type, message);
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
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/caregivers"><i class="bi bi-arrow-left me-1"></i>Caregivers</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(personName(caregiver)) + "</h1>" +
                "</div>" +
                '<a class="btn btn-outline-primary" href="#/resources/RelatedPerson/' + encodeURIComponent(caregiver.id) + '">' +
                    '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
            "</div>" +
            '<div id="cgd-detail-alert" class="alert d-none"></div>' +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "cgd-basic-details", "#cgd-basic-modal") + "</div>" +
                '<div class="col-lg-6">' + card("Identifiers", "cgd-id-rows",
                    ["System", "Value", ""], "#cgd-id-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Contacts", "cgd-telecom-rows",
                    ["System", "Value", ""], "#cgd-telecom-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Addresses", "cgd-address-rows",
                    ["Address", ""], "#cgd-address-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Languages", "cgd-lang-rows",
                    ["Language", ""], "#cgd-lang-modal", "Add") + "</div>" +
                (isAdmin()
                    ? '<div class="col-lg-6">' + card("Patients", "cgd-team-rows",
                        ["Patient", "Care team", "Role", ""], "#cgd-team-modal", "Add") + "</div>"
                    : "") +
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

        renderBasics();
        renderIdentifiers();
        renderTelecom();
        renderAddresses();
        renderLanguages();
        bindForms();
        if (isAdmin()) {
            loadCareTeams();
            $("#cgd-team-modal").on("show.bs.modal", function () {
                fillSelect("#cgd-ct-patient", "/Patient?_count=200&_sort=name", personName, "Select…");
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
        $(".page-title").first().text(personName(caregiver));
    }

    function renderIdentifiers() {
        const items = caregiver.identifier || [];
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
            return "<tr><td>" + esc(conceptLabel(item)) + "</td>" +
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
            if (!teams.length) {
                $("#cgd-team-rows").html(emptyRow(4, "No patients via care teams."));
                return;
            }
            $("#cgd-team-rows").html(teams.map(function (team) {
                const patientId = refId(team.subject);
                const patient = patients[patientId];
                const patientName = patient ? personName(patient) : refLabel(team.subject);
                const patientHtml = patientId
                    ? '<a href="#/resources/Patient/' + encodeURIComponent(patientId) + '">' + esc(patientName) + "</a>"
                    : esc(patientName || "—");
                const teamHtml = '<a href="#/resources/CareTeam/' + encodeURIComponent(team.id) + '">' +
                    esc(team.name || team.id) + "</a>";
                return "<tr><td>" + patientHtml + "</td><td>" + teamHtml + "</td><td>" + esc(participantRole(team)) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-team="' +
                    esc(team.id) + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
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
            participant.role = [{
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    code: role.code,
                    display: role.display
                }],
                text: role.display
            }];
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
            const patientName = $("#cgd-ct-patient option:selected").text();
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
            const patientId = $("#cgd-ct-patient").val();
            if (!patientId) {
                alertMsg("danger", "Select a patient.");
                return;
            }
            const role = participantRoles.find(function (item) { return item.code === $("#cgd-ct-role").val(); });
            const teamId = $("#cgd-ct-team").val();
            const patientDisplay = $("#cgd-ct-patient option:selected").text();
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
