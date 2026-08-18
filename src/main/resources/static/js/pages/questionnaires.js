CadminApp.register("questionnaires", function (params) {
    const token = CadminApi.routeParamId(params);
    if (token) {
        CadminApi.fhir("/Questionnaire/" + encodeURIComponent(token)).done(function (questionnaire) {
            CadminQuestionnaireDetail.render(questionnaire);
        }).fail(function () {
            renderQuestionnaireList(token);
        });
        return;
    }
    renderQuestionnaireList("");
});

function renderQuestionnaireList(initialQuery) {
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
            '<h1 class="h3 mb-0 page-title">Questionnaires</h1>' +
            '<button class="btn btn-primary" type="button" data-bs-toggle="modal" data-bs-target="#create-questionnaire-modal">' +
                '<i class="bi bi-plus-lg me-1"></i>New questionnaire</button>' +
        "</div>" +
        '<div id="questionnaire-alert" class="alert d-none"></div>' +
        '<div class="card shadow mb-4">' +
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0">Questionnaire search</h6>' +
                '<form class="d-flex" id="questionnaire-search-form">' +
                    '<input class="form-control form-control-sm me-2" id="questionnaire-query" placeholder="Title" value="' +
                        CadminApi.escapeHtml(initialQuery) + '">' +
                    '<button class="btn btn-sm btn-primary" type="submit">Search</button>' +
                "</form>" +
            "</div>" +
            '<div class="card-body">' +
                '<div class="table-responsive">' +
                    '<table class="table table-hover align-middle">' +
                        "<thead><tr><th>Title</th><th>Status</th><th>Version</th><th>Items</th><th>Publisher</th><th>ID</th><th></th></tr></thead>" +
                        '<tbody id="questionnaire-rows"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>' +
                    "</table>" +
                "</div>" +
                '<div class="list-pager" id="questionnaire-pager"></div>' +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="create-questionnaire-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="create-questionnaire-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Create questionnaire</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<div class="mb-3"><label class="form-label" for="qn-title">Title</label>' +
                            '<input class="form-control" id="qn-title" name="title" required></div>' +
                        '<div class="mb-3"><label class="form-label" for="qn-status">Status</label>' +
                            '<select class="form-select" id="qn-status" name="status">' +
                                statusOptions.map(function (option) {
                                    return '<option value="' + option.code + '">' +
                                        CadminApi.escapeHtml(option.display) + "</option>";
                                }).join("") +
                            "</select></div>" +
                        '<div class="mb-3"><label class="form-label" for="qn-url">URL</label>' +
                            '<input class="form-control font-monospace" id="qn-url" name="url" placeholder="https://example.org/Questionnaire/intake"></div>' +
                        '<div class="mb-0"><label class="form-label" for="qn-version">Version</label>' +
                            '<input class="form-control" id="qn-version" name="version" value="1.0.0" autocomplete="off"></div>' +
                    "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                        '<button type="submit" class="btn btn-primary">Create</button>' +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>" +
        '<div class="modal fade" id="duplicate-questionnaire-modal" tabindex="-1">' +
            '<div class="modal-dialog">' +
                '<form class="modal-content" id="duplicate-questionnaire-form">' +
                    '<div class="modal-header"><h5 class="modal-title">Duplicate questionnaire</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' +
                        '<p class="mb-3">Create a new draft from <strong id="qn-dup-title"></strong>.</p>' +
                        '<div class="mb-3"><label class="form-label">Title</label>' +
                            '<input class="form-control" id="qn-dup-name" required></div>' +
                        '<div class="mb-0"><label class="form-label">Version</label>' +
                            '<input class="form-control" id="qn-dup-version" placeholder="1.0.1"></div>' +
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
        const kind = status === "active" ? "success"
            : status === "retired" ? "secondary"
                : status === "draft" ? "warning"
                    : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function countItems(items) {
        return (items || []).reduce(function (total, item) {
            return total + 1 + countItems(item.item);
        }, 0);
    }

    function slugName(title) {
        return String(title || "questionnaire").toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 64) || "questionnaire";
    }

    function bumpVersion(value) {
        const text = String(value || "").trim();
        const match = text.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (match) {
            return match[1] + "." + match[2] + "." + (Number(match[3]) + 1);
        }
        if (/^\d+$/.test(text)) {
            return String(Number(text) + 1);
        }
        return text ? text + "-copy" : "1.0.0";
    }

    let listPage = 0;

    function load(query, page) {
        listPage = typeof page === "number" ? page : 0;
        let path = "/Questionnaire?_sort=-_lastUpdated";
        if (query) {
            path += "&title=" + encodeURIComponent(query);
        }
        const pageSize = CadminApi.listPageSize("questionnaires");
        CadminApi.fhir(CadminApi.pagedPath(path, listPage, pageSize)).done(function (bundle) {
            const entries = CadminApi.bundleResources(bundle, "Questionnaire");
            CadminApi.renderPager("#questionnaire-pager", {
                page: listPage,
                size: pageSize,
                pageSizeKey: "questionnaires",
                returned: entries.length,
                total: bundle.total,
                bundle: bundle,
                onPage: function (nextPage) { load(query, nextPage); }
            });
            if (!entries.length) {
                $("#questionnaire-rows").html('<tr><td colspan="7" class="text-muted">No questionnaires found. Create one or start HAPI FHIR.</td></tr>');
                return;
            }
            $("#questionnaire-rows").html(entries.map(function (qn) {
                return "<tr>" +
                    "<td>" + CadminApi.resourceLink("#/questionnaires/" + encodeURIComponent(qn.id),
                        qn.title || qn.name || "Untitled") + "</td>" +
                    "<td>" + statusBadge(qn.status) + "</td>" +
                    "<td><code>" + esc(qn.version || "—") + "</code></td>" +
                    "<td>" + countItems(qn.item) + "</td>" +
                    "<td>" + esc(qn.publisher || "—") + "</td>" +
                    "<td><code>" + esc(qn.id) + "</code></td>" +
                    '<td class="text-end text-nowrap">' +
                        '<a class="btn btn-sm btn-outline-primary me-1" href="#/questionnaires/' +
                            encodeURIComponent(qn.id) + '" title="Open" aria-label="Open"><i class="bi bi-eye"></i></a>' +
                        '<button class="btn btn-sm btn-outline-secondary" type="button" data-duplicate="' +
                            esc(qn.id) + '">Duplicate</button>' +
                    "</td></tr>";
            }).join(""));
        }).fail(function (xhr) {
            $("#questionnaire-pager").empty();
            $("#questionnaire-rows").html('<tr><td colspan="7" class="text-danger">Unable to load questionnaires from /fhir.</td></tr>');
            CadminApi.showAlert("#questionnaire-alert", "danger",
                "FHIR request failed (" + xhr.status + "). Is the HAPI FHIR stack running?");
        });
    }

    $("#questionnaire-search-form").on("submit", function (event) {
        event.preventDefault();
        load($("#questionnaire-query").val());
    });

    $("#create-questionnaire-form").on("submit", function (event) {
        event.preventDefault();
        const fields = this.elements;
        const title = String((fields.namedItem("title") || {}).value || "").trim();
        const resource = {
            resourceType: "Questionnaire",
            status: String((fields.namedItem("status") || {}).value || "draft").trim() || "draft",
            title: title,
            name: slugName(title),
            version: String((fields.namedItem("version") || {}).value || "").trim() || "1.0.0",
            item: []
        };
        const url = String((fields.namedItem("url") || {}).value || "").trim();
        if (url) {
            resource.url = url;
        }
        CadminApi.fhir("/Questionnaire", "POST", resource).done(function (created) {
            const modal = bootstrap.Modal.getInstance(document.getElementById("create-questionnaire-modal"));
            if (modal) {
                modal.hide();
            }
            CadminApi.showToast("success", "Questionnaire created.");
            if (created && created.id) {
                window.location.hash = "#/questionnaires/" + encodeURIComponent(created.id);
                return;
            }
            load($("#questionnaire-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Create failed (" + xhr.status + ").");
        });
    });

    $root.on("click", "[data-duplicate]", function () {
        const id = $(this).attr("data-duplicate");
        CadminApi.fhir("/Questionnaire/" + encodeURIComponent(id)).done(function (qn) {
            duplicateSource = qn;
            $("#qn-dup-title").text(qn.title || qn.name || qn.id);
            $("#qn-dup-name").val((qn.title || "Questionnaire") + " copy");
            $("#qn-dup-version").val(bumpVersion(qn.version));
            bootstrap.Modal.getOrCreateInstance(document.getElementById("duplicate-questionnaire-modal")).show();
        }).fail(function (xhr) {
            CadminApi.showAlert("#questionnaire-alert", "danger", "Unable to load questionnaire (" + xhr.status + ").");
        });
    });

    $("#duplicate-questionnaire-form").on("submit", function (event) {
        event.preventDefault();
        if (!duplicateSource) {
            return;
        }
        const copy = JSON.parse(JSON.stringify(duplicateSource));
        delete copy.id;
        delete copy.meta;
        delete copy.text;
        copy.status = "draft";
        copy.title = $("#qn-dup-name").val().trim() || (duplicateSource.title || "Questionnaire") + " copy";
        copy.name = slugName(copy.title);
        const version = $("#qn-dup-version").val().trim();
        if (version) {
            copy.version = version;
        } else {
            delete copy.version;
        }
        CadminApi.fhir("/Questionnaire", "POST", copy).done(function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById("duplicate-questionnaire-modal"));
            if (modal) {
                modal.hide();
            }
            duplicateSource = null;
            CadminApi.showToast("success", "Questionnaire duplicated as draft.");
            load($("#questionnaire-query").val());
        }).fail(function (xhr) {
            CadminApi.showToast("danger", "Duplicate failed (" + xhr.status + ").");
        });
    });

    load(initialQuery);
}
