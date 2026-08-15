CadminApp.register("practitioners", function (params) {
    const token = params[0] ? decodeURIComponent(params[0]) : "";
    if (token) {
        CadminApi.fhir("/Practitioner/" + encodeURIComponent(token)).done(function (practitioner) {
            CadminPractitionerDetail.render(practitioner);
        }).fail(function () {
            renderPractitionerList(token);
        });
        return;
    }
    renderPractitionerList("");
});

function renderPractitionerList(initialQuery) {
    const roleOptions = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" },
        { code: "teacher", display: "Teacher" },
        { code: "ict", display: "ICT professional" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Practitioners</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-practitioner-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New practitioner</button>' +
        '</div>' +
        '<div id="practitioner-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Practitioner search</h6>' +
                '<form class="d-flex" id="practitioner-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="practitioner-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Gender</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="practitioner-rows"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-practitioner-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-practitioner-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create practitioner</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Family name</label>' +
                            '<input class="form-control" id="pr-family" required></div>' +
                        '<div class="mb-3"><label class="form-label">Given name</label>' +
                            '<input class="form-control" id="pr-given" required></div>' +
                        '<div class="mb-3"><label class="form-label">Gender</label>' +
                            '<select class="form-select" id="pr-gender">' +
                                '<option value="unknown">Unknown</option>' +
                                '<option value="female">Female</option>' +
                                '<option value="male">Male</option>' +
                                '<option value="other">Other</option>' +
                            "</select></div>" +
                        '<div class="form-check mb-3">' +
                            '<input class="form-check-input" type="checkbox" id="pr-active" checked>' +
                            '<label class="form-check-label" for="pr-active">Active</label>' +
                        "</div>" +
                        '<div id="pr-role-section"' + (CadminApp.isAdmin() ? "" : ' class="d-none"') + ">" +
                        '<hr>' +
                        '<h6 class="mb-3">Initial organization role</h6>' +
                        '<div class="mb-3"><label class="form-label">Organization</label>' +
                            '<select class="form-select" id="pr-organization">' +
                                '<option value="">None</option>' +
                            "</select></div>" +
                        '<div class="mb-0"><label class="form-label">Role</label>' +
                            '<select class="form-select" id="pr-role">' +
                                roleOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        "</div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function personName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function loadOrganizationOptions() {
        const $select = $("#pr-organization");
        const previous = $select.val();
        CadminApi.fhir("/Organization?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">None</option>'].concat((bundle.entry || []).map(function (e) {
                return e.resource;
            }).filter(Boolean).map(function (org) {
                return '<option value="' + CadminApi.escapeHtml(org.id) + '">' +
                    CadminApi.escapeHtml(org.name || org.id) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function createPractitionerRole(practitioner, done) {
        const organizationId = $("#pr-organization").val();
        if (!organizationId) {
            done(false);
            return;
        }
        const role = roleOptions.find(function (option) { return option.code === $("#pr-role").val(); });
        const resource = {
            resourceType: "PractitionerRole",
            active: true,
            practitioner: {
                reference: "Practitioner/" + practitioner.id,
                display: personName(practitioner)
            },
            organization: {
                reference: "Organization/" + organizationId,
                display: $("#pr-organization option:selected").text()
            }
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
            done(true);
        }).fail(function (xhr) {
            CadminApi.showAlert("#practitioner-alert", "warning",
                "Practitioner created, but organization role failed (" + xhr.status + ").");
            done(null);
        });
    }

    function load(query) {
        let path = "/Practitioner?_count=50&_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(path).done(function (bundle) {
            const entries = (bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean);
            if (!entries.length) {
                $("#practitioner-rows").html('<tr><td colspan="5" class="text-muted">No practitioners found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (practitioner) {
                const active = practitioner.active !== false;
                return "<tr>" +
                    "<td>" + CadminApi.escapeHtml(personName(practitioner)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(practitioner.gender || "—") + "</td>" +
                    "<td>" + (active
                        ? '<span class="badge text-bg-success">Active</span>'
                        : '<span class="badge text-bg-secondary">Inactive</span>') + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(practitioner.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/practitioners/' +
                        encodeURIComponent(practitioner.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#practitioner-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#practitioner-rows").html('<tr><td colspan="5" class="text-danger">Unable to load practitioners from /fhir.</td></tr>');
            CadminApi.showAlert("#practitioner-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#practitioner-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#practitioner-query").val());
    });

    $("#create-practitioner-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "Practitioner",
            name: [{ family: $("#pr-family").val(), given: [$("#pr-given").val()] }],
            gender: $("#pr-gender").val(),
            active: $("#pr-active").is(":checked")
        };
        CadminApi.fhir("/Practitioner", "POST", resource).done(function (created) {
            createPractitionerRole(created, function (assigned) {
                const modal = bootstrap.Modal.getInstance(document.getElementById("create-practitioner-modal"));
                if (modal) {
                    modal.hide();
                }
                if (assigned === true) {
                    CadminApi.showAlert("#practitioner-alert", "success",
                        "Practitioner created and assigned to the organization.");
                } else if (assigned === false) {
                    CadminApi.showAlert("#practitioner-alert", "success", "Practitioner created.");
                }
                load($("#practitioner-query").val());
            });
        }).fail(function (xhr) {
            CadminApi.showAlert("#practitioner-alert", "danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#create-practitioner-modal").on("show.bs.modal", loadOrganizationOptions);

    load(initialQuery);
}
