window.CadminLocationDetail = (function () {
    const statusOptions = [
        { code: "active", display: "Active" },
        { code: "suspended", display: "Suspended" },
        { code: "inactive", display: "Inactive" }
    ];
    const modeOptions = [
        { code: "instance", display: "Instance" },
        { code: "kind", display: "Kind" }
    ];
    const physicalTypes = [
        { code: "", display: "Unspecified" },
        { code: "si", display: "Site" },
        { code: "bu", display: "Building" },
        { code: "wi", display: "Wing" },
        { code: "wa", display: "Ward" },
        { code: "lvl", display: "Level" },
        { code: "co", display: "Corridor" },
        { code: "ro", display: "Room" },
        { code: "bd", display: "Bed" },
        { code: "ve", display: "Vehicle" },
        { code: "ho", display: "House" },
        { code: "ca", display: "Cabinet" },
        { code: "area", display: "Area" },
        { code: "jdn", display: "Jurisdiction" }
    ];
    const serviceTypes = [
        { code: "", display: "Unspecified" },
        { code: "HOSP", display: "Hospital" },
        { code: "ER", display: "Emergency room" },
        { code: "ICU", display: "Intensive care unit" },
        { code: "HU", display: "Hospital unit" },
        { code: "OF", display: "Outpatient facility" },
        { code: "PHARM", display: "Pharmacy" },
        { code: "AMB", display: "Ambulance" },
        { code: "COMM", display: "Community location" }
    ];
    const daysOfWeek = [
        { code: "mon", display: "Mon" },
        { code: "tue", display: "Tue" },
        { code: "wed", display: "Wed" },
        { code: "thu", display: "Thu" },
        { code: "fri", display: "Fri" },
        { code: "sat", display: "Sat" },
        { code: "sun", display: "Sun" }
    ];
    const connectionTypes = [
        { code: "hl7-fhir-rest", display: "HL7 FHIR REST" },
        { code: "hl7-fhir-msg", display: "HL7 FHIR Messaging" },
        { code: "direct-project", display: "Direct Project" },
        { code: "secure-email", display: "Secure email" }
    ];
    const practitionerRoles = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" },
        { code: "teacher", display: "Teacher" },
        { code: "ict", display: "ICT professional" }
    ];

    let loc = null;
    let map = null;

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
        const coding = (item.coding && item.coding[0]) || item;
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
        return [given, name.family].filter(Boolean).join(" ") || (resource && resource.id) || "Unnamed";
    }

    function formatAddress(address) {
        if (!address) {
            return "—";
        }
        return [(address.line || []).join(", "), address.city, address.state, address.postalCode, address.country]
            .filter(Boolean).join(", ") || "—";
    }

    function formatTelecom(list) {
        return (list || []).map(function (item) {
            return [item.system, item.value].filter(Boolean).join(": ");
        }).filter(Boolean).join(" · ") || "—";
    }

    function addressFields(address) {
        const item = address || {};
        return {
            line: ((item.line || [])[0] || "").trim(),
            city: (item.city || "").trim(),
            state: (item.state || "").trim(),
            postalCode: (item.postalCode || "").trim(),
            country: (item.country || "").trim()
        };
    }

    function formAddress() {
        return {
            line: ($("#ld-line").val() || "").trim(),
            city: ($("#ld-city").val() || "").trim(),
            state: ($("#ld-state").val() || "").trim(),
            postalCode: ($("#ld-postal").val() || "").trim(),
            country: ($("#ld-country").val() || "").trim()
        };
    }

    function hasAddress(fields) {
        return !!(fields.line || fields.city || fields.state || fields.postalCode || fields.country);
    }

    function lookupCoordinates(fields, $button) {
        if (!hasAddress(fields)) {
            alertMsg("danger", "Enter an address first.");
            return $.Deferred().reject().promise();
        }
        const label = $button.html();
        $button.prop("disabled", true)
            .html('<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Looking up…');
        return CadminApi.geocode(fields).always(function () {
            $button.prop("disabled", false).html(label);
        });
    }

    function geocodeFail(xhr) {
        if (!xhr || !xhr.status) {
            return;
        }
        if (xhr.status === 404) {
            alertMsg("warning", "No matching location for that address.");
            return;
        }
        fail("Lookup coordinates", xhr);
    }

    function formatPosition(position) {
        if (!position || (position.latitude == null && position.longitude == null)) {
            return "—";
        }
        return [position.latitude, position.longitude, position.altitude].filter(function (v) {
            return v != null && v !== "";
        }).join(", ");
    }

    function positionCoords(position) {
        if (!position || position.latitude == null || position.longitude == null) {
            return null;
        }
        const lat = Number(position.latitude);
        const lng = Number(position.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { lat: lat, lng: lng };
    }

    function destroyMap() {
        if (map) {
            map.remove();
            map = null;
        }
    }

    function renderMap() {
        destroyMap();
        const coords = positionCoords(loc && loc.position);
        const el = document.getElementById("loc-map");
        if (!coords || !el || typeof L === "undefined") {
            return;
        }
        map = L.map(el).setView([coords.lat, coords.lng], 16);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
        }).addTo(map);
        const address = formatAddress(loc.address);
        const popup = address !== "—"
            ? "<strong>" + esc(loc.name || "Location") + "</strong><br>" + esc(address)
            : esc(loc.name || "Location");
        L.marker([coords.lat, coords.lng]).addTo(map).bindPopup(popup);
        setTimeout(function () {
            if (map) {
                map.invalidateSize();
            }
        }, 0);
    }

    function hoursSlot(availability) {
        return (availability && availability.availableTime && availability.availableTime[0]) || availability || {};
    }

    function formatHours(availability) {
        const slot = hoursSlot(availability);
        if (slot.allDay) {
            return "all day";
        }
        const open = slot.availableStartTime || slot.openingTime || "";
        const close = slot.availableEndTime || slot.closingTime || "";
        return (open || close) ? open + "–" + close : "—";
    }

    function codeStatusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "error" ? "danger"
                : status === "limited" || status === "suspended" ? "warning"
                    : "secondary";
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

    function fillSelect(selector, path, labelFn, excludeId) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat(bundleResources(bundle)
                .filter(function (resource) { return resource.id !== excludeId; })
                .map(function (resource) {
                    return '<option value="' + esc(resource.id) + '">' + esc(labelFn(resource)) + "</option>";
                }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function card(title, tableId, cols, addTarget, addLabel, extraHeader) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                '<div class="d-flex gap-2">' +
                    (extraHeader || "") +
                    '<button class="btn btn-sm btn-primary" type="button" data-bs-toggle="modal" data-bs-target="' + addTarget + '">' +
                        '<i class="bi bi-plus-lg me-1"></i>' + addLabel + "</button>" +
                "</div>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle mb-0">' +
                        "<thead><tr>" + cols.map(function (col) { return "<th>" + col + "</th>"; }).join("") + "</tr></thead>" +
                        '<tbody id="' + tableId + '">' + emptyRow(cols.length, "Loading…") + "</tbody>" +
                    "</table>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function editCard(title, bodyId, editTarget, extraHeader) {
        return '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                "<h6 class=\"m-0\">" + title + "</h6>" +
                '<div class="d-flex gap-2">' +
                    (extraHeader || "") +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="' +
                        editTarget + '">Edit</button>' +
                "</div>" +
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

    function coding(system, option) {
        if (!option || !option.code) {
            return undefined;
        }
        return {
            coding: [{ system: system, code: option.code, display: option.display }]
        };
    }

    function findOption(items, code) {
        return items.find(function (item) { return item.code === code; });
    }

    function currentCode(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        return item && item.coding && item.coding[0] ? item.coding[0].code : "";
    }

    function render(resource) {
        destroyMap();
        loc = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/locations"><i class="bi bi-arrow-left me-1"></i>Locations</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(loc.name || "Location") + "</h1>" +
                "</div>" +
                '<a class="btn btn-outline-primary" href="#/resources/Location/' + encodeURIComponent(loc.id) + '">' +
                    '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "loc-basic-details", "#ld-basic-modal") + "</div>" +
                '<div class="col-lg-6">' + editCard("Address and position", "loc-address-details", "#ld-address-modal",
                    '<button class="btn btn-sm btn-outline-secondary" type="button" id="ld-lookup-saved">' +
                        '<i class="bi bi-geo-alt me-1"></i>Lookup coordinates</button>') + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Relationships", "loc-rel-details", "#ld-rel-modal") + "</div>" +
                '<div class="col-lg-6">' + card("Contacts", "loc-contact-rows",
                    ["System", "Value", ""], "#ld-contact-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Sub-locations", "loc-child-rows",
                    ["Name", "Type", "Status", ""], "#ld-child-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Hours of operation", "loc-hours-rows",
                    ["Days", "Hours", ""], "#ld-hours-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Endpoints", "loc-endpoint-rows",
                    ["Name", "Type", "Address", "Status", ""], "#ld-endpoint-modal", "Add",
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#ld-ep-attach-modal">Attach</button>') + "</div>" +
                '<div class="col-lg-6">' + card("Practitioners", "loc-role-rows",
                    ["Practitioner", "Role", "Status", ""], "#ld-role-modal", "Add") + "</div>" +
            "</div>" +
            CadminResourceGraph.card() +
            modal("ld-basic-modal", "Edit basic details",
                field("Name", '<input class="form-control" id="ld-name" required>') +
                field("Status", '<select class="form-select" id="ld-status">' + optionsHtml(statusOptions) + "</select>") +
                field("Mode", '<select class="form-select" id="ld-mode"><option value=""></option>' + optionsHtml(modeOptions) + "</select>") +
                field("Physical type", '<select class="form-select" id="ld-physical">' + optionsHtml(physicalTypes) + "</select>") +
                field("Service type", '<select class="form-select" id="ld-type">' + optionsHtml(serviceTypes) + "</select>") +
                field("Description", '<textarea class="form-control" id="ld-description" rows="2"></textarea>') +
                field("Alias", '<input class="form-control" id="ld-alias" placeholder="Comma-separated">'),
                "ld-basic-form") +
            modal("ld-address-modal", "Edit address and position",
                field("Street", '<input class="form-control" id="ld-line">') +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label><input class="form-control" id="ld-city"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">State</label><input class="form-control" id="ld-state"></div></div>' +
                '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">Postal code</label><input class="form-control" id="ld-postal"></div>' +
                '<div class="col-md-6 mb-3"><label class="form-label">Country</label><input class="form-control" id="ld-country"></div></div>' +
                '<div class="d-flex justify-content-between align-items-center mb-2">' +
                    '<span class="form-label mb-0">Position</span>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" id="ld-lookup-form">' +
                        '<i class="bi bi-geo-alt me-1"></i>Lookup from address</button>' +
                "</div>" +
                '<div class="row"><div class="col-md-4 mb-0"><label class="form-label">Latitude</label><input class="form-control" id="ld-lat"></div>' +
                '<div class="col-md-4 mb-0"><label class="form-label">Longitude</label><input class="form-control" id="ld-lng"></div>' +
                '<div class="col-md-4 mb-0"><label class="form-label">Altitude</label><input class="form-control" id="ld-alt"></div></div>',
                "ld-address-form") +
            modal("ld-rel-modal", "Edit relationships",
                field("Managing organization", '<select class="form-select" id="ld-organization"><option value="">None</option></select>') +
                field("Part of", '<select class="form-select" id="ld-part-of"><option value="">None</option></select>'),
                "ld-rel-form") +
            modal("ld-contact-modal", "Add contact",
                field("System", '<select class="form-select" id="ld-tel-system"><option value="phone">Phone</option><option value="email">Email</option><option value="fax">Fax</option><option value="url">URL</option></select>') +
                field("Value", '<input class="form-control" id="ld-tel-value" required>'),
                "ld-contact-form") +
            modal("ld-child-modal", "Add sub-location",
                field("Name", '<input class="form-control" id="ld-child-name" required>') +
                field("Status", '<select class="form-select" id="ld-child-status">' + optionsHtml(statusOptions) + "</select>") +
                field("Physical type", '<select class="form-select" id="ld-child-physical">' + optionsHtml(physicalTypes) + "</select>"),
                "ld-child-form") +
            modal("ld-hours-modal", "Add hours of operation",
                '<div class="mb-3"><label class="form-label">Days</label><div id="ld-hours-days">' +
                    daysOfWeek.map(function (day) {
                        return '<div class="form-check form-check-inline">' +
                            '<input class="form-check-input" type="checkbox" id="ld-day-' + day.code + '" value="' + day.code + '">' +
                            '<label class="form-check-label" for="ld-day-' + day.code + '">' + day.display + "</label></div>";
                    }).join("") +
                "</div></div>" +
                '<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="ld-hours-allday">' +
                    '<label class="form-check-label" for="ld-hours-allday">All day</label></div>' +
                '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Opens</label><input type="time" class="form-control" id="ld-hours-open"></div>' +
                '<div class="col-md-6 mb-0"><label class="form-label">Closes</label><input type="time" class="form-control" id="ld-hours-close"></div></div>',
                "ld-hours-form") +
            modal("ld-endpoint-modal", "Add endpoint",
                field("Name", '<input class="form-control" id="ld-ep-name" required>') +
                field("Connection type", '<select class="form-select" id="ld-ep-type">' + optionsHtml(connectionTypes) + "</select>") +
                field("Address", '<input class="form-control" id="ld-ep-address" required placeholder="https://example.org/fhir">') +
                field("Status", '<select class="form-select" id="ld-ep-status">' +
                    '<option value="active">Active</option><option value="limited">Limited</option>' +
                    '<option value="suspended">Suspended</option><option value="off">Off</option></select>'),
                "ld-endpoint-form") +
            modal("ld-ep-attach-modal", "Attach endpoint",
                field("Endpoint", '<select class="form-select" id="ld-ep-attach" required><option value="">Select…</option></select>'),
                "ld-ep-attach-form") +
            modal("ld-role-modal", "Add practitioner role",
                field("Practitioner", '<select class="form-select" id="ld-pr-practitioner"><option value="">Select…</option></select>') +
                field("Role", '<select class="form-select" id="ld-pr-role">' + optionsHtml(practitionerRoles) + "</select>"),
                "ld-role-form")
        );
        CadminResourceGraph.mount(loc);
        renderBasics();
        renderAddress();
        renderRelationships();
        renderContacts();
        renderHours();
        loadChildren();
        loadEndpoints();
        loadRoles();
        bindForms();

        $("#ld-rel-modal").on("show.bs.modal", function () {
            CadminApi.bindOrganizationSelect("#ld-organization", {
                placeholder: "None",
                selectedId: refId(loc.managingOrganization),
                selectedLabel: refLabel(loc.managingOrganization)
            });
            fillSelect("#ld-part-of", "/Location?_count=200&_sort=name", function (item) {
                return item.name || item.id;
            }, loc.id);
        });
        $("#ld-ep-attach-modal").on("show.bs.modal", fillEndpointAttach);
        $("#ld-role-modal").on("show.bs.modal", function () {
            CadminApi.bindPractitionerSelect("#ld-pr-practitioner", { placeholder: "Select…" });
        });
        $("#ld-basic-modal").on("show.bs.modal", populateBasicForm);
        $("#ld-address-modal").on("show.bs.modal", populateAddressForm);
        $("#ld-rel-modal").on("shown.bs.modal", populateRelForm);
    }

    function renderBasics() {
        $("#loc-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(loc.name || "—") + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + codeStatusBadge(loc.status) + "</dd>" +
                '<dt class="col-sm-4">Mode</dt><dd class="col-sm-8">' + esc(loc.mode || "—") + "</dd>" +
                '<dt class="col-sm-4">Physical type</dt><dd class="col-sm-8">' + esc(conceptLabel(loc.form || loc.physicalType)) + "</dd>" +
                '<dt class="col-sm-4">Service type</dt><dd class="col-sm-8">' + esc(conceptLabel(loc.type)) + "</dd>" +
                '<dt class="col-sm-4">Description</dt><dd class="col-sm-8">' + esc(loc.description || "—") + "</dd>" +
                '<dt class="col-sm-4">Alias</dt><dd class="col-sm-8">' + esc((loc.alias || []).join(", ") || "—") + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(loc.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function renderAddress() {
        const coords = positionCoords(loc.position);
        $("#loc-address-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Address</dt><dd class="col-sm-8">' + esc(formatAddress(loc.address)) + "</dd>" +
                '<dt class="col-sm-4">Position</dt><dd class="col-sm-8">' + esc(formatPosition(loc.position)) + "</dd>" +
            "</dl>" +
            (coords
                ? '<div id="loc-map" class="location-map mt-3" role="img" aria-label="Map of this location"></div>'
                : "")
        );
        $("#ld-lookup-saved").prop("disabled", !hasAddress(addressFields(loc.address)));
        renderMap();
    }

    function renderRelationships() {
        const orgId = refId(loc.managingOrganization);
        const parentId = refId(loc.partOf);
        const orgHtml = orgId
            ? '<a href="#/organizations/' + encodeURIComponent(orgId) + '">' + esc(refLabel(loc.managingOrganization)) + "</a>"
            : "—";
        const parentHtml = parentId
            ? '<a href="#/locations/' + encodeURIComponent(parentId) + '">' + esc(refLabel(loc.partOf)) + "</a>"
            : "—";
        $("#loc-rel-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Organization</dt><dd class="col-sm-8">' + orgHtml + "</dd>" +
                '<dt class="col-sm-4">Part of</dt><dd class="col-sm-8">' + parentHtml + "</dd>" +
            "</dl>"
        );
    }

    function locationTelecoms() {
        const list = [];
        (loc.contact || []).forEach(function (contact, index) {
            (contact.telecom || []).forEach(function (item) {
                list.push({ index: index, item: item });
            });
        });
        return list;
    }

    function renderContacts() {
        const telecom = locationTelecoms();
        if (!telecom.length) {
            $("#loc-contact-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#loc-contact-rows").html(telecom.map(function (entry) {
            return "<tr><td>" + esc(entry.item.system || "—") + "</td><td>" + esc(entry.item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-contact="' +
                entry.index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderHours() {
        const hours = loc.hoursOfOperation || [];
        if (!hours.length) {
            $("#loc-hours-rows").html(emptyRow(3, "No hours of operation."));
            return;
        }
        $("#loc-hours-rows").html(hours.map(function (item, index) {
            const slot = hoursSlot(item);
            return "<tr><td>" + esc((slot.daysOfWeek || []).join(", ") || "—") + "</td><td>" +
                esc(formatHours(item)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-hours="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function loadChildren() {
        CadminApi.fhir("/Location?partof=" + encodeURIComponent(loc.id) + "&_count=50&_sort=name").done(function (bundle) {
            const rows = bundleResources(bundle);
            if (!rows.length) {
                $("#loc-child-rows").html(emptyRow(4, "No sub-locations."));
                return;
            }
            $("#loc-child-rows").html(rows.map(function (child) {
                return "<tr>" +
                    '<td><a href="#/locations/' + encodeURIComponent(child.id) + '">' + esc(child.name || child.id) + "</a></td>" +
                    "<td>" + esc(conceptLabel(child.form || child.physicalType)) + "</td>" +
                    "<td>" + codeStatusBadge(child.status) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-secondary" type="button" data-unlink-loc="' +
                        esc(child.id) + '">Unlink</button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
            $("#loc-child-rows").html(emptyRow(4, "Unable to load sub-locations."));
            fail("Load sub-locations", xhr);
        });
    }

    function fillEndpointAttach() {
        const linked = (loc.endpoint || []).map(refId).filter(Boolean);
        CadminApi.fhir("/Endpoint?_count=200&_sort=name").done(function (bundle) {
            const options = ['<option value="">Select…</option>'].concat(bundleResources(bundle)
                .filter(function (ep) { return linked.indexOf(ep.id) === -1; })
                .map(function (ep) {
                    const label = (ep.name || ep.id) + (ep.address ? " · " + ep.address : "");
                    return '<option value="' + esc(ep.id) + '">' + esc(label) + "</option>";
                }));
            $("#ld-ep-attach").html(options.join(""));
        });
    }

    function loadEndpoints() {
        const ids = (loc.endpoint || []).map(refId).filter(Boolean);
        if (!ids.length) {
            $("#loc-endpoint-rows").html(emptyRow(5, "No endpoints."));
            return;
        }
        CadminApi.fhir("/Endpoint?_id=" + ids.map(encodeURIComponent).join(",") + "&_count=50").done(function (bundle) {
            const listed = bundleResources(bundle);
            if (!listed.length) {
                $("#loc-endpoint-rows").html(emptyRow(5, "No endpoints."));
                return;
            }
            $("#loc-endpoint-rows").html(listed.map(function (ep) {
                return "<tr>" +
                    '<td><a href="#/endpoints/' + encodeURIComponent(ep.id) + '">' + esc(ep.name || ep.id) + "</a></td>" +
                    "<td>" + esc(conceptLabel(ep.connectionType)) + "</td>" +
                    "<td><code>" + esc(ep.address || "—") + "</code></td>" +
                    "<td>" + codeStatusBadge(ep.status) + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-secondary" type="button" data-unlink-endpoint="' +
                    esc(ep.id) + '" title="Unlink" aria-label="Unlink"><i class="bi bi-x-lg"></i></button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
            $("#loc-endpoint-rows").html(emptyRow(5, "Unable to load endpoints."));
            fail("Load endpoints", xhr);
        });
    }

    function loadRoles() {
        CadminApi.fhir("/PractitionerRole?location=" + encodeURIComponent(loc.id) +
            "&_include=PractitionerRole:practitioner&_count=50").done(function (bundle) {
            const practitioners = {};
            const roles = [];
            bundleResources(bundle).forEach(function (resource) {
                if (resource.resourceType === "Practitioner") {
                    practitioners[resource.id] = resource;
                } else if (resource.resourceType === "PractitionerRole") {
                    roles.push(resource);
                }
            });
            if (!roles.length) {
                $("#loc-role-rows").html(emptyRow(4, "No practitioners at this location."));
                return;
            }
            $("#loc-role-rows").html(roles.map(function (role) {
                const prId = refId(role.practitioner);
                const practitioner = practitioners[prId] || {};
                const name = personName(practitioner) !== "Unnamed" ? personName(practitioner) : refLabel(role.practitioner);
                const nameHtml = prId
                    ? '<a href="#/practitioners/' + encodeURIComponent(prId) + '">' + esc(name) + "</a>"
                    : esc(name);
                return "<tr><td>" + nameHtml + "</td><td>" + esc(conceptLabel(role.code)) + "</td><td>" +
                    codeStatusBadge(role.active === false ? "inactive" : "active") + "</td>" +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-delete="/PractitionerRole/' +
                    encodeURIComponent(role.id) + '" data-reload="roles" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
            }).join(""));
        }).fail(function (xhr) {
            $("#loc-role-rows").html(emptyRow(4, "Unable to load practitioners."));
            fail("Load practitioners", xhr);
        });
    }

    function saveLoc(next) {
        delete loc.telecom;
        delete loc.physicalType;
        delete loc.availabilityExceptions;
        CadminApi.fhir("/Location/" + encodeURIComponent(loc.id), "PUT", loc).done(function (updated) {
            loc = updated;
            renderBasics();
            renderAddress();
            renderRelationships();
            renderContacts();
            renderHours();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update location", xhr);
        });
    }

    function populateBasicForm() {
        $("#ld-name").val(loc.name || "");
        $("#ld-status").val(loc.status || "active");
        $("#ld-mode").val(loc.mode || "");
        $("#ld-physical").val(currentCode(loc.form || loc.physicalType));
        $("#ld-type").val(currentCode(loc.type));
        $("#ld-description").val(loc.description || "");
        $("#ld-alias").val((loc.alias || []).join(", "));
    }

    function populateAddressForm() {
        const address = loc.address || {};
        $("#ld-line").val((address.line || [])[0] || "");
        $("#ld-city").val(address.city || "");
        $("#ld-state").val(address.state || "");
        $("#ld-postal").val(address.postalCode || "");
        $("#ld-country").val(address.country || "");
        const position = loc.position || {};
        $("#ld-lat").val(position.latitude != null ? position.latitude : "");
        $("#ld-lng").val(position.longitude != null ? position.longitude : "");
        $("#ld-alt").val(position.altitude != null ? position.altitude : "");
    }

    function populateRelForm() {
        const parentId = refId(loc.partOf);
        if (parentId) {
            $("#ld-part-of").val(parentId);
        }
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".locdetail");

        $root.on("click.locdetail", "[data-delete]", function () {
            const path = $(this).attr("data-delete");
            CadminApi.fhir(path, "DELETE").done(function () {
                alertMsg("success", "Removed.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Remove", xhr);
            });
        });

        $root.on("click.locdetail", "[data-unlink-endpoint]", function () {
            const id = $(this).attr("data-unlink-endpoint");
            loc.endpoint = (loc.endpoint || []).filter(function (ref) {
                return refId(ref) !== id;
            });
            if (!loc.endpoint.length) {
                delete loc.endpoint;
            }
            saveLoc(function () {
                alertMsg("success", "Endpoint unlinked.");
                loadEndpoints();
            });
        });

        $root.on("click.locdetail", "[data-unlink-loc]", function () {
            const id = $(this).attr("data-unlink-loc");
            CadminApi.fhir("/Location/" + encodeURIComponent(id)).done(function (child) {
                delete child.partOf;
                CadminApi.fhir("/Location/" + encodeURIComponent(id), "PUT", child).done(function () {
                    alertMsg("success", "Sub-location unlinked.");
                    loadChildren();
                }).fail(function (xhr) {
                    fail("Unlink", xhr);
                });
            }).fail(function (xhr) {
                fail("Unlink", xhr);
            });
        });

        $root.on("click.locdetail", "[data-remove-contact]", function () {
            const index = Number($(this).attr("data-remove-contact"));
            loc.contact = (loc.contact || []).filter(function (_item, i) { return i !== index; });
            if (!loc.contact.length) {
                delete loc.contact;
            }
            saveLoc(function () {
                alertMsg("success", "Contact removed.");
            });
        });

        $root.on("click.locdetail", "#ld-lookup-saved", function () {
            const $btn = $(this);
            lookupCoordinates(addressFields(loc.address), $btn).done(function (result) {
                loc.position = loc.position || {};
                loc.position.latitude = result.latitude;
                loc.position.longitude = result.longitude;
                saveLoc(function () {
                    alertMsg("success", result.displayName
                        ? "Coordinates set · " + result.displayName
                        : "Coordinates set.");
                });
            }).fail(geocodeFail);
        });

        $root.on("click.locdetail", "#ld-lookup-form", function () {
            const $btn = $(this);
            lookupCoordinates(formAddress(), $btn).done(function (result) {
                $("#ld-lat").val(result.latitude);
                $("#ld-lng").val(result.longitude);
                alertMsg("success", result.displayName
                    ? "Coordinates found · " + result.displayName
                    : "Coordinates found.");
            }).fail(geocodeFail);
        });

        $root.on("click.locdetail", "[data-remove-hours]", function () {
            const index = Number($(this).attr("data-remove-hours"));
            loc.hoursOfOperation = (loc.hoursOfOperation || []).filter(function (_item, i) { return i !== index; });
            saveLoc(function () {
                alertMsg("success", "Hours removed.");
            });
        });

        $("#ld-basic-form").on("submit", function (event) {
            event.preventDefault();
            loc.name = $("#ld-name").val();
            loc.status = $("#ld-status").val() || "active";
            const mode = $("#ld-mode").val();
            if (mode) {
                loc.mode = mode;
            } else {
                delete loc.mode;
            }
            const physical = coding("http://terminology.hl7.org/CodeSystem/location-physical-type",
                findOption(physicalTypes, $("#ld-physical").val()));
            if (physical) {
                loc.form = physical;
            } else {
                delete loc.form;
            }
            const service = coding("http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                findOption(serviceTypes, $("#ld-type").val()));
            if (service) {
                loc.type = [service];
            } else {
                delete loc.type;
            }
            const description = $("#ld-description").val();
            if (description) {
                loc.description = description;
            } else {
                delete loc.description;
            }
            const alias = $("#ld-alias").val().split(",").map(function (item) { return item.trim(); }).filter(Boolean);
            if (alias.length) {
                loc.alias = alias;
            } else {
                delete loc.alias;
            }
            saveLoc(function () {
                hideModal("ld-basic-modal");
                alertMsg("success", "Basic details updated.");
                $(".page-title").first().text(loc.name || "Location");
            });
        });

        $("#ld-address-form").on("submit", function (event) {
            event.preventDefault();
            const line = $("#ld-line").val();
            const city = $("#ld-city").val();
            const state = $("#ld-state").val();
            const postal = $("#ld-postal").val();
            const country = $("#ld-country").val();
            if (line || city || state || postal || country) {
                loc.address = {
                    line: line ? [line] : undefined,
                    city: city || undefined,
                    state: state || undefined,
                    postalCode: postal || undefined,
                    country: country || undefined
                };
            } else {
                delete loc.address;
            }
            const lat = $("#ld-lat").val();
            const lng = $("#ld-lng").val();
            const alt = $("#ld-alt").val();
            if (lat || lng || alt) {
                loc.position = {};
                if (lat) {
                    loc.position.latitude = Number(lat);
                }
                if (lng) {
                    loc.position.longitude = Number(lng);
                }
                if (alt) {
                    loc.position.altitude = Number(alt);
                }
            } else {
                delete loc.position;
            }
            saveLoc(function () {
                hideModal("ld-address-modal");
                alertMsg("success", "Address updated.");
            });
        });

        $("#ld-rel-form").on("submit", function (event) {
            event.preventDefault();
            const orgId = CadminApi.selectValue("#ld-organization");
            if (orgId) {
                loc.managingOrganization = {
                    reference: "Organization/" + orgId,
                    display: CadminApi.selectLabel("#ld-organization")
                };
            } else {
                delete loc.managingOrganization;
            }
            const parentId = $("#ld-part-of").val();
            if (parentId) {
                loc.partOf = {
                    reference: "Location/" + parentId,
                    display: $("#ld-part-of option:selected").text()
                };
            } else {
                delete loc.partOf;
            }
            saveLoc(function () {
                hideModal("ld-rel-modal");
                alertMsg("success", "Relationships updated.");
            });
        });

        $("#ld-contact-form").on("submit", function (event) {
            event.preventDefault();
            loc.contact = loc.contact || [];
            loc.contact.push({
                telecom: [{
                    system: $("#ld-tel-system").val(),
                    value: $("#ld-tel-value").val()
                }]
            });
            saveLoc(function () {
                hideModal("ld-contact-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#ld-child-form").on("submit", function (event) {
            event.preventDefault();
            const resource = {
                resourceType: "Location",
                name: $("#ld-child-name").val(),
                status: $("#ld-child-status").val() || "active",
                partOf: { reference: "Location/" + loc.id, display: loc.name }
            };
            if (loc.managingOrganization) {
                resource.managingOrganization = loc.managingOrganization;
            }
            const physical = coding("http://terminology.hl7.org/CodeSystem/location-physical-type",
                findOption(physicalTypes, $("#ld-child-physical").val()));
            if (physical) {
                resource.form = physical;
            }
            CadminApi.fhir("/Location", "POST", resource).done(function () {
                hideModal("ld-child-modal");
                alertMsg("success", "Sub-location created.");
                loadChildren();
            }).fail(function (xhr) {
                fail("Create sub-location", xhr);
            });
        });

        $("#ld-hours-form").on("submit", function (event) {
            event.preventDefault();
            const selectedDays = daysOfWeek.map(function (day) { return day.code; }).filter(function (code) {
                return $("#ld-day-" + code).is(":checked");
            });
            const slot = { daysOfWeek: selectedDays };
            if ($("#ld-hours-allday").is(":checked")) {
                slot.allDay = true;
            } else {
                const open = $("#ld-hours-open").val();
                const close = $("#ld-hours-close").val();
                if (open) {
                    slot.availableStartTime = open + (open.length === 5 ? ":00" : "");
                }
                if (close) {
                    slot.availableEndTime = close + (close.length === 5 ? ":00" : "");
                }
            }
            loc.hoursOfOperation = loc.hoursOfOperation || [];
            loc.hoursOfOperation.push({ availableTime: [slot] });
            saveLoc(function () {
                hideModal("ld-hours-modal");
                alertMsg("success", "Hours added.");
            });
        });

        $("#ld-ep-attach-form").on("submit", function (event) {
            event.preventDefault();
            const id = $("#ld-ep-attach").val();
            if (!id) {
                return;
            }
            const label = ($("#ld-ep-attach option:selected").text() || "").split(" · ")[0];
            loc.endpoint = loc.endpoint || [];
            loc.endpoint.push({
                reference: "Endpoint/" + id,
                display: label
            });
            saveLoc(function () {
                hideModal("ld-ep-attach-modal");
                alertMsg("success", "Endpoint attached.");
                loadEndpoints();
            });
        });

        $("#ld-endpoint-form").on("submit", function (event) {
            event.preventDefault();
            const conn = findOption(connectionTypes, $("#ld-ep-type").val());
            const resource = {
                resourceType: "Endpoint",
                status: $("#ld-ep-status").val() || "active",
                name: $("#ld-ep-name").val(),
                address: $("#ld-ep-address").val(),
                connectionType: [{
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                        code: conn ? conn.code : "hl7-fhir-rest",
                        display: conn ? conn.display : "HL7 FHIR REST"
                    }]
                }],
                payload: [{
                    type: [{
                        coding: [{
                            system: "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                            code: "any",
                            display: "Any"
                        }]
                    }]
                }]
            };
            if (loc.managingOrganization) {
                resource.managingOrganization = loc.managingOrganization;
            }
            CadminApi.fhir("/Endpoint", "POST", resource).done(function (created) {
                loc.endpoint = loc.endpoint || [];
                loc.endpoint.push({ reference: "Endpoint/" + created.id, display: created.name });
                saveLoc(function () {
                    hideModal("ld-endpoint-modal");
                    alertMsg("success", "Endpoint created.");
                    loadEndpoints();
                });
            }).fail(function (xhr) {
                fail("Create endpoint", xhr);
            });
        });

        $("#ld-role-form").on("submit", function (event) {
            event.preventDefault();
            const practitionerId = CadminApi.selectValue("#ld-pr-practitioner");
            if (!practitionerId) {
                alertMsg("danger", "Select a practitioner.");
                return;
            }
            const role = findOption(practitionerRoles, $("#ld-pr-role").val());
            const resource = {
                resourceType: "PractitionerRole",
                active: true,
                practitioner: {
                    reference: "Practitioner/" + practitionerId,
                    display: CadminApi.selectLabel("#ld-pr-practitioner")
                },
                location: [{ reference: "Location/" + loc.id, display: loc.name }]
            };
            if (loc.managingOrganization) {
                resource.organization = loc.managingOrganization;
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
                hideModal("ld-role-modal");
                alertMsg("success", "Practitioner role created.");
                loadRoles();
            }).fail(function (xhr) {
                fail("Create practitioner role", xhr);
            });
        });
    }

    $(window).on("hashchange.locmap", destroyMap);

    return { render: render };
}());
