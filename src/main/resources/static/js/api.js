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
            if (xhr.status === 401 && !options.skipAuthRedirect && options.url !== "/login") {
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
            url: "/api/auth/login",
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
            headers: $.extend({
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/fhir+json"
            }, csrfHeaders())
        });
    }

    function showAlert(selector, type, message) {
        $(selector)
            .removeClass("d-none alert-success alert-danger alert-warning alert-info")
            .addClass("alert alert-" + type)
            .text(message);
    }

    function escapeHtml(value) {
        return $("<div>").text(value == null ? "" : String(value)).html();
    }

    return {
        get: get,
        post: function (url, data) { return send(url, "POST", data); },
        put: function (url, data) { return send(url, "PUT", data); },
        login: login,
        logout: logout,
        fhir: fhir,
        showAlert: showAlert,
        escapeHtml: escapeHtml
    };
}(jQuery));
