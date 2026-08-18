CadminApp.register("patients", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Patient/" + encodeURIComponent(token)).done(function (patient) {
            CadminPatientDetail.render(patient);
        }).fail(function () {
            renderPatientList(token);
        });
        return;
    }
    renderPatientList("");
});

function renderPatientList(initialQuery) {
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
    let pendingPatient = null;
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Patients</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-patient-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New patient</button>' +
        "</div>" +
        '<div id="patient-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Patient search</h6>' +
                '<form class="d-flex" id="patient-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="patient-query" placeholder="Name or identifier" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Name</th><th>Gender</th><th>Birth date</th><th>Status</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="patient-rows"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="patient-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-patient-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-patient-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create patient</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Family name</label>' +
                            '<input class="form-control" id="p-family" required></div>' +
                        '<div class="mb-3"><label class="form-label">Given name</label>' +
                            '<input class="form-control" id="p-given" required></div>' +
                        '<div class="mb-3"><label class="form-label">Gender</label>' +
                            '<select class="form-select" id="p-gender">' +
                                '<option value="unknown">Unknown</option>' +
                                '<option value="female">Female</option>' +
                                '<option value="male">Male</option>' +
                                '<option value="other">Other</option>' +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Birth date</label>' +
                            '<input type="date" class="form-control" id="p-birth"></div>' +
                        '<div class="mb-0"><label class="form-label">SSN</label>' +
                            '<input class="form-control" id="p-ssn" placeholder="000-00-0000"></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="offer-care-team-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<div class="modal-content">' +
                    '<div class="modal-header"><h5 class="modal-title">Create care team?</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<p class="mb-0">Patient <strong id="offer-care-team-name"></strong> was created. Create a care team for this patient?</p>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Not now</button>' +
                        '<button type="button" class="btn btn-primary" id="offer-care-team-yes">Create care team</button>' +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-care-team-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-care-team-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create care team</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Patient</label>' +
                            '<input class="form-control" id="ct-patient-name" readonly>' +
                            '<input type="hidden" id="ct-patient"></div>' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="ct-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="ct-status">' +
                                statusOptions.map(function (option) {
                                    const selected = option.code === "active" ? " selected" : "";
                                    return '<option value="' + option.code + '"' + selected + ">" +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Category</label>' +
                            '<select class="form-select" id="ct-category">' +
                                categoryOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-0"><label class="form-label">Managing organization</label>' +
                            '<select class="form-select" id="ct-organization">' +
                                '<option value="">None</option>' +
                            "</select></div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function patientName(resource) {
        const name = (resource && resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function createdId(body, xhr, resourceType) {
        return CadminApi.createdResourceId(body, xhr, resourceType);
    }

    function hideModal(id, then) {
        const el = document.getElementById(id);
        const modal = bootstrap.Modal.getInstance(el);
        if (!modal) {
            if (then) {
                then();
            }
            return;
        }
        if (then) {
            $(el).one("hidden.bs.modal", then);
        }
        modal.hide();
    }

    function showModal(id) {
        bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
    }

    function categoryByCode(code) {
        return categoryOptions.find(function (option) { return option.code === code; });
    }

    function fillOrganizationSelect() {
        CadminApi.bindOrganizationSelect("#ct-organization", { placeholder: "None" });
    }

    function openCareTeamDialog(patient) {
        $("#ct-patient").val(patient.id);
        $("#ct-patient-name").val(patient.name);
        $("#ct-name").val(patient.name + " care team");
        $("#ct-status").val("active");
        $("#ct-category").val("");
        fillOrganizationSelect();
        showModal("create-care-team-modal");
    }

    function offerCareTeam(patient) {
        pendingPatient = patient;
        $("#offer-care-team-name").text(patient.name);
        showModal("offer-care-team-modal");
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Patient?_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("patients");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Patient");
            CadminApi.renderPager("#patient-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "patients",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#patient-rows").html('<tr><td colspan="6" class="text-muted">No patients found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (p) {
                const active = p.active !== false;
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/patients/" + encodeURIComponent(p.id), patientName(p)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(p.gender || "—") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(p.birthDate || "—") + "</td>" +
                    "<td>" + (active
                        ? '<span class="badge text-bg-success">Active</span>'
                        : '<span class="badge text-bg-secondary">Inactive</span>') + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(p.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/patients/' +
                        encodeURIComponent(p.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#patient-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#patient-pager").empty();
            $("#patient-rows").html('<tr><td colspan="6" class="text-danger">Unable to load patients from /fhir.</td></tr>');
            CadminApi.showAlert("#patient-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#patient-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#patient-query").val());
    });

    $("#create-patient-form").on("submit", function (event) {
        event.preventDefault();
        const given = $("#p-given").val().trim();
        const family = $("#p-family").val().trim();
        const resource = {
            resourceType: "Patient",
            name: [{ family: family, given: given ? [given] : [] }],
            gender: $("#p-gender").val()
        };
        const birth = $("#p-birth").val();
        if (birth) {
            resource.birthDate = birth;
        }
        const ssn = $("#p-ssn").val().trim();
        if (ssn) {
            resource.identifier = [{
                use: "official",
                type: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                        code: "SS",
                        display: "Social Security Number"
                    }],
                    text: "Social Security Number"
                },
                system: "http://hl7.org/fhir/sid/us-ssn",
                value: ssn
            }];
        }
        CadminApi.fhir("/Patient", "POST", resource).done(function (created, _status, xhr) {
            const id = createdId(created, xhr, "Patient");
            const name = (created && patientName(created)) || [given, family].filter(Boolean).join(" ") || id;
            hideModal("create-patient-modal", function () {
                CadminApi.showToast("success", "Patient created.");
                load($("#patient-query").val());
                if (CadminApp.isAdmin() && id) {
                    offerCareTeam({ id: id, name: name });
                }
            });
        }).fail(function (xhr) {
            if (xhr.status >= 200 && xhr.status < 300) {
                const id = createdId(xhr.responseJSON, xhr, "Patient");
                const name = [given, family].filter(Boolean).join(" ") || id;
                hideModal("create-patient-modal", function () {
                    CadminApi.showToast("success", "Patient created.");
                    load($("#patient-query").val());
                    if (CadminApp.isAdmin() && id) {
                        offerCareTeam({ id: id, name: name });
                    }
                });
                return;
            }
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#offer-care-team-yes").on("click", function () {
        const patient = pendingPatient;
        hideModal("offer-care-team-modal", function () {
            if (patient && patient.id) {
                openCareTeamDialog(patient);
            }
        });
    });

    $("#create-care-team-form").on("submit", function (event) {
        event.preventDefault();
        const patientId = $("#ct-patient").val();
        const resource = {
            resourceType: "CareTeam",
            name: $("#ct-name").val(),
            status: $("#ct-status").val() || "active"
        };
        const selected = categoryByCode($("#ct-category").val());
        if (selected && selected.code) {
            resource.category = [{
                coding: [{
                    system: "http://loinc.org",
                    code: selected.code,
                    display: selected.display
                }]
            }];
        }
        if (patientId) {
            resource.subject = {
                reference: "Patient/" + patientId,
                display: $("#ct-patient-name").val()
            };
        }
        const organizationId = CadminApi.selectValue("#ct-organization");
        if (organizationId) {
            resource.managingOrganization = [{
                reference: "Organization/" + organizationId,
                display: CadminApi.selectLabel("#ct-organization")
            }];
        }
        CadminApi.fhir("/CareTeam", "POST", resource).done(function () {
            hideModal("create-care-team-modal");
            CadminApi.showToast("success", "Care team created.");
        }).fail(function (xhr) {
            if (xhr.status >= 200 && xhr.status < 300) {
                hideModal("create-care-team-modal");
                CadminApi.showToast("success", "Care team created.");
                return;
            }
            CadminApi.showToast("danger", "Create care team failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
}
