window.CadminQuestionnaireDetail = (function () {
    const statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "retired", display: "Retired" },
        { code: "unknown", display: "Unknown" }
    ];
    const itemTypes = [
        { code: "group", display: "Group" },
        { code: "display", display: "Display" },
        { code: "boolean", display: "Boolean" },
        { code: "decimal", display: "Decimal" },
        { code: "integer", display: "Integer" },
        { code: "date", display: "Date" },
        { code: "dateTime", display: "Date/time" },
        { code: "time", display: "Time" },
        { code: "string", display: "String" },
        { code: "text", display: "Text" },
        { code: "url", display: "URL" },
        { code: "coding", display: "Coding" },
        { code: "attachment", display: "Attachment" },
        { code: "reference", display: "Reference" },
        { code: "quantity", display: "Quantity" }
    ];
    const enableOperators = [
        { code: "exists", display: "Exists" },
        { code: "=", display: "Equals" },
        { code: "!=", display: "Not equals" },
        { code: ">", display: "Greater than" },
        { code: "<", display: "Less than" },
        { code: ">=", display: "Greater or equal" },
        { code: "<=", display: "Less or equal" }
    ];
    const subjectTypes = [
        { code: "Patient", display: "Patient" },
        { code: "Practitioner", display: "Practitioner" },
        { code: "RelatedPerson", display: "Related person" },
        { code: "Organization", display: "Organization" },
        { code: "Device", display: "Device" }
    ];
    const referenceTargets = [
        { code: "Patient", display: "Patient" },
        { code: "Practitioner", display: "Practitioner" },
        { code: "RelatedPerson", display: "Related person" },
        { code: "Organization", display: "Organization" },
        { code: "Location", display: "Location" },
        { code: "Device", display: "Device" }
    ];

    let questionnaire = null;
    let selectedPath = "";
    let previewAnswers = {};
    const valueSetCache = {};

    function esc(value) {
        return CadminApi.escapeHtml(value);
    }

    function optionsHtml(items, selected) {
        return items.map(function (item) {
            const mark = item.code === selected ? " selected" : "";
            return '<option value="' + esc(item.code) + '"' + mark + ">" + esc(item.display) + "</option>";
        }).join("");
    }

    function typeLabel(code) {
        const match = itemTypes.find(function (item) { return item.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusLabel(code) {
        const match = statusOptions.find(function (item) { return item.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success"
            : status === "retired" ? "secondary"
                : status === "draft" ? "warning"
                    : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
    }

    function hideModal(id) {
        const el = document.getElementById(id);
        const instance = el ? bootstrap.Modal.getInstance(el) : null;
        if (instance) {
            instance.hide();
        }
    }

    function alertMsg(type, message) {
        CadminApi.showToast(type, message);
    }

    function fail(action, xhr) {
        alertMsg("danger", action + " failed (" + xhr.status + ").");
    }

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function parsePath(path) {
        return String(path || "").split(".").filter(function (part) {
            return part !== "";
        }).map(Number);
    }

    function itemAt(path) {
        const parts = parsePath(path);
        if (!parts.length) {
            return null;
        }
        let node = null;
        let list = questionnaire.item || [];
        for (let i = 0; i < parts.length; i += 1) {
            node = list[parts[i]];
            if (!node) {
                return null;
            }
            list = node.item || [];
        }
        return node;
    }

    function parentContext(path) {
        const parts = parsePath(path);
        if (!parts.length) {
            return { list: questionnaire.item || [], index: -1, parent: null };
        }
        if (parts.length === 1) {
            questionnaire.item = questionnaire.item || [];
            return { list: questionnaire.item, index: parts[0], parent: null };
        }
        const parent = itemAt(parts.slice(0, -1).join("."));
        if (!parent) {
            return { list: [], index: -1, parent: null };
        }
        parent.item = parent.item || [];
        return { list: parent.item, index: parts[parts.length - 1], parent: parent };
    }

    function walkItems(items, visit, prefix) {
        (items || []).forEach(function (item, index) {
            const path = prefix ? prefix + "." + index : String(index);
            visit(item, path);
            walkItems(item.item, visit, path);
        });
    }

    function allLinkIds(exceptPath) {
        const ids = [];
        walkItems(questionnaire.item, function (item, path) {
            if (path !== exceptPath && item.linkId) {
                ids.push(item.linkId);
            }
        });
        return ids;
    }

    function nextLinkId(parentItem) {
        const used = {};
        allLinkIds("").forEach(function (id) {
            used[id] = true;
        });
        const base = parentItem && parentItem.linkId ? parentItem.linkId + "." : "q";
        let n = 1;
        while (used[base + n]) {
            n += 1;
        }
        return base + n;
    }

    function emptyItem(type, parentItem) {
        const item = {
            linkId: nextLinkId(parentItem),
            type: type || "string",
            text: type === "group" ? "New group" : (type === "display" ? "Display text" : "New question")
        };
        if (type === "group") {
            item.item = [];
        }
        return item;
    }

    function cloneItem(item) {
        const copy = JSON.parse(JSON.stringify(item));
        const used = {};
        allLinkIds("").forEach(function (id) {
            used[id] = true;
        });
        function retarget(node, parentId) {
            const base = parentId ? parentId + "." : "q";
            let n = 1;
            while (used[base + n]) {
                n += 1;
            }
            node.linkId = base + n;
            used[node.linkId] = true;
            (node.item || []).forEach(function (child) {
                retarget(child, node.linkId);
            });
        }
        retarget(copy, item.linkId);
        return copy;
    }

    function answerKey(itemType) {
        if (itemType === "boolean") {
            return "answerBoolean";
        }
        if (itemType === "decimal") {
            return "answerDecimal";
        }
        if (itemType === "integer") {
            return "answerInteger";
        }
        if (itemType === "date") {
            return "answerDate";
        }
        if (itemType === "dateTime") {
            return "answerDateTime";
        }
        if (itemType === "time") {
            return "answerTime";
        }
        if (itemType === "coding") {
            return "answerCoding";
        }
        if (itemType === "quantity") {
            return "answerQuantity";
        }
        if (itemType === "reference") {
            return "answerReference";
        }
        return "answerString";
    }

    function optionValueKey(itemType) {
        if (itemType === "integer") {
            return "valueInteger";
        }
        if (itemType === "date") {
            return "valueDate";
        }
        if (itemType === "time") {
            return "valueTime";
        }
        if (itemType === "coding") {
            return "valueCoding";
        }
        if (itemType === "reference") {
            return "valueReference";
        }
        return "valueString";
    }

    function optionLabel(option, itemType) {
        if (!option) {
            return "";
        }
        const key = optionValueKey(itemType);
        const value = option[key];
        if (key === "valueCoding") {
            return (value && (value.display || value.code)) || "";
        }
        if (key === "valueReference") {
            return (value && (value.display || value.reference)) || "";
        }
        return value == null ? "" : String(value);
    }

    function uniqueLinkIdError() {
        const seen = {};
        let duplicate = "";
        walkItems(questionnaire.item, function (item) {
            if (!item.linkId) {
                duplicate = duplicate || "(empty)";
                return;
            }
            if (seen[item.linkId]) {
                duplicate = item.linkId;
            }
            seen[item.linkId] = true;
        });
        return duplicate;
    }

    function saveQuestionnaire(next) {
        const dup = uniqueLinkIdError();
        if (dup) {
            alertMsg("danger", "Duplicate or empty linkId: " + dup);
            return;
        }
        CadminApi.fhir("/Questionnaire/" + encodeURIComponent(questionnaire.id), "PUT", questionnaire)
            .done(function (updated) {
                questionnaire = updated || questionnaire;
                renderMeta();
                renderTree();
                renderInspector();
                renderPreview();
                CadminResourceSource.mount(function () { return questionnaire; });
                CadminResourceGraph.mount(questionnaire);
                if (next) {
                    next();
                }
            }).fail(function (xhr) {
                fail("Update questionnaire", xhr);
            });
    }

    function render(resource) {
        questionnaire = resource;
        questionnaire.item = questionnaire.item || [];
        selectedPath = questionnaire.item.length ? "0" : "";
        previewAnswers = {};
        const $root = $(CadminWorkspace.root());
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/questionnaires">' +
                        '<i class="bi bi-arrow-left me-1"></i>Questionnaires</a>' +
                    '<h1 class="h3 mb-0 page-title" id="qd-title"></h1>' +
                "</div>" +
                '<div class="d-flex flex-wrap gap-2">' +
                    '<button class="btn btn-primary" type="button" id="qd-save">' +
                        '<i class="bi bi-check2 me-1"></i>Save</button>' +
                    '<button class="btn btn-outline-danger" type="button" id="qd-delete">' +
                        '<i class="bi bi-trash me-1"></i>Delete</button>' +
                    CadminResourceSource.button() +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Metadata</h6>' +
                    '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#qd-meta-modal">Edit</button>' +
                "</div>" +
                '<div class="card-body" id="qd-meta"></div>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                    '<h6 class="m-0">Items</h6>' +
                    '<div class="d-flex gap-2">' +
                        '<button class="btn btn-sm btn-outline-primary" type="button" id="qd-add-group">' +
                            '<i class="bi bi-folder-plus me-1"></i>Add group</button>' +
                        '<button class="btn btn-sm btn-primary" type="button" id="qd-add-question">' +
                            '<i class="bi bi-plus-lg me-1"></i>Add question</button>' +
                    "</div>" +
                "</div>" +
                '<div class="q-editor">' +
                    '<div class="q-tree" id="qd-tree"></div>' +
                    '<div class="q-inspector" id="qd-inspector"></div>' +
                "</div>" +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<div class="card-header py-3"><h6 class="m-0">Preview</h6></div>' +
                '<div class="card-body" id="qd-preview"></div>' +
            "</div>" +
            CadminResourceGraph.card() +
            '<div class="modal fade" id="qd-meta-modal" tabindex="-1">' +
                '<div class="modal-dialog modal-lg">' +
                    '<form class="modal-content" id="qd-meta-form">' +
                        '<div class="modal-header"><h5 class="modal-title">Edit metadata</h5>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                        '<div class="modal-body">' +
                            field("Title", '<input class="form-control" id="qd-title-input" required>') +
                            field("Name", '<input class="form-control font-monospace" id="qd-name">') +
                            field("URL", '<input class="form-control font-monospace" id="qd-url">') +
                            '<div class="row"><div class="col-md-6">' +
                                field("Version", '<input class="form-control" id="qd-version">') +
                            "</div><div class=\"col-md-6\">" +
                                field("Status", '<select class="form-select" id="qd-status">' +
                                    optionsHtml(statusOptions) + "</select>") +
                            "</div></div>" +
                            field("Publisher", '<input class="form-control" id="qd-publisher">') +
                            field("Description", '<textarea class="form-control" id="qd-description" rows="2"></textarea>') +
                            field("Purpose", '<textarea class="form-control" id="qd-purpose" rows="2"></textarea>') +
                            '<div class="mb-3"><label class="form-label">Subject type</label>' +
                                '<div id="qd-subject-types">' +
                                    subjectTypes.map(function (item) {
                                        return '<div class="form-check form-check-inline">' +
                                            '<input class="form-check-input" type="checkbox" id="qd-st-' +
                                            item.code + '" value="' + item.code + '">' +
                                            '<label class="form-check-label" for="qd-st-' + item.code + '">' +
                                            esc(item.display) + "</label></div>";
                                    }).join("") +
                                "</div></div>" +
                            '<div class="row"><div class="col-md-6 mb-0"><label class="form-label">Period start</label>' +
                                '<input class="form-control" id="qd-period-start" type="date"></div>' +
                                '<div class="col-md-6 mb-0"><label class="form-label">Period end</label>' +
                                '<input class="form-control" id="qd-period-end" type="date"></div></div>' +
                        "</div>" +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
                            '<button type="submit" class="btn btn-primary">Save</button>' +
                        "</div>" +
                    "</form>" +
                "</div>" +
            "</div>"
        );
        CadminResourceSource.mount(function () { return questionnaire; });
        CadminResourceGraph.mount(questionnaire);
        renderMeta();
        renderTree();
        renderInspector();
        renderPreview();
        bind();
        $("#qd-meta-modal").on("show.bs.modal", populateMetaForm);
    }

    function renderMeta() {
        $("#qd-title").text(questionnaire.title || questionnaire.name || "Questionnaire");
        const subjects = (questionnaire.subjectType || []).join(", ") || "—";
        const period = questionnaire.effectivePeriod;
        const periodText = period && (period.start || period.end)
            ? [period.start || "…", period.end || "…"].join(" – ")
            : "—";
        $("#qd-meta").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-3">Title</dt><dd class="col-sm-9">' + esc(questionnaire.title || "—") + "</dd>" +
                '<dt class="col-sm-3">Status</dt><dd class="col-sm-9">' + statusBadge(questionnaire.status) + "</dd>" +
                '<dt class="col-sm-3">Name</dt><dd class="col-sm-9"><code>' + esc(questionnaire.name || "—") + "</code></dd>" +
                '<dt class="col-sm-3">URL</dt><dd class="col-sm-9"><code>' + esc(questionnaire.url || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Version</dt><dd class="col-sm-9"><code>' + esc(questionnaire.version || "—") + "</code></dd>" +
                '<dt class="col-sm-3">Subject type</dt><dd class="col-sm-9">' + esc(subjects) + "</dd>" +
                '<dt class="col-sm-3">Publisher</dt><dd class="col-sm-9">' + esc(questionnaire.publisher || "—") + "</dd>" +
                '<dt class="col-sm-3">Description</dt><dd class="col-sm-9">' + esc(questionnaire.description || "—") + "</dd>" +
                '<dt class="col-sm-3">Purpose</dt><dd class="col-sm-9">' + esc(questionnaire.purpose || "—") + "</dd>" +
                '<dt class="col-sm-3">Period</dt><dd class="col-sm-9">' + esc(periodText) + "</dd>" +
                '<dt class="col-sm-3">ID</dt><dd class="col-sm-9"><code>' + esc(questionnaire.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function populateMetaForm() {
        $("#qd-title-input").val(questionnaire.title || "");
        $("#qd-name").val(questionnaire.name || "");
        $("#qd-url").val(questionnaire.url || "");
        $("#qd-version").val(questionnaire.version || "");
        $("#qd-status").val(questionnaire.status || "draft");
        $("#qd-publisher").val(questionnaire.publisher || "");
        $("#qd-description").val(questionnaire.description || "");
        $("#qd-purpose").val(questionnaire.purpose || "");
        const selected = questionnaire.subjectType || [];
        subjectTypes.forEach(function (item) {
            $("#qd-st-" + item.code).prop("checked", selected.indexOf(item.code) !== -1);
        });
        $("#qd-period-start").val((questionnaire.effectivePeriod && questionnaire.effectivePeriod.start) || "");
        $("#qd-period-end").val((questionnaire.effectivePeriod && questionnaire.effectivePeriod.end) || "");
    }

    function treeRow(item, path, depth) {
        const selected = path === selectedPath ? " selected" : "";
        const label = [item.prefix, item.text || item.linkId || typeLabel(item.type)].filter(Boolean).join(" ");
        return '<div class="q-tree-node" data-path="' + esc(path) + '">' +
            '<div class="q-tree-row' + selected + '" data-select="' + esc(path) + '" style="padding-left:' +
                (0.75 + depth * 1.1) + 'rem">' +
                '<div class="q-tree-label">' +
                    '<span class="badge q-tree-type me-2">' + esc(typeLabel(item.type)) + "</span>" +
                    "<span>" + esc(label) + "</span>" +
                    '<code class="ms-2 small">' + esc(item.linkId || "") + "</code>" +
                "</div>" +
                '<div class="q-tree-actions btn-group btn-group-sm">' +
                    (item.type === "group"
                        ? '<button class="btn btn-outline-primary" type="button" data-add-child="' +
                            esc(path) + '" title="Add child"><i class="bi bi-plus"></i></button>'
                        : "") +
                    '<button class="btn btn-outline-secondary" type="button" data-move-up="' +
                        esc(path) + '" title="Move up"><i class="bi bi-arrow-up"></i></button>' +
                    '<button class="btn btn-outline-secondary" type="button" data-move-down="' +
                        esc(path) + '" title="Move down"><i class="bi bi-arrow-down"></i></button>' +
                    '<button class="btn btn-outline-secondary" type="button" data-dup-item="' +
                        esc(path) + '" title="Duplicate"><i class="bi bi-copy"></i></button>' +
                    '<button class="btn btn-outline-danger" type="button" data-remove-item="' +
                        esc(path) + '" title="Remove"><i class="bi bi-trash"></i></button>' +
                "</div>" +
            "</div>" +
            ((item.item || []).map(function (child, index) {
                return treeRow(child, path + "." + index, depth + 1);
            }).join("")) +
        "</div>";
    }

    function renderTree() {
        const items = questionnaire.item || [];
        if (!items.length) {
            $("#qd-tree").html('<div class="text-muted p-3">No items yet. Add a group or question.</div>');
            return;
        }
        $("#qd-tree").html(items.map(function (item, index) {
            return treeRow(item, String(index), 0);
        }).join(""));
    }

    function questionChoices(exceptPath) {
        const choices = [];
        walkItems(questionnaire.item, function (item, path) {
            if (path === exceptPath || item.type === "group" || item.type === "display") {
                return;
            }
            choices.push({
                code: item.linkId,
                display: (item.text || item.linkId) + " (" + item.linkId + ")"
            });
        });
        return choices;
    }

    function renderInspector() {
        const item = itemAt(selectedPath);
        const $el = $("#qd-inspector");
        if (!item) {
            $el.html('<div class="text-muted p-3">Select an item or add one.</div>');
            return;
        }
        const dup = allLinkIds(selectedPath).indexOf(item.linkId) !== -1;
        const canOptions = ["coding", "string", "integer", "date", "time"].indexOf(item.type) !== -1;
        const canValueSet = item.type === "coding";
        const canMax = item.type === "string" || item.type === "text";
        const canEnable = item.type !== "group";
        const questions = questionChoices(selectedPath);
        let html = "<h6 class=\"mb-3\">Item</h6>";
        html += field("Link ID", '<input class="form-control font-monospace" data-item-field="linkId" value="' +
            esc(item.linkId || "") + '">' +
            (dup ? '<div class="form-text text-danger">This linkId is already used.</div>' : ""));
        html += field("Type", '<select class="form-select" data-item-field="type">' +
            optionsHtml(itemTypes, item.type) + "</select>");
        html += field("Prefix", '<input class="form-control" data-item-field="prefix" value="' +
            esc(item.prefix || "") + '">');
        html += field("Text", '<textarea class="form-control" data-item-field="text" rows="2">' +
            esc(item.text || "") + "</textarea>");
        if (item.type !== "display" && item.type !== "group") {
            html += '<div class="d-flex flex-wrap gap-3 mb-3">' +
                check("required", "Required", item.required) +
                check("repeats", "Repeats", item.repeats) +
                check("readOnly", "Read only", item.readOnly) +
                "</div>";
        }
        if (canMax) {
            html += field("Max length", '<input class="form-control" data-item-field="maxLength" type="number" min="1" value="' +
                esc(item.maxLength || "") + '">');
        }
        if (item.type === "reference") {
            html += field("Reference target", '<select class="form-select" data-item-field="refTarget">' +
                '<option value=""></option>' +
                optionsHtml(referenceTargets, ((item.answerValueSet || "") && "") ||
                    ((item.extension || []).length ? "" : "")) +
                "</select>");
        }
        if (item.type === "quantity") {
            const unit = (((item.initial || [])[0] || {}).valueQuantity || {}).unit || "";
            html += field("Quantity unit", '<input class="form-control" data-item-field="qtyUnit" value="' +
                esc(unit) + '">');
        }
        if (canValueSet) {
            html += field("Answer value set", '<input class="form-control font-monospace" data-item-field="answerValueSet" placeholder="http://…" value="' +
                esc(item.answerValueSet || "") + '">');
        }
        if (canOptions) {
            html += '<div class="mb-3"><div class="d-flex justify-content-between align-items-center mb-2">' +
                '<label class="form-label mb-0">Answer options</label>' +
                '<button class="btn btn-sm btn-outline-primary" type="button" data-add-option>Add</button></div>' +
                optionRows(item) + "</div>";
        }
        if (item.type !== "group" && item.type !== "display") {
            html += '<div class="mb-3">' + field("Initial value", initialControl(item)) + "</div>";
        }
        if (canEnable) {
            html += '<div class="mb-3"><div class="d-flex justify-content-between align-items-center mb-2">' +
                '<label class="form-label mb-0">Enable when</label>' +
                '<button class="btn btn-sm btn-outline-primary" type="button" data-add-enable>Add</button></div>' +
                (item.enableWhen && item.enableWhen.length
                    ? field("Behavior", '<select class="form-select" data-item-field="enableBehavior">' +
                        optionsHtml([
                            { code: "all", display: "All" },
                            { code: "any", display: "Any" }
                        ], item.enableBehavior || "all") + "</select>")
                    : "") +
                enableRows(item, questions) +
                "</div>";
        }
        $el.html(html);
    }

    function check(fieldName, label, on) {
        return '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" data-item-field="' + fieldName + '"' +
            (on ? " checked" : "") + ">" +
            '<label class="form-check-label">' + label + "</label></div>";
    }

    function optionRows(item) {
        const rows = item.answerOption || [];
        if (!rows.length) {
            return '<div class="text-muted small">No options. Use a value set or add choices.</div>';
        }
        return '<div class="table-responsive"><table class="table table-sm align-middle mb-0"><tbody>' +
            rows.map(function (option, index) {
                return "<tr><td><input class=\"form-control form-control-sm\" data-option-value=\"" +
                    index + '" value="' + esc(optionLabel(option, item.type)) + '"></td>' +
                    '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-option="' +
                    index + '"><i class="bi bi-trash"></i></button></td></tr>';
            }).join("") +
            "</tbody></table></div>";
    }

    function enableRows(item, questions) {
        const rows = item.enableWhen || [];
        if (!rows.length) {
            return '<div class="text-muted small">Always shown.</div>';
        }
        return rows.map(function (rule, index) {
            const source = findItemByLinkId(rule.question);
            const key = answerKey(source && source.type);
            let answer = "";
            if (key === "answerBoolean") {
                answer = rule.answerBoolean === true ? "true" : (rule.answerBoolean === false ? "false" : "");
            } else if (key === "answerCoding") {
                answer = (rule.answerCoding && (rule.answerCoding.code || rule.answerCoding.display)) || "";
            } else if (rule[key] != null) {
                answer = String(rule[key]);
            } else if (rule.answerString != null) {
                answer = rule.answerString;
            }
            return '<div class="row g-2 mb-2 align-items-center">' +
                '<div class="col-md-4"><select class="form-select form-select-sm" data-enable-q="' + index + '">' +
                    '<option value=""></option>' + optionsHtml(questions, rule.question) + "</select></div>" +
                '<div class="col-md-3"><select class="form-select form-select-sm" data-enable-op="' + index + '">' +
                    optionsHtml(enableOperators, rule.operator || "=") + "</select></div>" +
                '<div class="col-md-4"><input class="form-control form-control-sm" data-enable-ans="' +
                    index + '" value="' + esc(answer) + '"' +
                    (rule.operator === "exists" ? " disabled" : "") + "></div>" +
                '<div class="col-md-1 text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove-enable="' +
                    index + '"><i class="bi bi-trash"></i></button></div></div>';
        }).join("");
    }

    function findItemByLinkId(linkId) {
        let found = null;
        walkItems(questionnaire.item, function (item) {
            if (item.linkId === linkId) {
                found = item;
            }
        });
        return found;
    }

    function initialControl(item) {
        const initial = (item.initial && item.initial[0]) || {};
        if (item.type === "boolean") {
            return '<select class="form-select" data-item-field="initial">' +
                '<option value=""></option>' +
                '<option value="true"' + (initial.valueBoolean === true ? " selected" : "") + ">True</option>" +
                '<option value="false"' + (initial.valueBoolean === false ? " selected" : "") + ">False</option></select>";
        }
        if (item.type === "integer" || item.type === "decimal" || item.type === "quantity") {
            const num = item.type === "quantity"
                ? (initial.valueQuantity && initial.valueQuantity.value)
                : (item.type === "integer" ? initial.valueInteger : initial.valueDecimal);
            return '<input class="form-control" data-item-field="initial" type="number" value="' +
                esc(num == null ? "" : num) + '">';
        }
        if (item.type === "date") {
            return '<input class="form-control" data-item-field="initial" type="date" value="' +
                esc(initial.valueDate || "") + '">';
        }
        if (item.type === "dateTime") {
            return '<input class="form-control" data-item-field="initial" type="datetime-local" value="' +
                esc((initial.valueDateTime || "").slice(0, 16)) + '">';
        }
        if (item.type === "time") {
            return '<input class="form-control" data-item-field="initial" type="time" value="' +
                esc(initial.valueTime || "") + '">';
        }
        if (item.type === "coding") {
            const coding = initial.valueCoding || {};
            return '<input class="form-control" data-item-field="initial" placeholder="code" value="' +
                esc(coding.code || coding.display || "") + '">';
        }
        return '<input class="form-control" data-item-field="initial" value="' +
            esc(initial.valueString || initial.valueUri || "") + '">';
    }

    function setInitial(item, raw) {
        if (raw === "" || raw == null) {
            delete item.initial;
            return;
        }
        const entry = {};
        if (item.type === "boolean") {
            entry.valueBoolean = raw === "true";
        } else if (item.type === "integer") {
            entry.valueInteger = Number(raw);
        } else if (item.type === "decimal") {
            entry.valueDecimal = Number(raw);
        } else if (item.type === "quantity") {
            const unit = (((item.initial || [])[0] || {}).valueQuantity || {}).unit || "";
            entry.valueQuantity = { value: Number(raw), unit: unit };
        } else if (item.type === "date") {
            entry.valueDate = raw;
        } else if (item.type === "dateTime") {
            entry.valueDateTime = raw;
        } else if (item.type === "time") {
            entry.valueTime = raw;
        } else if (item.type === "coding") {
            entry.valueCoding = { code: raw, display: raw };
        } else if (item.type === "url") {
            entry.valueUri = raw;
        } else {
            entry.valueString = raw;
        }
        item.initial = [entry];
    }

    function setOptionValue(item, option, raw) {
        const key = optionValueKey(item.type);
        Object.keys(option).forEach(function (name) {
            if (name.indexOf("value") === 0) {
                delete option[name];
            }
        });
        if (key === "valueCoding") {
            option.valueCoding = { code: raw, display: raw };
        } else if (key === "valueInteger") {
            option.valueInteger = Number(raw);
        } else if (key === "valueReference") {
            option.valueReference = { display: raw };
        } else {
            option[key] = raw;
        }
    }

    function setEnableAnswer(rule, sourceType, raw) {
        ["answerBoolean", "answerDecimal", "answerInteger", "answerDate", "answerDateTime",
            "answerTime", "answerString", "answerCoding", "answerQuantity", "answerReference"]
            .forEach(function (key) {
                delete rule[key];
            });
        if (rule.operator === "exists") {
            rule.answerBoolean = raw !== "false";
            return;
        }
        const key = answerKey(sourceType);
        if (key === "answerBoolean") {
            rule.answerBoolean = raw === "true";
        } else if (key === "answerInteger") {
            rule.answerInteger = Number(raw);
        } else if (key === "answerDecimal") {
            rule.answerDecimal = Number(raw);
        } else if (key === "answerCoding") {
            rule.answerCoding = { code: raw, display: raw };
        } else {
            rule[key] = raw;
        }
    }

    function applyItemField(item, fieldName, $input) {
        if (fieldName === "required" || fieldName === "repeats" || fieldName === "readOnly") {
            if ($input.is(":checked")) {
                item[fieldName] = true;
            } else {
                delete item[fieldName];
            }
            return;
        }
        const value = $input.val();
        if (fieldName === "type") {
            const previous = item.type;
            item.type = value;
            if (previous === "group" && value !== "group") {
                delete item.item;
            }
            if (value === "group") {
                item.item = item.item || [];
                delete item.required;
                delete item.repeats;
                delete item.readOnly;
                delete item.answerOption;
                delete item.answerValueSet;
                delete item.initial;
            }
            if (value === "display") {
                delete item.required;
                delete item.repeats;
                delete item.readOnly;
                delete item.answerOption;
                delete item.initial;
            }
            return;
        }
        if (fieldName === "maxLength") {
            if (value) {
                item.maxLength = Number(value);
            } else {
                delete item.maxLength;
            }
            return;
        }
        if (fieldName === "answerValueSet") {
            if (value) {
                item.answerValueSet = value;
            } else {
                delete item.answerValueSet;
            }
            return;
        }
        if (fieldName === "enableBehavior") {
            item.enableBehavior = value || "all";
            return;
        }
        if (fieldName === "initial") {
            setInitial(item, value);
            return;
        }
        if (fieldName === "qtyUnit") {
            item.initial = item.initial || [{ valueQuantity: {} }];
            item.initial[0].valueQuantity = item.initial[0].valueQuantity || {};
            if (value) {
                item.initial[0].valueQuantity.unit = value;
            } else {
                delete item.initial[0].valueQuantity.unit;
            }
            return;
        }
        if (fieldName === "refTarget") {
            return;
        }
        if (value) {
            item[fieldName] = value;
        } else {
            delete item[fieldName];
        }
    }

    function refreshItemUi(rebuildInspector) {
        renderTree();
        if (rebuildInspector) {
            renderInspector();
        }
        renderPreview();
    }

    function addRootItem(type) {
        questionnaire.item = questionnaire.item || [];
        questionnaire.item.push(emptyItem(type, null));
        selectedPath = String(questionnaire.item.length - 1);
        refreshItemUi(true);
    }

    function addChild(path) {
        const parent = itemAt(path);
        if (!parent || parent.type !== "group") {
            return;
        }
        parent.item = parent.item || [];
        parent.item.push(emptyItem("string", parent));
        selectedPath = path + "." + (parent.item.length - 1);
        refreshItemUi(true);
    }

    function moveItem(path, delta) {
        const ctx = parentContext(path);
        const next = ctx.index + delta;
        if (ctx.index < 0 || next < 0 || next >= ctx.list.length) {
            return;
        }
        const swap = ctx.list[ctx.index];
        ctx.list[ctx.index] = ctx.list[next];
        ctx.list[next] = swap;
        const parts = parsePath(path);
        parts[parts.length - 1] = next;
        selectedPath = parts.join(".");
        refreshItemUi(true);
    }

    function duplicateItem(path) {
        const ctx = parentContext(path);
        const item = ctx.list[ctx.index];
        if (!item) {
            return;
        }
        ctx.list.splice(ctx.index + 1, 0, cloneItem(item));
        const parts = parsePath(path);
        parts[parts.length - 1] = ctx.index + 1;
        selectedPath = parts.join(".");
        refreshItemUi(true);
    }

    function removeItem(path) {
        const ctx = parentContext(path);
        if (ctx.index < 0) {
            return;
        }
        ctx.list.splice(ctx.index, 1);
        if (ctx.parent && ctx.parent.type === "group" && !ctx.list.length) {
            ctx.parent.item = [];
        }
        selectedPath = ctx.list.length
            ? (parsePath(path).slice(0, -1).concat([Math.min(ctx.index, ctx.list.length - 1)]).join(".") || "0")
            : (parsePath(path).slice(0, -1).join("."));
        if (selectedPath === "" && (questionnaire.item || []).length) {
            selectedPath = "0";
        }
        refreshItemUi(true);
    }

    function previewValue(item) {
        if (Object.prototype.hasOwnProperty.call(previewAnswers, item.linkId)) {
            return previewAnswers[item.linkId];
        }
        const initial = (item.initial && item.initial[0]) || {};
        if (item.type === "boolean") {
            return initial.valueBoolean;
        }
        if (item.type === "integer") {
            return initial.valueInteger;
        }
        if (item.type === "decimal") {
            return initial.valueDecimal;
        }
        if (item.type === "coding") {
            return initial.valueCoding && (initial.valueCoding.code || initial.valueCoding.display);
        }
        return initial.valueString || initial.valueDate || initial.valueTime || initial.valueUri || "";
    }

    function comparePreview(left, operator, right) {
        if (operator === "exists") {
            return right === false ? left == null || left === "" : !(left == null || left === "");
        }
        if (left == null || left === "") {
            return false;
        }
        if (operator === "=") {
            return String(left) === String(right);
        }
        if (operator === "!=") {
            return String(left) !== String(right);
        }
        const a = Number(left);
        const b = Number(right);
        if (operator === ">") {
            return a > b;
        }
        if (operator === "<") {
            return a < b;
        }
        if (operator === ">=") {
            return a >= b;
        }
        if (operator === "<=") {
            return a <= b;
        }
        return false;
    }

    function enableAnswerValue(rule) {
        if (rule.operator === "exists") {
            return rule.answerBoolean !== false;
        }
        if (rule.answerBoolean != null) {
            return rule.answerBoolean;
        }
        if (rule.answerCoding) {
            return rule.answerCoding.code || rule.answerCoding.display;
        }
        return rule.answerString != null ? rule.answerString
            : rule.answerInteger != null ? rule.answerInteger
                : rule.answerDecimal != null ? rule.answerDecimal
                    : rule.answerDate || rule.answerDateTime || rule.answerTime || "";
    }

    function isEnabled(item) {
        const rules = item.enableWhen || [];
        if (!rules.length) {
            return true;
        }
        const results = rules.map(function (rule) {
            const source = findItemByLinkId(rule.question);
            const actual = source ? previewValue(source) : undefined;
            return comparePreview(actual, rule.operator || "=", enableAnswerValue(rule));
        });
        return item.enableBehavior === "any" ? results.some(Boolean) : results.every(Boolean);
    }

    function previewControl(item) {
        const value = previewValue(item);
        const name = "pv-" + item.linkId;
        const disabled = item.readOnly ? " disabled" : "";
        if (item.type === "boolean") {
            return '<div class="form-check"><input class="form-check-input" type="checkbox" data-preview="' +
                esc(item.linkId) + '"' + (value === true ? " checked" : "") + disabled + ">" +
                '<label class="form-check-label">Yes</label></div>';
        }
        if (item.type === "text") {
            return '<textarea class="form-control" data-preview="' + esc(item.linkId) + '" rows="3"' +
                disabled + ">" + esc(value || "") + "</textarea>";
        }
        if (item.type === "integer" || item.type === "decimal" || item.type === "quantity") {
            return '<div class="input-group"><input class="form-control" data-preview="' +
                esc(item.linkId) + '" type="number" value="' + esc(value == null ? "" : value) + '"' +
                disabled + ">" +
                (item.type === "quantity" && item.initial && item.initial[0] && item.initial[0].valueQuantity
                    && item.initial[0].valueQuantity.unit
                    ? '<span class="input-group-text">' + esc(item.initial[0].valueQuantity.unit) + "</span>"
                    : "") +
                "</div>";
        }
        if (item.type === "date") {
            return '<input class="form-control" data-preview="' + esc(item.linkId) + '" type="date" value="' +
                esc(value || "") + '"' + disabled + ">";
        }
        if (item.type === "dateTime") {
            return '<input class="form-control" data-preview="' + esc(item.linkId) + '" type="datetime-local" value="' +
                esc(String(value || "").slice(0, 16)) + '"' + disabled + ">";
        }
        if (item.type === "time") {
            return '<input class="form-control" data-preview="' + esc(item.linkId) + '" type="time" value="' +
                esc(value || "") + '"' + disabled + ">";
        }
        if (item.type === "attachment") {
            return '<input class="form-control" type="file" disabled>';
        }
        if (item.type === "coding" && (item.answerOption || []).length) {
            return '<select class="form-select" data-preview="' + esc(item.linkId) + '"' + disabled + ">" +
                '<option value=""></option>' +
                item.answerOption.map(function (option) {
                    const label = optionLabel(option, "coding");
                    return '<option value="' + esc(label) + '"' + (String(value) === label ? " selected" : "") +
                        ">" + esc(label) + "</option>";
                }).join("") +
                "</select>";
        }
        if (item.type === "coding" && item.answerValueSet) {
            const concepts = valueSetCache[item.answerValueSet];
            if (!concepts) {
                expandValueSet(item.answerValueSet);
                return '<select class="form-select" data-preview="' + esc(item.linkId) + '" disabled>' +
                    "<option>Loading value set…</option></select>";
            }
            return '<select class="form-select" data-preview="' + esc(item.linkId) + '"' + disabled + ">" +
                '<option value=""></option>' +
                concepts.map(function (concept) {
                    const label = concept.display || concept.code;
                    return '<option value="' + esc(concept.code) + '"' +
                        (String(value) === String(concept.code) ? " selected" : "") + ">" +
                        esc(label) + "</option>";
                }).join("") +
                "</select>";
        }
        return '<input class="form-control" data-preview="' + esc(item.linkId) + '" value="' +
            esc(value || "") + '"' + (item.type === "url" ? ' inputmode="url"' : "") +
            disabled + " id=\"" + esc(name) + '">';
    }

    function expandValueSet(url) {
        if (!url || valueSetCache[url] === "pending") {
            return;
        }
        valueSetCache[url] = "pending";
        CadminApi.fhir("/ValueSet/$expand?url=" + encodeURIComponent(url) + "&count=50").done(function (vs) {
            const contains = (vs.expansion && vs.expansion.contains) || [];
            valueSetCache[url] = contains.map(function (item) {
                return { code: item.code, display: item.display || item.code };
            });
            renderPreview();
        }).fail(function () {
            valueSetCache[url] = [];
            renderPreview();
        });
    }

    function previewBlock(item, depth) {
        if (!isEnabled(item)) {
            return "";
        }
        if (item.type === "display") {
            return '<p class="text-muted mb-3">' + esc(item.text || "") + "</p>";
        }
        if (item.type === "group") {
            return '<fieldset class="q-preview-group mb-3">' +
                "<legend class=\"h6\">" + esc([item.prefix, item.text].filter(Boolean).join(" ") || "Group") +
                "</legend>" +
                (item.item || []).map(function (child) {
                    return previewBlock(child, depth + 1);
                }).join("") +
                "</fieldset>";
        }
        const required = item.required ? ' <span class="text-danger">*</span>' : "";
        const repeats = item.repeats ? ' <span class="small text-muted">(repeats)</span>' : "";
        return '<div class="mb-3">' +
            '<label class="form-label">' + esc([item.prefix, item.text || item.linkId].filter(Boolean).join(" ")) +
            required + repeats + "</label>" +
            previewControl(item) +
            "</div>";
    }

    function renderPreview() {
        const items = questionnaire.item || [];
        if (!items.length) {
            $("#qd-preview").html('<div class="text-muted">Add items to preview the form.</div>');
            return;
        }
        $("#qd-preview").html(items.map(function (item) {
            return previewBlock(item, 0);
        }).join(""));
    }

    function bind() {
        const $root = $(CadminWorkspace.root());
        $root.off(".qdetail");

        $root.on("click.qdetail", "[data-select]", function (event) {
            if ($(event.target).closest("button").length) {
                return;
            }
            selectedPath = $(this).attr("data-select");
            renderTree();
            renderInspector();
        });
        $root.on("click.qdetail", "#qd-add-group", function () {
            addRootItem("group");
        });
        $root.on("click.qdetail", "#qd-add-question", function () {
            addRootItem("string");
        });
        $root.on("click.qdetail", "[data-add-child]", function () {
            addChild($(this).attr("data-add-child"));
        });
        $root.on("click.qdetail", "[data-move-up]", function () {
            moveItem($(this).attr("data-move-up"), -1);
        });
        $root.on("click.qdetail", "[data-move-down]", function () {
            moveItem($(this).attr("data-move-down"), 1);
        });
        $root.on("click.qdetail", "[data-dup-item]", function () {
            duplicateItem($(this).attr("data-dup-item"));
        });
        $root.on("click.qdetail", "[data-remove-item]", function () {
            removeItem($(this).attr("data-remove-item"));
        });
        $root.on("change.qdetail input.qdetail", "[data-item-field]", function () {
            const item = itemAt(selectedPath);
            if (!item) {
                return;
            }
            const fieldName = $(this).attr("data-item-field");
            applyItemField(item, fieldName, $(this));
            refreshItemUi(fieldName === "type");
        });
        $root.on("click.qdetail", "[data-add-option]", function () {
            const item = itemAt(selectedPath);
            if (!item) {
                return;
            }
            item.answerOption = item.answerOption || [];
            const option = {};
            setOptionValue(item, option, "option-" + (item.answerOption.length + 1));
            item.answerOption.push(option);
            refreshItemUi(true);
        });
        $root.on("input.qdetail", "[data-option-value]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-option-value"));
            if (!item || !item.answerOption || !item.answerOption[index]) {
                return;
            }
            setOptionValue(item, item.answerOption[index], $(this).val());
            renderPreview();
        });
        $root.on("click.qdetail", "[data-remove-option]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-remove-option"));
            if (!item) {
                return;
            }
            item.answerOption.splice(index, 1);
            if (!item.answerOption.length) {
                delete item.answerOption;
            }
            refreshItemUi(true);
        });
        $root.on("click.qdetail", "[data-add-enable]", function () {
            const item = itemAt(selectedPath);
            if (!item) {
                return;
            }
            item.enableWhen = item.enableWhen || [];
            item.enableWhen.push({ operator: "=" });
            item.enableBehavior = item.enableBehavior || "all";
            refreshItemUi(true);
        });
        $root.on("change.qdetail", "[data-enable-q]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-enable-q"));
            if (!item || !item.enableWhen || !item.enableWhen[index]) {
                return;
            }
            item.enableWhen[index].question = $(this).val();
            renderPreview();
        });
        $root.on("change.qdetail", "[data-enable-op]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-enable-op"));
            if (!item || !item.enableWhen || !item.enableWhen[index]) {
                return;
            }
            item.enableWhen[index].operator = $(this).val();
            refreshItemUi(true);
        });
        $root.on("input.qdetail", "[data-enable-ans]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-enable-ans"));
            const rule = item && item.enableWhen && item.enableWhen[index];
            if (!rule) {
                return;
            }
            const source = findItemByLinkId(rule.question);
            setEnableAnswer(rule, source && source.type, $(this).val());
            renderPreview();
        });
        $root.on("click.qdetail", "[data-remove-enable]", function () {
            const item = itemAt(selectedPath);
            const index = Number($(this).attr("data-remove-enable"));
            if (!item) {
                return;
            }
            item.enableWhen.splice(index, 1);
            if (!item.enableWhen.length) {
                delete item.enableWhen;
                delete item.enableBehavior;
            }
            refreshItemUi(true);
        });
        $root.on("change.qdetail input.qdetail", "[data-preview]", function () {
            const linkId = $(this).attr("data-preview");
            if ($(this).is(":checkbox")) {
                previewAnswers[linkId] = $(this).is(":checked");
            } else {
                previewAnswers[linkId] = $(this).val();
            }
            renderPreview();
        });
        $root.on("click.qdetail", "#qd-save", function () {
            saveQuestionnaire(function () {
                alertMsg("success", "Questionnaire saved.");
            });
        });
        $root.on("click.qdetail", "#qd-delete", function () {
            if (!window.confirm("Delete this questionnaire?")) {
                return;
            }
            CadminApi.fhir("/Questionnaire/" + encodeURIComponent(questionnaire.id), "DELETE").done(function () {
                alertMsg("success", "Questionnaire deleted.");
                window.location.hash = "#/questionnaires";
            }).fail(function (xhr) {
                fail("Delete questionnaire", xhr);
            });
        });

        $("#qd-meta-form").on("submit", function (event) {
            event.preventDefault();
            questionnaire.title = $("#qd-title-input").val().trim();
            const name = $("#qd-name").val().trim();
            const url = $("#qd-url").val().trim();
            const version = $("#qd-version").val().trim();
            const publisher = $("#qd-publisher").val().trim();
            const description = $("#qd-description").val().trim();
            const purpose = $("#qd-purpose").val().trim();
            questionnaire.status = $("#qd-status").val() || "draft";
            if (name) {
                questionnaire.name = name;
            } else {
                delete questionnaire.name;
            }
            if (url) {
                questionnaire.url = url;
            } else {
                delete questionnaire.url;
            }
            if (version) {
                questionnaire.version = version;
            } else {
                delete questionnaire.version;
            }
            if (publisher) {
                questionnaire.publisher = publisher;
            } else {
                delete questionnaire.publisher;
            }
            if (description) {
                questionnaire.description = description;
            } else {
                delete questionnaire.description;
            }
            if (purpose) {
                questionnaire.purpose = purpose;
            } else {
                delete questionnaire.purpose;
            }
            const subjects = [];
            subjectTypes.forEach(function (item) {
                if ($("#qd-st-" + item.code).is(":checked")) {
                    subjects.push(item.code);
                }
            });
            if (subjects.length) {
                questionnaire.subjectType = subjects;
            } else {
                delete questionnaire.subjectType;
            }
            const start = $("#qd-period-start").val();
            const end = $("#qd-period-end").val();
            if (start || end) {
                questionnaire.effectivePeriod = {};
                if (start) {
                    questionnaire.effectivePeriod.start = start;
                }
                if (end) {
                    questionnaire.effectivePeriod.end = end;
                }
            } else {
                delete questionnaire.effectivePeriod;
            }
            saveQuestionnaire(function () {
                hideModal("qd-meta-modal");
                alertMsg("success", "Metadata updated.");
            });
        });
    }

    return {
        render: render
    };
}());
