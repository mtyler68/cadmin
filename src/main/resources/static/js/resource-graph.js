window.CadminResourceGraph = (function () {
    const DETAIL_PREFIX = {
        Patient: "#/patients/",
        RelatedPerson: "#/caregivers/",
        Practitioner: "#/practitioners/",
        Device: "#/devices/",
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
    const DEPTH_MAX = 3;
    const DEPTH_DEFAULT = 2;
    const NEIGHBOR_FETCH_LIMIT = 10;

    let network = null;
    let nodeSet = null;
    let edgeSet = null;
    let lastGraph = null;
    let focusKey = "";
    let cssFullscreen = false;
    let graphDepth = DEPTH_DEFAULT;
    let mountedResource = null;
    let mountedByKey = null;
    let expandToken = 0;

    function clampDepth(value) {
        const n = parseInt(value, 10);
        if (n < DEPTH_MIN) {
            return DEPTH_MIN;
        }
        if (n > DEPTH_MAX) {
            return DEPTH_MAX;
        }
        if (n === 1 || n === 2 || n === 3) {
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
            '<div class="card-header py-3 d-flex justify-content-between align-items-center">' +
                '<h6 class="m-0"><i class="bi bi-diagram-3 me-2"></i>Reference graph</h6>' +
                '<div class="d-flex align-items-center gap-2">' +
                    '<label class="small text-muted mb-0 d-flex align-items-center gap-1" for="resource-graph-depth">' +
                        "Depth" +
                        '<input id="resource-graph-depth" class="form-control form-control-sm resource-graph-depth" ' +
                            'type="number" min="' + DEPTH_MIN + '" max="' + DEPTH_MAX + '" step="1" value="' +
                            graphDepth + '" title="Graph depth" aria-label="Graph depth">' +
                    "</label>" +
                    '<span class="small text-muted d-none d-lg-inline">Scroll to zoom · drag to pan</span>' +
                    '<button class="btn btn-sm btn-outline-secondary" type="button" id="resource-graph-declutter" title="Arrange nodes so connectors do not overlap">' +
                        '<i class="bi bi-distribute-vertical" aria-hidden="true"></i>' +
                        '<span class="ms-1">Declutter</span>' +
                    "</button>" +
                    '<button class="btn btn-sm btn-outline-secondary" type="button" id="resource-graph-fullscreen" title="Fullscreen">' +
                        '<i class="bi bi-fullscreen" aria-hidden="true"></i>' +
                        '<span class="ms-1">Fullscreen</span>' +
                    "</button>" +
                "</div>" +
            "</div>" +
            '<div class="card-body p-0">' +
                '<div id="resource-graph" class="resource-graph"></div>' +
            "</div>" +
        "</div>";
    }

    function nativeFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function isFullscreen() {
        const cardEl = document.getElementById("resource-graph-card");
        return cssFullscreen || !!(cardEl && nativeFullscreenElement() === cardEl);
    }

    function syncFullscreenUi() {
        const button = document.getElementById("resource-graph-fullscreen");
        const active = isFullscreen();
        document.body.classList.toggle("resource-graph-fullscreen-open", active);
        if (!button) {
            return;
        }
        button.title = active ? "Exit fullscreen" : "Fullscreen";
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.innerHTML = active
            ? '<i class="bi bi-fullscreen-exit" aria-hidden="true"></i><span class="ms-1">Exit</span>'
            : '<i class="bi bi-fullscreen" aria-hidden="true"></i><span class="ms-1">Fullscreen</span>';
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

    function afterFullscreenChange() {
        syncFullscreenUi();
        window.requestAnimationFrame(function () {
            resizeNetwork();
        });
    }

    function enterCssFullscreen() {
        const cardEl = document.getElementById("resource-graph-card");
        if (!cardEl) {
            return;
        }
        cssFullscreen = true;
        cardEl.classList.add("resource-graph-is-fullscreen");
        afterFullscreenChange();
    }

    function exitCssFullscreen() {
        const cardEl = document.getElementById("resource-graph-card");
        cssFullscreen = false;
        if (cardEl) {
            cardEl.classList.remove("resource-graph-is-fullscreen");
        }
        afterFullscreenChange();
    }

    function exitNativeFullscreen() {
        const active = nativeFullscreenElement();
        if (!active) {
            return;
        }
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    function exitAllFullscreen() {
        if (cssFullscreen) {
            exitCssFullscreen();
        }
        exitNativeFullscreen();
    }

    function enterFullscreen() {
        const cardEl = document.getElementById("resource-graph-card");
        if (!cardEl) {
            return;
        }
        const request = cardEl.requestFullscreen || cardEl.webkitRequestFullscreen;
        if (!request) {
            enterCssFullscreen();
            return;
        }
        const result = request.call(cardEl);
        if (result && typeof result.then === "function") {
            result.then(afterFullscreenChange).catch(enterCssFullscreen);
        }
    }

    function toggleFullscreen() {
        if (isFullscreen()) {
            exitAllFullscreen();
            return;
        }
        enterFullscreen();
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

    function visEdges(graph) {
        const groups = {};
        graph.edges.forEach(function (edge, index) {
            const pair = edge.from + "\0" + edge.to;
            if (!groups[pair]) {
                groups[pair] = [];
            }
            groups[pair].push(index);
        });
        return graph.edges.map(function (edge, index) {
            const label = edge.label || "";
            const group = groups[edge.from + "\0" + edge.to] || [index];
            const slot = group.indexOf(index);
            const mid = (group.length - 1) / 2;
            const offset = slot - mid;
            let smooth;
            if (group.length === 1) {
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
                label: abbreviate(label, 24),
                title: label,
                arrows: { to: { enabled: true, scaleFactor: 0.75 } },
                color: { color: "#b7b9cc", highlight: "#4e73df" },
                font: {
                    align: "middle",
                    size: 11,
                    color: "#858796",
                    face: "Nunito, system-ui, sans-serif",
                    strokeWidth: 3,
                    strokeColor: "#fff"
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
        return Object.keys(graph.nodes).map(function (key) {
            const node = graph.nodes[key];
            const focus = node.role === "focus";
            const color = TYPE_COLORS[node.type] || "#6f42c1";
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
                    ? { background: "#4e73df", border: "#224abe", highlight: { background: "#224abe", border: "#224abe" } }
                    : { background: "#fff", border: color, highlight: { background: "#f8f9fc", border: color } },
                font: {
                    face: "Nunito, system-ui, sans-serif",
                    size: 13,
                    color: focus ? "#fff" : "#5a5c69",
                    bold: { color: focus ? "#fff" : "#5a5c69" }
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
        exitAllFullscreen();
        destroyNetwork();
    }

    function draw(graph) {
        const el = document.getElementById("resource-graph");
        if (!el || typeof vis === "undefined" || !vis.Network) {
            if (el) {
                el.innerHTML = '<div class="text-muted p-3">Graph view is unavailable.</div>';
            }
            return;
        }
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
                keyboard: true,
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
        if (isFullscreen()) {
            window.requestAnimationFrame(resizeNetwork);
        }
    }

    function loadNeighborhood(type, id, iterate) {
        const paths = [];
        if (iterate) {
            paths.push("/" + type + "?_id=" + encodeURIComponent(id) +
                "&_include=*&_include:iterate=*&_revinclude=*&_revinclude:iterate=*&_count=100");
        }
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_include=*&_revinclude=*&_count=100");
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_revinclude=*&_count=100");
        paths.push("/" + type + "?_id=" + encodeURIComponent(id) + "&_revinclude=*:*&_count=100");

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
        if (n === 1 || n === 2 || n === 3) {
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
    $(document).on("click.resourcegraphfs", "#resource-graph-fullscreen", function (event) {
        event.preventDefault();
        toggleFullscreen();
    });
    $(document).on("fullscreenchange.resourcegraphfs webkitfullscreenchange.resourcegraphfs", afterFullscreenChange);
    $(document).on("keydown.resourcegraphfs", function (event) {
        if (event.key === "Escape" && cssFullscreen) {
            exitCssFullscreen();
        }
    });
    $(window).on("resize.resourcegraphfs", function () {
        if (isFullscreen()) {
            resizeNetwork();
        }
    });
    $(window).on("hashchange.resourcegraph", destroy);

    return {
        card: card,
        mount: mount,
        destroy: destroy,
        detailHref: detailHref
    };
}());
