window.CadminDeviceDetail = (function () {
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
    const nameTypes = [
        { code: "user-friendly-name", display: "User-friendly name" },
        { code: "registered-name", display: "Registered name" },
        { code: "patient-reported-name", display: "Patient-reported name" }
    ];
    const udiEntryTypes = [
        { code: "", display: "Unspecified" },
        { code: "barcode", display: "Barcode" },
        { code: "rfid", display: "RFID" },
        { code: "manual", display: "Manual" },
        { code: "card", display: "Card" },
        { code: "unknown", display: "Unknown" }
    ];

    let device = null;
    let association = null;

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

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
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
        return [given, name.family].filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function nameValue(item) {
        return (item && (item.value || item.name)) || "";
    }

    function deviceNames(resource) {
        return (resource && (resource.name || resource.deviceName)) || [];
    }

    function deviceLabel(resource) {
        const names = deviceNames(resource);
        const preferred = names.find(function (item) { return item.display === true; });
        const friendly = names.find(function (item) { return item.type === "user-friendly-name"; });
        const named = nameValue(preferred || friendly || names[0] || {});
        if (named) {
            return named;
        }
        return [resource.manufacturer, resource.modelNumber].filter(Boolean).join(" ") || resource.id || "Unnamed";
    }

    function nameTypeLabel(code) {
        const match = nameTypes.find(function (item) { return item.code === code; });
        return match ? match.display : (code || "—");
    }

    function dateOnly(value) {
        return (value || "").slice(0, 10);
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "inactive" ? "secondary"
                : status === "entered-in-error" ? "danger"
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

    function typeSelectHtml() {
        const code = currentCode(device.type);
        let html = optionsHtml(typeOptions);
        if (code && !typeOptions.some(function (item) { return item.code === code; })) {
            html += '<option value="' + esc(code) + '">' + esc(conceptLabel(device.type)) + "</option>";
        }
        return html;
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

    function setOrDelete(obj, key, value) {
        if (value) {
            obj[key] = value;
        } else {
            delete obj[key];
        }
    }

    function fillSelect(selector, path, labelFn, excludeId, selectedId) {
        const $select = $(selector);
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle)
                .filter(function (resource) { return resource.id !== excludeId; })
                .map(function (resource) {
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

    function refLink(resourceType, ref, hashPrefix) {
        const id = refId(ref);
        if (!id) {
            return "—";
        }
        const href = hashPrefix
            ? hashPrefix + encodeURIComponent(id)
            : "#/resources/" + resourceType + "/" + encodeURIComponent(id);
        return '<a href="' + href + '">' + esc(refLabel(ref)) + "</a>";
    }

    function render(resource) {
        device = resource;
        if (!device.name && device.deviceName) {
            device.name = device.deviceName;
        }
        delete device.patient;
        const $root = $(CadminWorkspace.root());
        const admin = CadminApp.isAdmin();
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/devices"><i class="bi bi-arrow-left me-1"></i>Devices</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(deviceLabel(device)) + "</h1>" +
                "</div>" +
                CadminResourceSource.button() +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "dev-basic-details", "#dd-basic-modal") + "</div>" +
                '<div class="col-lg-6">' + editCard("Assignment", "dev-assign-details", "#dd-assign-modal") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Names", "dev-name-rows",
                    ["Name", "Type", ""], "#dd-name-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Identifiers", "dev-id-rows",
                    ["System", "Value", ""], "#dd-id-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("UDI carriers", "dev-udi-rows",
                    ["Device identifier", "Carrier", ""], "#dd-udi-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Contacts", "dev-contact-rows",
                    ["System", "Value", ""], "#dd-contact-modal", "Add") + "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("dd-basic-modal", "Edit basic details",
                field("Status", '<select class="form-select" id="dd-status">' + optionsHtml(statusOptions) + "</select>") +
                field("Type", '<select class="form-select" id="dd-type">' + typeSelectHtml() + "</select>") +
                field("Manufacturer", '<input class="form-control" id="dd-manufacturer">') +
                field("Model number", '<input class="form-control" id="dd-model">') +
                field("Serial number", '<input class="form-control" id="dd-serial">') +
                field("Lot number", '<input class="form-control" id="dd-lot">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Manufacture date</label>' +
                    '<input type="date" class="form-control" id="dd-mfg"></div>' +
                    '<div class="col-md-6 mb-3"><label class="form-label">Expiration date</label>' +
                    '<input type="date" class="form-control" id="dd-exp"></div></div>' +
                field("URL", '<input class="form-control" id="dd-url">'),
                "dd-basic-form") +
            modal("dd-assign-modal", "Edit assignment",
                field("Patient", '<select class="form-select" id="dd-patient"><option value="">None</option></select>') +
                (admin
                    ? field("Owner organization", '<select class="form-select" id="dd-owner"><option value="">None</option></select>') +
                      field("Location", '<select class="form-select" id="dd-location"><option value="">None</option></select>')
                    : "") +
                field("Parent device", '<select class="form-select" id="dd-parent"><option value="">None</option></select>'),
                "dd-assign-form") +
            modal("dd-name-modal", "Add name",
                field("Name", '<input class="form-control" id="dd-name-value" required>') +
                field("Type", '<select class="form-select" id="dd-name-type">' + optionsHtml(nameTypes) + "</select>"),
                "dd-name-form") +
            modal("dd-id-modal", "Add identifier",
                field("System", '<input class="form-control" id="dd-id-system">') +
                field("Value", '<input class="form-control" id="dd-id-value" required>'),
                "dd-id-form") +
            modal("dd-udi-modal", "Add UDI carrier",
                field("Device identifier", '<input class="form-control" id="dd-udi-di" required>') +
                field("Carrier HRF", '<input class="form-control" id="dd-udi-hrf">') +
                field("Issuer", '<input class="form-control" id="dd-udi-issuer">') +
                field("Jurisdiction", '<input class="form-control" id="dd-udi-jurisdiction">') +
                field("Entry type", '<select class="form-select" id="dd-udi-entry">' + optionsHtml(udiEntryTypes) + "</select>"),
                "dd-udi-form") +
            modal("dd-contact-modal", "Add contact",
                field("System", '<select class="form-select" id="dd-tel-system">' +
                    '<option value="phone">Phone</option><option value="email">Email</option>' +
                    '<option value="fax">Fax</option><option value="url">URL</option></select>') +
                field("Value", '<input class="form-control" id="dd-tel-value" required>'),
                "dd-contact-form")
        );
        CadminResourceSource.mount(function () { return device; });
        CadminResourceGraph.mount(device);
        renderBasics();
        renderAssignment();
        renderNames();
        renderIdentifiers();
        renderUdi();
        renderContacts();
        loadAssociation();
        bindForms();
    }

    function renderBasics() {
        $("#dev-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(device.status) + "</dd>" +
                '<dt class="col-sm-4">Type</dt><dd class="col-sm-8">' + esc(conceptLabel(device.type)) + "</dd>" +
                '<dt class="col-sm-4">Manufacturer</dt><dd class="col-sm-8">' + esc(device.manufacturer || "—") + "</dd>" +
                '<dt class="col-sm-4">Model</dt><dd class="col-sm-8">' + esc(device.modelNumber || "—") + "</dd>" +
                '<dt class="col-sm-4">Serial</dt><dd class="col-sm-8">' + esc(device.serialNumber || "—") + "</dd>" +
                '<dt class="col-sm-4">Lot</dt><dd class="col-sm-8">' + esc(device.lotNumber || "—") + "</dd>" +
                '<dt class="col-sm-4">Manufactured</dt><dd class="col-sm-8">' + esc(dateOnly(device.manufactureDate) || "—") + "</dd>" +
                '<dt class="col-sm-4">Expires</dt><dd class="col-sm-8">' + esc(dateOnly(device.expirationDate) || "—") + "</dd>" +
                '<dt class="col-sm-4">URL</dt><dd class="col-sm-8">' + esc(device.url || "—") + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(device.id) + "</code></dd>" +
            "</dl>"
        );
        $(".page-title").first().text(deviceLabel(device));
    }

    function renderAssignment() {
        const ownerHref = CadminApp.isAdmin() ? "#/organizations/" : "#/resources/Organization/";
        const locHref = CadminApp.isAdmin() ? "#/locations/" : "#/resources/Location/";
        $("#dev-assign-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Patient</dt><dd class="col-sm-8">' +
                    refLink("Patient", association && association.subject, "#/patients/") + "</dd>" +
                '<dt class="col-sm-4">Owner</dt><dd class="col-sm-8">' +
                    refLink("Organization", device.owner, ownerHref) + "</dd>" +
                '<dt class="col-sm-4">Location</dt><dd class="col-sm-8">' +
                    refLink("Location", device.location, locHref) + "</dd>" +
                '<dt class="col-sm-4">Parent</dt><dd class="col-sm-8">' +
                    refLink("Device", device.parent, "#/devices/") + "</dd>" +
            "</dl>"
        );
    }

    function renderNames() {
        const names = deviceNames(device);
        if (!names.length) {
            $("#dev-name-rows").html(emptyRow(3, "No names."));
            return;
        }
        $("#dev-name-rows").html(names.map(function (item, index) {
            return "<tr><td>" + esc(nameValue(item) || "—") + "</td><td>" + esc(nameTypeLabel(item.type)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="name" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderIdentifiers() {
        const identifiers = device.identifier || [];
        if (!identifiers.length) {
            $("#dev-id-rows").html(emptyRow(3, "No identifiers."));
            return;
        }
        $("#dev-id-rows").html(identifiers.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="identifier" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderUdi() {
        const carriers = device.udiCarrier || [];
        if (!carriers.length) {
            $("#dev-udi-rows").html(emptyRow(3, "No UDI carriers."));
            return;
        }
        $("#dev-udi-rows").html(carriers.map(function (item, index) {
            return "<tr><td>" + esc(item.deviceIdentifier || "—") + "</td><td>" +
                esc(item.carrierHRF || item.entryType || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="udiCarrier" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderContacts() {
        const telecom = device.contact || [];
        if (!telecom.length) {
            $("#dev-contact-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#dev-contact-rows").html(telecom.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="contact" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function refreshLists() {
        renderBasics();
        renderAssignment();
        renderNames();
        renderIdentifiers();
        renderUdi();
        renderContacts();
    }

    function saveDevice(next) {
        delete device.patient;
        delete device.deviceName;
        delete device.distinctIdentifier;
        if (device.name) {
            device.name = device.name.map(function (item) {
                const mapped = {
                    value: nameValue(item),
                    type: item.type === "registered-name" || item.type === "patient-reported-name"
                        ? item.type : "user-friendly-name"
                };
                if (item.display === true) {
                    mapped.display = true;
                }
                return mapped;
            }).filter(function (item) { return item.value; });
            if (!device.name.length) {
                delete device.name;
            }
        }
        if (device.type && !Array.isArray(device.type)) {
            device.type = [device.type];
        }
        CadminApi.fhir("/Device/" + encodeURIComponent(device.id), "PUT", device).done(function (updated) {
            device = updated || device;
            refreshLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update device", xhr);
        });
    }

    function currentAssociation(resource) {
        return resource && resource.resourceType === "DeviceAssociation"
            && resource.status !== "explanted" && resource.status !== "entered-in-error";
    }

    function loadAssociation() {
        CadminApi.fhir("/DeviceAssociation?device=" + encodeURIComponent("Device/" + device.id) + "&_count=50")
            .done(function (bundle) {
                association = bundleResources(bundle).find(currentAssociation) || null;
                renderAssignment();
            }).fail(function () {
                association = null;
                renderAssignment();
            });
    }

    function syncPatientAssociation(patientId, display, next) {
        const currentId = refId(association && association.subject);
        if (!patientId) {
            if (association && association.id) {
                CadminApi.fhir("/DeviceAssociation/" + encodeURIComponent(association.id), "DELETE")
                    .done(function () {
                        association = null;
                        next();
                    }).fail(function (xhr) {
                        fail("Update assignment", xhr);
                    });
                return;
            }
            next();
            return;
        }
        const payload = {
            resourceType: "DeviceAssociation",
            status: "attached",
            device: {
                reference: "Device/" + device.id,
                display: deviceLabel(device)
            },
            subject: {
                reference: "Patient/" + patientId,
                display: display && display !== "None" ? display : undefined
            }
        };
        if (association && association.id) {
            if (currentId === patientId) {
                next();
                return;
            }
            payload.id = association.id;
            CadminApi.fhir("/DeviceAssociation/" + encodeURIComponent(association.id), "PUT", payload)
                .done(function (updated) {
                    association = updated || payload;
                    next();
                }).fail(function (xhr) {
                    fail("Update assignment", xhr);
                });
            return;
        }
        CadminApi.fhir("/DeviceAssociation", "POST", payload).done(function (created) {
            association = created || payload;
            next();
        }).fail(function (xhr) {
            fail("Update assignment", xhr);
        });
    }

    function setReference(obj, key, id, type, display) {
        if (id) {
            obj[key] = { reference: type + "/" + id };
            if (display && display !== "None") {
                obj[key].display = display;
            }
        } else {
            delete obj[key];
        }
    }

    function bindForms() {
        const $root = $(CadminWorkspace.root());
        $root.off(".devdetail");

        $root.on("click.devdetail", "[data-remove]", function () {
            const fieldName = $(this).attr("data-remove");
            const index = Number($(this).attr("data-index"));
            device[fieldName] = (device[fieldName] || []).filter(function (_item, i) { return i !== index; });
            if (!device[fieldName].length) {
                delete device[fieldName];
            }
            saveDevice(function () {
                alertMsg("success", "Removed.");
            });
        });

        $("#dd-basic-modal").on("show.bs.modal", function () {
            $("#dd-status").val(device.status || "active");
            $("#dd-type").val(currentCode(device.type));
            $("#dd-manufacturer").val(device.manufacturer || "");
            $("#dd-model").val(device.modelNumber || "");
            $("#dd-serial").val(device.serialNumber || "");
            $("#dd-lot").val(device.lotNumber || "");
            $("#dd-mfg").val(dateOnly(device.manufactureDate));
            $("#dd-exp").val(dateOnly(device.expirationDate));
            $("#dd-url").val(device.url || "");
        });

        $("#dd-assign-modal").on("show.bs.modal", function () {
            CadminApi.bindPatientSelect("#dd-patient", {
                placeholder: "None",
                selectedId: refId(association && association.subject),
                selectedLabel: refLabel(association && association.subject)
            });
            fillSelect("#dd-parent", "/Device?_count=200", deviceLabel, device.id, refId(device.parent));
            if (CadminApp.isAdmin()) {
                CadminApi.bindOrganizationSelect("#dd-owner", {
                    placeholder: "None",
                    selectedId: refId(device.owner),
                    selectedLabel: refLabel(device.owner)
                });
                fillSelect("#dd-location", "/Location?_count=200&_sort=name", function (loc) {
                    return loc.name || loc.id;
                }, null, refId(device.location));
            }
        });

        $("#dd-basic-form").on("submit", function (event) {
            event.preventDefault();
            device.status = $("#dd-status").val() || "active";
            const typeCode = $("#dd-type").val();
            const type = typeOptions.find(function (item) { return item.code === typeCode; });
            if (type && type.code) {
                device.type = [{
                    coding: [{
                        system: "http://snomed.info/sct",
                        code: type.code,
                        display: type.display
                    }],
                    text: type.display
                }];
            } else if (typeCode && currentCode(device.type) === typeCode) {
                if (device.type && !Array.isArray(device.type)) {
                    device.type = [device.type];
                }
            } else {
                delete device.type;
            }
            setOrDelete(device, "manufacturer", $("#dd-manufacturer").val().trim());
            setOrDelete(device, "modelNumber", $("#dd-model").val().trim());
            setOrDelete(device, "serialNumber", $("#dd-serial").val().trim());
            setOrDelete(device, "lotNumber", $("#dd-lot").val().trim());
            setOrDelete(device, "manufactureDate", $("#dd-mfg").val());
            setOrDelete(device, "expirationDate", $("#dd-exp").val());
            setOrDelete(device, "url", $("#dd-url").val().trim());
            saveDevice(function () {
                hideModal("dd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#dd-assign-form").on("submit", function (event) {
            event.preventDefault();
            const patientId = CadminApi.selectValue("#dd-patient");
            const patientDisplay = CadminApi.selectLabel("#dd-patient");
            setReference(device, "parent", $("#dd-parent").val(), "Device",
                $("#dd-parent option:selected").text());
            if (CadminApp.isAdmin()) {
                setReference(device, "owner", CadminApi.selectValue("#dd-owner"), "Organization",
                    CadminApi.selectLabel("#dd-owner"));
                setReference(device, "location", $("#dd-location").val(), "Location",
                    $("#dd-location option:selected").text());
            }
            saveDevice(function () {
                syncPatientAssociation(patientId, patientDisplay, function () {
                    hideModal("dd-assign-modal");
                    renderAssignment();
                    alertMsg("success", "Assignment updated.");
                });
            });
        });

        $("#dd-name-form").on("submit", function (event) {
            event.preventDefault();
            device.name = deviceNames(device);
            delete device.deviceName;
            device.name.push({
                value: $("#dd-name-value").val().trim(),
                type: $("#dd-name-type").val() || "user-friendly-name"
            });
            if (!device.name.some(function (item) { return item.display === true; })) {
                device.name[device.name.length - 1].display = true;
            }
            saveDevice(function () {
                hideModal("dd-name-modal");
                alertMsg("success", "Name added.");
            });
        });

        $("#dd-id-form").on("submit", function (event) {
            event.preventDefault();
            const identifier = { value: $("#dd-id-value").val().trim() };
            const system = $("#dd-id-system").val().trim();
            if (system) {
                identifier.system = system;
            }
            device.identifier = device.identifier || [];
            device.identifier.push(identifier);
            saveDevice(function () {
                hideModal("dd-id-modal");
                alertMsg("success", "Identifier added.");
            });
        });

        $("#dd-udi-form").on("submit", function (event) {
            event.preventDefault();
            const carrier = { deviceIdentifier: $("#dd-udi-di").val().trim() };
            setOrDelete(carrier, "carrierHRF", $("#dd-udi-hrf").val().trim());
            setOrDelete(carrier, "issuer", $("#dd-udi-issuer").val().trim());
            setOrDelete(carrier, "jurisdiction", $("#dd-udi-jurisdiction").val().trim());
            setOrDelete(carrier, "entryType", $("#dd-udi-entry").val());
            device.udiCarrier = device.udiCarrier || [];
            device.udiCarrier.push(carrier);
            saveDevice(function () {
                hideModal("dd-udi-modal");
                alertMsg("success", "UDI carrier added.");
            });
        });

        $("#dd-contact-form").on("submit", function (event) {
            event.preventDefault();
            device.contact = device.contact || [];
            device.contact.push({
                system: $("#dd-tel-system").val() || "phone",
                value: $("#dd-tel-value").val().trim()
            });
            saveDevice(function () {
                hideModal("dd-contact-modal");
                alertMsg("success", "Contact added.");
            });
        });
    }

    return { render: render };
}());
