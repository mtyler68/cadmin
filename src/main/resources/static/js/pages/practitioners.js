CadminApp.register("practitioners", function (params) {
    const token = CadminApi.routeParamId(params);
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
    let pendingPractitioner = null;
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Practitioners</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-practitioner-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New practitioner</button>' +
        "</div>" +
        '<div id="practitioner-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Practitioner search</h6>' +
                '<form class="d-flex" id="practitioner-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="practitioner-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Name</th><th>Gender</th><th>Status</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="practitioner-rows"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="practitioner-pager"></div>' +
            "</div>" +
        "</div>" +
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
                        '<div class="form-check mb-0">' +
                            '<input class="form-check-input" type="checkbox" id="pr-active" checked>' +
                            '<label class="form-check-label" for="pr-active">Active</label>' +
                        "</div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="offer-practitioner-role-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<div class="modal-content">' +
                    '<div class="modal-header"><h5 class="modal-title">Create practitioner role?</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<p class="mb-0">Practitioner <strong id="offer-practitioner-role-name"></strong> was created. Create a practitioner role for this practitioner?</p>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Not now</button>' +
                        '<button type="button" class="btn btn-primary" id="offer-practitioner-role-yes">Create practitioner role</button>' +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-practitioner-role-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-practitioner-role-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create practitioner role</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Practitioner</label>' +
                            '<input class="form-control" id="pr-role-practitioner-name" readonly>' +
                            '<input type="hidden" id="pr-role-practitioner"></div>' +
                        '<div class="mb-3"><label class="form-label">Organization</label>' +
                            '<select class="form-select" id="pr-role-org" required><option value="">Select…</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Location</label>' +
                            '<select class="form-select" id="pr-role-loc"><option value="">None</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Role</label>' +
                            '<select class="form-select" id="pr-role-code">' +
                                roleOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="form-check mb-0">' +
                            '<input class="form-check-input" type="checkbox" id="pr-role-active" checked>' +
                            '<label class="form-check-label" for="pr-role-active">Active</label>' +
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

    function fillSelect(selector, path, labelFn, placeholder) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">' + CadminApi.escapeHtml(placeholder || "None") + "</option>"]
                .concat((bundle.entry || []).map(function (e) { return e.resource; }).filter(Boolean).map(function (resource) {
                    return '<option value="' + CadminApi.escapeHtml(resource.id) + '">' +
                        CadminApi.escapeHtml(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
        });
    }

    function openPractitionerRoleDialog(practitioner) {
        $("#pr-role-practitioner").val(practitioner.id);
        $("#pr-role-practitioner-name").val(practitioner.name);
        $("#pr-role-code").val("doctor");
        $("#pr-role-active").prop("checked", true);
        CadminApi.bindOrganizationSelect("#pr-role-org", { placeholder: "Select…" });
        fillSelect("#pr-role-loc", "/Location?_count=200&_sort=name", function (loc) {
            return loc.name || loc.id;
        }, "None");
        showModal("create-practitioner-role-modal");
    }

    function offerPractitionerRole(practitioner) {
        pendingPractitioner = practitioner;
        $("#offer-practitioner-role-name").text(practitioner.name);
        showModal("offer-practitioner-role-modal");
    }

    function afterPractitionerCreated(id, name) {
        hideModal("create-practitioner-modal", function () {
            CadminApi.showToast("success", "Practitioner created.");
            load($("#practitioner-query").val());
            if (CadminApp.isAdmin() && id) {
                offerPractitionerRole({ id: id, name: name });
            }
        });
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Practitioner?_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("practitioners");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Practitioner");
            CadminApi.renderPager("#practitioner-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "practitioners",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#practitioner-rows").html('<tr><td colspan="5" class="text-muted">No practitioners found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (practitioner) {
                const active = practitioner.active !== false;
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/practitioners/" + encodeURIComponent(practitioner.id), personName(practitioner)) + "</td>" +
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
            $("#practitioner-pager").empty();
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
        const given = $("#pr-given").val().trim();
        const family = $("#pr-family").val().trim();
        const resource = {
            resourceType: "Practitioner",
            name: [{ family: family, given: given ? [given] : [] }],
            gender: $("#pr-gender").val(),
            active: $("#pr-active").is(":checked")
        };
        CadminApi.fhir("/Practitioner", "POST", resource).done(function (created, _status, xhr) {
            const id = createdId(created, xhr, "Practitioner");
            const name = (created && personName(created)) || [given, family].filter(Boolean).join(" ") || id;
            afterPractitionerCreated(id, name);
        }).fail(function (xhr) {
            if (xhr.status >= 200 && xhr.status < 300) {
                const id = createdId(xhr.responseJSON, xhr, "Practitioner");
                const name = [given, family].filter(Boolean).join(" ") || id;
                afterPractitionerCreated(id, name);
                return;
            }
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#offer-practitioner-role-yes").on("click", function () {
        const practitioner = pendingPractitioner;
        hideModal("offer-practitioner-role-modal", function () {
            if (practitioner && practitioner.id) {
                openPractitionerRoleDialog(practitioner);
            }
        });
    });

    $("#create-practitioner-role-form").on("submit", function (event) {
        event.preventDefault();
        const practitionerId = $("#pr-role-practitioner").val();
        const organizationId = CadminApi.selectValue("#pr-role-org");
        if (!practitionerId) {
            CadminApi.showToast("danger", "Practitioner is missing.");
            return;
        }
        if (!organizationId) {
            CadminApi.showToast("danger", "Select an organization.");
            return;
        }
        const role = roleOptions.find(function (option) { return option.code === $("#pr-role-code").val(); });
        const resource = {
            resourceType: "PractitionerRole",
            active: $("#pr-role-active").is(":checked"),
            practitioner: {
                reference: "Practitioner/" + practitionerId,
                display: $("#pr-role-practitioner-name").val()
            },
            organization: {
                reference: "Organization/" + organizationId,
                display: CadminApi.selectLabel("#pr-role-org")
            }
        };
        const locationId = $("#pr-role-loc").val();
        if (locationId) {
            resource.location = [{
                reference: "Location/" + locationId,
                display: $("#pr-role-loc option:selected").text()
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
            hideModal("create-practitioner-role-modal");
            CadminApi.showToast("success", "Practitioner role created.");
        }).fail(function (xhr) {
            if (xhr.status >= 200 && xhr.status < 300) {
                hideModal("create-practitioner-role-modal");
                CadminApi.showToast("success", "Practitioner role created.");
                return;
            }
            CadminApi.showToast("danger", "Create practitioner role failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
}
