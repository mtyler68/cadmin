window.CadminWorkspace = (function ($) {
    const ROUTES = {
        patients: { type: "Patient", path: "/Patient/", icon: "bi-person", listLabel: "Patients" },
        caregivers: { type: "RelatedPerson", path: "/RelatedPerson/", icon: "bi-person-heart", listLabel: "Caregivers" },
        practitioners: { type: "Practitioner", path: "/Practitioner/", icon: "bi-person-badge", listLabel: "Practitioners" },
        devices: { type: "Device", path: "/Device/", icon: "bi-cpu", listLabel: "Devices" },
        flags: { type: "Flag", path: "/Flag/", icon: "bi-flag", listLabel: "Flags" },
        organizations: { type: "Organization", path: "/Organization/", icon: "bi-building", listLabel: "Organizations" },
        "care-teams": { type: "CareTeam", path: "/CareTeam/", icon: "bi-people", listLabel: "Care teams" },
        locations: { type: "Location", path: "/Location/", icon: "bi-geo-alt", listLabel: "Locations" },
        "pds-policies": { type: "Library", path: "/Library/", icon: "bi-shield-check", listLabel: "PDS Policies" },
        questionnaires: { type: "Questionnaire", path: "/Questionnaire/", icon: "bi-ui-checks", listLabel: "Questionnaires" },
        subscriptions: { type: "Subscription", path: "/Subscription/", icon: "bi-bell", listLabel: "Subscriptions" },
        "subscription-topics": { type: "SubscriptionTopic", path: "/SubscriptionTopic/", icon: "bi-broadcast", listLabel: "Subscription topics" },
        endpoints: { type: "Endpoint", path: "/Endpoint/", icon: "bi-plug", listLabel: "Endpoints" },
        consents: { type: "Consent", path: "/Consent/", icon: "bi-file-earmark-check", listLabel: "Consents" }
    };
    const LIST_LABELS = {
        dashboard: "Dashboard",
        resources: "FHIR browser",
        capabilities: "Capabilities",
        "demo-data": "Demo data",
        users: "Users",
        settings: "Settings",
        "search-parameters": "Search parameters"
    };
    const BOOKMARK_STORE = "cadmin-workspace-bookmarks";
    const TAB_STORE = "cadmin-workspace-open-tabs";
    const CLOSED_MAX = 100;
    const tabs = {};
    const order = [];
    const closedStack = [];
    let activeKey = "workspace";
    let paintedKey = "";
    let workspaceHash = "#/dashboard";
    let workspaceLabel = "Dashboard";
    let workspaceTouched = false;
    let suppressHash = false;
    let bound = false;
    let pendingReopen = null;
    let menuKey = "";
    let dragKey = "";
    let dragPinned = false;
    let suppressClick = false;
    let restoring = false;
    let restored = false;

    function specFor(routeName) {
        return ROUTES[routeName] || null;
    }

    function routeNameForType(type) {
        const names = Object.keys(ROUTES);
        for (let i = 0; i < names.length; i++) {
            if (ROUTES[names[i]].type === type) {
                return names[i];
            }
        }
        return "";
    }

    function tabKey(type, id) {
        return type + "/" + id;
    }

    function routeKey(route) {
        const spec = specFor(route && route.name);
        const id = CadminApi.routeParamId(route && route.params);
        if (!spec || !id) {
            return "";
        }
        return tabKey(spec.type, id);
    }

    function tabKeys() {
        const keys = order.filter(function (key) {
            return !!tabs[key];
        });
        const pinned = keys.filter(function (key) {
            return !!tabs[key].pinned;
        });
        const rest = keys.filter(function (key) {
            return !tabs[key].pinned;
        });
        return pinned.concat(rest);
    }

    function humanName(resource) {
        const name = resource && resource.name;
        const item = Array.isArray(name) ? name[0] : name;
        if (!item) {
            return "";
        }
        if (typeof item === "string") {
            return item;
        }
        const given = (item.given || []).join(" ");
        return [given, item.family].filter(Boolean).join(" ");
    }

    function titleOf(resource) {
        if (!resource) {
            return "Details";
        }
        const named = humanName(resource);
        if (named) {
            return named;
        }
        if (resource.title) {
            return resource.title;
        }
        if (resource.name && typeof resource.name === "string") {
            return resource.name;
        }
        const code = resource.code;
        const coding = (Array.isArray(code) ? code[0] : code) || {};
        const first = (coding.coding && coding.coding[0]) || {};
        return coding.text || first.display || first.code || resource.id || resource.resourceType || "Details";
    }

    function snapshot(tab) {
        return {
            key: tab.key,
            routeName: tab.routeName || routeNameForType(tab.type),
            id: tab.id,
            hash: tab.hash,
            icon: tab.icon,
            title: tab.title,
            type: tab.type,
            pinned: !!tab.pinned
        };
    }

    function rememberClosed(tab) {
        const snap = snapshot(tab);
        for (let i = closedStack.length - 1; i >= 0; i--) {
            if (closedStack[i] && closedStack[i].key === snap.key) {
                closedStack.splice(i, 1);
            }
        }
        closedStack.push(snap);
        if (closedStack.length > CLOSED_MAX) {
            closedStack.shift();
        }
    }

    const ADMIN_ROUTES = {
        organizations: true,
        "care-teams": true,
        locations: true,
        "pds-policies": true,
        "search-parameters": true,
        questionnaires: true,
        "demo-data": true,
        "subscription-topics": true,
        subscriptions: true,
        endpoints: true,
        consents: true
    };

    function sessionStoreKey() {
        const user = window.CadminApp && typeof CadminApp.user === "function" && CadminApp.user();
        const name = (user && (user.username || user.displayName)) || "default";
        return TAB_STORE + ":" + name;
    }

    function canRestoreRoute(routeName) {
        if (!ADMIN_ROUTES[routeName]) {
            return true;
        }
        return !!(window.CadminApp && typeof CadminApp.isAdmin === "function" && CadminApp.isAdmin());
    }

    function tabFromSnapshot(snap) {
        const routeName = (snap && snap.routeName) || routeNameForType(snap && snap.type);
        const spec = specFor(routeName);
        const id = snap && snap.id;
        if (!spec || !id || !canRestoreRoute(routeName)) {
            return null;
        }
        const key = snap.key || tabKey(spec.type, id);
        return {
            key: key,
            routeName: routeName,
            type: spec.type,
            id: id,
            hash: snap.hash || "#/" + routeName + "/" + encodeURIComponent(id),
            icon: snap.icon || spec.icon,
            title: snap.title || spec.type,
            load: function () {
                return CadminApi.fhir(spec.path + encodeURIComponent(id));
            },
            render: null,
            resource: null,
            dirty: true,
            pinned: !!snap.pinned
        };
    }

    function persistSession() {
        if (restoring) {
            return;
        }
        const payload = {
            tabs: tabKeys().map(function (key) {
                return snapshot(tabs[key]);
            }),
            order: order.filter(function (key) {
                return !!tabs[key];
            }),
            closed: closedStack.slice(),
            workspaceHash: workspaceHash,
            workspaceLabel: workspaceLabel
        };
        try {
            localStorage.setItem(sessionStoreKey(), JSON.stringify(payload));
        } catch (error) {
            // localStorage may be unavailable
        }
        renderHistoryMenu();
    }

    function restoreClosed(list) {
        if (!Array.isArray(list)) {
            return;
        }
        closedStack.length = 0;
        list.forEach(function (snap) {
            if (!snap || !snap.key || !snap.hash) {
                return;
            }
            const routeName = snap.routeName || routeNameForType(snap.type);
            if (!canRestoreRoute(routeName)) {
                return;
            }
            closedStack.push(snap);
        });
        if (closedStack.length > CLOSED_MAX) {
            closedStack.splice(0, closedStack.length - CLOSED_MAX);
        }
    }

    function restoreSession() {
        ensureShell();
        if (restored) {
            return;
        }
        restored = true;
        let data = null;
        try {
            data = JSON.parse(localStorage.getItem(sessionStoreKey()) || "null");
        } catch (error) {
            data = null;
        }
        restoring = true;
        restoreClosed(data && data.closed);
        if (data && Array.isArray(data.tabs)) {
            data.tabs.forEach(function (snap) {
                const tab = tabFromSnapshot(snap);
                if (!tab || tabs[tab.key]) {
                    return;
                }
                tabs[tab.key] = tab;
            });
            const savedOrder = Array.isArray(data.order) ? data.order : [];
            savedOrder.forEach(function (key) {
                if (tabs[key] && order.indexOf(key) < 0) {
                    order.push(key);
                }
            });
            data.tabs.forEach(function (snap) {
                const key = snap && (snap.key || (snap.type && snap.id ? tabKey(snap.type, snap.id) : ""));
                if (key && tabs[key] && order.indexOf(key) < 0) {
                    order.push(key);
                }
            });
            Object.keys(tabs).forEach(function (key) {
                if (order.indexOf(key) < 0) {
                    order.push(key);
                }
            });
            if (data.workspaceHash) {
                workspaceHash = data.workspaceHash;
                workspaceTouched = true;
            }
            if (data.workspaceLabel) {
                workspaceLabel = data.workspaceLabel;
                workspaceTouched = true;
            }
        }
        renderTabStrip();
        restoring = false;
        persistSession();
    }

    function readBookmarks() {
        try {
            const raw = localStorage.getItem(BOOKMARK_STORE);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (error) {
            return [];
        }
    }

    function writeBookmarks(list) {
        try {
            localStorage.setItem(BOOKMARK_STORE, JSON.stringify(list));
        } catch (error) {
            // localStorage may be unavailable
        }
    }

    function isBookmarked(key) {
        return readBookmarks().some(function (item) {
            return item.key === key;
        });
    }

    function addBookmark(tab) {
        const list = readBookmarks();
        if (list.some(function (item) {
            return item.key === tab.key;
        })) {
            return;
        }
        list.push({
            key: tab.key,
            hash: tab.hash,
            title: tab.title,
            icon: tab.icon,
            type: tab.type,
            id: tab.id,
            routeName: tab.routeName || routeNameForType(tab.type)
        });
        writeBookmarks(list);
        renderBookmarkMenu();
    }

    function removeBookmark(key) {
        writeBookmarks(readBookmarks().filter(function (item) {
            return item.key !== key;
        }));
        renderBookmarkMenu();
    }

    function clearBookmarks() {
        writeBookmarks([]);
        renderBookmarkMenu();
    }

    function renderBookmarkMenu() {
        const menu = document.getElementById("workspace-bookmark-menu");
        if (!menu) {
            return;
        }
        const list = readBookmarks();
        if (!list.length) {
            menu.innerHTML = '<li><span class="dropdown-item-text text-muted">No bookmarks</span></li>';
            return;
        }
        menu.innerHTML = list.map(function (item) {
            return '<li class="workspace-bookmark-row">' +
                '<a class="dropdown-item text-truncate" href="' + CadminApi.escapeHtml(item.hash) +
                '" data-bookmark-open="' + CadminApi.escapeHtml(item.key) + '">' +
                '<i class="bi ' + CadminApi.escapeHtml(item.icon || "bi-bookmark") + ' me-2" aria-hidden="true"></i>' +
                CadminApi.escapeHtml(item.title || item.key) + "</a>" +
                '<button type="button" class="workspace-bookmark-remove" data-bookmark-remove="' +
                CadminApi.escapeHtml(item.key) + '" title="Remove bookmark" aria-label="Remove bookmark">&times;</button></li>';
        }).join("") +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><button type="button" class="dropdown-item" data-bookmark-clear>' +
            '<i class="bi bi-bookmark-x me-2" aria-hidden="true"></i>Clear all bookmarks</button></li>';
    }

    function historyItemHtml(item, attr, extraClass) {
        return '<li><button type="button" class="dropdown-item text-truncate' + extraClass + '" ' + attr + '="' +
            CadminApi.escapeHtml(item.key) + '">' +
            '<i class="bi ' + CadminApi.escapeHtml(item.icon || "bi-file-earmark") + ' me-2" aria-hidden="true"></i>' +
            CadminApi.escapeHtml(item.title || item.key) + "</button></li>";
    }

    function renderHistoryMenu() {
        const menu = document.getElementById("workspace-history-menu");
        if (!menu) {
            return;
        }
        const openKeys = tabKeys();
        const closed = closedStack.filter(function (item) {
            return item && item.key && !tabs[item.key];
        }).reverse();
        let html = '<li><h6 class="dropdown-header">Open</h6></li>';
        if (!openKeys.length) {
            html += '<li><span class="dropdown-item-text text-muted">No open pages</span></li>';
        } else {
            html += openKeys.map(function (key) {
                const tab = tabs[key];
                const active = activeKey === key ? " active" : "";
                return historyItemHtml(tab, "data-history-open", active);
            }).join("");
        }
        html += '<li><hr class="dropdown-divider"></li>';
        html += '<li><h6 class="dropdown-header">Closed</h6></li>';
        if (!closed.length) {
            html += '<li><span class="dropdown-item-text text-muted">No closed pages</span></li>';
        } else {
            html += closed.map(function (item) {
                return historyItemHtml(item, "data-history-reopen", "");
            }).join("");
            html += '<li><hr class="dropdown-divider"></li>' +
                '<li><button type="button" class="dropdown-item" data-history-clear>' +
                '<i class="bi bi-x-square me-2" aria-hidden="true"></i>Clear closed history</button></li>';
        }
        menu.innerHTML = html;
    }

    function clearClosedHistory() {
        closedStack.length = 0;
        persistSession();
    }

    function navigateToDetailHash(hash, item) {
        if (!hash) {
            return;
        }
        const next = hash.charAt(0) === "#" ? hash : "#" + hash;
        if (window.location.hash === next) {
            const routeName = (item && (item.routeName || routeNameForType(item.type))) || "";
            if (routeName) {
                window.location.hash = "#/" + routeName;
                window.setTimeout(function () {
                    window.location.hash = next;
                }, 0);
                return;
            }
        }
        window.location.hash = next;
    }

    function goToTab(key) {
        if (!tabs[key]) {
            return;
        }
        activate(key);
        if (typeof tabs[key].render === "function") {
            syncHash(tabs[key].hash);
            return;
        }
        navigateToDetailHash(tabs[key].hash, tabs[key]);
    }

    function openBookmark(key) {
        const item = readBookmarks().filter(function (entry) {
            return entry.key === key;
        })[0];
        if (!item) {
            return;
        }
        ensureShell();
        if (tabs[item.key]) {
            goToTab(item.key);
            return;
        }
        const stub = tabFromSnapshot(item);
        if (stub) {
            tabs[stub.key] = stub;
            if (order.indexOf(stub.key) < 0) {
                order.push(stub.key);
            }
            activate(stub.key);
            navigateToDetailHash(stub.hash, stub);
            return;
        }
        navigateToDetailHash(item.hash, item);
    }

    function ensureMenu() {
        if (document.getElementById("workspace-tab-menu")) {
            return;
        }
        const menu = document.createElement("div");
        menu.id = "workspace-tab-menu";
        menu.className = "dropdown-menu workspace-tab-menu";
        menu.setAttribute("role", "menu");
        document.body.appendChild(menu);
    }

    function ensureShell() {
        if (document.getElementById("app-content-shell")) {
            return;
        }
        const content = document.getElementById("app-content");
        if (!content || !content.parentNode) {
            return;
        }
        const shell = document.createElement("div");
        shell.id = "app-content-shell";
        content.parentNode.insertBefore(shell, content);
        const tabsEl = document.createElement("ul");
        tabsEl.id = "app-content-tabs";
        tabsEl.className = "nav nav-pills flex-nowrap content-workspace-tabs";
        tabsEl.setAttribute("role", "tablist");
        const bar = document.createElement("div");
        bar.id = "app-content-tabs-bar";
        bar.className = "content-workspace-tabs-bar d-none";
        bar.appendChild(tabsEl);
        const appContent = content.closest(".app-content");
        const main = document.querySelector(".app-main");
        if (main && appContent && appContent.parentNode === main) {
            main.insertBefore(bar, appContent);
        } else {
            shell.insertBefore(bar, shell.firstChild);
        }
        const workspace = document.createElement("div");
        workspace.id = "app-workspace-pane";
        const detail = document.createElement("div");
        detail.id = "app-detail-pane";
        detail.className = "d-none";
        shell.appendChild(workspace);
        workspace.appendChild(content);
        shell.appendChild(detail);
        bindOnce();
    }

    function bindOnce() {
        if (bound) {
            return;
        }
        bound = true;
        ensureMenu();
        renderBookmarkMenu();
        renderHistoryMenu();
        $(document).on("click.workspace", "#app-content-tabs [data-workspace-tab]", function (event) {
            if (suppressClick) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if ($(event.target).closest("[data-workspace-close]").length) {
                return;
            }
            const key = $(this).attr("data-workspace-tab");
            if (key === "workspace") {
                showWorkspace();
                if (window.location.hash === workspaceHash) {
                    showPanes();
                    return;
                }
                window.location.hash = workspaceHash;
                return;
            }
            goToTab(key);
        });
        $(document).on("click.workspace", "#app-content-tabs [data-workspace-close]", function (event) {
            event.preventDefault();
            event.stopPropagation();
            close($(this).attr("data-workspace-close"));
        });
        $(document).on("contextmenu.workspace", "#app-content-tabs [data-workspace-tab]", function (event) {
            const key = $(this).attr("data-workspace-tab");
            if (key === "workspace" || !tabs[key]) {
                return;
            }
            event.preventDefault();
            showTabMenu(key, event.clientX, event.clientY);
        });
        $(document).on("click.workspace", "#workspace-tab-menu [data-workspace-menu]", function (event) {
            event.preventDefault();
            const action = $(this).attr("data-workspace-menu");
            const key = menuKey;
            hideTabMenu();
            if (!key || $(this).hasClass("disabled")) {
                return;
            }
            if (action === "close") {
                close(key);
                return;
            }
            if (action === "close-others") {
                closeOthers(key);
                return;
            }
            if (action === "close-all") {
                closeAll();
                return;
            }
            if (action === "close-left") {
                closeToLeft(key);
                return;
            }
            if (action === "pin") {
                togglePin(key);
                return;
            }
            if (action === "reopen") {
                reopenClosed();
                return;
            }
            if (action === "bookmark" && tabs[key]) {
                addBookmark(tabs[key]);
            }
        });
        $(document).on("click.workspace", function (event) {
            if (!$(event.target).closest("#workspace-tab-menu").length) {
                hideTabMenu();
            }
        });
        $(document).on("keydown.workspace", function (event) {
            if (event.key === "Escape") {
                hideTabMenu();
            }
        });
        $(document).on("click.workspace", "[data-bookmark-open]", function (event) {
            event.preventDefault();
            openBookmark($(this).attr("data-bookmark-open"));
        });
        $(document).on("click.workspace", "[data-bookmark-remove]", function (event) {
            event.preventDefault();
            event.stopPropagation();
            removeBookmark($(this).attr("data-bookmark-remove"));
        });
        $(document).on("click.workspace", "[data-bookmark-clear]", function (event) {
            event.preventDefault();
            clearBookmarks();
        });
        $(document).on("click.workspace", "[data-history-open]", function (event) {
            event.preventDefault();
            goToTab($(this).attr("data-history-open"));
        });
        $(document).on("click.workspace", "[data-history-reopen]", function (event) {
            event.preventDefault();
            reopenClosedKey($(this).attr("data-history-reopen"));
        });
        $(document).on("click.workspace", "[data-history-clear]", function (event) {
            event.preventDefault();
            clearClosedHistory();
        });
        $(document).on("dragstart.workspace", "#app-content-tabs [data-workspace-drag]", function (event) {
            if ($(event.target).closest("[data-workspace-close]").length) {
                event.preventDefault();
                return;
            }
            const key = $(this).attr("data-workspace-drag");
            if (!key || !tabs[key]) {
                event.preventDefault();
                return;
            }
            hideTabMenu();
            hideTabTooltips();
            dragKey = key;
            dragPinned = !!tabs[key].pinned;
            const native = event.originalEvent && event.originalEvent.dataTransfer;
            if (native) {
                native.effectAllowed = "move";
                native.setData("text/plain", key);
            }
            $(this).closest(".nav-item").addClass("is-dragging");
        });
        $(document).on("dragover.workspace", "#app-content-tabs", function (event) {
            if (!dragKey) {
                return;
            }
            const native = event.originalEvent;
            const clientX = native ? native.clientX : event.clientX;
            scrollStripDuringDrag(clientX);
            const item = dragItemFromPoint(native && native.target);
            clearDropMarkers();
            if (!item || !canDropOn(item)) {
                return;
            }
            event.preventDefault();
            if (native && native.dataTransfer) {
                native.dataTransfer.dropEffect = "move";
            }
            const after = dropAfter(item, clientX);
            item.classList.add(after ? "drop-after" : "drop-before");
        });
        $(document).on("drop.workspace", "#app-content-tabs", function (event) {
            if (!dragKey) {
                return;
            }
            event.preventDefault();
            const native = event.originalEvent;
            const item = dragItemFromPoint(native && native.target);
            const fromKey = dragKey;
            clearDropMarkers();
            if (!item || !canDropOn(item)) {
                return;
            }
            const toKey = item.getAttribute("data-workspace-drag");
            const clientX = native ? native.clientX : event.clientX;
            reorderTab(fromKey, toKey, dropAfter(item, clientX));
        });
        $(document).on("dragend.workspace", "#app-content-tabs [data-workspace-drag]", function () {
            if (dragKey) {
                suppressClick = true;
                window.setTimeout(function () {
                    suppressClick = false;
                }, 0);
            }
            dragKey = "";
            clearDropMarkers();
            $("#app-content-tabs .nav-item").removeClass("is-dragging");
        });
        $(".app-content, #app-content-tabs").on("scroll.workspace", hideTabMenu);
    }

    function workspacePane() {
        return document.getElementById("app-workspace-pane");
    }

    function detailPane() {
        return document.getElementById("app-detail-pane");
    }

    function root() {
        return detailPane() || document.getElementById("app-content");
    }

    function disposeTabTooltips() {
        const el = document.getElementById("app-content-tabs");
        if (!el || typeof bootstrap === "undefined" || !bootstrap.Tooltip) {
            return;
        }
        el.querySelectorAll("[data-bs-toggle=\"tooltip\"]").forEach(function (node) {
            const inst = bootstrap.Tooltip.getInstance(node);
            if (inst) {
                inst.dispose();
            }
        });
    }

    function hideTabTooltips() {
        const el = document.getElementById("app-content-tabs");
        if (!el || typeof bootstrap === "undefined" || !bootstrap.Tooltip) {
            return;
        }
        el.querySelectorAll("[data-bs-toggle=\"tooltip\"]").forEach(function (node) {
            const inst = bootstrap.Tooltip.getInstance(node);
            if (inst) {
                inst.hide();
            }
        });
    }

    function bindTabTooltips() {
        const el = document.getElementById("app-content-tabs");
        if (!el || typeof bootstrap === "undefined" || !bootstrap.Tooltip) {
            return;
        }
        el.querySelectorAll("[data-bs-toggle=\"tooltip\"]").forEach(function (node) {
            bootstrap.Tooltip.getOrCreateInstance(node, {
                placement: "bottom",
                trigger: "hover",
                container: "body",
                delay: { show: 250, hide: 50 }
            });
        });
    }

    function hideTabMenu() {
        const menu = document.getElementById("workspace-tab-menu");
        if (menu) {
            menu.classList.remove("show");
            menu.style.display = "none";
        }
        menuKey = "";
    }

    function dragItemFromPoint(target) {
        if (!target || !target.closest) {
            return null;
        }
        return target.closest("#app-content-tabs [data-workspace-drag]");
    }

    function canDropOn(item) {
        const key = item && item.getAttribute("data-workspace-drag");
        if (!dragKey || !key || key === dragKey || !tabs[key]) {
            return false;
        }
        return !!tabs[key].pinned === dragPinned;
    }

    function dropAfter(item, clientX) {
        const box = item.getBoundingClientRect();
        return clientX > box.left + (box.width / 2);
    }

    function clearDropMarkers() {
        const strip = document.getElementById("app-content-tabs");
        if (!strip) {
            return;
        }
        strip.querySelectorAll(".drop-before, .drop-after").forEach(function (node) {
            node.classList.remove("drop-before", "drop-after");
        });
    }

    function scrollStripDuringDrag(clientX) {
        const strip = document.getElementById("app-content-tabs");
        if (!strip) {
            return;
        }
        const box = strip.getBoundingClientRect();
        if (clientX < box.left + 36) {
            strip.scrollLeft -= 16;
        } else if (clientX > box.right - 36) {
            strip.scrollLeft += 16;
        }
    }

    function reorderTab(fromKey, toKey, placeAfter) {
        if (!fromKey || !toKey || fromKey === toKey || !tabs[fromKey] || !tabs[toKey]) {
            return;
        }
        if (!!tabs[fromKey].pinned !== !!tabs[toKey].pinned) {
            return;
        }
        const fromPos = order.indexOf(fromKey);
        if (fromPos < 0) {
            return;
        }
        order.splice(fromPos, 1);
        let toPos = order.indexOf(toKey);
        if (toPos < 0) {
            order.push(fromKey);
            renderTabStrip();
            return;
        }
        if (placeAfter) {
            toPos += 1;
        }
        order.splice(toPos, 0, fromKey);
        renderTabStrip();
    }

    function itemHtml(action, label, icon, disabled) {
        return '<li><button type="button" class="dropdown-item' + (disabled ? " disabled" : "") +
            '" data-workspace-menu="' + action + '"' + (disabled ? ' aria-disabled="true"' : "") +
            ' role="menuitem"><i class="bi ' + icon + '" aria-hidden="true"></i>' +
            CadminApi.escapeHtml(label) + "</button></li>";
    }

    function showTabMenu(key, x, y) {
        const menu = document.getElementById("workspace-tab-menu");
        const tab = tabs[key];
        if (!menu || !tab) {
            return;
        }
        hideTabTooltips();
        menuKey = key;
        const keys = tabKeys();
        const index = keys.indexOf(key);
        const closableOthers = keys.some(function (item) {
            return item !== key && !tabs[item].pinned;
        });
        const closableAll = keys.some(function (item) {
            return !tabs[item].pinned;
        });
        const closableLeft = keys.slice(0, Math.max(index, 0)).some(function (item) {
            return !tabs[item].pinned;
        });
        menu.innerHTML = itemHtml("close", "Close", "bi-x-lg", false) +
            itemHtml("close-others", "Close Other Tabs", "bi-x-square", !closableOthers) +
            itemHtml("close-all", "Close All Tabs", "bi-x-square-fill", !closableAll) +
            itemHtml("close-left", "Close Tabs to the Left", "bi-arrow-bar-left", !closableLeft) +
            '<li><hr class="dropdown-divider"></li>' +
            itemHtml("pin", tab.pinned ? "Unpin Tab" : "Pin Tab",
                tab.pinned ? "bi-pin-angle" : "bi-pin-angle-fill", false) +
            itemHtml("reopen", "Reopen Closed Tab", "bi-arrow-counterclockwise", !closedStack.length) +
            itemHtml("bookmark", "Bookmark", "bi-bookmark", isBookmarked(key));
        menu.classList.add("show");
        menu.style.display = "block";
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        const left = Math.min(x, window.innerWidth - width - 8);
        const top = Math.min(y, window.innerHeight - height - 8);
        menu.style.left = Math.max(8, left) + "px";
        menu.style.top = Math.max(8, top) + "px";
    }

    function renderTabStrip() {
        const el = document.getElementById("app-content-tabs");
        if (!el) {
            return;
        }
        disposeTabTooltips();
        const keys = tabKeys();
        const bar = document.getElementById("app-content-tabs-bar");
        if (!keys.length) {
            el.classList.add("d-none");
            if (bar) {
                bar.classList.add("d-none");
            }
            el.innerHTML = "";
            persistSession();
            return;
        }
        el.classList.remove("d-none");
        if (bar) {
            bar.classList.remove("d-none");
        }
        const workspaceActive = activeKey === "workspace" ? " active" : "";
        let html = '<li class="nav-item" role="presentation">' +
            '<button class="nav-link' + workspaceActive + '" type="button" data-workspace-tab="workspace">' +
            '<i class="bi bi-house me-1" aria-hidden="true"></i>' +
            '<span class="content-tab-label">' + CadminApi.escapeHtml(workspaceLabel) + "</span></button></li>";
        keys.forEach(function (key) {
            const tab = tabs[key];
            const active = activeKey === key ? " active" : "";
            const pinned = tab.pinned ? " content-tab-pinned" : "";
            html += '<li class="nav-item" role="presentation">' +
                '<button class="nav-link' + active + pinned + '" type="button" draggable="true" data-workspace-drag="' +
                CadminApi.escapeHtml(key) + '" data-workspace-tab="' +
                CadminApi.escapeHtml(key) + '" data-bs-toggle="tooltip" data-bs-title="' +
                CadminApi.escapeHtml(tab.title).replace(/"/g, "&quot;") + '">' +
                (tab.pinned ? '<i class="bi bi-pin-angle-fill content-tab-pin" aria-hidden="true"></i>' : "") +
                '<i class="bi ' + CadminApi.escapeHtml(tab.icon) + '" aria-hidden="true"></i>' +
                '<span class="content-tab-label">' + CadminApi.escapeHtml(tab.title) + "</span>" +
                '<span class="content-tab-close" data-workspace-close="' + CadminApi.escapeHtml(key) +
                '" title="Close" aria-label="Close">&times;</span></button></li>';
        });
        el.innerHTML = html;
        bindTabTooltips();
        scrollActiveTabIntoView();
        persistSession();
    }

    function scrollActiveTabIntoView() {
        const strip = document.getElementById("app-content-tabs");
        if (!strip) {
            return;
        }
        const active = strip.querySelector(".nav-link.active");
        if (!active) {
            return;
        }
        window.requestAnimationFrame(function () {
            const stripBox = strip.getBoundingClientRect();
            const tabBox = active.getBoundingClientRect();
            if (tabBox.left < stripBox.left) {
                strip.scrollLeft += tabBox.left - stripBox.left - 12;
                return;
            }
            if (tabBox.right > stripBox.right) {
                strip.scrollLeft += tabBox.right - stripBox.right + 12;
            }
        });
    }

    function showPanes() {
        const work = workspacePane();
        const detail = detailPane();
        if (!work || !detail) {
            return;
        }
        const showDetail = activeKey !== "workspace";
        work.classList.toggle("d-none", showDetail);
        detail.classList.toggle("d-none", !showDetail);
        if (showDetail) {
            scrollContentToTop();
        }
    }

    function scrollContentToTop() {
        const main = document.querySelector(".app-main");
        if (main) {
            main.scrollTop = 0;
        }
        const content = document.querySelector(".app-content");
        if (content) {
            content.scrollTop = 0;
        }
        const shell = document.getElementById("app-content-shell");
        if (shell) {
            shell.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }

    function teardownDetail() {
        const pane = detailPane();
        if (!pane) {
            return;
        }
        if (window.CadminResourceGraph && typeof CadminResourceGraph.destroy === "function") {
            CadminResourceGraph.destroy();
        }
        if (window.CadminLocationDetail && typeof CadminLocationDetail.destroyMap === "function") {
            CadminLocationDetail.destroyMap();
        }
        CadminApi.destroySelects(pane);
        $(pane).off();
        $(pane).empty();
        paintedKey = "";
    }

    function paint(key) {
        const tab = tabs[key];
        const pane = detailPane();
        if (!tab || !pane || !tab.resource || typeof tab.render !== "function") {
            return;
        }
        teardownDetail();
        tab.render(tab.resource, $(pane));
        paintedKey = key;
        if (typeof CadminResourceGraph !== "undefined" && typeof CadminResourceGraph.resize === "function") {
            window.setTimeout(CadminResourceGraph.resize, 50);
        }
    }

    function reload(key) {
        const tab = tabs[key];
        if (!tab || typeof tab.load !== "function") {
            return;
        }
        tab.load().done(function (resource) {
            tab.resource = resource;
            tab.title = titleOf(resource) || tab.title;
            tab.dirty = false;
            renderTabStrip();
            if (activeKey === key) {
                paint(key);
            }
        }).fail(function () {
            tab.dirty = false;
        });
    }

    function activate(key) {
        if (key !== "workspace" && !tabs[key]) {
            return;
        }
        activeKey = key;
        if (key !== "workspace" && typeof tabs[key].render === "function") {
            if (tabs[key].dirty) {
                reload(key);
            } else if (paintedKey !== key) {
                paint(key);
            } else if (window.CadminResourceGraph && typeof CadminResourceGraph.resize === "function") {
                window.setTimeout(CadminResourceGraph.resize, 50);
            }
        }
        showPanes();
        renderTabStrip();
    }

    function syncHash(hash) {
        if (!hash) {
            return;
        }
        const next = hash.charAt(0) === "#" ? hash : "#" + hash;
        if (window.location.hash === next) {
            return;
        }
        suppressHash = true;
        window.location.hash = next;
    }

    function consumeHashChange() {
        if (!suppressHash) {
            return false;
        }
        suppressHash = false;
        return true;
    }

    function showWorkspace(route) {
        ensureShell();
        if (route && route.name) {
            workspaceTouched = true;
            workspaceLabel = (ROUTES[route.name] && ROUTES[route.name].listLabel)
                || LIST_LABELS[route.name]
                || route.name;
            const hash = window.location.hash;
            if (hash && hash !== "#" && !routeKey(route)) {
                workspaceHash = hash;
            } else {
                workspaceHash = "#/" + route.name;
            }
        }
        activeKey = "workspace";
        showPanes();
        renderTabStrip();
    }

    function finishClose(wasActive) {
        hideTabMenu();
        if (wasActive) {
            activeKey = "workspace";
            showPanes();
            renderTabStrip();
            window.location.hash = workspaceHash;
            return;
        }
        renderTabStrip();
    }

    function close(key, options) {
        options = options || {};
        const tab = tabs[key];
        if (!tab) {
            return false;
        }
        if (options.skipPinned && tab.pinned) {
            return false;
        }
        if (!options.forget) {
            rememberClosed(tab);
        }
        const wasActive = activeKey === key;
        if (paintedKey === key) {
            teardownDetail();
        }
        delete tabs[key];
        const pos = order.indexOf(key);
        if (pos >= 0) {
            order.splice(pos, 1);
        }
        if (options.defer) {
            return wasActive;
        }
        finishClose(wasActive);
        return wasActive;
    }

    function closeMany(keys) {
        let wasActive = false;
        keys.forEach(function (key) {
            if (close(key, { defer: true, skipPinned: true })) {
                wasActive = true;
            }
        });
        finishClose(wasActive);
    }

    function closeOthers(keepKey) {
        closeMany(tabKeys().filter(function (key) {
            return key !== keepKey;
        }));
        if (tabs[keepKey] && activeKey !== keepKey) {
            activate(keepKey);
            syncHash(tabs[keepKey].hash);
        }
    }

    function closeAll() {
        closeMany(tabKeys());
    }

    function closeToLeft(fromKey) {
        const keys = tabKeys();
        const index = keys.indexOf(fromKey);
        if (index <= 0) {
            return;
        }
        closeMany(keys.slice(0, index));
    }

    function moveToPinned(key) {
        const pos = order.indexOf(key);
        if (pos >= 0) {
            order.splice(pos, 1);
        }
        order.unshift(key);
    }

    function togglePin(key) {
        const tab = tabs[key];
        if (!tab) {
            return;
        }
        tab.pinned = !tab.pinned;
        if (tab.pinned) {
            moveToPinned(key);
        }
        renderTabStrip();
    }

    function applyPendingReopen(key) {
        if (!pendingReopen || pendingReopen.key !== key || !tabs[key]) {
            return;
        }
        if (pendingReopen.pinned) {
            tabs[key].pinned = true;
            moveToPinned(key);
            renderTabStrip();
        }
        pendingReopen = null;
    }

    function takeClosed(key) {
        if (key) {
            for (let i = closedStack.length - 1; i >= 0; i--) {
                if (closedStack[i] && closedStack[i].key === key) {
                    return closedStack.splice(i, 1)[0];
                }
            }
            return null;
        }
        return closedStack.pop() || null;
    }

    function reopenSnapshot(snap) {
        if (!snap || !snap.hash) {
            return;
        }
        persistSession();
        if (tabs[snap.key]) {
            goToTab(snap.key);
            return;
        }
        pendingReopen = snap;
        const stub = tabFromSnapshot(snap);
        if (stub) {
            tabs[stub.key] = stub;
            if (order.indexOf(stub.key) < 0) {
                order.push(stub.key);
            }
            applyPendingReopen(stub.key);
            activate(stub.key);
            navigateToDetailHash(stub.hash, stub);
            return;
        }
        navigateToDetailHash(snap.hash, snap);
    }

    function reopenClosed() {
        reopenSnapshot(takeClosed());
    }

    function reopenClosedKey(key) {
        reopenSnapshot(takeClosed(key));
    }

    function openRoute(routeName, id, renderFn, onMissing) {
        ensureShell();
        const spec = specFor(routeName);
        if (!spec || !id) {
            if (onMissing) {
                onMissing();
            }
            return;
        }
        const key = tabKey(spec.type, id);
        const hash = "#/" + routeName + "/" + encodeURIComponent(id);
        if (!workspaceTouched) {
            workspaceHash = "#/" + routeName;
            workspaceLabel = spec.listLabel;
        }
        if (tabs[key]) {
            if (typeof renderFn === "function") {
                tabs[key].render = renderFn;
            }
            applyPendingReopen(key);
            activate(key);
            syncHash(hash);
            return;
        }
        tabs[key] = {
            key: key,
            routeName: routeName,
            type: spec.type,
            id: id,
            hash: hash,
            icon: spec.icon,
            title: spec.type,
            load: function () {
                return CadminApi.fhir(spec.path + encodeURIComponent(id));
            },
            render: renderFn,
            resource: null,
            dirty: false,
            pinned: false
        };
        if (order.indexOf(key) < 0) {
            order.push(key);
        }
        applyPendingReopen(key);
        activeKey = key;
        showPanes();
        renderTabStrip();
        const pane = detailPane();
        if (pane) {
            pane.innerHTML = '<div class="text-muted py-5 text-center">Loading…</div>';
        }
        tabs[key].load().done(function (resource) {
            if (!tabs[key]) {
                return;
            }
            tabs[key].resource = resource;
            tabs[key].title = titleOf(resource);
            renderTabStrip();
            if (activeKey === key) {
                paint(key);
            }
        }).fail(function () {
            close(key, { forget: true });
            showWorkspace({ name: routeName });
            if (onMissing) {
                onMissing();
            }
        });
    }

    function has(key) {
        return !!(key && tabs[key]);
    }

    function keyFromPath(path) {
        const match = String(path || "").match(/^\/([A-Za-z]+)\/([^/?#]+)/);
        if (!match) {
            return "";
        }
        try {
            return match[1] + "/" + decodeURIComponent(match[2]);
        } catch (error) {
            return match[1] + "/" + match[2];
        }
    }

    function notifyWrite(info) {
        const method = info && info.method;
        if (method === "DELETE") {
            const deleted = keyFromPath(info.path);
            if (deleted && tabs[deleted]) {
                close(deleted);
            }
        }
        const resource = info && info.resource;
        const writtenKey = resource && resource.resourceType && resource.id
            ? tabKey(resource.resourceType, resource.id)
            : "";
        Object.keys(tabs).forEach(function (key) {
            if (writtenKey && key === writtenKey) {
                if (resource && resource.resourceType) {
                    tabs[key].resource = resource;
                    tabs[key].title = titleOf(resource);
                }
                if (activeKey === key) {
                    return;
                }
            }
            tabs[key].dirty = true;
        });
        if (writtenKey && tabs[writtenKey]) {
            renderTabStrip();
        }
    }

    function handleRoute(route) {
        const key = routeKey(route);
        if (!key || !tabs[key] || typeof tabs[key].render !== "function") {
            return false;
        }
        applyPendingReopen(key);
        activate(key);
        if (tabs[key].dirty) {
            reload(key);
        }
        return true;
    }

    return {
        ensure: ensureShell,
        root: root,
        routeKey: routeKey,
        has: has,
        openRoute: openRoute,
        showWorkspace: showWorkspace,
        handleRoute: handleRoute,
        consumeHashChange: consumeHashChange,
        notifyWrite: notifyWrite,
        close: close,
        restore: restoreSession
    };
}(jQuery));
