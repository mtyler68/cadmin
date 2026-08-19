window.CadminResourceGraph = (function () {
    const DETAIL_PREFIX = {
        Patient: "#/patients/",
        RelatedPerson: "#/caregivers/",
        Practitioner: "#/practitioners/",
        Device: "#/devices/",
        Flag: "#/flags/",
        Organization: "#/organizations/",
        CareTeam: "#/care-teams/",
        Location: "#/locations/",
        Consent: "#/consents/",
        Subscription: "#/subscriptions/",
        SubscriptionTopic: "#/subscription-topics/",
        Endpoint: "#/endpoints/",
        Library: "#/pds-policies/",
        Questionnaire: "#/questionnaires/"
    };
    const TYPE_COLORS = {
        Patient: "#36b9cc",
        RelatedPerson: "#1cc88a",
        Practitioner: "#4e73df",
        Organization: "#f6c23e",
        Location: "#e74a3b",
        CareTeam: "#858796",
        Device: "#5a5c69",
        Flag: "#d63384",
        DeviceAssociation: "#6f42c1",
        Consent: "#fd7e14",
        Subscription: "#20c997",
        SubscriptionTopic: "#0d6efd",
        Library: "#6610f2",
        Questionnaire: "#198754",
        PractitionerRole: "#4e73df",
        OrganizationAffiliation: "#f6c23e",
        Endpoint: "#36b9cc"
    };
    const DEPTH_MIN = 1;
    const DEPTH_MAX = 4;
    const DEPTH_DEFAULT = 2;
    const NEIGHBOR_FETCH_LIMIT = 10;

    let network = null;
    let nodeSet = null;
    let edgeSet = null;
    let lastGraph = null;
    let focusKey = "";
    let graphDepth = DEPTH_DEFAULT;
    let mountedResource = null;
    let mountedByKey = null;
    let expandToken = 0;
    let themeBound = false;

    function cssColor(name, fallback) {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!raw) {
            return fallback;
        }
        if (/^\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?){2}/.test(raw)) {
            return "rgb(" + raw + ")";
        }
        return raw;
    }

    function themePalette() {
        return {
            canvas: cssColor("--bs-body-bg", "#fff"),
            nodeBg: cssColor("--bs-body-bg", "#fff"),
            nodeHover: cssColor("--bs-secondary-bg", "#f8f9fc"),
            text: cssColor("--bs-body-color", "#5a5c69"),
            muted: cssColor("--bs-secondary-color", "#858796"),
            border: cssColor("--bs-border-color", "#dee2e6"),
            primary: cssColor("--bs-primary", "#0d6efd"),
            onPrimary: cssColor("--bs-white", "#fff")
        };
    }

    function bindTheme() {
        if (themeBound) {
            return;
        }
        themeBound = true;
        const observer = new MutationObserver(function () {
            restyleNetwork();
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-bs-theme"]
        });
        if (window.matchMedia) {
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", restyleNetwork);
        }
    }

    function restyleNetwork() {
        if (!lastGraph || !nodeSet || !edgeSet) {
            return;
        }
        nodeSet.update(visNodes(lastGraph));
        edgeSet.update(visEdges(lastGraph));
        if (network) {
            network.redraw();
        }
    }

    function clampDepth(value) {
        const n = parseInt(value, 10);
        if (n >= DEPTH_MIN && n <= DEPTH_MAX) {
            return n;
        }
        return DEPTH_DEFAULT;
    }

    function readDepth() {
        const input = document.getElementById("resource-graph-depth");
        return clampDepth(input ? input.value : graphDepth);
    }

    function syncDepthInput() {
        const input = document.getElementById("resource-graph-depth");
        if (input) {
            input.value = String(graphDepth);
        }
    }

    function hopRole(direction, hop) {
        if (hop <= 0) {
            return "focus";
        }
        return hop === 1 ? direction : direction + hop;
    }

    function roleRank(role) {
        if (role === "focus") {
            return 0;
        }
        if (role === "incoming" || role === "outgoing") {
            return 1;
        }
        const match = /^(incoming|outgoing)(\d+)$/.exec(role || "");
        return match ? parseInt(match[2], 10) : 9;
    }

    function roleLevel(role, depth) {
        depth = clampDepth(depth);
        if (role === "focus") {
            return depth;
        }
        const incoming = /^incoming(\d*)$/.exec(role || "");
        if (incoming) {
            const hop = incoming[1] ? parseInt(incoming[1], 10) : 1;
            return depth - hop;
        }
        const outgoing = /^outgoing(\d*)$/.exec(role || "");
        if (outgoing) {
            const hop = outgoing[1] ? parseInt(outgoing[1], 10) : 1;
            return depth + hop;
        }
        return depth;
    }

    function card() {
        return '<div class="card shadow mb-4" id="resource-graph-card">' +
            '<div class="card-header">' +
                '<h3 class="card-title"><i class="bi bi-diagram-3 me-2"></i>Reference graph</h3>' +
                '<div class="card-tools">' +
                    '<label class="small text-muted mb-0 d-inline-flex align-items-center gap-1" for="resource-graph-depth">' +
                        "Depth" +
                        '<input id="resource-graph-depth" class="form-control form-control-sm resource-graph-depth" ' +
                            'type="number" min="' + DEPTH_MIN + '" max="' + DEPTH_MAX + '" step="1" value="' +
                            graphDepth + '" title="Graph depth" aria-label="Graph depth">' +
                    "</label>" +
                    '<span class="small text-muted d-none d-lg-inline ms-2">Scroll to zoom · drag to pan</span>' +
                    '<button class="btn btn-sm btn-outline-secondary ms-2" type="button" id="resource-graph-declutter" title="Arrange nodes so connectors do not overlap">' +
                        '<i class="bi bi-distribute-vertical" aria-hidden="true"></i>' +
                        '<span class="ms-1">Declutter</span>' +
                    "</button>" +
                    '<div class="btn-group btn-group-sm ms-2 resource-graph-export">' +
                        '<button class="btn btn-outline-secondary" type="button" id="resource-graph-export-png" title="Open the current graph as a PNG image">' +
                            '<i class="bi bi-image" aria-hidden="true"></i>' +
                            '<span class="ms-1">PNG</span>' +
                        "</button>" +
                        '<button class="btn btn-outline-secondary dropdown-toggle dropdown-toggle-split" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false" aria-label="Open graph as an image or SVG">' +
                            '<span class="visually-hidden">More graph image formats</span>' +
                        "</button>" +
                        '<ul class="dropdown-menu dropdown-menu-end">' +
                            '<li><button class="dropdown-item" type="button" id="resource-graph-export-png-item">' +
                                '<i class="bi bi-filetype-png me-2" aria-hidden="true"></i>Open as PNG</button></li>' +
                            '<li><button class="dropdown-item" type="button" id="resource-graph-export-svg">' +
                                '<i class="bi bi-filetype-svg me-2" aria-hidden="true"></i>Open as SVG</button></li>' +
                        "</ul>" +
                    "</div>" +
                    '<button type="button" class="btn btn-tool" data-lte-toggle="card-maximize" title="Maximize" aria-label="Maximize">' +
                        '<i data-lte-icon="maximize" class="bi bi-fullscreen"></i>' +
                        '<i data-lte-icon="minimize" class="bi bi-fullscreen-exit"></i>' +
                    "</button>" +
                "</div>" +
            "</div>" +
            '<div class="card-body p-0">' +
                '<div id="resource-graph" class="resource-graph"></div>' +
            "</div>" +
        "</div>";
    }

    function graphCard() {
        return document.getElementById("resource-graph-card");
    }

    function isMaximized() {
        const cardEl = graphCard();
        return !!(cardEl && cardEl.classList.contains("maximized-card"));
    }

    function restoreMaximize() {
        const cardEl = graphCard();
        if (cardEl && cardEl.classList.contains("maximized-card")) {
            const button = cardEl.querySelector("[data-lte-toggle=\"card-maximize\"]");
            if (button) {
                button.click();
                return;
            }
            cardEl.classList.remove("maximized-card");
            cardEl.style.cssText = "";
        }
        document.documentElement.classList.remove("maximized-card");
    }

    function afterMaximizeChange() {
        window.requestAnimationFrame(function () {
            resizeNetwork();
            window.setTimeout(resizeNetwork, 180);
        });
    }

    function resizeNetwork() {
        if (!network) {
            return;
        }
        const el = document.getElementById("resource-graph");
        if (!el || !el.clientWidth || !el.clientHeight) {
            return;
        }
        network.setSize(el.clientWidth + "px", el.clientHeight + "px");
        network.redraw();
        network.fit({ animation: false });
    }

    function detailHref(type, id) {
        if (typeof CadminApi.detailHref === "function") {
            return CadminApi.detailHref(type, id);
        }
        const prefix = DETAIL_PREFIX[type];
        if (prefix) {
            return prefix + encodeURIComponent(id);
        }
        return "#/resources/" + encodeURIComponent(type) + "/" + encodeURIComponent(id);
    }

    function parseReference(value) {
        if (!value || typeof value !== "string" || value.charAt(0) === "#") {
            return null;
        }
        const cleaned = value.split("?")[0].replace(/\/_history\/[^/]+$/, "");
        const parts = cleaned.split("/").filter(Boolean);
        if (parts.length < 2) {
            return null;
        }
        const id = parts[parts.length - 1];
        const type = parts[parts.length - 2];
        if (!id || !/^[A-Z][A-Za-z0-9]+$/.test(type)) {
            return null;
        }
        return { type: type, id: id };
    }

    function nodeKey(type, id) {
        return type + "/" + id;
    }

    function keyOf(resource) {
        return resource && resource.resourceType && resource.id
            ? nodeKey(resource.resourceType, resource.id)
            : "";
    }

    function abbreviate(text, max) {
        const value = String(text || "").replace(/\s+/g, " ").trim();
        if (!value) {
            return "";
        }
        return value.length > max ? value.slice(0, max - 1) + "…" : value;
    }

    function conceptText(cc) {
        const item = Array.isArray(cc) ? cc[0] : cc;
        if (!item || typeof item !== "object") {
            return "";
        }
        const coding = (item.coding && item.coding[0]) || {};
        return item.text || coding.display || coding.code || "";
    }

    function conceptCodes(cc) {
        const items = Array.isArray(cc) ? cc : (cc ? [cc] : []);
        const values = [];
        items.forEach(function (item) {
            if (!item || typeof item !== "object") {
                return;
            }
            const codings = Array.isArray(item.coding) ? item.coding : [];
            let added = false;
            codings.forEach(function (coding) {
                const value = (coding && (coding.code || coding.display)) || "";
                if (value && values.indexOf(value) === -1) {
                    values.push(value);
                    added = true;
                }
            });
            if (!added && item.text && values.indexOf(item.text) === -1) {
                values.push(item.text);
            }
        });
        return values;
    }

    function roleCodeTitle(resource) {
        return conceptCodes(resource && resource.code).join(", ");
    }

    function usesRoleCodeTitle(type) {
        return type === "PractitionerRole" || type === "OrganizationAffiliation";
    }

    function humanName(name) {
        const item = Array.isArray(name) ? name[0] : name;
        if (!item) {
            return "";
        }
        if (typeof item === "string") {
            return item;
        }
        if (item.value || item.name) {
            return item.value || item.name;
        }
        const given = (item.given || []).join(" ");
        return [item.prefix && item.prefix.join(" "), given, item.family, item.suffix && item.suffix.join(" ")]
            .filter(Boolean).join(" ");
    }

    function resourceTitle(resource) {
        if (!resource) {
            return "";
        }
        if (usesRoleCodeTitle(resource.resourceType)) {
            return roleCodeTitle(resource);
        }
        if (resource._display) {
            return resource._display;
        }
        const named = humanName(resource.name);
        if (named) {
            return named;
        }
        return resource.title || resource.url || conceptText(resource.category)
            || resource.topic || resource.address || resource.id || "";
    }

    function collectReferences(value, found, seen, path) {
        path = path || "";
        if (!value || typeof value !== "object") {
            return found;
        }
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                collectReferences(item, found, seen, path);
            });
            return found;
        }
        if (typeof value.reference === "string") {
            const parsed = parseReference(value.reference);
            if (parsed) {
                const property = path || "reference";
                const key = nodeKey(parsed.type, parsed.id) + "|" + property;
                if (!seen[key]) {
                    seen[key] = true;
                    found.push({
                        type: parsed.type,
                        id: parsed.id,
                        display: value.display || "",
                        property: property
                    });
                }
            }
            return found;
        }
        Object.keys(value).forEach(function (key) {
            if (key === "text" || key === "snapshot" || key === "differential") {
                return;
            }
            collectReferences(value[key], found, seen, path ? path + "." + key : key);
        });
        return found;
    }

    function outgoingOf(resource) {
        return collectReferences(resource, [], {});
    }

    function stubResource(ref) {
        return {
            resourceType: ref.type,
            id: ref.id,
            _display: ref.display || ""
        };
    }

    function remember(byKey, resource) {
        const key = keyOf(resource);
        if (!key) {
            return;
        }
        const existing = byKey[key];
        if (!existing) {
            byKey[key] = resource;
        } else if (existing._display && !resource._display) {
            byKey[key] = resource;
        }
    }

    function addNode(nodes, resource, role) {
        if (!resource || !resource.resourceType || !resource.id) {
            return;
        }
        const key = nodeKey(resource.resourceType, resource.id);
        const existing = nodes[key];
        const title = resourceTitle(resource);
        if (!existing) {
            nodes[key] = {
                key: key,
                type: resource.resourceType,
                id: resource.id,
                title: title,
                role: role
            };
            return;
        }
        if (title && (!existing.title || existing.title === existing.id)) {
            existing.title = title;
        }
        if (roleRank(role) < roleRank(existing.role)) {
            existing.role = role;
        }
    }

    function addEdge(edges, seen, from, to, property) {
        if (!from || !to || from === to) {
            return;
        }
        const label = property || "";
        const key = from + "->" + to + "|" + label;
        if (seen[key]) {
            return;
        }
        seen[key] = true;
        edges.push({ from: from, to: to, label: label });
    }

    function graphFrom(focusResource, byKey, depth) {
        depth = clampDepth(depth);
        const nodes = {};
        const edges = [];
        const edgeSeen = {};
        const hopOf = {};
        const focus = keyOf(focusResource);
        addNode(nodes, focusResource, "focus");
        hopOf[focus] = 0;

        let frontier = [focus];
        for (let hop = 1; hop <= depth; hop += 1) {
            const next = [];
            const nextSeen = {};

            function enqueue(key, role, resource) {
                if (hopOf[key] == null) {
                    hopOf[key] = hop;
                    addNode(nodes, resource, role);
                    if (!nextSeen[key]) {
                        nextSeen[key] = true;
                        next.push(key);
                    }
                    return;
                }
                addNode(nodes, resource, role);
            }

            frontier.forEach(function (key) {
                const resource = key === focus ? focusResource : byKey[key];
                if (resource) {
                    outgoingOf(resource).forEach(function (ref) {
                        const target = nodeKey(ref.type, ref.id);
                        if (!target || target === key) {
                            return;
                        }
                        addEdge(edges, edgeSeen, key, target, ref.property);
                        enqueue(target, hopRole("outgoing", hop), byKey[target] || stubResource(ref));
                    });
                }
                Object.keys(byKey).forEach(function (src) {
                    if (src === key) {
                        return;
                    }
                    outgoingOf(byKey[src]).forEach(function (ref) {
                        if (nodeKey(ref.type, ref.id) !== key) {
                            return;
                        }
                        addEdge(edges, edgeSeen, src, key, ref.property);
                        enqueue(src, hopRole("incoming", hop), byKey[src]);
                    });
                });
            });
            frontier = next;
        }

        return { focus: focus, nodes: nodes, edges: edges, depth: depth };
    }

    function keysAtHop(focusResource, byKey, hop) {
        const graph = graphFrom(focusResource, byKey, hop);
        if (hop <= 1) {
            return Object.keys(graph.nodes).filter(function (key) {
                return key !== graph.focus;
            });
        }
        const inner = graphFrom(focusResource, byKey, hop - 1);
        return Object.keys(graph.nodes).filter(function (key) {
            return !inner.nodes[key];
        });
    }

    function undirectedKey(from, to) {
        return from < to ? from + "\0" + to : to + "\0" + from;
    }

    function edgePairGroups(graph) {
        const pairs = {};
        (graph.edges || []).forEach(function (edge, index) {
            const key = undirectedKey(edge.from, edge.to);
            if (!pairs[key]) {
                pairs[key] = { key: key, fwd: [], rev: [] };
            }
            if (edge.from < edge.to) {
                pairs[key].fwd.push({ edge: edge, index: index });
            } else {
                pairs[key].rev.push({ edge: edge, index: index });
            }
        });
        return pairs;
    }

    function isBidirectionalPair(pair) {
        return pair && pair.fwd.length > 0 && pair.rev.length > 0;
    }

    function edgeGoesRight(fromId, toId) {
        if (network) {
            const pos = network.getPositions([fromId, toId]);
            const from = pos[fromId];
            const to = pos[toId];
            if (from && to && (from.x !== to.x || from.y !== to.y)) {
                if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
                    return to.x >= from.x;
                }
                return to.y >= from.y;
            }
        }
        return fromId < toId;
    }

    function directionMark(fromId, toId) {
        if (network) {
            const pos = network.getPositions([fromId, toId]);
            const from = pos[fromId];
            const to = pos[toId];
            if (from && to) {
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                if (Math.abs(dx) >= Math.abs(dy)) {
                    return dx >= 0
                        ? { atEnd: true, mark: "▶" }
                        : { atEnd: false, mark: "◀" };
                }
                return dy >= 0
                    ? { atEnd: true, mark: "▼" }
                    : { atEnd: false, mark: "▲" };
            }
        }
        return edgeGoesRight(fromId, toId)
            ? { atEnd: true, mark: "▶" }
            : { atEnd: false, mark: "◀" };
    }

    const LABEL_FONT = "11px system-ui, sans-serif";
    const LABEL_HEIGHT = 14;
    const LABEL_PAD = 8;

    function triangleLabel(text, fromId, toId) {
        const short = abbreviate(text, 22) || "link";
        const dir = directionMark(fromId, toId);
        return dir.atEnd ? short + " " + dir.mark : dir.mark + " " + short;
    }

    function pairAxis(fromId, toId) {
        const pos = network.getPositions([fromId, toId]);
        const from = pos[fromId];
        const to = pos[toId];
        if (!from || !to) {
            return null;
        }
        const alongFrom = fromId < toId ? from : to;
        const alongTo = fromId < toId ? to : from;
        const dx = alongTo.x - alongFrom.x;
        const dy = alongTo.y - alongFrom.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
            mx: (from.x + to.x) / 2,
            my: (from.y + to.y) / 2,
            nx: -dy / len,
            ny: dx / len
        };
    }

    function paintDirectedLabel(ctx, x, y, text, theme) {
        ctx.save();
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = theme.canvas;
        ctx.fillStyle = theme.muted;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function measurePairLabels(ctx, items) {
        ctx.font = LABEL_FONT;
        return items.map(function (item) {
            const text = triangleLabel(item.edge.label, item.edge.from, item.edge.to);
            return {
                item: item,
                text: text,
                width: ctx.measureText(text).width
            };
        });
    }

    function sideClearance(nx, ny, widthA, widthB) {
        const minSepX = (widthA + widthB) / 2 + LABEL_PAD;
        const minSepY = LABEL_HEIGHT + LABEL_PAD;
        const needX = Math.abs(nx) > 0.001 ? minSepX / (2 * Math.abs(nx)) : Number.POSITIVE_INFINITY;
        const needY = Math.abs(ny) > 0.001 ? minSepY / (2 * Math.abs(ny)) : Number.POSITIVE_INFINITY;
        return Math.max(10, Math.min(needX, needY));
    }

    function stackStep(nx, ny, prevWidth, nextWidth) {
        if (Math.abs(nx) >= Math.abs(ny)) {
            return (prevWidth + nextWidth) / 2 + LABEL_PAD;
        }
        return LABEL_HEIGHT + 4;
    }

    function placeLabelSide(list, other, axis, side) {
        const placed = [];
        const widest = list.length ? Math.max.apply(null, list.map(function (entry) {
            return entry.width;
        })) : 0;
        const otherWidest = other.length ? Math.max.apply(null, other.map(function (entry) {
            return entry.width;
        })) : 0;
        let gap = sideClearance(axis.nx, axis.ny, widest, otherWidest);
        list.forEach(function (entry, index) {
            if (index > 0) {
                gap += stackStep(axis.nx, axis.ny, list[index - 1].width, entry.width);
            }
            placed.push({
                x: axis.mx + axis.nx * gap * side,
                y: axis.my + axis.ny * gap * side,
                text: entry.text
            });
        });
        return placed;
    }

    function bidirectionalLabelPlacements(ctx) {
        const placed = [];
        if (!lastGraph || !network) {
            return placed;
        }
        const pairs = edgePairGroups(lastGraph);
        Object.keys(pairs).forEach(function (key) {
            const pair = pairs[key];
            if (!isBidirectionalPair(pair)) {
                return;
            }
            const sample = pair.fwd[0] || pair.rev[0];
            const axis = pairAxis(sample.edge.from, sample.edge.to);
            if (!axis) {
                return;
            }
            const below = measurePairLabels(ctx, pair.fwd);
            const above = measurePairLabels(ctx, pair.rev);
            placeLabelSide(below, above, axis, 1).forEach(function (item) {
                placed.push(item);
            });
            placeLabelSide(above, below, axis, -1).forEach(function (item) {
                placed.push(item);
            });
        });
        return placed;
    }

    function drawBidirectionalLabels(ctx) {
        const theme = themePalette();
        bidirectionalLabelPlacements(ctx).forEach(function (item) {
            paintDirectedLabel(ctx, item.x, item.y, item.text, theme);
        });
    }

    function visEdges(graph) {
        const theme = themePalette();
        const pairs = edgePairGroups(graph);
        const pairOf = {};
        Object.keys(pairs).forEach(function (key) {
            pairs[key].fwd.concat(pairs[key].rev).forEach(function (item) {
                pairOf[item.index] = pairs[key];
            });
        });
        const sameDir = {};
        graph.edges.forEach(function (edge, index) {
            const key = edge.from + "\0" + edge.to;
            if (!sameDir[key]) {
                sameDir[key] = [];
            }
            sameDir[key].push(index);
        });
        return graph.edges.map(function (edge, index) {
            const label = edge.label || "";
            const pair = pairOf[index];
            const bidirectional = isBidirectionalPair(pair);
            const group = sameDir[edge.from + "\0" + edge.to] || [index];
            const slot = group.indexOf(index);
            const mid = (group.length - 1) / 2;
            const offset = slot - mid;
            let smooth;
            if (bidirectional) {
                smooth = { enabled: false };
            } else if (group.length === 1) {
                smooth = { type: "cubicBezier", forceDirection: "horizontal", roundness: 0.22 };
            } else if (offset === 0) {
                smooth = { type: "cubicBezier", forceDirection: "horizontal", roundness: 0.18 };
            } else {
                smooth = {
                    type: offset < 0 ? "curvedCCW" : "curvedCW",
                    roundness: Math.min(0.2 + Math.abs(offset) * 0.2, 0.85)
                };
            }
            return {
                id: String(index),
                from: edge.from,
                to: edge.to,
                label: bidirectional ? "" : abbreviate(label, 24),
                title: label,
                arrows: { to: { enabled: true, scaleFactor: 0.75 } },
                color: { color: theme.border, highlight: theme.primary },
                font: {
                    align: "horizontal",
                    size: 11,
                    color: theme.muted,
                    face: "system-ui, sans-serif",
                    strokeWidth: 4,
                    strokeColor: theme.canvas
                },
                smooth: smooth
            };
        });
    }

    function declutterPositions(graph) {
        const depth = graph.depth || graphDepth;
        const byLevel = {};
        Object.keys(graph.nodes).forEach(function (key) {
            const level = roleLevel(graph.nodes[key].role, depth);
            if (!byLevel[level]) {
                byLevel[level] = [];
            }
            byLevel[level].push(key);
        });
        const levelKeys = Object.keys(byLevel).map(Number).sort(function (a, b) {
            return a - b;
        });
        const current = network ? network.getPositions() : {};
        levelKeys.forEach(function (level) {
            byLevel[level].sort(function (a, b) {
                const pa = current[a];
                const pb = current[b];
                if (pa && pb && pa.y !== pb.y) {
                    return pa.y - pb.y;
                }
                const na = graph.nodes[a];
                const nb = graph.nodes[b];
                return String(na.title || na.id).localeCompare(String(nb.title || nb.id));
            });
        });

        const outgoing = {};
        const incoming = {};
        graph.edges.forEach(function (edge) {
            if (!outgoing[edge.from]) {
                outgoing[edge.from] = [];
            }
            outgoing[edge.from].push(edge.to);
            if (!incoming[edge.to]) {
                incoming[edge.to] = [];
            }
            incoming[edge.to].push(edge.from);
        });

        function indexOf(order) {
            const map = {};
            order.forEach(function (id, index) {
                map[id] = index;
            });
            return map;
        }

        function barycenter(neighbors, index) {
            if (!neighbors || !neighbors.length) {
                return null;
            }
            let sum = 0;
            let count = 0;
            neighbors.forEach(function (id) {
                if (index[id] != null) {
                    sum += index[id];
                    count += 1;
                }
            });
            return count ? sum / count : null;
        }

        function sortByBarycenter(ids, neighborsOf, index) {
            ids.sort(function (a, b) {
                const left = barycenter(neighborsOf[a], index);
                const right = barycenter(neighborsOf[b], index);
                if (left == null && right == null) {
                    return 0;
                }
                if (left == null) {
                    return 1;
                }
                if (right == null) {
                    return -1;
                }
                return left - right;
            });
        }

        for (let pass = 0; pass < 4; pass += 1) {
            for (let i = 1; i < levelKeys.length; i += 1) {
                sortByBarycenter(byLevel[levelKeys[i]], incoming, indexOf(byLevel[levelKeys[i - 1]]));
            }
            for (let i = levelKeys.length - 2; i >= 0; i -= 1) {
                sortByBarycenter(byLevel[levelKeys[i]], outgoing, indexOf(byLevel[levelKeys[i + 1]]));
            }
        }

        const xGap = 280;
        const yGap = 150;
        const tallest = levelKeys.reduce(function (max, level) {
            return Math.max(max, byLevel[level].length);
        }, 1);
        const canvasHeight = (tallest - 1) * yGap;
        const updates = [];
        levelKeys.forEach(function (level, column) {
            const ids = byLevel[level];
            const colHeight = (ids.length - 1) * yGap;
            const originY = (canvasHeight - colHeight) / 2 + (column % 2) * (yGap / 4);
            ids.forEach(function (id, row) {
                updates.push({
                    id: id,
                    x: column * xGap,
                    y: originY + row * yGap,
                    fixed: false
                });
            });
        });
        return updates;
    }

    function declutter() {
        if (!network || !nodeSet || !edgeSet || !lastGraph) {
            return;
        }
        network.setOptions({
            layout: { hierarchical: false },
            physics: { enabled: false }
        });
        nodeSet.update(declutterPositions(lastGraph));
        edgeSet.update(visEdges(lastGraph));
        window.requestAnimationFrame(function () {
            if (network) {
                network.fit({ animation: { duration: 280, easingFunction: "easeInOutQuad" } });
            }
        });
    }

    function visNodes(graph) {
        const theme = themePalette();
        return Object.keys(graph.nodes).map(function (key) {
            const node = graph.nodes[key];
            const focus = node.role === "focus";
            const color = TYPE_COLORS[node.type] || theme.primary;
            const subtitle = abbreviate(node.title, 28)
                || (usesRoleCodeTitle(node.type) ? "" : node.id);
            const label = node.type + (subtitle ? "\n" + subtitle : "");
            return {
                id: key,
                label: label,
                level: roleLevel(node.role, graph.depth),
                title: node.type + (node.title ? " · " + node.title : ""),
                shape: "box",
                margin: 10,
                borderWidth: focus ? 3 : 2,
                color: focus
                    ? {
                        background: theme.primary,
                        border: theme.primary,
                        highlight: { background: theme.primary, border: theme.primary }
                    }
                    : {
                        background: theme.nodeBg,
                        border: color,
                        highlight: { background: theme.nodeHover, border: color }
                    },
                font: {
                    face: "system-ui, sans-serif",
                    size: 13,
                    color: focus ? theme.onPrimary : theme.text,
                    bold: { color: focus ? theme.onPrimary : theme.text }
                }
            };
        });
    }

    function destroyNetwork() {
        if (network) {
            network.destroy();
            network = null;
        }
        nodeSet = null;
        edgeSet = null;
        focusKey = "";
    }

    function destroy() {
        expandToken += 1;
        mountedResource = null;
        mountedByKey = null;
        restoreMaximize();
        destroyNetwork();
    }

    function exportBasename() {
        if (mountedResource && mountedResource.resourceType && mountedResource.id) {
            return mountedResource.resourceType + "-" + mountedResource.id + "-reference-graph";
        }
        return "reference-graph";
    }

    function graphCanvas() {
        return network && network.canvas && network.canvas.frame && network.canvas.frame.canvas;
    }

    function xmlEscape(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function openPreparedTab(filename) {
        const tab = window.open("about:blank", "_blank");
        if (!tab) {
            return null;
        }
        try {
            tab.document.title = filename;
            tab.document.body.style.margin = "0";
            tab.document.body.style.fontFamily = "system-ui, sans-serif";
            tab.document.body.textContent = "Preparing " + filename + "…";
        } catch (ignore) {
        }
        return tab;
    }

    function showBlobInTab(tab, blob, filename) {
        let file = blob;
        try {
            file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        } catch (ignore) {
        }
        const url = URL.createObjectURL(file);
        if (!tab) {
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
        } else {
            try {
                tab.location.replace(url);
            } catch (ignore) {
                tab.location.href = url;
            }
        }
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 120000);
    }

    function toDom(point) {
        if (!point || !network) {
            return { x: 0, y: 0 };
        }
        return network.canvasToDOM({ x: point.x, y: point.y });
    }

    function edgeVias(edge) {
        const type = edge && edge.edgeType;
        if (!type || typeof type.getViaCoordinates !== "function") {
            return [];
        }
        const via = type.getViaCoordinates();
        if (!via) {
            return [];
        }
        if (Array.isArray(via)) {
            return via.filter(function (point) {
                return point && typeof point.x === "number" && typeof point.y === "number";
            });
        }
        if (typeof via.x === "number" && typeof via.y === "number") {
            return [via];
        }
        return [];
    }

    function bezierPoint(from, vias, to, t) {
        const u = 1 - t;
        if (!vias || !vias.length) {
            return {
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t
            };
        }
        if (vias.length === 1) {
            return {
                x: u * u * from.x + 2 * u * t * vias[0].x + t * t * to.x,
                y: u * u * from.y + 2 * u * t * vias[0].y + t * t * to.y
            };
        }
        return {
            x: u * u * u * from.x + 3 * u * u * t * vias[0].x + 3 * u * t * t * vias[1].x + t * t * t * to.x,
            y: u * u * u * from.y + 3 * u * u * t * vias[0].y + 3 * u * t * t * vias[1].y + t * t * t * to.y
        };
    }

    function tangentPoint(from, vias, to, t) {
        const before = bezierPoint(from, vias, to, Math.max(0, t - 0.02));
        const after = bezierPoint(from, vias, to, Math.min(1, t + 0.02));
        return { x: after.x - before.x, y: after.y - before.y };
    }

    function svgArrow(from, vias, to, size) {
        const tip = toDom(to);
        const dir = tangentPoint(from, vias, to, 1);
        const length = Math.hypot(dir.x, dir.y) || 1;
        const ux = dir.x / length;
        const uy = dir.y / length;
        const px = -uy;
        const py = ux;
        const back = size * 0.9;
        const half = size * 0.42;
        const baseX = tip.x - ux * back;
        const baseY = tip.y - uy * back;
        return [
            tip.x + "," + tip.y,
            (baseX + px * half) + "," + (baseY + py * half),
            (baseX - px * half) + "," + (baseY - py * half)
        ].join(" ");
    }

    function svgPath(from, vias, to) {
        const start = toDom(from);
        const end = toDom(to);
        if (!vias || !vias.length) {
            return "M" + start.x + " " + start.y + " L" + end.x + " " + end.y;
        }
        if (vias.length === 1) {
            const via = toDom(vias[0]);
            return "M" + start.x + " " + start.y + " Q" + via.x + " " + via.y + " " + end.x + " " + end.y;
        }
        const a = toDom(vias[0]);
        const b = toDom(vias[1]);
        return "M" + start.x + " " + start.y + " C" + a.x + " " + a.y + " " + b.x + " " + b.y + " " + end.x + " " + end.y;
    }

    function svgHaloText(x, y, text, fill, stroke, size) {
        return '<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="middle" ' +
            'font-family="system-ui, sans-serif" font-size="' + size + '" fill="' + xmlEscape(fill) + '" ' +
            'stroke="' + xmlEscape(stroke) + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke">' +
            xmlEscape(text) + "</text>";
    }

    function buildGraphSvg() {
        const el = document.getElementById("resource-graph");
        const theme = themePalette();
        const width = el ? el.clientWidth : 800;
        const height = el ? el.clientHeight : 420;
        const scale = network && typeof network.getScale === "function" ? network.getScale() : 1;
        const parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
                '" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Reference graph">',
            '<rect width="100%" height="100%" fill="' + xmlEscape(theme.canvas) + '"/>'
        ];
        const edgeColor = theme.border;
        const arrowSize = Math.max(8, 12 * scale);
        if (network && network.body && network.body.edges) {
            Object.keys(network.body.edges).forEach(function (id) {
                const edge = network.body.edges[id];
                if (!edge || !edge.fromPoint || !edge.toPoint) {
                    return;
                }
                const vias = edgeVias(edge);
                parts.push(
                    '<path d="' + svgPath(edge.fromPoint, vias, edge.toPoint) +
                        '" fill="none" stroke="' + xmlEscape(edgeColor) + '" stroke-width="' +
                        Math.max(1, 1.5 * scale) + '"/>'
                );
                parts.push(
                    '<polygon points="' + svgArrow(edge.fromPoint, vias, edge.toPoint, arrowSize) +
                        '" fill="' + xmlEscape(edgeColor) + '"/>'
                );
                const label = edge.options && edge.options.label;
                if (label && String(label).trim()) {
                    const mid = toDom(bezierPoint(edge.fromPoint, vias, edge.toPoint, 0.5));
                    parts.push(svgHaloText(mid.x, mid.y, String(label).trim(), theme.muted, theme.canvas, 11));
                }
            });
        }
        if (lastGraph && network && typeof network.getBoundingBox === "function") {
            Object.keys(lastGraph.nodes).forEach(function (key) {
                const node = lastGraph.nodes[key];
                const box = network.getBoundingBox(key);
                if (!box) {
                    return;
                }
                const topLeft = toDom({ x: box.left, y: box.top });
                const bottomRight = toDom({ x: box.right, y: box.bottom });
                const x = topLeft.x;
                const y = topLeft.y;
                const w = Math.max(1, bottomRight.x - topLeft.x);
                const h = Math.max(1, bottomRight.y - topLeft.y);
                const focus = node.role === "focus";
                const fill = focus ? theme.primary : theme.nodeBg;
                const stroke = focus ? theme.primary : (TYPE_COLORS[node.type] || theme.primary);
                const text = focus ? theme.onPrimary : theme.text;
                parts.push(
                    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
                        '" rx="6" ry="6" fill="' + xmlEscape(fill) + '" stroke="' + xmlEscape(stroke) +
                        '" stroke-width="' + (focus ? 3 : 2) + '"/>'
                );
                const subtitle = abbreviate(node.title, 28)
                    || (usesRoleCodeTitle(node.type) ? "" : node.id);
                const lines = [node.type].concat(subtitle ? [subtitle] : []);
                const lineH = 16;
                const cx = x + w / 2;
                const cy = y + h / 2;
                lines.forEach(function (line, index) {
                    const ly = cy + (index - (lines.length - 1) / 2) * lineH;
                    parts.push(
                        '<text x="' + cx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="middle" ' +
                            'font-family="system-ui, sans-serif" font-size="13" fill="' + xmlEscape(text) + '">' +
                            xmlEscape(line) + "</text>"
                    );
                });
            });
        }
        const measure = document.createElement("canvas").getContext("2d");
        bidirectionalLabelPlacements(measure).forEach(function (item) {
            const point = toDom(item);
            parts.push(svgHaloText(point.x, point.y, item.text, theme.muted, theme.canvas, 11 * scale));
        });
        parts.push("</svg>");
        return parts.join("");
    }

    function exportGraphPng() {
        if (!network) {
            return;
        }
        network.redraw();
        const canvas = graphCanvas();
        if (!canvas) {
            return;
        }
        const filename = exportBasename() + ".png";
        const tab = openPreparedTab(filename);
        const theme = themePalette();
        const out = document.createElement("canvas");
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext("2d");
        ctx.fillStyle = theme.canvas;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        const finish = function (blob) {
            if (!blob) {
                if (tab) {
                    tab.document.body.textContent = "Could not export the graph as PNG.";
                }
                return;
            }
            showBlobInTab(tab, blob, filename);
        };
        if (out.toBlob) {
            out.toBlob(finish, "image/png");
            return;
        }
        const data = out.toDataURL("image/png");
        const binary = atob(data.split(",")[1] || "");
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        finish(new Blob([bytes], { type: "image/png" }));
    }

    function exportGraphSvg() {
        if (!network) {
            return;
        }
        network.redraw();
        const filename = exportBasename() + ".svg";
        const tab = openPreparedTab(filename);
        const blob = new Blob([buildGraphSvg()], { type: "image/svg+xml;charset=utf-8" });
        showBlobInTab(tab, blob, filename);
    }

    function draw(graph) {
        const el = document.getElementById("resource-graph");
        if (!el || typeof vis === "undefined" || !vis.Network) {
            if (el) {
                el.innerHTML = '<div class="text-muted p-3">Graph view is unavailable.</div>';
            }
            return;
        }
        bindTheme();
        destroyNetwork();
        lastGraph = graph;
        focusKey = graph.focus;
        el.innerHTML = "";
        nodeSet = new vis.DataSet(visNodes(graph));
        edgeSet = new vis.DataSet(visEdges(graph));
        network = new vis.Network(el, {
            nodes: nodeSet,
            edges: edgeSet
        }, {
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: "LR",
                    sortMethod: "directed",
                    levelSeparation: 180,
                    nodeSpacing: 80,
                    treeSpacing: 110
                }
            },
            physics: false,
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                navigationButtons: true,
                keyboard: { enabled: true, bindToWindow: false },
                hover: true,
                tooltipDelay: 200,
                selectable: true
            },
            nodes: {
                shape: "box"
            },
            edges: {
                width: 1.5
            }
        });
        let nodeDragOrigin = null;
        let nodeWasDragged = false;
        const dragClickSlop = 6;

        function pointerMoved(params) {
            if (!nodeDragOrigin || !params.pointer || !params.pointer.DOM) {
                return false;
            }
            const dx = params.pointer.DOM.x - nodeDragOrigin.x;
            const dy = params.pointer.DOM.y - nodeDragOrigin.y;
            return (dx * dx + dy * dy) > (dragClickSlop * dragClickSlop);
        }

        function releaseHierarchicalLock() {
            if (!network) {
                return;
            }
            const positions = network.getPositions();
            const updates = Object.keys(positions).map(function (id) {
                return {
                    id: id,
                    x: positions[id].x,
                    y: positions[id].y,
                    fixed: false
                };
            });
            if (!updates.length) {
                return;
            }
            network.setOptions({
                layout: { hierarchical: false },
                physics: { enabled: false }
            });
            nodeSet.update(updates);
        }

        network.once("afterDrawing", releaseHierarchicalLock);
        network.on("afterDrawing", function (ctx) {
            drawBidirectionalLabels(ctx);
        });
        network.on("dragStart", function (params) {
            nodeWasDragged = false;
            nodeDragOrigin = params.pointer && params.pointer.DOM
                ? { x: params.pointer.DOM.x, y: params.pointer.DOM.y }
                : null;
            if (params.nodes.length) {
                el.style.cursor = "grabbing";
            }
        });
        network.on("dragging", function (params) {
            if (params.nodes.length && pointerMoved(params)) {
                nodeWasDragged = true;
            }
        });
        network.on("dragEnd", function () {
            el.style.cursor = "grab";
            window.setTimeout(function () {
                nodeWasDragged = false;
            }, 0);
        });
        network.on("click", function (params) {
            if (nodeWasDragged) {
                nodeWasDragged = false;
                return;
            }
            if (!params.nodes.length) {
                return;
            }
            const key = params.nodes[0];
            if (key === focusKey) {
                return;
            }
            const parts = String(key).split("/");
            const type = parts[0];
            const id = parts.slice(1).join("/");
            if (type && id) {
                window.location.hash = detailHref(type, id);
            }
        });
        network.on("hoverNode", function () {
            el.style.cursor = "grab";
        });
        network.on("blurNode", function () {
            el.style.cursor = "grab";
        });
        el.style.cursor = "grab";
        if (isMaximized()) {
            window.requestAnimationFrame(resizeNetwork);
        }
    }

    function loadNeighborhood(type, id, iterate) {
        const paths = [];
        if (iterate) {
            paths.push("/" + type + "?_id=" + encodeURIComponent(id) +
                "&_include=*&_include:iterate=*&_revinclude=*&_revinclude:iterate=*&_count=150");
        }
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_include=*&_revinclude=*&_count=150");
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_revinclude=*&_count=150");
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_revinclude=*:*&_count=150");

        function next(index) {
            if (index >= paths.length) {
                return $.Deferred().reject().promise();
            }
            return CadminApi.fhir(paths[index]).then(null, function () {
                return next(index + 1);
            });
        }

        return next(0);
    }

    function mergeBundle(byKey, bundle) {
        CadminApi.bundleResources(bundle).forEach(function (item) {
            remember(byKey, item);
        });
    }

    function fetchKeysForHop(focusResource, byKey, hop) {
        const keys = keysAtHop(focusResource, byKey, hop);
        const needed = keys.filter(function (key) {
            return !byKey[key] || byKey[key]._display;
        });
        const expand = keys.filter(function (key) {
            return byKey[key] && !byKey[key]._display;
        });
        return needed.concat(expand).slice(0, NEIGHBOR_FETCH_LIMIT).map(function (key) {
            if (byKey[key] && !byKey[key]._display) {
                return { type: byKey[key].resourceType, id: byKey[key].id };
            }
            const parts = key.split("/");
            return { type: parts[0], id: parts.slice(1).join("/") };
        });
    }

    function loadMany(items) {
        const deferred = $.Deferred();
        const collected = [];
        let pending = items.length;
        if (!pending) {
            return deferred.resolve(collected).promise();
        }
        items.forEach(function (item) {
            loadNeighborhood(item.type, item.id, false).done(function (bundle) {
                collected.push(bundle);
            }).always(function () {
                pending -= 1;
                if (pending === 0) {
                    deferred.resolve(collected);
                }
            });
        });
        return deferred.promise();
    }

    function redrawMounted() {
        if (!mountedResource || !mountedByKey) {
            return;
        }
        draw(graphFrom(mountedResource, mountedByKey, graphDepth));
    }

    function expandFromHop(hop, token, depth) {
        if (token !== expandToken || !mountedResource || !mountedByKey || hop >= depth) {
            return;
        }
        const fetches = fetchKeysForHop(mountedResource, mountedByKey, hop);
        if (!fetches.length) {
            expandFromHop(hop + 1, token, depth);
            return;
        }
        loadMany(fetches).done(function (bundles) {
            if (token !== expandToken || !mountedByKey) {
                return;
            }
            bundles.forEach(function (item) {
                mergeBundle(mountedByKey, item);
            });
            redrawMounted();
            expandFromHop(hop + 1, token, depth);
        });
    }

    function startExpand() {
        if (!mountedResource || !mountedByKey) {
            return;
        }
        const token = expandToken + 1;
        expandToken = token;
        const depth = graphDepth;
        const resource = mountedResource;
        loadNeighborhood(resource.resourceType, resource.id, depth > 1).done(function (bundle) {
            if (token !== expandToken || !mountedByKey) {
                return;
            }
            mergeBundle(mountedByKey, bundle);
            redrawMounted();
            expandFromHop(1, token, depth);
        });
    }

    function applyDepth(value) {
        const next = clampDepth(value);
        const previous = graphDepth;
        graphDepth = next;
        syncDepthInput();
        if (!mountedResource || !mountedByKey) {
            return;
        }
        redrawMounted();
        if (next > previous) {
            startExpand();
        }
    }

    function mount(resource) {
        const el = document.getElementById("resource-graph");
        if (!el || !resource || !resource.resourceType || !resource.id) {
            return;
        }
        graphDepth = readDepth();
        syncDepthInput();
        mountedResource = resource;
        mountedByKey = {};
        remember(mountedByKey, resource);
        redrawMounted();
        startExpand();
    }

    $(document).on("input.resourcegraphdepth", "#resource-graph-depth", function () {
        const n = parseInt(this.value, 10);
        if (n >= DEPTH_MIN && n <= DEPTH_MAX) {
            applyDepth(n);
        }
    });
    $(document).on("change.resourcegraphdepth", "#resource-graph-depth", function () {
        applyDepth(this.value);
    });
    $(document).on("click.resourcegraphdeclutter", "#resource-graph-declutter", function (event) {
        event.preventDefault();
        declutter();
    });
    $(document).on("click.resourcegraphexportpng", "#resource-graph-export-png, #resource-graph-export-png-item", function (event) {
        event.preventDefault();
        exportGraphPng();
    });
    $(document).on("click.resourcegraphexportsvg", "#resource-graph-export-svg", function (event) {
        event.preventDefault();
        exportGraphSvg();
    });
    $(document).on("maximized.lte.card-widget.resourcegraphfs minimized.lte.card-widget.resourcegraphfs", function (event) {
        if (!$(event.target).closest("#resource-graph-card").length) {
            return;
        }
        afterMaximizeChange();
    });
    $(document).on("keydown.resourcegraphfs", function (event) {
        if (event.key === "Escape" && isMaximized()) {
            restoreMaximize();
        }
    });
    $(window).on("resize.resourcegraphfs", function () {
        if (isMaximized()) {
            resizeNetwork();
        }
    });
    $(window).on("hashchange.resourcegraph", destroy);

    return {
        card: card,
        mount: mount,
        resize: resizeNetwork,
        destroy: destroy,
        detailHref: detailHref
    };
}());
