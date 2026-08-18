CadminApp.register("locations", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Location/" + encodeURIComponent(token)).done(function (location) {
            CadminLocationDetail.render(location);
        }).fail(function () {
            renderLocationList(token);
        });
        return;
    }
    renderLocationList("");
});

function renderLocationList(initialQuery) {
    const statusOptions = [
        { code: "active", display: "Active" },
        { code: "suspended", display: "Suspended" },
        { code: "inactive", display: "Inactive" }
    ];
    const physicalTypes = [
        { code: "", display: "Unspecified" },
        { code: "si", display: "Site" },
        { code: "bu", display: "Building" },
        { code: "wi", display: "Wing" },
        { code: "wa", display: "Ward" },
        { code: "lvl", display: "Level" },
        { code: "ro", display: "Room" },
        { code: "bd", display: "Bed" },
        { code: "ve", display: "Vehicle" },
        { code: "ho", display: "House" },
        { code: "area", display: "Area" }
    ];
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">Locations</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-location-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New location</button>' +
        '</div>' +
        '<div id="location-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Location search</h6>' +
                '<form class="d-flex" id="location-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="location-query" placeholder="Name" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Name</th><th>Organization</th><th>Part of</th><th>Type</th><th>Status</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="location-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
                '<div class="list-pager" id="location-pager"></div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-location-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-location-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create location</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Name</label>' +
                            '<input class="form-control" id="loc-name" required></div>' +
                        '<div class="mb-3"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="loc-status">' +
                                statusOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Physical type</label>' +
                            '<select class="form-select" id="loc-physical">' +
                                physicalTypes.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label">Managing organization</label>' +
                            '<select class="form-select" id="loc-organization"><option value="">None</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Part of</label>' +
                            '<select class="form-select" id="loc-part-of"><option value="">None</option></select></div>' +
                        '<div class="mb-3"><label class="form-label">Address</label>' +
                            '<input class="form-control" id="loc-line" placeholder="Street"></div>' +
                        '<div class="row"><div class="col-md-6 mb-3"><label class="form-label">City</label>' +
                            '<input class="form-control" id="loc-city"></div>' +
                        '<div class="col-md-6 mb-3"><label class="form-label">State</label>' +
                            '<input class="form-control" id="loc-state"></div></div>' +
                        '<div class="d-flex justify-content-between align-items-center mb-2">' +
                            '<span class="form-label mb-0">Position</span>' +
                            '<button class="btn btn-sm btn-outline-primary" type="button" id="loc-lookup">' +
                                '<i class="bi bi-geo-alt me-1"></i>Lookup from address</button>' +
                        "</div>" +
                        '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Latitude</label>' +
                            '<input class="form-control" id="loc-lat"></div>' +
                        '<div class="col-md-6 mb-0"><label class="form-label">Longitude</label>' +
                            '<input class="form-control" id="loc-lng"></div></div>' +
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

    function fillSelect(selector, path, labelFn) {
        const $select = $(selector);
        const previous = $select.val();
        CadminApi.fhir(path).done(function (bundle) {
            const options = ['<option value="">None</option>'].concat((bundle.entry || []).map(function (e) {
                return e.resource;
            }).filter(Boolean).map(function (resource) {
                return '<option value="' + CadminApi.escapeHtml(resource.id) + '">' +
                    CadminApi.escapeHtml(labelFn(resource)) + "</option>";
            }));
            $select.html(options.join(""));
            if (previous && $select.find('option[value="' + previous + '"]').length) {
                $select.val(previous);
            }
        });
    }

    function loadCreateOptions() {
        fillSelect("#loc-organization", "/Organization?_count=200&_sort=name", function (org) {
            return org.name || org.id;
        });
        fillSelect("#loc-part-of", "/Location?_count=200&_sort=name", function (loc) {
            return loc.name || loc.id;
        });
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Location?_sort=-_lastUpdated";
        if (query) {
            path += "&name=" + encodeURIComponent(query);
        }
        CadminApi.fhir(CadminApi.pagedPath(path, listPage)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Location");
            CadminApi.renderPager("#location-pager", {
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#location-rows").html('<tr><td colspan="7" class="text-muted">No locations found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (loc) {
                const kind = loc.status === "active" ? "success" : loc.status === "suspended" ? "warning" : "secondary";
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/locations/" + encodeURIComponent(loc.id), loc.name || "Unnamed") + "</td>" +
                    "<td>" + CadminApi.escapeHtml(refLabel(loc.managingOrganization)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(refLabel(loc.partOf)) + "</td>" +
                    "<td>" + CadminApi.escapeHtml(conceptLabel(loc.form) !== "—"
                        ? conceptLabel(loc.form) : conceptLabel(loc.type)) + "</td>" +
                    "<td><span class=\"badge text-bg-" + kind + '">' + CadminApi.escapeHtml(loc.status || "—") + "</span></td>" +
                    "<td><code>" + CadminApi.escapeHtml(loc.id) + "</code></td>" +
                    '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/locations/' +
                        encodeURIComponent(loc.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a></td>' +
                    "</tr>";
            });
            $("#location-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#location-pager").empty();
            $("#location-rows").html('<tr><td colspan="7" class="text-danger">Unable to load locations from /fhir.</td></tr>');
            CadminApi.showAlert("#location-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#location-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#location-query").val());
    });

    $("#create-location-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "Location",
            name: $("#loc-name").val(),
            status: $("#loc-status").val() || "active"
        };
        const physical = physicalTypes.find(function (option) { return option.code === $("#loc-physical").val(); });
        if (physical && physical.code) {
            resource.form = {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
                    code: physical.code,
                    display: physical.display
                }]
            };
        }
        const orgId = $("#loc-organization").val();
        if (orgId) {
            resource.managingOrganization = {
                reference: "Organization/" + orgId,
                display: $("#loc-organization option:selected").text()
            };
        }
        const partOfId = $("#loc-part-of").val();
        if (partOfId) {
            resource.partOf = {
                reference: "Location/" + partOfId,
                display: $("#loc-part-of option:selected").text()
            };
        }
        const line = $("#loc-line").val();
        const city = $("#loc-city").val();
        const state = $("#loc-state").val();
        if (line || city || state) {
            resource.address = {
                line: line ? [line] : undefined,
                city: city || undefined,
                state: state || undefined
            };
        }
        const lat = $("#loc-lat").val();
        const lng = $("#loc-lng").val();
        if (lat || lng) {
            resource.position = {};
            if (lat) {
                resource.position.latitude = Number(lat);
            }
            if (lng) {
                resource.position.longitude = Number(lng);
            }
        }
        CadminApi.fhir("/Location", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-location-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Location created.");
            load($("#location-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $("#loc-lookup").on("click", function () {
        const fields = {
            line: ($("#loc-line").val() || "").trim(),
            city: ($("#loc-city").val() || "").trim(),
            state: ($("#loc-state").val() || "").trim()
        };
        if (!fields.line && !fields.city && !fields.state) {
            CadminApi.showToast("danger", "Enter an address first.");
            return;
        }
        const $btn = $(this);
        const label = $btn.html();
        $btn.prop("disabled", true)
            .html('<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Looking up…');
        CadminApi.geocode(fields).done(function (result) {
            $("#loc-lat").val(result.latitude);
            $("#loc-lng").val(result.longitude);
            CadminApi.showToast("success", result.displayName
                ? "Coordinates found · " + result.displayName
                : "Coordinates found.");
        }).fail(function (xhr) {
            if (xhr.status === 404) {
                CadminApi.showToast("warning", "No matching location for that address.");
                return;
            }
            CadminApi.showToast("danger", "Lookup coordinates failed (" + xhr.status + ").");
        }).always(function () {
            $btn.prop("disabled", false).html(label);
        });
    });

    $("#create-location-modal").on("show.bs.modal", loadCreateOptions);

    load(initialQuery);
}
