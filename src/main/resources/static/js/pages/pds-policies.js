CadminApp.register("pds-policies", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Library/" + encodeURIComponent(token)).done(function (library) {
            CadminPdsPolicyDetail.render(library);
        }).fail(function () {
            renderPdsPolicyList(token);
        });
        return;
    }
    renderPdsPolicyList("");
});

function renderPdsPolicyList(initialQuery) {
    const libraryType = "pds-policies";
    const policyContentType = "application/x-policy+x-yaml";
    const statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "retired", display: "Retired" },
        { code: "unknown", display: "Unknown" }
    ];
    let duplicateSource = null;
    const $root = $("#app-content");
    $root.html(
        '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
            '<h1 class="h3 mb-0 page-title">PDS Policies</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-pds-policy-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New policy</button>' +
        '</div>' +
        '<div id="pds-policy-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Policy search</h6>' +
                '<form class="d-flex" id="pds-policy-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="pds-policy-query" placeholder="Title" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                '</form>' +
            '</div>' +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        '<thead><tr><th>Title</th><th>Description</th><th>Version</th><th>Status</th><th>Name</th><th>ID</th><th></th></tr></thead>' +
                        '<tbody id="pds-policy-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    '</table>' +
                '</div>' +
                '<div class="list-pager" id="pds-policy-pager"></div>' +
            '</div>' +
        '</div>' +
        '<div class="modal fade" id="create-pds-policy-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-pds-policy-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create PDS policy</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label">Title</label>' +
                            '<input class="form-control" id="pds-title" required></div>' +
                        '<div class="mb-3"><label class="form-label">Description</label>' +
                            '<textarea class="form-control" id="pds-description" rows="3"></textarea></div>' +
                        '<div class="mb-0"><label class="form-label">Status</label>' +
                            '<select class="form-select" id="pds-status">' +
                                statusOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' + CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="duplicate-pds-policy-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="duplicate-pds-policy-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Duplicate PDS policy</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div id="dup-alert" class="alert d-none"></div>' +
                        '<p class="mb-3">Create a new draft from <strong id="dup-source-title"></strong>.</p>' +
                        '<div class="mb-3"><label class="form-label">Current version</label>' +
                            '<div><code id="dup-source-version"></code></div></div>' +
                        '<div class="mb-3"><label class="form-label" for="dup-version">New version</label>' +
                            '<input class="form-control" id="dup-version" required placeholder="e.g. 1.0.1">' +
                            '<div class="form-text">Must be a semantic version greater than the policy being duplicated.</div>' +
                            '<div class="invalid-feedback" id="dup-version-feedback">Enter a greater semantic version.</div></div>' +
                        '<div class="mb-0"><label class="form-label">Status</label>' +
                            '<input class="form-control" value="Draft" disabled></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Duplicate</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>"
    );

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function statusLabel(code) {
        const match = statusOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success" : status === "retired" ? "secondary" : status === "draft" ? "warning" : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function encodeText(value) {
        try {
            return btoa(unescape(encodeURIComponent(value || "")));
        } catch (err) {
            return btoa(value || "");
        }
    }

    function decodeText(value) {
        if (!value) {
            return "";
        }
        try {
            return decodeURIComponent(escape(atob(value)));
        } catch (err) {
            try {
                return atob(value);
            } catch (ignored) {
                return "";
            }
        }
    }

    function isPolicyYaml(item) {
        const type = ((item && item.contentType) || "").split(";")[0].trim().toLowerCase();
        return type === policyContentType;
    }

    function parseSemver(value) {
        const text = String(value || "").trim();
        if (!text) {
            return { major: 0, minor: 0, patch: 0, extra: [], prerelease: [] };
        }
        const plus = text.split("+")[0];
        const dash = plus.indexOf("-");
        const core = dash === -1 ? plus : plus.slice(0, dash);
        const pre = dash === -1 ? "" : plus.slice(dash + 1);
        const parts = core.split(".");
        if (!parts.length || parts.some(function (part) { return !/^\d+$/.test(part); })) {
            return null;
        }
        return {
            major: Number(parts[0] || 0),
            minor: Number(parts[1] || 0),
            patch: Number(parts[2] || 0),
            extra: parts.slice(3).map(Number),
            prerelease: pre ? pre.split(".") : []
        };
    }

    function comparePrerelease(a, b) {
        const length = Math.max(a.length, b.length);
        for (let i = 0; i < length; i++) {
            if (i >= a.length) {
                return -1;
            }
            if (i >= b.length) {
                return 1;
            }
            const aNumeric = /^\d+$/.test(a[i]);
            const bNumeric = /^\d+$/.test(b[i]);
            if (aNumeric && bNumeric) {
                const diff = Number(a[i]) - Number(b[i]);
                if (diff) {
                    return diff;
                }
            } else if (aNumeric) {
                return -1;
            } else if (bNumeric) {
                return 1;
            } else if (a[i] !== b[i]) {
                return a[i] < b[i] ? -1 : 1;
            }
        }
        return 0;
    }

    function compareSemver(left, right) {
        const a = parseSemver(left);
        const b = parseSemver(right);
        if (!a || !b) {
            return null;
        }
        if (a.major !== b.major) {
            return a.major - b.major;
        }
        if (a.minor !== b.minor) {
            return a.minor - b.minor;
        }
        if (a.patch !== b.patch) {
            return a.patch - b.patch;
        }
        const extraLength = Math.max(a.extra.length, b.extra.length);
        for (let i = 0; i < extraLength; i++) {
            const av = a.extra[i] || 0;
            const bv = b.extra[i] || 0;
            if (av !== bv) {
                return av - bv;
            }
        }
        if (!a.prerelease.length && !b.prerelease.length) {
            return 0;
        }
        if (!a.prerelease.length) {
            return 1;
        }
        if (!b.prerelease.length) {
            return -1;
        }
        return comparePrerelease(a.prerelease, b.prerelease);
    }

    function suggestNextVersion(current) {
        const parsed = parseSemver(current || "0.0.0");
        if (!parsed) {
            return "";
        }
        return parsed.major + "." + parsed.minor + "." + (parsed.patch + 1);
    }

    function yamlQuoted(value) {
        return JSON.stringify(String(value == null ? "" : value));
    }

    function replaceYamlField(yaml, key, value) {
        const pattern = new RegExp("^" + key + "\\s*:.*$", "m");
        const line = key + ": " + yamlQuoted(value);
        if (pattern.test(yaml)) {
            return yaml.replace(pattern, line);
        }
        return yaml.replace(/\s*$/, "\n") + line + "\n";
    }

    function updatePolicyYaml(text, version, status) {
        let yaml = text || "";
        yaml = replaceYamlField(yaml, "version", version);
        yaml = replaceYamlField(yaml, "status", status);
        return yaml;
    }

    function cloneLibrary(source, newVersion) {
        const copy = JSON.parse(JSON.stringify(source));
        delete copy.id;
        delete copy.meta;
        delete copy.text;
        copy.status = "draft";
        copy.version = newVersion;
        copy.content = (copy.content || []).map(function (item) {
            if (!isPolicyYaml(item) || !item.data) {
                return item;
            }
            const next = Object.assign({}, item);
            next.data = encodeText(updatePolicyYaml(decodeText(item.data), newVersion, "draft"));
            return next;
        });
        return copy;
    }

    function showDupVersionError(message) {
        $("#dup-version").addClass("is-invalid");
        $("#dup-version-feedback").text(message);
    }

    function clearDupVersionError() {
        $("#dup-version").removeClass("is-invalid");
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Library?type=" + encodeURIComponent(libraryType) + "&_sort=-_lastUpdated";
        if (query) {
            path += "&title=" + encodeURIComponent(query);
        }
        CadminApi.fhir(CadminApi.pagedPath(path, listPage)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Library");
            CadminApi.renderPager("#pds-policy-pager", {
                page: listPage,
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#pds-policy-rows").html('<tr><td colspan="7" class="text-muted">No PDS policies found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            const rows = entries.map(function (library) {
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/pds-policies/" + encodeURIComponent(library.id), library.title || library.name || "Untitled") + "</td>" +
                    "<td>" + esc(library.description || "—") + "</td>" +
                    "<td><code>" + esc(library.version || "—") + "</code></td>" +
                    "<td>" + statusBadge(library.status) + "</td>" +
                    "<td><code>" + esc(library.name || "—") + "</code></td>" +
                    "<td><code>" + esc(library.id) + "</code></td>" +
                    '<td class="text-end text-nowrap">' +
                        '<a class="btn btn-sm btn-outline-primary me-1" href="#/pds-policies/' +
                            encodeURIComponent(library.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a>' +
                        '<button class="btn btn-sm btn-outline-secondary" type="button" data-duplicate="' +
                            esc(library.id) + '">Duplicate</button>' +
                    "</td>" +
                    "</tr>";
            });
            $("#pds-policy-rows").html(rows.join(""));
        }).fail(function (xhr) {
            $("#pds-policy-pager").empty();
            $("#pds-policy-rows").html('<tr><td colspan="7" class="text-danger">Unable to load libraries from /fhir.</td></tr>');
            CadminApi.showAlert("#pds-policy-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#pds-policy-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#pds-policy-query").val());
    });

    $("#create-pds-policy-form").on("submit", function (event) {
        event.preventDefault();
        const resource = {
            resourceType: "Library",
            status: $("#pds-status").val() || "draft",
            title: $("#pds-title").val(),
            type: {
                coding: [{
                    code: libraryType,
                    display: "PDS Policies"
                }],
                text: libraryType
            }
        };
        const description = $("#pds-description").val();
        if (description) {
            resource.description = description;
        }
        CadminApi.fhir("/Library", "POST", resource).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-pds-policy-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "PDS policy created.");
            load($("#pds-policy-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $root.on("click", "[data-duplicate]", function () {
        const id = $(this).attr("data-duplicate");
        CadminApi.fhir("/Library/" + encodeURIComponent(id)).done(function (library) {
            duplicateSource = library;
            $("#dup-source-title").text(library.title || library.name || library.id);
            $("#dup-source-version").text(library.version || "0.0.0");
            $("#dup-version").val(suggestNextVersion(library.version));
            clearDupVersionError();
            CadminApi.showAlert("#dup-alert", "info", "");
            $("#dup-alert").addClass("d-none");
            bootstrap.Modal.getOrCreateInstance(document.getElementById("duplicate-pds-policy-modal")).show();
        }).fail(function (xhr) {
            CadminApi.showAlert("#pds-policy-alert", "danger", "Unable to load policy (" + xhr.status + ").");
        });
    });

    $("#duplicate-pds-policy-form").on("submit", function (event) {
        event.preventDefault();
        if (!duplicateSource) {
            return;
        }
        const newVersion = ($("#dup-version").val() || "").trim();
        const currentVersion = duplicateSource.version || "0.0.0";
        clearDupVersionError();
        if (!parseSemver(newVersion) || !String(newVersion).trim()) {
            showDupVersionError("Enter a semantic version such as 1.0.1.");
            return;
        }
        const comparison = compareSemver(currentVersion, newVersion);
        if (comparison === null) {
            showDupVersionError("New version must be a valid semantic version greater than " + currentVersion + ".");
            return;
        }
        if (comparison >= 0) {
            showDupVersionError("New version must be semantically greater than " + currentVersion + ".");
            return;
        }
        const copy = cloneLibrary(duplicateSource, newVersion);
        CadminApi.fhir("/Library", "POST", copy).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("duplicate-pds-policy-modal"));
            if (modal) {
                modal.hide();
            }
            duplicateSource = null;
            CadminApi.showToast("success", "PDS policy duplicated as draft " + newVersion + ".");
            load($("#pds-policy-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Duplicate failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
}
