window.CadminCareTeamDetail = (function () {
    const statusOptions = [
        { code: "proposed", display: "Proposed" },
        { code: "active", display: "Active" },
        { code: "suspended", display: "Suspended" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const categoryOptions = [
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

    let team = null;

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

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
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

    function teamName(resource) {
        return (resource && resource.name) || (resource && resource.id) || "Unnamed";
    }

    function statusLabel(code) {
        const match = statusOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "inactive" || status === "entered-in-error" ? "secondary"
                : status === "suspended" ? "warning"
                    : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
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

    function memberHref(type, id) {
        if (type === "Patient") {
            return "#/patients/" + encodeURIComponent(id);
        }
        if (type === "RelatedPerson") {
            return "#/caregivers/" + encodeURIComponent(id);
        }
        if (type === "Practitioner") {
            return "#/practitioners/" + encodeURIComponent(id);
        }
        if (type === "Organization") {
            return "#/organizations/" + encodeURIComponent(id);
        }
        return "#/resources/" + encodeURIComponent(type) + "/" + encodeURIComponent(id);
    }

    function membersOfType(type) {
        return (team.participant || []).filter(function (item) {
            return refType(item.member) === type;
        });
    }

    function hasMember(type, id) {
        const reference = type + "/" + id;
        return (team.participant || []).some(function (item) {
            return (item.member && item.member.reference) === reference;
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

    function render(resource) {
        team = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/care-teams">' +
                        '<i class="bi bi-arrow-left me-1"></i>Care Teams</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(teamName(team)) + "</h1>" +
                "</div>" +
                CadminResourceSource.button() +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "ctd-basic-details", "#ctd-basic-modal") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Caregivers", "ctd-caregiver-rows",
                    ["Name", "Role", ""], "#ctd-caregiver-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Practitioners", "ctd-practitioner-rows",
                    ["Name", "Role", ""], "#ctd-practitioner-modal", "Add") + "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("ctd-basic-modal", "Edit basic details",
                field("Name", '<input class="form-control" id="ctd-name" required>') +
                field("Status", '<select class="form-select" id="ctd-status">' +
                    optionsHtml(statusOptions) + "</select>") +
                field("Category", '<select class="form-select" id="ctd-category">' +
                    optionsHtml(categoryOptions) + "</select>") +
                field("Patient", '<select class="form-select" id="ctd-patient">' +
                    '<option value="">None</option></select>') +
                field("Managing organization",
                    '<select class="form-select" id="ctd-org"><option value="">None</option></select>'),
                "ctd-basic-form") +
            modal("ctd-caregiver-modal", "Add caregiver",
                field("Caregiver", '<select class="form-select" id="ctd-cg-person" required>' +
                    '<option value="">Select…</option></select>') +
                field("Role", '<select class="form-select" id="ctd-cg-role">' +
                    optionsHtml(caregiverRoles) + "</select>"),
                "ctd-caregiver-form") +
            modal("ctd-practitioner-modal", "Add practitioner",
                field("Practitioner", '<select class="form-select" id="ctd-pr-person" required>' +
                    '<option value="">Select…</option></select>') +
                field("Role", '<select class="form-select" id="ctd-pr-role">' +
                    optionsHtml(practitionerRoles) + "</select>"),
                "ctd-practitioner-form")
        );
        CadminResourceSource.mount(function () { return team; });
        CadminResourceGraph.mount(team);
        renderBasics();
        renderCaregivers();
        renderPractitioners();
        bindForms();
    }

    function patientHtml() {
        const id = refId(team.subject);
        if (!id) {
            return esc(refLabel(team.subject));
        }
        return '<a href="#/patients/' + encodeURIComponent(id) + '">' + esc(refLabel(team.subject)) + "</a>";
    }

    function orgHtml() {
        const id = refId(team.managingOrganization);
        if (!id) {
            return esc(refLabel(team.managingOrganization));
        }
        return '<a href="#/organizations/' + encodeURIComponent(id) + '">' +
            esc(refLabel(team.managingOrganization)) + "</a>";
    }

    function renderBasics() {
        $("#ctd-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(teamName(team)) + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(team.status) + "</dd>" +
                '<dt class="col-sm-4">Category</dt><dd class="col-sm-8">' + esc(conceptLabel(team.category)) + "</dd>" +
                '<dt class="col-sm-4">Patient</dt><dd class="col-sm-8">' + patientHtml() + "</dd>" +
                '<dt class="col-sm-4">Organization</dt><dd class="col-sm-8">' + orgHtml() + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(team.id) + "</code></dd>" +
            "</dl>"
        );
        $(".page-title").first().text(teamName(team));
    }

    function renderMemberRows(selector, type) {
        const rows = membersOfType(type);
        if (!rows.length) {
            $(selector).html(emptyRow(3, "None."));
            return;
        }
        $(selector).html(rows.map(function (item, index) {
            const id = refId(item.member);
            const name = refLabel(item.member);
            const nameHtml = id
                ? CadminApi.resourceLink(memberHref(type, id), name)
                : esc(name);
            return "<tr><td>" + nameHtml + "</td><td>" + esc(conceptLabel(item.role)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-member="' +
                index + '" data-ref="' + esc((item.member && item.member.reference) || "") +
                '" title="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderCaregivers() {
        renderMemberRows("#ctd-caregiver-rows", "RelatedPerson");
    }

    function renderPractitioners() {
        renderMemberRows("#ctd-practitioner-rows", "Practitioner");
    }

    function refreshLists() {
        renderBasics();
        renderCaregivers();
        renderPractitioners();
    }

    function saveTeam(next) {
        CadminApi.fhir("/CareTeam/" + encodeURIComponent(team.id), "PUT", team).done(function (updated) {
            team = updated || team;
            refreshLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update care team", xhr);
        });
    }

    function addParticipant(participant, done) {
        team.participant = team.participant || [];
        if (hasMember(refType(participant.member), refId(participant.member))) {
            alertMsg("danger", "Already on this care team.");
            return;
        }
        team.participant.push(participant);
        saveTeam(done);
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".ctdetail");

        $root.on("click.ctdetail", "[data-remove-member]", function () {
            const reference = $(this).attr("data-ref");
            team.participant = (team.participant || []).filter(function (item) {
                return (item.member && item.member.reference) !== reference;
            });
            if (!team.participant.length) {
                delete team.participant;
            }
            saveTeam(function () {
                alertMsg("success", "Removed from care team.");
            });
        });

        $("#ctd-basic-modal").on("show.bs.modal", function () {
            $("#ctd-name").val(team.name || "");
            $("#ctd-status").val(team.status || "active");
            $("#ctd-category").val(currentCode(team.category) || "");
            CadminApi.bindPatientSelect("#ctd-patient", {
                placeholder: "None",
                selectedId: refId(team.subject),
                selectedLabel: refLabel(team.subject)
            });
            CadminApi.bindOrganizationSelect("#ctd-org", {
                placeholder: "None",
                selectedId: refId(team.managingOrganization),
                selectedLabel: refLabel(team.managingOrganization)
            });
        });

        $("#ctd-caregiver-modal").on("show.bs.modal", function () {
            CadminApi.bindCaregiverSelect("#ctd-cg-person", { placeholder: "Select…" });
            $("#ctd-cg-role").val("CARGVR");
        });

        $("#ctd-practitioner-modal").on("show.bs.modal", function () {
            CadminApi.bindPractitionerSelect("#ctd-pr-person", { placeholder: "Select…" });
            $("#ctd-pr-role").val("doctor");
        });

        $("#ctd-basic-form").on("submit", function (event) {
            event.preventDefault();
            team.name = $("#ctd-name").val().trim();
            team.status = $("#ctd-status").val() || "active";
            const category = categoryOptions.find(function (item) {
                return item.code === $("#ctd-category").val();
            });
            if (category && category.code) {
                team.category = [{
                    coding: [{ system: "http://loinc.org", code: category.code, display: category.display }]
                }];
            } else {
                delete team.category;
            }
            const patientId = CadminApi.selectValue("#ctd-patient");
            if (patientId) {
                team.subject = {
                    reference: "Patient/" + patientId,
                    display: CadminApi.selectLabel("#ctd-patient")
                };
            } else {
                delete team.subject;
            }
            const orgId = CadminApi.selectValue("#ctd-org");
            if (orgId) {
                team.managingOrganization = [{
                    reference: "Organization/" + orgId,
                    display: CadminApi.selectLabel("#ctd-org")
                }];
            } else {
                delete team.managingOrganization;
            }
            saveTeam(function () {
                hideModal("ctd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#ctd-caregiver-form").on("submit", function (event) {
            event.preventDefault();
            const id = CadminApi.selectValue("#ctd-cg-person");
            if (!id) {
                alertMsg("danger", "Select a caregiver.");
                return;
            }
            const role = caregiverRoles.find(function (item) { return item.code === $("#ctd-cg-role").val(); });
            addParticipant(participantFrom("RelatedPerson", id, CadminApi.selectLabel("#ctd-cg-person"),
                role, "http://terminology.hl7.org/CodeSystem/v3-RoleCode"), function () {
                hideModal("ctd-caregiver-modal");
                alertMsg("success", "Caregiver added.");
            });
        });

        $("#ctd-practitioner-form").on("submit", function (event) {
            event.preventDefault();
            const id = CadminApi.selectValue("#ctd-pr-person");
            if (!id) {
                alertMsg("danger", "Select a practitioner.");
                return;
            }
            const role = practitionerRoles.find(function (item) { return item.code === $("#ctd-pr-role").val(); });
            addParticipant(participantFrom("Practitioner", id, CadminApi.selectLabel("#ctd-pr-person"),
                role, "http://terminology.hl7.org/CodeSystem/practitioner-role"), function () {
                hideModal("ctd-practitioner-modal");
                alertMsg("success", "Practitioner added.");
            });
        });
    }

    return { render: render };
}());
