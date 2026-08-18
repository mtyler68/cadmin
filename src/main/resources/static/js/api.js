window.CadminApi = (function ($) {
    function cookie(name) {
        const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
        return match ? decodeURIComponent(match[1]) : "";
    }

    let csrfToken = "";
    let csrfHeaderName = "X-XSRF-TOKEN";

    function csrfHeaders() {
        const token = csrfToken || cookie("XSRF-TOKEN");
        return token ? { [csrfHeaderName]: token } : {};
    }

    function rememberCsrf(config) {
        if (config && config.csrfToken) {
            csrfToken = config.csrfToken;
        }
        if (config && config.csrfHeaderName) {
            csrfHeaderName = config.csrfHeaderName;
        }
        return config;
    }

    function ajax(options) {
        return $.ajax($.extend(true, {
            headers: $.extend({ "X-Requested-With": "XMLHttpRequest" }, csrfHeaders()),
            xhrFields: { withCredentials: true }
        }, options)).fail(function (xhr) {
            if (xhr.status === 401 && !options.skipAuthRedirect
                    && options.url !== "/login" && options.url !== "/api/auth/login") {
                window.location.href = "/login.html";
            }
        });
    }

    function get(url) {
        const request = ajax({ url: url, method: "GET" });
        if (url === "/api/auth/config") {
            return request.done(rememberCsrf);
        }
        return request;
    }

    function send(url, method, data, contentType) {
        return ajax({
            url: url,
            method: method,
            data: typeof data === "string" ? data : JSON.stringify(data),
            contentType: contentType || "application/json"
        });
    }

    function login(username, password) {
        return ajax({
            url: "/login",
            method: "POST",
            skipAuthRedirect: true,
            data: JSON.stringify({ username: username, password: password }),
            contentType: "application/json"
        });
    }

    function logout() {
        return ajax({ url: "/logout", method: "POST" });
    }

    function fhir(path, method, data) {
        return ajax({
            url: "/fhir" + path,
            method: method || "GET",
            data: data ? JSON.stringify(data) : undefined,
            contentType: data ? "application/fhir+json" : undefined,
            converters: {
                "text json": function (text) {
                    return text && String(text).trim() ? JSON.parse(text) : null;
                }
            },
            headers: $.extend({
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/fhir+json"
            }, data ? { Prefer: "return=representation" } : {}, csrfHeaders())
        });
    }

    function showAlert(selector, type, message) {
        $(selector)
            .removeClass("d-none alert-success alert-danger alert-warning alert-info")
            .addClass("alert alert-" + type)
            .text(message);
    }

    function showToast(type, message) {
        if (!message || typeof bootstrap === "undefined") {
            return;
        }
        let container = document.getElementById("cadmin-toasts");
        if (!container) {
            container = document.createElement("div");
            container.id = "cadmin-toasts";
            container.className = "toast-container position-fixed p-3";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "false");
            document.body.appendChild(container);
        }
        const danger = type === "danger";
        const light = type === "warning" || type === "info";
        const toastEl = document.createElement("div");
        toastEl.className = "toast align-items-center text-bg-" + type + " border-0 shadow";
        toastEl.setAttribute("role", danger ? "alert" : "status");
        toastEl.setAttribute("aria-live", danger ? "assertive" : "polite");
        toastEl.setAttribute("aria-atomic", "true");
        toastEl.innerHTML = '<div class="d-flex">' +
            '<div class="toast-body">' + escapeHtml(message) + "</div>" +
            '<button type="button" class="btn-close ' + (light ? "" : "btn-close-white ") +
                'me-2 m-auto" data-bs-dismiss="toast" aria-label="Dismiss"></button>' +
            "</div>";
        container.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, {
            autohide: true,
            delay: danger ? 8000 : 5000
        });
        toastEl.addEventListener("hidden.bs.toast", function () {
            toastEl.remove();
        });
        toast.show();
    }

    function escapeHtml(value) {
        return $("<div>").text(value == null ? "" : String(value)).html();
    }

    function resourceLink(href, label) {
        return '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a>";
    }

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

    function detailHref(type, id) {
        const prefix = DETAIL_PREFIX[type];
        if (prefix) {
            return prefix + encodeURIComponent(id);
        }
        return "#/resources/" + encodeURIComponent(type) + "/" + encodeURIComponent(id);
    }

    function decodeId(value) {
        const text = value == null ? "" : String(value);
        if (!text) {
            return "";
        }
        try {
            return decodeURIComponent(text);
        } catch (error) {
            return text;
        }
    }

    function routeParamId(params) {
        return (params || []).map(decodeId).filter(Boolean).join("/");
    }

    function referenceId(ref) {
        if (!ref) {
            return "";
        }
        const reference = typeof ref === "string" ? ref : (ref.reference || "");
        const urn = reference.match(/^urn:uuid:([^/?#]+)$/i);
        if (urn) {
            return decodeId(urn[1]);
        }
        const match = reference.match(/\/([^/]+)$/);
        return match ? decodeId(match[1]) : "";
    }

    const PAGE_SIZE = 20;

    function pagedPath(path, page, size) {
        size = size || PAGE_SIZE;
        page = Math.max(0, parseInt(page, 10) || 0);
        const text = String(path || "");
        const qIndex = text.indexOf("?");
        const base = qIndex >= 0 ? text.slice(0, qIndex) : text;
        const params = new URLSearchParams(qIndex >= 0 ? text.slice(qIndex + 1) : "");
        params.set("_count", String(size));
        if (page > 0) {
            params.set("_offset", String(page * size));
        } else {
            params.delete("_offset");
        }
        return base + "?" + params.toString();
    }

    function bundleResources(bundle, resourceType) {
        return (bundle && bundle.entry || []).map(function (entry) {
            return entry.resource;
        }).filter(function (resource) {
            return resource && (!resourceType || resource.resourceType === resourceType);
        });
    }

    function bundleHasNext(bundle, page, returned, size, total) {
        if ((bundle && bundle.link || []).some(function (link) { return link.relation === "next"; })) {
            return true;
        }
        if (typeof total === "number") {
            return (page + 1) * size < total;
        }
        return returned >= size;
    }

    function pageWindow(current, pageCount) {
        const pages = [];
        if (pageCount <= 7) {
            for (let i = 0; i < pageCount; i += 1) {
                pages.push(i);
            }
            return pages;
        }
        pages.push(0);
        let start = Math.max(1, current - 1);
        let end = Math.min(pageCount - 2, current + 1);
        if (current <= 2) {
            start = 1;
            end = 3;
        }
        if (current >= pageCount - 3) {
            start = pageCount - 4;
            end = pageCount - 2;
        }
        if (start > 1) {
            pages.push("ellipsis");
        }
        for (let i = start; i <= end; i += 1) {
            pages.push(i);
        }
        if (end < pageCount - 2) {
            pages.push("ellipsis");
        }
        pages.push(pageCount - 1);
        return pages;
    }

    function pagerButton(page, label, disabled, active) {
        if (disabled) {
            return '<li class="page-item disabled"><span class="page-link">' + escapeHtml(label) + "</span></li>";
        }
        if (active) {
            return '<li class="page-item active" aria-current="page">' +
                '<button type="button" class="page-link" data-page="' + page + '">' + escapeHtml(label) + "</button></li>";
        }
        return '<li class="page-item">' +
            '<button type="button" class="page-link" data-page="' + page + '">' + escapeHtml(label) + "</button></li>";
    }

    function renderPager(selector, options) {
        const opts = options || {};
        const page = Math.max(0, opts.page || 0);
        const size = opts.size || PAGE_SIZE;
        const returned = opts.returned || 0;
        const total = typeof opts.total === "number" ? opts.total : undefined;
        const $el = $(selector);
        if (!$el.length) {
            return;
        }
        if (!returned && page === 0) {
            $el.empty();
            return;
        }
        const hasPrev = page > 0;
        const hasNext = opts.hasNext != null
            ? !!opts.hasNext
            : bundleHasNext(opts.bundle, page, returned, size, total);
        const start = page * size + (returned ? 1 : 0);
        const end = page * size + returned;
        const label = typeof total === "number"
            ? "Showing " + start + "–" + end + " of " + total
            : "Showing " + start + "–" + end;
        let numbers = "";
        if (typeof total === "number" && total > 0) {
            const pageCount = Math.max(1, Math.ceil(total / size));
            numbers = pageWindow(page, pageCount).map(function (item) {
                if (item === "ellipsis") {
                    return '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
                }
                return pagerButton(item, String(item + 1), false, item === page);
            }).join("");
        } else {
            numbers = pagerButton(page, String(page + 1), false, true);
        }
        $el.html(
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">' +
                '<div class="text-muted small">' + escapeHtml(label) + "</div>" +
                '<nav aria-label="List pages"><ul class="pagination pagination-sm mb-0">' +
                    pagerButton(page - 1, "Previous", !hasPrev, false) +
                    numbers +
                    pagerButton(page + 1, "Next", !hasNext, false) +
                "</ul></nav></div>"
        );
        $el.off("click.pager").on("click.pager", "button[data-page]", function () {
            const nextPage = parseInt($(this).attr("data-page"), 10);
            if (!isNaN(nextPage) && typeof opts.onPage === "function") {
                opts.onPage(nextPage);
            }
        });
    }

    function createdResourceId(body, xhr, resourceType) {
        if (body && body.id) {
            return body.id;
        }
        const header = (xhr && (xhr.getResponseHeader("Location") || xhr.getResponseHeader("Content-Location"))) || "";
        if (!header) {
            return "";
        }
        const urn = header.match(/urn:uuid:([^/?#]+)/i);
        if (urn) {
            return decodeId(urn[1]);
        }
        if (resourceType) {
            const match = header.match(new RegExp(resourceType + "/([^/?#]+)"));
            if (match) {
                return decodeId(match[1]);
            }
        }
        const tail = header.match(/\/([^/?#]+)(?:\/_history\/[^/?#]+)?\/?$/);
        return tail ? decodeId(tail[1]) : "";
    }

    const VALUE_SETS = {
        subscriptionStatus: "http://hl7.org/fhir/ValueSet/subscription-status",
        subscriptionChannelType: "http://hl7.org/fhir/ValueSet/subscription-channel-type",
        subscriptionPayloadContent: "http://hl7.org/fhir/ValueSet/subscription-payload-content",
        publicationStatus: "http://hl7.org/fhir/ValueSet/publication-status",
        interactionTrigger: "http://hl7.org/fhir/ValueSet/interaction-trigger",
        subscriptiontopicCrBehavior: "http://hl7.org/fhir/ValueSet/subscriptiontopic-cr-behavior",
        searchComparator: "http://hl7.org/fhir/ValueSet/search-comparator",
        searchModifierCode: "http://hl7.org/fhir/ValueSet/search-modifier-code",
        searchParamType: "http://hl7.org/fhir/ValueSet/search-param-type",
        resourceTypes: "http://hl7.org/fhir/ValueSet/resource-types",
        consentState: "http://hl7.org/fhir/ValueSet/consent-state-codes",
        consentProvisionType: "http://hl7.org/fhir/ValueSet/consent-provision-type",
        consentCategory: "http://hl7.org/fhir/ValueSet/consent-category",
        consentAction: "http://hl7.org/fhir/ValueSet/consent-action",
        consentPolicy: "http://hl7.org/fhir/ValueSet/consent-policy",
        consentDataMeaning: "http://hl7.org/fhir/ValueSet/consent-data-meaning"
    };

    const valueSetCache = {};

    function flattenExpansion(items, out) {
        (items || []).forEach(function (item) {
            if (item && item.code) {
                out.push({
                    code: item.code,
                    display: item.display || item.code,
                    system: item.system || ""
                });
            }
            if (item && item.contains) {
                flattenExpansion(item.contains, out);
            }
        });
        return out;
    }

    function sortConcepts(concepts) {
        return concepts.slice().sort(function (a, b) {
            return String(a.display || a.code).localeCompare(String(b.display || b.code));
        });
    }

    function expandValueSet(url, options) {
        const opts = options || {};
        const count = opts.count || 500;
        const filter = opts.filter || "";
        const key = String(url) + "|" + count + "|" + filter;
        if (valueSetCache[key]) {
            return $.Deferred().resolve(valueSetCache[key]).promise();
        }
        let path = "/ValueSet/$expand?url=" + encodeURIComponent(url) + "&count=" + encodeURIComponent(String(count));
        if (filter) {
            path += "&filter=" + encodeURIComponent(filter);
        }
        return fhir(path).then(function (valueSet) {
            const contains = ((valueSet && valueSet.expansion) || {}).contains || [];
            const concepts = sortConcepts(flattenExpansion(contains, []));
            if (!concepts.length) {
                return $.Deferred().reject(valueSet).promise();
            }
            valueSetCache[key] = concepts;
            return concepts;
        });
    }

    function optionHtml(items, selected) {
        return (items || []).map(function (item) {
            const code = item.code != null ? item.code : item;
            const display = item.display != null ? item.display : item;
            const mark = String(code) === String(selected) ? " selected" : "";
            return '<option value="' + escapeHtml(code) + '"' + mark + ">" + escapeHtml(display) + "</option>";
        }).join("");
    }

    function ensureSelected(concepts, selected) {
        if (selected == null || selected === "") {
            return concepts;
        }
        if (concepts.some(function (item) { return String(item.code) === String(selected); })) {
            return concepts;
        }
        return concepts.concat([{ code: selected, display: selected }]);
    }

    function fillSelectOptions(selector, concepts, options) {
        const opts = options || {};
        const $el = $(selector);
        if (!$el.length) {
            return concepts || [];
        }
        const selected = opts.selected !== undefined ? opts.selected : $el.val();
        const items = ensureSelected((opts.prepend || []).concat(concepts || []), selected);
        $el.html(optionHtml(items, selected));
        return concepts || [];
    }

    function fillValueSetSelect(selector, url, options) {
        const opts = options || {};
        return expandValueSet(url, opts).then(function (concepts) {
            fillSelectOptions(selector, concepts, opts);
            if (typeof opts.onConcepts === "function") {
                opts.onConcepts(concepts);
            }
            return concepts;
        }, function () {
            const fallback = opts.fallback || [];
            fillSelectOptions(selector, fallback, opts);
            if (typeof opts.onConcepts === "function") {
                opts.onConcepts(fallback);
            }
            return fallback;
        });
    }

    function fillValueSetChecks(containerSelector, url, options) {
        const opts = options || {};
        const $el = $(containerSelector);
        const selected = opts.selected || [];
        const name = opts.name || "vs";
        const inputClass = opts.inputClass || "";
        function apply(concepts) {
            $el.html((concepts || []).map(function (item) {
                const id = name + "-" + String(item.code).replace(/[^A-Za-z0-9_-]/g, "_");
                const checked = selected.indexOf(item.code) >= 0 ? " checked" : "";
                return '<div class="form-check">' +
                    '<input class="form-check-input' + (inputClass ? " " + inputClass : "") +
                    '" type="checkbox" name="' + escapeHtml(name) + '" value="' +
                    escapeHtml(item.code) + '" id="' + escapeHtml(id) + '"' + checked + ">" +
                    '<label class="form-check-label" for="' + escapeHtml(id) + '">' +
                    escapeHtml(item.display) + "</label></div>";
            }).join(""));
            if (typeof opts.onConcepts === "function") {
                opts.onConcepts(concepts);
            }
            return concepts || [];
        }
        return expandValueSet(url, opts).then(apply, function () {
            return apply(opts.fallback || []);
        });
    }

    function geocode(fields) {
        const params = [];
        ["q", "line", "city", "state", "postalCode", "country"].forEach(function (key) {
            const value = fields && fields[key];
            if (value) {
                params.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }
        });
        return get("/api/geocode" + (params.length ? "?" + params.join("&") : ""));
    }

    function valueSetDisplay(concepts, code) {
        const match = (concepts || []).find(function (item) { return item.code === code; });
        return match ? match.display : (code || "—");
    }

    return {
        get: get,
        post: function (url, data) { return send(url, "POST", data); },
        put: function (url, data) { return send(url, "PUT", data); },
        login: login,
        logout: logout,
        fhir: fhir,
        showAlert: showAlert,
        showToast: showToast,
        escapeHtml: escapeHtml,
        resourceLink: resourceLink,
        detailHref: detailHref,
        routeParamId: routeParamId,
        referenceId: referenceId,
        createdResourceId: createdResourceId,
        pageSize: PAGE_SIZE,
        pagedPath: pagedPath,
        bundleResources: bundleResources,
        renderPager: renderPager,
        valueSets: VALUE_SETS,
        expandValueSet: expandValueSet,
        fillSelectOptions: fillSelectOptions,
        fillValueSetSelect: fillValueSetSelect,
        fillValueSetChecks: fillValueSetChecks,
        valueSetDisplay: valueSetDisplay,
        geocode: geocode
    };
}(jQuery));
