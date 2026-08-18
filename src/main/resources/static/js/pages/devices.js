CadminApp.register("devices", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Device/" + encodeURIComponent(token)).done(function (device) {
            CadminDeviceDetail.render(device);
        }).fail(function () {
            renderDeviceList(token);
        });
        return;
    }
    renderDeviceList("");
});

function renderDeviceList(initialQuery) {
    const statusOptions = [
        { code: "active", display: "Active" },
        { code: "inactive", display: "Inactive" },
        { code: "entered-in-error", display: "Entered in error" }
    ];
    const typeOptions = [
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
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Devices</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-device-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New device</button>' +
        "</div>" +
        '<div id="device-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Device search</h6>' +
                '<form class="d-flex" id="device-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="device-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Name</th><th>Type</th><th>Manufacturer</th><th>Status</th><th>Patient</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="device-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="device-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-device-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-device-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create device</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="dev-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="dev-status">' +
                                statusOptions.map(function (option) {
                                    const selected = option.code === "active" ? " selected" : "";
                                    return '<option value="' + option.code + '"' + selected + ">" +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Type</label>' +
                            '<select class="form-select" id="dev-type">' +
                                typeOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Manufacturer</label>' +
                            '<input class="form-control" id="dev-manufacturer"></div>' +
                        '<div class="mb-3"><label class="form-label">Model number</label>' +
                            '<input class="form-control" id="dev-model"></div>' +
                        '<div class="mb-3"><label class="form-label">Serial number</label>' +
                            '<input class="form-control" id="dev-serial"></div>' +
                        '<div class="mb-0"><label class="form-label">Patient</label>' +
                            '<select class="form-select" id="dev-patient"><option value="">None</option></select></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

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

    function nameValue(item) {
        return (item && (item.value || item.name)) || "";
    }

    function deviceLabel(resource) {
        const names = resource.name || resource.deviceName || [];
        const preferred = names.find(function (item) { return item.display === true; });
        const friendly = names.find(function (item) { return item.type === "user-friendly-name"; });
        const named = nameValue(preferred || friendly || names[0] || {});
        if (named) {
            return named;
        }
        return [resource.manufacturer, resource.modelNumber].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "inactive" ? "secondary"
                : status === "entered-in-error" ? "danger"
                    : "warning";
        return '<span class="badge text-bg-' + kind + '">' + CadminApi.escapeHtml(status || "—") + "</span>";
    }

    function personName(resource) {
        const name = (resource.name && resource.name[0]) || {};
        const given = (name.given || []).join(" ");
        return [given, name.family].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function fillPatientSelect() {
        const $select = $("#dev-patient");
        const previous = $select.val();
        CadminApi.fhir("/Patient?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">None</option>'].concat((bundle.entry || []).map(function (e) {
                return e.resource;
            }).filter(Boolean).map(function (resource) {
                return '<option value="' + CadminApi.escapeHtml(resource.id) + '">' +
                    CadminApi.escapeHtml(personName(resource)) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function createdId(body, xhr, resourceType) {
        return CadminApi.createdResourceId(body, xhr, resourceType);
    }

    function currentAssociation(resource) {
        return resource && resource.resourceType === "DeviceAssociation"
            && resource.status !== "explanted" && resource.status !== "entered-in-error";
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Device?_sort=-_lastUpdated&_revinclude=DeviceAssociation:device";
        if (query) {
            path += "&device-name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(CadminApi.pagedPath(path, listPage)).done(function (bundle) {
            const resources = CadminApi.bundleResources(bundle);
            const associations = {};
            resources.forEach(function (resource) {
                if (currentAssociation(resource)) {
                    const deviceId = refId(resource.device);
                    if (deviceId) {
                        associations[deviceId] = resource;
                    }
                }
            });
            const entries = resources.filter(function (resource) {
                return resource.resourceType === "Device";
            });
            CadminApi.renderPager("#device-pager", {
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#device-rows").html('<tr><td colspan="7" class="text-muted">No devices found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (device) {
                const association = associations[device.id];
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/devices/" + encodeURIComponent(device.id), deviceLabel(device)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(conceptLabel(device.type)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(device.manufacturer || "—") + "</td>" +
                    "<td>" + statusBadge(device.status) + "</td>" +
                    "<td>" + (refId(association && association.subject)
                        ? CadminApi.resourceLink("#/patients/" + encodeURIComponent(refId(association.subject)),
                            refLabel(association.subject))
                        : "—") + "</td>" +
                    "<td><code>" + CadminApi.escapeHtml(device.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/devices/' +
                        encodeURIComponent(device.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#device-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#device-pager").empty();
            $("#device-rows").html('<tr><td colspan="7" class="text-danger">Unable to load devices from /fhir.</td></tr>');
            CadminApi.showAlert("#device-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#device-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#device-query").val());
    });

    $("#create-device-form").on("submit", function (event) {
        event.preventDefault();
        const patientId = $("#dev-patient").val();
        const patientDisplay = $("#dev-patient option:selected").text();
        const resource = {
            resourceType: "Device",
            status: $("#dev-status").val() || "active",
            name: [{
                value: $("#dev-name").val().trim(),
                type: "user-friendly-name",
                display: true
            }]
        };
        const manufacturer = $("#dev-manufacturer").val().trim();
        const model = $("#dev-model").val().trim();
        const serial = $("#dev-serial").val().trim();
        if (manufacturer) {
            resource.manufacturer = manufacturer;
        }
        if (model) {
            resource.modelNumber = model;
        }
        if (serial) {
            resource.serialNumber = serial;
        }
        const type = typeOptions.find(function (option) { return option.code === $("#dev-type").val(); });
        if (type && type.code) {
            resource.type = [{
                coding: [{
                    system: "http://snomed.info/sct",
                    code: type.code,
                    display: type.display
                }],
                text: type.display
            }];
        }
        function finishCreate() {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-device-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Device created.");
            load($("#device-query").val());
        }
        CadminApi.fhir("/Device", "POST", resource).done(function (created, _status, xhr) {
            const id = createdId(created, xhr, "Device");
            if (patientId && id) {
                CadminApi.fhir("/DeviceAssociation", "POST", {
                    resourceType: "DeviceAssociation",
                    status: "attached",
                    device: {
                        reference: "Device/" + id,
                        display: resource.name[0].value
                    },
                    subject: {
                        reference: "Patient/" + patientId,
                        display: patientDisplay
                    }
                }).always(finishCreate);
                return;
            }
            finishCreate();
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#create-device-modal").on("show.bs.modal", fillPatientSelect);

    load(initialQuery);
}
