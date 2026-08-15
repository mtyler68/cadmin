window.CadminPdsPolicyDetail = (function () {
    const libraryType = "pds-policies";
    const statusOptions = [
        { code: "draft", display: "Draft" },
        { code: "active", display: "Active" },
        { code: "retired", display: "Retired" },
        { code: "unknown", display: "Unknown" }
    ];
    const applyOptions = [
        { code: "deny-overrides", display: "Deny overrides" },
        { code: "permit-overrides", display: "Permit overrides" }
    ];
    const policyContentType = "application/x-policy+x-yaml";
    const contentTypes = [
        { code: "text/plain", display: "Plain text" },
        { code: "application/json", display: "JSON" },
        { code: "application/xml", display: "XML" },
        { code: "text/cql", display: "CQL" },
        { code: "text/markdown", display: "Markdown" }
    ];
    const artifactTypes = [
        { code: "documentation", display: "Documentation" },
        { code: "justification", display: "Justification" },
        { code: "citation", display: "Citation" },
        { code: "predecessor", display: "Predecessor" },
        { code: "successor", display: "Successor" },
        { code: "derived-from", display: "Derived from" },
        { code: "depends-on", display: "Depends on" },
        { code: "composed-of", display: "Composed of" }
    ];

    let library = null;
    let otherPolicies = [];
    let targetEditor = null;
    let yamlPreviewEditor = null;
    let springElModeDefined = false;

    const spelKeywords = {
        "true": true,
        "false": true,
        "null": true,
        "new": true,
        "instanceof": true,
        "matches": true,
        "between": true,
        "and": true,
        "or": true,
        "not": true,
        "eq": true,
        "ne": true,
        "lt": true,
        "le": true,
        "gt": true,
        "ge": true
    };

    function defineSpringElMode() {
        if (typeof CodeMirror === "undefined" || springElModeDefined) {
            return;
        }
        springElModeDefined = true;
        CodeMirror.defineMode("springel", function () {
            function tokenString(quote) {
                return function (stream, state) {
                    let escaped = false;
                    let next;
                    while ((next = stream.next()) != null) {
                        if (quote === "'" && next === "'" && stream.peek() === "'") {
                            stream.next();
                            continue;
                        }
                        if (next === quote && !escaped) {
                            state.tokenize = tokenBase;
                            break;
                        }
                        escaped = quote === '"' && !escaped && next === "\\";
                    }
                    return "string";
                };
            }

            function tokenBase(stream, state) {
                if (stream.eatSpace()) {
                    return null;
                }
                const ch = stream.next();
                if (ch === "'" || ch === '"') {
                    state.tokenize = tokenString(ch);
                    return state.tokenize(stream, state);
                }
                if (ch === "/" && stream.eat("/")) {
                    stream.skipToEnd();
                    return "comment";
                }
                if (/\d/.test(ch)) {
                    if (ch === "0" && stream.eat(/[xX]/)) {
                        stream.eatWhile(/[0-9a-fA-F]/);
                        return "number";
                    }
                    stream.eatWhile(/\d/);
                    if (stream.peek() === ".") {
                        stream.next();
                        if (!stream.eatWhile(/\d/)) {
                            stream.backUp(1);
                        }
                    }
                    stream.match(/^[eE][+-]?\d+/);
                    stream.eat(/[lLfFdD]/);
                    return "number";
                }
                if (ch === "#") {
                    if (stream.match(/^[A-Za-z_][\w$]*/) || stream.eat("{")) {
                        return "variable-2";
                    }
                    return "operator";
                }
                if (ch === "@") {
                    stream.match(/^[A-Za-z_][\w$]*/);
                    return "atom";
                }
                if (ch === "T" && stream.peek() === "(") {
                    return "builtin";
                }
                if (ch === "?" && /[:.]/.test(stream.peek() || "")) {
                    stream.next();
                    return "operator";
                }
                if ((ch === "!" || ch === "^" || ch === "$") && stream.peek() === "[") {
                    return "operator";
                }
                if ((ch === "=" || ch === "!" || ch === "<" || ch === ">") && stream.peek() === "=") {
                    stream.next();
                    return "operator";
                }
                if (ch === "&" && stream.peek() === "&") {
                    stream.next();
                    return "operator";
                }
                if (ch === "|" && stream.peek() === "|") {
                    stream.next();
                    return "operator";
                }
                if ("()[]{}".indexOf(ch) >= 0) {
                    return "bracket";
                }
                if ("+-*/%^=!<>&|?:.,;$".indexOf(ch) >= 0) {
                    return "operator";
                }
                stream.backUp(1);
                const word = stream.match(/^[A-Za-z_$][\w$]*/);
                if (word) {
                    return spelKeywords[word[0]] ? "keyword" : "variable";
                }
                stream.next();
                return null;
            }

            return {
                startState: function () {
                    return { tokenize: tokenBase };
                },
                token: function (stream, state) {
                    return state.tokenize(stream, state);
                },
                lineComment: "//"
            };
        });
        CodeMirror.defineMIME("text/x-springel", "springel");
    }

    function spelStringMask(text) {
        const mask = [];
        let i = 0;
        while (i < text.length) {
            const ch = text.charAt(i);
            if (ch === "'" || ch === '"') {
                const quote = ch;
                mask[i] = false;
                i += 1;
                while (i < text.length) {
                    if (quote === "'" && text.charAt(i) === "'" && text.charAt(i + 1) === "'") {
                        mask[i] = true;
                        mask[i + 1] = true;
                        i += 2;
                        continue;
                    }
                    if (quote === '"' && text.charAt(i) === "\\") {
                        mask[i] = true;
                        i += 1;
                        if (i < text.length) {
                            mask[i] = true;
                            i += 1;
                        }
                        continue;
                    }
                    if (text.charAt(i) === quote) {
                        mask[i] = false;
                        i += 1;
                        break;
                    }
                    mask[i] = true;
                    i += 1;
                }
                continue;
            }
            mask[i] = false;
            i += 1;
        }
        return mask;
    }

    function currentParameterRange(text, index) {
        if (!text || index < 0 || index > text.length) {
            return null;
        }
        const inString = spelStringMask(text);
        if (index < inString.length && inString[index]) {
            return null;
        }
        const pairs = { "(": ")", "[": "]", "{": "}" };
        const closers = { ")": "(", "]": "[", "}": "{" };
        let openPos = -1;
        let opener = "";
        let depth = 0;
        for (let i = index - 1; i >= 0; i -= 1) {
            if (inString[i]) {
                continue;
            }
            const ch = text.charAt(i);
            if (closers[ch]) {
                depth += 1;
            } else if (pairs[ch]) {
                if (depth === 0) {
                    openPos = i;
                    opener = ch;
                    break;
                }
                depth -= 1;
            }
        }
        if (openPos < 0) {
            return null;
        }
        const closer = pairs[opener];
        depth = 0;
        let closePos = -1;
        for (let i = openPos + 1; i < text.length; i += 1) {
            if (inString[i]) {
                continue;
            }
            const ch = text.charAt(i);
            if (ch === opener) {
                depth += 1;
            } else if (ch === closer) {
                if (depth === 0) {
                    closePos = i;
                    break;
                }
                depth -= 1;
            }
        }
        if (index === openPos || (closePos >= 0 && index === closePos)) {
            return { open: openPos, close: closePos, arg: null };
        }
        if (closePos < 0 && index < openPos) {
            return null;
        }
        const endLimit = closePos >= 0 ? closePos : text.length;
        const args = [];
        let start = openPos + 1;
        depth = 0;
        for (let i = openPos + 1; i < endLimit; i += 1) {
            if (inString[i]) {
                continue;
            }
            const ch = text.charAt(i);
            if (pairs[ch]) {
                depth += 1;
            } else if (closers[ch]) {
                depth -= 1;
            } else if (ch === "," && depth === 0) {
                args.push({ start: start, end: i });
                start = i + 1;
            }
        }
        args.push({ start: start, end: endLimit });
        let arg = null;
        args.forEach(function (item) {
            if (index >= item.start && index <= item.end) {
                arg = item;
            }
        });
        return { open: openPos, close: closePos, arg: arg };
    }

    function trimParameterArg(text, arg) {
        if (!arg) {
            return null;
        }
        let start = arg.start;
        let end = arg.end;
        while (start < end && /\s/.test(text.charAt(start))) {
            start += 1;
        }
        while (end > start && /\s/.test(text.charAt(end - 1))) {
            end -= 1;
        }
        if (end <= start) {
            return null;
        }
        return { start: start, end: end };
    }

    function bindParameterMatch(cm) {
        let marks = [];
        function clearMarks() {
            marks.forEach(function (mark) { mark.clear(); });
            marks = [];
        }
        function refreshMarks() {
            clearMarks();
            const text = cm.getValue();
            const range = currentParameterRange(text, cm.indexFromPos(cm.getCursor()));
            if (!range) {
                return;
            }
            function pos(index) {
                return cm.posFromIndex(index);
            }
            marks.push(cm.markText(pos(range.open), pos(range.open + 1), {
                className: "spel-param-bracket",
                inclusiveLeft: false,
                inclusiveRight: false
            }));
            if (range.close >= 0) {
                marks.push(cm.markText(pos(range.close), pos(range.close + 1), {
                    className: "spel-param-bracket",
                    inclusiveLeft: false,
                    inclusiveRight: false
                }));
            }
            const arg = trimParameterArg(text, range.arg);
            if (arg) {
                marks.push(cm.markText(pos(arg.start), pos(arg.end), {
                    className: "spel-current-param",
                    inclusiveLeft: false,
                    inclusiveRight: false
                }));
            }
        }
        cm.on("cursorActivity", refreshMarks);
        cm.on("changes", refreshMarks);
        refreshMarks();
    }

    function attachSpelEditor(textarea, minHeight) {
        if (typeof CodeMirror === "undefined" || !textarea) {
            return null;
        }
        defineSpringElMode();
        const cm = CodeMirror.fromTextArea(textarea, {
            mode: "springel",
            theme: "default",
            lineWrapping: true,
            viewportMargin: Infinity,
            matchBrackets: true,
            highlightSelectionMatches: {
                minChars: 2,
                delay: 80,
                wordsOnly: false,
                showToken: /[#@A-Za-z0-9_$]/,
                trim: true
            },
            extraKeys: { Tab: false, "Shift-Tab": false }
        });
        if (minHeight) {
            cm.getWrapperElement().style.minHeight = minHeight;
        }
        bindParameterMatch(cm);
        requestAnimationFrame(function () {
            cm.refresh();
        });
        return cm;
    }

    function teardownSpelEditors() {
        teardownYamlPreview();
        if (targetEditor) {
            targetEditor.toTextArea();
            targetEditor = null;
        }
        $("#pd-policy-ontarget .pd-ontarget-row").each(function () {
            const cm = $(this).data("cm");
            if (cm) {
                cm.toTextArea();
                $(this).removeData("cm");
            }
        });
    }

    function attachOnTargetEditor($row) {
        const textarea = $row.find("textarea.pd-ontarget-value")[0];
        const cm = attachSpelEditor(textarea, "3.5rem");
        if (cm) {
            $row.data("cm", cm);
        }
    }

    function esc(value) {
        return CadminApi.escapeHtml(value);
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

    function statusLabel(code) {
        const match = statusOptions.find(function (option) { return option.code === code; });
        return match ? match.display : (code || "—");
    }

    function statusBadge(status) {
        const kind = status === "active" ? "success" : status === "retired" ? "secondary" : status === "draft" ? "warning" : "info";
        return '<span class="badge text-bg-' + kind + '">' + esc(statusLabel(status)) + "</span>";
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

    function modal(id, title, body, formId, large) {
        return '<div class="modal fade" id="' + id + '" tabindex="-1">' +
            '<div class="modal-dialog' + (large ? " modal-lg" : "") + '">' +
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

    function viewModal(id, title, body) {
        return '<div class="modal fade" id="' + id + '" tabindex="-1">' +
            '<div class="modal-dialog modal-lg">' +
                '<div class="modal-content">' +
                    '<div class="modal-header"><h5 class="modal-title">' + title + "</h5>" +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                    '<div class="modal-body">' + body + "</div>" +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>' +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function field(label, control) {
        return '<div class="mb-3"><label class="form-label">' + label + "</label>" + control + "</div>";
    }

    function setOrDelete(obj, key, value) {
        if (value) {
            obj[key] = value;
        } else {
            delete obj[key];
        }
    }

    function yamlScalar(value) {
        const text = value == null ? "" : String(value);
        if (text === "") {
            return '""';
        }
        if (/[\n\r]/.test(text)) {
            return "|\n" + text.split(/\r?\n/).map(function (line) {
                return "  " + line;
            }).join("\n");
        }
        if (/[:#\[\]{}&*!|>'"%@`]/.test(text)
                || /^\s|\s$/.test(text)
                || /^(true|false|null|yes|no|on|off)$/i.test(text)
                || (/^[-+]?[0-9]/.test(text) && !isNaN(text))) {
            return JSON.stringify(text);
        }
        return text;
    }

    function unquoteYaml(value) {
        const text = (value || "").trim();
        if ((text.charAt(0) === '"' && text.charAt(text.length - 1) === '"')
                || (text.charAt(0) === "'" && text.charAt(text.length - 1) === "'")) {
            try {
                if (text.charAt(0) === '"') {
                    return JSON.parse(text);
                }
                return text.slice(1, -1);
            } catch (err) {
                return text.slice(1, -1);
            }
        }
        return text;
    }

    function dumpPolicyYaml(policy) {
        const imports = (policy.imports || []).filter(Boolean);
        const onTarget = (policy.onTarget || []).filter(Boolean);
        let yaml = "id: " + yamlScalar(policy.id) + "\n";
        yaml += "description: " + yamlScalar(policy.description || "") + "\n";
        yaml += "version: " + yamlScalar(policy.version || "") + "\n";
        yaml += "status: " + yamlScalar(policy.status || "draft") + "\n";
        if (!imports.length) {
            yaml += "imports: []\n";
        } else {
            yaml += "imports:\n";
            imports.forEach(function (id) {
                yaml += "  - " + JSON.stringify(String(id)) + "\n";
            });
        }
        yaml += "target: " + yamlScalar(policy.target || "") + "\n";
        yaml += "apply: " + yamlScalar(policy.apply || "deny-overrides") + "\n";
        if (!onTarget.length) {
            yaml += "onTarget: []\n";
        } else {
            yaml += "onTarget:\n";
            onTarget.forEach(function (statement) {
                yaml += "  - " + JSON.stringify(String(statement)) + "\n";
            });
        }
        return yaml;
    }

    function parseInlineList(raw) {
        const inner = String(raw || "").trim();
        if (inner.charAt(0) !== "[" || inner.charAt(inner.length - 1) !== "]") {
            return [];
        }
        const body = inner.slice(1, -1).trim();
        if (!body) {
            return [];
        }
        return body.split(",").map(function (item) {
            return unquoteYaml(item);
        }).filter(Boolean);
    }

    function parseYamlList(text, key) {
        const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
        const items = [];
        let inList = false;
        const keyPattern = new RegExp("^" + key + "\\s*:");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (keyPattern.test(line)) {
                inList = true;
                items.length = 0;
                const rest = line.replace(keyPattern, "").replace(/^\s*/, "").trim();
                if (rest === "[]") {
                    return [];
                }
                if (rest.charAt(0) === "[" && rest.charAt(rest.length - 1) === "]") {
                    return parseInlineList(rest);
                }
                continue;
            }
            if (!inList) {
                continue;
            }
            if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line)) {
                break;
            }
            const item = line.match(/^[ \t]*-[ \t]+(.*)$/);
            if (item) {
                const value = unquoteYaml(item[1]);
                if (value && value !== "[]") {
                    items.push(value);
                }
            }
        }
        return items;
    }

    function parsePolicyYaml(text) {
        const result = {
            id: "",
            description: "",
            version: "",
            status: "draft",
            imports: [],
            target: "",
            apply: "deny-overrides",
            onTarget: []
        };
        if (!text || !String(text).trim()) {
            return result;
        }
        const lines = String(text).replace(/\r\n/g, "\n").split("\n");
        let inBlock = false;
        let blockKey = "";
        let blockLines = [];

        function finishBlock() {
            if (inBlock) {
                result[blockKey] = blockLines.join("\n").replace(/\n+$/, "");
                inBlock = false;
                blockLines = [];
            }
        }

        lines.forEach(function (line) {
            if (inBlock) {
                if (line.indexOf("  ") === 0 || line === "") {
                    blockLines.push(line.indexOf("  ") === 0 ? line.slice(2) : line);
                    return;
                }
                finishBlock();
            }
            const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
            if (!keyMatch) {
                return;
            }
            const key = keyMatch[1];
            const rest = keyMatch[2];
            if (key === "imports" || key === "onTarget") {
                return;
            }
            if (rest === "|" || rest === ">" || rest === "|-" || rest === "|+") {
                inBlock = true;
                blockKey = key;
                blockLines = [];
                return;
            }
            if (key === "id" || key === "description" || key === "version" || key === "status"
                    || key === "target" || key === "apply") {
                result[key] = unquoteYaml(rest);
            }
        });
        finishBlock();
        result.imports = parseYamlList(text, "imports");
        result.onTarget = parseYamlList(text, "onTarget");
        return result;
    }

    function isPolicyYaml(item) {
        const type = ((item && item.contentType) || "").split(";")[0].trim().toLowerCase();
        return type === policyContentType;
    }

    function findPolicyAttachment() {
        return (library.content || []).find(isPolicyYaml);
    }

    function readPolicyDocument() {
        const attachment = findPolicyAttachment();
        const parsed = attachment && attachment.data ? parsePolicyYaml(decodeText(attachment.data)) : {};
        const imports = Array.isArray(parsed.imports) ? parsed.imports.filter(Boolean) : [];
        const onTarget = Array.isArray(parsed.onTarget) ? parsed.onTarget.filter(Boolean) : [];
        return {
            id: parsed.id || library.name || "",
            description: parsed.description || library.description || "",
            version: parsed.version || library.version || "",
            status: parsed.status || library.status || "draft",
            imports: imports,
            target: parsed.target || "",
            apply: parsed.apply || "deny-overrides",
            onTarget: onTarget
        };
    }

    function upsertPolicyYaml(policy) {
        const yaml = dumpPolicyYaml(policy);
        const attachment = {
            contentType: policyContentType,
            title: "Policy",
            data: encodeText(yaml)
        };
        library.content = library.content || [];
        let found = false;
        library.content = library.content.map(function (item) {
            if (!isPolicyYaml(item)) {
                return item;
            }
            found = true;
            attachment.title = item.title || attachment.title;
            return attachment;
        });
        if (!found) {
            library.content.push(attachment);
        }
    }

    function applyPolicyDocument(policy) {
        setOrDelete(library, "name", policy.id);
        setOrDelete(library, "description", policy.description);
        setOrDelete(library, "version", policy.version);
        library.status = policy.status || "draft";
        upsertPolicyYaml(policy);
    }

    function syncYamlFromLibraryIfPresent() {
        if (!findPolicyAttachment()) {
            return;
        }
        const current = readPolicyDocument();
        current.id = library.name || current.id;
        current.description = library.description || "";
        current.version = library.version || "";
        current.status = library.status || "draft";
        upsertPolicyYaml(current);
    }

    function importOptionHtml(selected) {
        const names = {};
        let html = '<option value="">Select a policy…</option>';
        otherPolicies.forEach(function (policy) {
            names[policy.name] = true;
            const label = policy.title && policy.title !== policy.name
                ? policy.name + " — " + policy.title
                : policy.name;
            html += '<option value="' + esc(policy.name) + '"' +
                (policy.name === selected ? " selected" : "") + ">" + esc(label) + "</option>";
        });
        if (selected && !names[selected]) {
            html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + "</option>";
        }
        if (!otherPolicies.length && !selected) {
            html += '<option value="" disabled>No other named policies</option>';
        }
        return html;
    }

    function importRowHtml(value) {
        return '<div class="input-group mb-2 pd-import-row">' +
            '<select class="form-select font-monospace pd-import-value">' + importOptionHtml(value) + "</select>" +
            '<button class="btn btn-outline-danger" type="button" data-import-remove title="Remove import">' +
                '<i class="bi bi-x-lg"></i></button>' +
            "</div>";
    }

    function collectImports(excludeId) {
        const imports = [];
        const seen = {};
        $("#pd-policy-imports .pd-import-value").each(function () {
            const value = ($(this).val() || "").trim();
            if (!value || value === excludeId || seen[value]) {
                return;
            }
            seen[value] = true;
            imports.push(value);
        });
        return imports;
    }

    function onTargetRowHtml(value) {
        return '<div class="d-flex align-items-stretch gap-2 mb-2 pd-ontarget-row">' +
            '<div class="spel-host flex-grow-1 min-w-0">' +
                '<textarea class="form-control font-monospace pd-ontarget-value" rows="2" placeholder="SpringEL statement">' +
                    esc(value || "") + "</textarea>" +
            "</div>" +
            '<button class="btn btn-outline-danger align-self-start" type="button" data-ontarget-remove title="Remove statement">' +
                '<i class="bi bi-x-lg"></i></button>' +
            "</div>";
    }

    function collectOnTarget() {
        const statements = [];
        $("#pd-policy-ontarget .pd-ontarget-row").each(function () {
            const cm = $(this).data("cm");
            const value = (cm ? cm.getValue() : ($(this).find(".pd-ontarget-value").val() || "")).trim();
            if (value) {
                statements.push(value);
            }
        });
        return statements;
    }

    function collectPolicyForm() {
        return {
            id: ($("#pd-policy-id").val() || "").trim(),
            description: ($("#pd-policy-description").val() || "").trim(),
            version: ($("#pd-policy-version").val() || "").trim(),
            status: $("#pd-policy-status").val() || "draft",
            imports: collectImports(($("#pd-policy-id").val() || "").trim()),
            target: (targetEditor ? targetEditor.getValue() : ($("#pd-policy-target").val() || "")).trim(),
            apply: $("#pd-policy-apply").val() || "deny-overrides",
            onTarget: collectOnTarget()
        };
    }

    function teardownYamlPreview() {
        if (yamlPreviewEditor) {
            yamlPreviewEditor.toTextArea();
            yamlPreviewEditor = null;
        }
    }

    function showGeneratedYaml() {
        const yaml = dumpPolicyYaml(collectPolicyForm());
        const textarea = document.getElementById("pd-yaml-preview");
        if (!textarea) {
            return;
        }
        teardownYamlPreview();
        textarea.value = yaml;
        if (typeof CodeMirror === "undefined") {
            return;
        }
        yamlPreviewEditor = CodeMirror.fromTextArea(textarea, {
            mode: "yaml",
            theme: "default",
            readOnly: true,
            lineNumbers: true,
            lineWrapping: true,
            viewportMargin: Infinity
        });
        yamlPreviewEditor.setSize("100%", "28rem");
        requestAnimationFrame(function () {
            if (yamlPreviewEditor) {
                yamlPreviewEditor.refresh();
            }
        });
    }

    function applySelectHtml(selected) {
        const value = selected || "deny-overrides";
        const known = applyOptions.some(function (option) { return option.code === value; });
        let html = optionsHtml(applyOptions);
        if (value && !known) {
            html += '<option value="' + esc(value) + '" selected>' + esc(value) + "</option>";
        }
        return html;
    }

    function render(resource) {
        library = resource;
        const $root = $("#app-content");
        $root.html(
            '<div class="d-sm-flex align-items-center justify-content-between mb-4">' +
                "<div>" +
                    '<a class="small text-decoration-none" href="#/pds-policies"><i class="bi bi-arrow-left me-1"></i>PDS Policies</a>' +
                    '<h1 class="h3 mb-0 page-title">' + esc(library.title || library.name || "PDS policy") + "</h1>" +
                "</div>" +
                '<a class="btn btn-outline-primary" href="#/resources/Library/' + encodeURIComponent(library.id) + '">' +
                    '<i class="bi bi-code-slash me-1"></i>FHIR resource</a>' +
            "</div>" +
            '<div class="card shadow mb-4">' +
                '<form id="pd-policy-form">' +
                    '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                        "<div>" +
                            '<h6 class="m-0">Policy content</h6>' +
                            '<div class="small text-muted mt-1"><code>' + esc(policyContentType) + "</code></div>" +
                        "</div>" +
                        '<div class="d-flex gap-2">' +
                            '<button class="btn btn-sm btn-primary" type="submit">Save</button>' +
                            '<button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#pd-yaml-modal">' +
                                '<i class="bi bi-filetype-yml me-1"></i>View YAML</button>' +
                        "</div>" +
                    "</div>" +
                    '<div class="card-body">' +
                        '<div class="row">' +
                            '<div class="col-md-6">' +
                                field("Policy ID", '<input class="form-control font-monospace" id="pd-policy-id" required placeholder="Unique ID (Library.name)">') +
                            "</div>" +
                            '<div class="col-md-3">' +
                                field("Version", '<input class="form-control" id="pd-policy-version" placeholder="e.g. 1.0.0">') +
                            "</div>" +
                            '<div class="col-md-3">' +
                                field("Status", '<select class="form-select" id="pd-policy-status">' + optionsHtml(statusOptions) + "</select>") +
                            "</div>" +
                        "</div>" +
                        field("Description", '<textarea class="form-control" id="pd-policy-description" rows="3"></textarea>') +
                        '<div class="mb-3">' +
                            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                                '<label class="form-label mb-0">Imports</label>' +
                                '<button class="btn btn-sm btn-outline-primary" type="button" id="pd-policy-import-add">' +
                                    '<i class="bi bi-plus-lg me-1"></i>Add import</button>' +
                            "</div>" +
                            '<div id="pd-policy-imports"></div>' +
                            '<div class="form-text">Each import is another policy’s <code>Library.name</code>.</div>' +
                        "</div>" +
                        field("Target", '<div class="spel-host">' +
                            '<textarea class="form-control font-monospace" id="pd-policy-target" rows="4" ' +
                            'placeholder="SpringEL predicate"></textarea></div>' +
                            '<div class="form-text">If this predicate is true, the policy rules are evaluated.</div>') +
                        field("Apply", '<select class="form-select" id="pd-policy-apply">' + optionsHtml(applyOptions) + "</select>" +
                            '<div class="form-text">Rule combiner used when the target matches.</div>') +
                        '<div class="mb-0">' +
                            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                                '<label class="form-label mb-0">On target</label>' +
                                '<button class="btn btn-sm btn-outline-primary" type="button" id="pd-policy-ontarget-add">' +
                                    '<i class="bi bi-plus-lg me-1"></i>Add statement</button>' +
                            "</div>" +
                            '<div id="pd-policy-ontarget"></div>' +
                            '<div class="form-text">SpringEL statements run when the target predicate is true.</div>' +
                        "</div>" +
                    "</div>" +
                "</form>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Basic details", "pds-basic-details", "#pd-basic-modal") + "</div>" +
                '<div class="col-lg-6">' + editCard("Identity and version", "pds-identity-details", "#pd-identity-modal") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + editCard("Purpose and usage", "pds-purpose-details", "#pd-purpose-modal") + "</div>" +
                '<div class="col-lg-6">' + editCard("Review dates", "pds-dates-details", "#pd-dates-modal") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Identifiers", "pds-id-rows",
                    ["System", "Value", ""], "#pd-id-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Contacts", "pds-contact-rows",
                    ["Name", "Telecom", ""], "#pd-contact-modal", "Add") + "</div>" +
            "</div>" +
            '<div class="row">' +
                '<div class="col-lg-6">' + card("Content", "pds-content-rows",
                    ["Title", "Type", ""], "#pd-content-modal", "Add") + "</div>" +
                '<div class="col-lg-6">' + card("Related artifacts", "pds-artifact-rows",
                    ["Type", "Display", ""], "#pd-artifact-modal", "Add") + "</div>" +
            "</div>" +
            viewModal("pd-yaml-modal", "Generated YAML",
                '<div class="yaml-preview-host">' +
                    '<textarea id="pd-yaml-preview" class="form-control font-monospace" readonly></textarea>' +
                "</div>") +
            modal("pd-basic-modal", "Edit basic details",
                field("Title", '<input class="form-control" id="pd-title" required>') +
                field("Status", '<select class="form-select" id="pd-status">' + optionsHtml(statusOptions) + "</select>") +
                field("Description", '<textarea class="form-control" id="pd-description" rows="4"></textarea>') +
                '<div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="pd-experimental">' +
                    '<label class="form-check-label" for="pd-experimental">Experimental</label></div>',
                "pd-basic-form") +
            modal("pd-identity-modal", "Edit identity and version",
                field("Canonical URL", '<input class="form-control" id="pd-url">') +
                field("Computer name", '<input class="form-control" id="pd-name">') +
                field("Version", '<input class="form-control" id="pd-version">') +
                field("Publisher", '<input class="form-control" id="pd-publisher">') +
                field("Date", '<input type="date" class="form-control" id="pd-date">'),
                "pd-identity-form") +
            modal("pd-purpose-modal", "Edit purpose and usage",
                field("Purpose", '<textarea class="form-control" id="pd-purpose" rows="3"></textarea>') +
                field("Usage", '<textarea class="form-control" id="pd-usage" rows="3"></textarea>') +
                field("Copyright", '<textarea class="form-control" id="pd-copyright" rows="2"></textarea>'),
                "pd-purpose-form") +
            modal("pd-dates-modal", "Edit review dates",
                field("Approval date", '<input type="date" class="form-control" id="pd-approval">') +
                field("Last review date", '<input type="date" class="form-control" id="pd-review">') +
                field("Effective start", '<input type="date" class="form-control" id="pd-period-start">') +
                field("Effective end", '<input type="date" class="form-control" id="pd-period-end">'),
                "pd-dates-form") +
            modal("pd-id-modal", "Add identifier",
                field("System", '<input class="form-control" id="pd-id-system">') +
                field("Value", '<input class="form-control" id="pd-id-value" required>'),
                "pd-id-form") +
            modal("pd-contact-modal", "Add contact",
                field("Name", '<input class="form-control" id="pd-ct-name" required>') +
                field("Phone", '<input class="form-control" id="pd-ct-phone">') +
                field("Email", '<input class="form-control" id="pd-ct-email" type="email">'),
                "pd-contact-form") +
            modal("pd-content-modal", "Add content",
                field("Title", '<input class="form-control" id="pd-content-title">') +
                field("Content type", '<select class="form-select" id="pd-content-type">' + optionsHtml(contentTypes) + "</select>") +
                field("URL", '<input class="form-control" id="pd-content-url" placeholder="Optional instead of inline data">') +
                field("Data", '<textarea class="form-control font-monospace" id="pd-content-data" rows="8" placeholder="Inline policy text"></textarea>'),
                "pd-content-form", true) +
            modal("pd-artifact-modal", "Add related artifact",
                field("Type", '<select class="form-select" id="pd-art-type">' + optionsHtml(artifactTypes) + "</select>") +
                field("Display", '<input class="form-control" id="pd-art-display" required>') +
                field("URL", '<input class="form-control" id="pd-art-url">') +
                field("Resource", '<input class="form-control" id="pd-art-resource" placeholder="e.g. Library/123">'),
                "pd-artifact-form")
        );

        renderBasics();
        renderIdentity();
        renderPurpose();
        renderDates();
        renderIdentifiers();
        renderContacts();
        renderContent();
        renderArtifacts();
        renderPolicyEditor();
        loadImportChoices();
        bindForms();
    }

    function renderImportRows(imports) {
        if (!imports || !imports.length) {
            $("#pd-policy-imports").html('<div class="text-muted small" id="pd-imports-empty">No imports.</div>');
            return;
        }
        $("#pd-policy-imports").html(imports.map(importRowHtml).join(""));
    }

    function renderOnTargetRows(statements) {
        $("#pd-policy-ontarget .pd-ontarget-row").each(function () {
            const cm = $(this).data("cm");
            if (cm) {
                cm.toTextArea();
                $(this).removeData("cm");
            }
        });
        if (!statements || !statements.length) {
            $("#pd-policy-ontarget").html('<div class="text-muted small" id="pd-ontarget-empty">No on-target statements.</div>');
            return;
        }
        $("#pd-policy-ontarget").html(statements.map(onTargetRowHtml).join(""));
        $("#pd-policy-ontarget .pd-ontarget-row").each(function () {
            attachOnTargetEditor($(this));
        });
    }

    function refreshImportSelects() {
        $("#pd-policy-imports .pd-import-value").each(function () {
            const selected = $(this).val();
            $(this).html(importOptionHtml(selected));
            if (selected) {
                $(this).val(selected);
            }
        });
    }

    function renderPolicyEditor() {
        teardownSpelEditors();
        const policy = readPolicyDocument();
        $("#pd-policy-id").val(policy.id);
        $("#pd-policy-description").val(policy.description);
        $("#pd-policy-version").val(policy.version);
        $("#pd-policy-status").val(policy.status || "draft");
        $("#pd-policy-target").val(policy.target || "");
        $("#pd-policy-apply").html(applySelectHtml(policy.apply));
        $("#pd-policy-apply").val(policy.apply || "deny-overrides");
        renderImportRows(policy.imports);
        renderOnTargetRows(policy.onTarget);
        targetEditor = attachSpelEditor(document.getElementById("pd-policy-target"), "6.5rem");
    }

    function loadImportChoices() {
        CadminApi.fhir("/Library?type=" + encodeURIComponent(libraryType) + "&_count=200").done(function (bundle) {
            otherPolicies = (bundle.entry || []).map(function (entry) {
                return entry.resource;
            }).filter(function (item) {
                return item && item.name && item.id !== library.id;
            }).map(function (item) {
                return { name: item.name, title: item.title || "" };
            }).sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            refreshImportSelects();
        }).fail(function () {
            otherPolicies = [];
        });
    }

    function renderBasics() {
        $("#pds-basic-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Title</dt><dd class="col-sm-8">' + esc(library.title || "—") + "</dd>" +
                '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + statusBadge(library.status) + "</dd>" +
                '<dt class="col-sm-4">Type</dt><dd class="col-sm-8">' + esc(libraryType) + "</dd>" +
                '<dt class="col-sm-4">Experimental</dt><dd class="col-sm-8">' + (library.experimental ? "Yes" : "No") + "</dd>" +
                '<dt class="col-sm-4">Description</dt><dd class="col-sm-8">' + esc(library.description || "—") + "</dd>" +
                '<dt class="col-sm-4">ID</dt><dd class="col-sm-8"><code>' + esc(library.id) + "</code></dd>" +
            "</dl>"
        );
    }

    function renderIdentity() {
        $("#pds-identity-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">URL</dt><dd class="col-sm-8"><code>' + esc(library.url || "—") + "</code></dd>" +
                '<dt class="col-sm-4">Name</dt><dd class="col-sm-8">' + esc(library.name || "—") + "</dd>" +
                '<dt class="col-sm-4">Version</dt><dd class="col-sm-8">' + esc(library.version || "—") + "</dd>" +
                '<dt class="col-sm-4">Publisher</dt><dd class="col-sm-8">' + esc(library.publisher || "—") + "</dd>" +
                '<dt class="col-sm-4">Date</dt><dd class="col-sm-8">' + esc(library.date || "—") + "</dd>" +
            "</dl>"
        );
    }

    function renderPurpose() {
        $("#pds-purpose-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Purpose</dt><dd class="col-sm-8">' + esc(library.purpose || "—") + "</dd>" +
                '<dt class="col-sm-4">Usage</dt><dd class="col-sm-8">' + esc(library.usage || "—") + "</dd>" +
                '<dt class="col-sm-4">Copyright</dt><dd class="col-sm-8">' + esc(library.copyright || "—") + "</dd>" +
            "</dl>"
        );
    }

    function renderDates() {
        const period = library.effectivePeriod || {};
        $("#pds-dates-details").html(
            '<dl class="row mb-0">' +
                '<dt class="col-sm-4">Approved</dt><dd class="col-sm-8">' + esc(library.approvalDate || "—") + "</dd>" +
                '<dt class="col-sm-4">Last review</dt><dd class="col-sm-8">' + esc(library.lastReviewDate || "—") + "</dd>" +
                '<dt class="col-sm-4">Effective</dt><dd class="col-sm-8">' +
                    esc(period.start || "—") + " – " + esc(period.end || "—") + "</dd>" +
            "</dl>"
        );
    }

    function renderIdentifiers() {
        const items = library.identifier || [];
        if (!items.length) {
            $("#pds-id-rows").html(emptyRow(3, "No identifiers."));
            return;
        }
        $("#pds-id-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.system || "—") + "</td><td>" + esc(item.value || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="identifier" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function formatTelecom(list) {
        return (list || []).map(function (item) {
            return [item.system, item.value].filter(Boolean).join(": ");
        }).filter(Boolean).join(" · ") || "—";
    }

    function renderContacts() {
        const items = library.contact || [];
        if (!items.length) {
            $("#pds-contact-rows").html(emptyRow(3, "No contacts."));
            return;
        }
        $("#pds-contact-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.name || "—") + "</td><td>" + esc(formatTelecom(item.telecom)) + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="contact" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function renderContent() {
        const items = library.content || [];
        const rows = [];
        items.forEach(function (item, index) {
            if (isPolicyYaml(item)) {
                return;
            }
            rows.push("<tr><td>" + esc(item.title || item.url || "Untitled") + "</td><td>" +
                esc(item.contentType || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="content" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>');
        });
        if (!rows.length) {
            $("#pds-content-rows").html(emptyRow(3, "No additional content."));
            return;
        }
        $("#pds-content-rows").html(rows.join(""));
    }

    function renderArtifacts() {
        const items = library.relatedArtifact || [];
        if (!items.length) {
            $("#pds-artifact-rows").html(emptyRow(3, "No related artifacts."));
            return;
        }
        $("#pds-artifact-rows").html(items.map(function (item, index) {
            return "<tr><td>" + esc(item.type || "—") + "</td><td>" + esc(item.display || item.url || item.resource || "—") + "</td>" +
                '<td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="relatedArtifact" data-index="' +
                index + '" title="Remove" aria-label="Remove"><i class="bi bi-trash"></i></button></td></tr>';
        }).join(""));
    }

    function refreshLists() {
        renderBasics();
        renderIdentity();
        renderPurpose();
        renderDates();
        renderIdentifiers();
        renderContacts();
        renderContent();
        renderArtifacts();
        renderPolicyEditor();
        $(".page-title").first().text(library.title || library.name || "PDS policy");
    }

    function saveLibrary(next) {
        if (!library.type) {
            library.type = {
                coding: [{ code: libraryType, display: "PDS Policies" }],
                text: libraryType
            };
        }
        const sentContent = library.content;
        CadminApi.fhir("/Library/" + encodeURIComponent(library.id), "PUT", library).done(function (updated) {
            library = updated || library;
            if (sentContent && sentContent.length) {
                if (!library.content || !library.content.length) {
                    library.content = sentContent;
                } else {
                    library.content = library.content.map(function (item, index) {
                        if (item.data) {
                            return item;
                        }
                        const sent = sentContent.find(function (candidate) {
                            return isPolicyYaml(candidate) && isPolicyYaml(item);
                        }) || sentContent[index];
                        if (sent && sent.data && !item.data) {
                            item.data = sent.data;
                            if (!item.contentType) {
                                item.contentType = sent.contentType;
                            }
                        }
                        return item;
                    });
                }
            }
            refreshLists();
            if (next) {
                next();
            }
        }).fail(function (xhr) {
            fail("Update policy", xhr);
        });
    }

    function bindForms() {
        const $root = $("#app-content");
        $root.off(".pdsdetail");

        $root.on("click.pdsdetail", "[data-remove]", function () {
            const fieldName = $(this).attr("data-remove");
            const index = Number($(this).attr("data-index"));
            if (fieldName === "content" && isPolicyYaml((library.content || [])[index])) {
                return;
            }
            library[fieldName] = (library[fieldName] || []).filter(function (_item, i) { return i !== index; });
            saveLibrary(function () {
                alertMsg("success", "Removed.");
            });
        });

        $("#pd-basic-modal").on("show.bs.modal", function () {
            $("#pd-title").val(library.title || "");
            $("#pd-status").val(library.status || "draft");
            $("#pd-description").val(library.description || "");
            $("#pd-experimental").prop("checked", !!library.experimental);
        });

        $("#pd-identity-modal").on("show.bs.modal", function () {
            $("#pd-url").val(library.url || "");
            $("#pd-name").val(library.name || "");
            $("#pd-version").val(library.version || "");
            $("#pd-publisher").val(library.publisher || "");
            $("#pd-date").val((library.date || "").slice(0, 10));
        });

        $("#pd-purpose-modal").on("show.bs.modal", function () {
            $("#pd-purpose").val(library.purpose || "");
            $("#pd-usage").val(library.usage || "");
            $("#pd-copyright").val(library.copyright || "");
        });

        $("#pd-dates-modal").on("show.bs.modal", function () {
            const period = library.effectivePeriod || {};
            $("#pd-approval").val(library.approvalDate || "");
            $("#pd-review").val(library.lastReviewDate || "");
            $("#pd-period-start").val((period.start || "").slice(0, 10));
            $("#pd-period-end").val((period.end || "").slice(0, 10));
        });

        $("#pd-basic-form").on("submit", function (event) {
            event.preventDefault();
            library.title = $("#pd-title").val();
            library.status = $("#pd-status").val() || "draft";
            setOrDelete(library, "description", $("#pd-description").val());
            if ($("#pd-experimental").is(":checked")) {
                library.experimental = true;
            } else {
                delete library.experimental;
            }
            syncYamlFromLibraryIfPresent();
            saveLibrary(function () {
                hideModal("pd-basic-modal");
                alertMsg("success", "Basic details updated.");
            });
        });

        $("#pd-identity-form").on("submit", function (event) {
            event.preventDefault();
            setOrDelete(library, "url", $("#pd-url").val());
            setOrDelete(library, "name", $("#pd-name").val());
            setOrDelete(library, "version", $("#pd-version").val());
            setOrDelete(library, "publisher", $("#pd-publisher").val());
            setOrDelete(library, "date", $("#pd-date").val());
            syncYamlFromLibraryIfPresent();
            saveLibrary(function () {
                hideModal("pd-identity-modal");
                alertMsg("success", "Identity updated.");
            });
        });

        $("#pd-purpose-form").on("submit", function (event) {
            event.preventDefault();
            setOrDelete(library, "purpose", $("#pd-purpose").val());
            setOrDelete(library, "usage", $("#pd-usage").val());
            setOrDelete(library, "copyright", $("#pd-copyright").val());
            saveLibrary(function () {
                hideModal("pd-purpose-modal");
                alertMsg("success", "Purpose updated.");
            });
        });

        $("#pd-dates-form").on("submit", function (event) {
            event.preventDefault();
            setOrDelete(library, "approvalDate", $("#pd-approval").val());
            setOrDelete(library, "lastReviewDate", $("#pd-review").val());
            const start = $("#pd-period-start").val();
            const end = $("#pd-period-end").val();
            if (start || end) {
                library.effectivePeriod = {};
                if (start) {
                    library.effectivePeriod.start = start;
                }
                if (end) {
                    library.effectivePeriod.end = end;
                }
            } else {
                delete library.effectivePeriod;
            }
            saveLibrary(function () {
                hideModal("pd-dates-modal");
                alertMsg("success", "Review dates updated.");
            });
        });

        $("#pd-id-form").on("submit", function (event) {
            event.preventDefault();
            library.identifier = library.identifier || [];
            const identifier = { value: $("#pd-id-value").val() };
            const system = $("#pd-id-system").val();
            if (system) {
                identifier.system = system;
            }
            library.identifier.push(identifier);
            saveLibrary(function () {
                hideModal("pd-id-modal");
                alertMsg("success", "Identifier added.");
            });
        });

        $("#pd-contact-form").on("submit", function (event) {
            event.preventDefault();
            const contact = { name: $("#pd-ct-name").val(), telecom: [] };
            const phone = $("#pd-ct-phone").val();
            const email = $("#pd-ct-email").val();
            if (phone) {
                contact.telecom.push({ system: "phone", value: phone });
            }
            if (email) {
                contact.telecom.push({ system: "email", value: email });
            }
            library.contact = library.contact || [];
            library.contact.push(contact);
            saveLibrary(function () {
                hideModal("pd-contact-modal");
                alertMsg("success", "Contact added.");
            });
        });

        $("#pd-content-form").on("submit", function (event) {
            event.preventDefault();
            const attachment = {
                contentType: $("#pd-content-type").val() || "text/plain"
            };
            const title = $("#pd-content-title").val();
            const url = $("#pd-content-url").val();
            const data = $("#pd-content-data").val();
            if (title) {
                attachment.title = title;
            }
            if (url) {
                attachment.url = url;
            }
            if (data) {
                attachment.data = encodeText(data);
            }
            library.content = library.content || [];
            library.content.push(attachment);
            saveLibrary(function () {
                hideModal("pd-content-modal");
                alertMsg("success", "Content added.");
            });
        });

        $root.on("click.pdsdetail", "#pd-policy-import-add", function () {
            $("#pd-imports-empty").remove();
            $("#pd-policy-imports").append(importRowHtml(""));
        });

        $root.on("click.pdsdetail", "[data-import-remove]", function () {
            $(this).closest(".pd-import-row").remove();
            if (!$("#pd-policy-imports .pd-import-row").length) {
                renderImportRows([]);
            }
        });

        $root.on("click.pdsdetail", "#pd-policy-ontarget-add", function () {
            $("#pd-ontarget-empty").remove();
            const $row = $(onTargetRowHtml(""));
            $("#pd-policy-ontarget").append($row);
            attachOnTargetEditor($row);
        });

        $root.on("click.pdsdetail", "[data-ontarget-remove]", function () {
            const $row = $(this).closest(".pd-ontarget-row");
            const cm = $row.data("cm");
            if (cm) {
                cm.toTextArea();
            }
            $row.remove();
            if (!$("#pd-policy-ontarget .pd-ontarget-row").length) {
                renderOnTargetRows([]);
            }
        });

        $("#pd-policy-form").on("submit", function (event) {
            event.preventDefault();
            const policy = collectPolicyForm();
            if (!policy.id) {
                alertMsg("danger", "Policy ID is required.");
                return;
            }
            applyPolicyDocument(policy);
            saveLibrary(function () {
                alertMsg("success", "Policy content saved.");
            });
        });

        $("#pd-yaml-modal").on("shown.bs.modal", showGeneratedYaml);
        $("#pd-yaml-modal").on("hidden.bs.modal", teardownYamlPreview);

        $("#pd-artifact-form").on("submit", function (event) {
            event.preventDefault();
            const artifact = {
                type: $("#pd-art-type").val() || "documentation",
                display: $("#pd-art-display").val()
            };
            const url = $("#pd-art-url").val();
            const resourceRef = $("#pd-art-resource").val();
            if (url) {
                artifact.url = url;
            }
            if (resourceRef) {
                artifact.resource = resourceRef;
            }
            library.relatedArtifact = library.relatedArtifact || [];
            library.relatedArtifact.push(artifact);
            saveLibrary(function () {
                hideModal("pd-artifact-modal");
                alertMsg("success", "Related artifact added.");
            });
        });
    }

    return { render: render };
}());
