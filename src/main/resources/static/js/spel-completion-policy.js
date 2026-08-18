window.CadminSpelPolicyCompletion = (function () {
    const catalog = {
        root: "PolicyRoot",
        variables: {
            "#root": { type: "PolicyRoot", detail: "Policy evaluation root" },
            "#this": { type: "PolicyRoot", detail: "Current evaluation context" }
        },
        types: {
            PolicyRoot: {
                detail: "Policy evaluation root",
                properties: {
                    request: { type: "RequestModel", detail: "Inbound authorization request" },
                    response: { type: "ResponseModel", detail: "Authorization response being built" },
                    utils: { type: "Utils", detail: "SpringEL utility functions" }
                }
            },
            RequestModel: {
                detail: "Authorization request",
                properties: {
                    subject: { type: "SubjectModel", detail: "Subject making the request" },
                    action: {
                        type: "String",
                        detail: "Action being taken",
                        enum: ["create", "read", "update", "delete", "search"]
                    },
                    resource: {
                        type: "String",
                        detail: "Resource URI, or a resource type for searches"
                    }
                }
            },
            SubjectModel: {
                detail: "Request subject (model to be defined)"
            },
            ResponseModel: {
                detail: "Authorization response",
                properties: {
                    reason: { type: "String", detail: "Why the request was denied" },
                    code: { type: "int", detail: "Response code" },
                    advice: { type: "AdviceModel", detail: "Advice to follow" }
                }
            },
            AdviceModel: {
                detail: "Advice to follow (definition to come later)"
            },
            Utils: {
                detail: "Utility methods available in SpringEL",
                methods: {
                    utcMinutesAgo: {
                        return: "Instant",
                        detail: "UTC Instant for the given number of minutes ago",
                        args: [{ name: "duration", type: "int", detail: "Minutes ago" }]
                    },
                    regexc: {
                        return: "boolean",
                        detail: "Regex match with a cached compiled pattern",
                        args: [
                            { name: "regex", type: "String", detail: "Regular expression" },
                            { name: "input", type: "String", detail: "Source string" }
                        ]
                    },
                    regex: {
                        return: "boolean",
                        detail: "Regex match; compiles the pattern on every call",
                        args: [
                            { name: "regex", type: "String", detail: "Regular expression" },
                            { name: "input", type: "String", detail: "Source string" }
                        ]
                    },
                    regexcFirst: {
                        return: "String",
                        detail: "First regex capture group, with a cached compiled pattern",
                        args: [
                            { name: "regex", type: "String", detail: "Regular expression with capture groups" },
                            { name: "input", type: "String", detail: "Source string" }
                        ]
                    }
                }
            },
            String: { detail: "String" },
            int: { detail: "int" },
            boolean: { detail: "boolean" },
            Instant: { detail: "UTC Instant" }
        },
        keywords: [
            { name: "true", detail: "Boolean literal" },
            { name: "false", detail: "Boolean literal" },
            { name: "null", detail: "Null literal" },
            { name: "and", detail: "Logical and" },
            { name: "or", detail: "Logical or" },
            { name: "not", detail: "Logical not" },
            { name: "eq", detail: "Equals" },
            { name: "ne", detail: "Not equals" },
            { name: "lt", detail: "Less than" },
            { name: "le", detail: "Less than or equal" },
            { name: "gt", detail: "Greater than" },
            { name: "ge", detail: "Greater than or equal" },
            { name: "matches", detail: "Regex match operator" },
            { name: "between", detail: "Range operator" },
            { name: "instanceof", detail: "Type check" },
            { name: "new", detail: "Construct a type" }
        ]
    };

    function typeDef(name) {
        return (catalog.types && catalog.types[name]) || null;
    }

    function stringMask(text) {
        const mask = [];
        let i = 0;
        while (i < text.length) {
            const ch = text.charAt(i);
            if (ch === "'" || ch === '"') {
                const quote = ch;
                mask[i] = true;
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
                    mask[i] = true;
                    if (text.charAt(i) === quote) {
                        i += 1;
                        break;
                    }
                    i += 1;
                }
                continue;
            }
            if (ch === "/" && text.charAt(i + 1) === "/") {
                while (i < text.length) {
                    mask[i] = true;
                    i += 1;
                }
                break;
            }
            mask[i] = false;
            i += 1;
        }
        return mask;
    }

    function skipSpace(text, index, mask, direction) {
        let i = index;
        if (direction < 0) {
            while (i >= 0 && /\s/.test(text.charAt(i)) && !mask[i]) {
                i -= 1;
            }
        } else {
            while (i < text.length && /\s/.test(text.charAt(i)) && !mask[i]) {
                i += 1;
            }
        }
        return i;
    }

    function skipCall(text, index, mask) {
        if (index < 0 || text.charAt(index) !== ")" || mask[index]) {
            return index;
        }
        let depth = 1;
        let i = index - 1;
        while (i >= 0 && depth) {
            if (!mask[i]) {
                if (text.charAt(i) === ")") {
                    depth += 1;
                } else if (text.charAt(i) === "(") {
                    depth -= 1;
                }
            }
            i -= 1;
        }
        return i;
    }

    function readName(text, index) {
        let i = index;
        while (i >= 0 && /[\w$]/.test(text.charAt(i))) {
            i -= 1;
        }
        const name = text.slice(i + 1, index + 1);
        if (i >= 0 && text.charAt(i) === "#") {
            return { name: "#" + name, next: i - 1 };
        }
        return { name: name, next: i };
    }

    function parseContext(text) {
        const mask = stringMask(text);
        const last = text.length ? mask[text.length - 1] : false;
        if (last) {
            return { kind: "string", prefix: "", path: [] };
        }
        let end = text.length;
        while (end > 0 && /[\w$]/.test(text.charAt(end - 1))) {
            end -= 1;
        }
        let prefix = text.slice(end);
        let before = text.slice(0, end);
        if (end > 0 && text.charAt(end - 1) === "#") {
            prefix = "#" + prefix;
            before = text.slice(0, end - 1);
        }
        const beforeMask = stringMask(before);
        let i = skipSpace(before, before.length - 1, beforeMask, -1);
        if (i >= 0 && (before.charAt(i) === "'" || before.charAt(i) === '"')) {
            return { kind: "string", prefix: "", path: [] };
        }
        if (i >= 0 && before.charAt(i) === ".") {
            if (i > 0 && before.charAt(i - 1) === "?") {
                i -= 1;
            }
            const path = [];
            i -= 1;
            while (i >= 0) {
                i = skipSpace(before, i, beforeMask, -1);
                i = skipCall(before, i, beforeMask);
                i = skipSpace(before, i, beforeMask, -1);
                const read = readName(before, i);
                if (!read.name) {
                    break;
                }
                path.unshift(read.name);
                i = skipSpace(before, read.next, beforeMask, -1);
                if (i >= 0 && before.charAt(i) === ".") {
                    if (i > 0 && before.charAt(i - 1) === "?") {
                        i -= 1;
                    }
                    i -= 1;
                    continue;
                }
                break;
            }
            return { kind: "member", prefix: prefix, path: path };
        }
        if (prefix.charAt(0) === "#") {
            return { kind: "variable", prefix: prefix, path: [] };
        }
        return { kind: "root", prefix: prefix, path: [] };
    }

    function resolveType(path) {
        let typeName = catalog.root;
        let prop = null;
        (path || []).forEach(function (part) {
            if (!typeName) {
                return;
            }
            const variable = catalog.variables[part];
            if (variable && typeName === catalog.root) {
                typeName = variable.type;
                prop = variable;
                return;
            }
            const type = typeDef(typeName);
            const key = part.charAt(0) === "#" ? part.slice(1) : part;
            const nextProp = type && type.properties && type.properties[key];
            const nextMethod = type && type.methods && type.methods[key];
            if (nextProp) {
                typeName = nextProp.type;
                prop = nextProp;
            } else if (nextMethod) {
                typeName = nextMethod.return;
                prop = nextMethod;
            } else {
                typeName = null;
                prop = null;
            }
        });
        return { typeName: typeName, type: typeDef(typeName), prop: prop };
    }

    function matchesPrefix(name, prefix) {
        if (!prefix) {
            return true;
        }
        return String(name).toLowerCase().indexOf(String(prefix).toLowerCase()) === 0;
    }

    function signature(args) {
        return "(" + (args || []).map(function (arg) {
            return arg.name + ": " + arg.type;
        }).join(", ") + ")";
    }

    function renderHint(element, _self, data) {
        const name = document.createElement("span");
        name.className = "spel-hint-name";
        name.textContent = data.displayName || data.text;
        element.appendChild(name);
        if (data.detail) {
            const detail = document.createElement("span");
            detail.className = "spel-hint-detail";
            detail.textContent = data.detail;
            element.appendChild(detail);
        }
    }

    function propertyItem(name, spec) {
        return {
            text: name,
            displayName: name,
            detail: (spec && spec.type ? spec.type : "") + (spec && spec.detail ? " — " + spec.detail : ""),
            className: "spel-hint-prop",
            render: renderHint
        };
    }

    function methodItem(name, spec) {
        const args = spec.args || [];
        return {
            text: name + "()",
            displayName: name + signature(args),
            detail: (spec.return || "") + (spec.detail ? " — " + spec.detail : ""),
            className: "spel-hint-fn",
            render: renderHint,
            hint: function (cm, data) {
                cm.replaceRange(name + "()", data.from, data.to, "complete");
                if (args.length) {
                    const cursor = cm.getCursor();
                    cm.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
                }
            }
        };
    }

    function keywordItem(item) {
        return {
            text: item.name,
            displayName: item.name,
            detail: item.detail || "keyword",
            className: "spel-hint-kw",
            render: renderHint
        };
    }

    function variableItem(name, spec) {
        return {
            text: name,
            displayName: name,
            detail: (spec && spec.type ? spec.type : "") + (spec && spec.detail ? " — " + spec.detail : ""),
            className: "spel-hint-var",
            render: renderHint
        };
    }

    function enumItem(value) {
        return {
            text: "'" + value + "'",
            displayName: "'" + value + "'",
            detail: "action",
            className: "spel-hint-enum",
            render: renderHint
        };
    }

    function membersOf(type, prefix) {
        const list = [];
        if (!type) {
            return list;
        }
        Object.keys(type.properties || {}).forEach(function (name) {
            if (matchesPrefix(name, prefix)) {
                list.push(propertyItem(name, type.properties[name]));
            }
        });
        Object.keys(type.methods || {}).forEach(function (name) {
            if (matchesPrefix(name, prefix)) {
                list.push(methodItem(name, type.methods[name]));
            }
        });
        return list;
    }

    function actionEnumContext(text) {
        return /request\.action\s*(==|=|eq|ne)\s*$/i.test(text);
    }

    function hint(cm) {
        const cursor = cm.getCursor();
        const index = cm.indexFromPos(cursor);
        const text = cm.getValue().slice(0, index);
        const ctx = parseContext(text);
        let list = [];
        if (ctx.kind === "string") {
            if (actionEnumContext(text.replace(/(['"])(?:\\.|(?!\1).)*$/, ""))) {
                list = ["create", "read", "update", "delete", "search"].filter(function (value) {
                    return matchesPrefix("'" + value, ctx.prefix) || matchesPrefix(value, ctx.prefix);
                }).map(enumItem);
            }
        } else if (ctx.kind === "member") {
            const resolved = resolveType(ctx.path);
            list = membersOf(resolved.type, ctx.prefix);
        } else if (ctx.kind === "variable") {
            const prefix = ctx.prefix;
            Object.keys(catalog.variables).forEach(function (name) {
                if (matchesPrefix(name, prefix)) {
                    list.push(variableItem(name, catalog.variables[name]));
                }
            });
        } else if (actionEnumContext(text.slice(0, text.length - ctx.prefix.length))) {
            list = ["create", "read", "update", "delete", "search"]
                .filter(function (value) {
                    return matchesPrefix("'" + value, ctx.prefix) || matchesPrefix(value, ctx.prefix);
                })
                .map(enumItem);
        } else {
            const root = typeDef(catalog.root);
            list = list.concat(membersOf(root, ctx.prefix));
            Object.keys(catalog.variables).forEach(function (name) {
                if (matchesPrefix(name, ctx.prefix)) {
                    list.push(variableItem(name, catalog.variables[name]));
                }
            });
            catalog.keywords.forEach(function (item) {
                if (ctx.prefix && matchesPrefix(item.name, ctx.prefix)) {
                    list.push(keywordItem(item));
                }
            });
        }
        if (!list.length) {
            return null;
        }
        list.sort(function (a, b) {
            return String(a.displayName || a.text).localeCompare(String(b.displayName || b.text));
        });
        const fromIndex = index - ctx.prefix.length;
        return {
            list: list,
            from: cm.posFromIndex(fromIndex),
            to: cursor
        };
    }

    function shouldTrigger(change) {
        if (!change || change.origin === "complete" || change.origin === "setValue") {
            return false;
        }
        const typed = (change.text || []).join("");
        if (!typed || typed.indexOf("\n") >= 0) {
            return false;
        }
        return typed === "." || typed === "#" || typed === "?" || /[A-Za-z_]/.test(typed);
    }

    function attach(cm) {
        if (!cm || typeof cm.showHint !== "function") {
            return;
        }
        const keys = Object.assign({}, cm.getOption("extraKeys") || {}, {
            "Ctrl-Space": "autocomplete"
        });
        cm.setOption("extraKeys", keys);
        cm.setOption("hintOptions", {
            hint: hint,
            completeSingle: false,
            alignWithWord: true
        });
        cm.on("inputRead", function (editor, change) {
            if (!shouldTrigger(change)) {
                return;
            }
            editor.showHint({ completeSingle: false });
        });
    }

    if (typeof CodeMirror !== "undefined") {
        CodeMirror.registerHelper("hint", "springel", hint);
    }

    return {
        catalog: catalog,
        hint: hint,
        attach: attach,
        parseContext: parseContext,
        resolveType: resolveType
    };
}());
