window.CadminApp = (function ($) {
    const routes = {};
    let currentUser = null;
    let config = { mode: "local" };

    function register(name, render) {
        routes[name] = render;
    }

    function parseHash() {
        const raw = (window.location.hash || "#/dashboard").replace(/^#\/?/, "");
        const parts = raw.split("/").filter(Boolean);
        return { name: parts[0] || "dashboard", params: parts.slice(1) };
    }

    function setActive(name) {
        $(".sidebar .nav-item").removeClass("active");
        $('.sidebar .nav-item[data-route="' + name + '"]').addClass("active");
    }

    function isAdmin(user) {
        return ((user && user.roles) || []).some(function (role) {
            return /^(ROLE_)?ADMIN$/i.test(role);
        });
    }

    function render() {
        const route = parseHash();
        if ((route.name === "organizations" || route.name === "care-teams"
                || route.name === "locations" || route.name === "pds-policies"
                || route.name === "search-parameters" || route.name === "questionnaires"
                || route.name === "demo-data"
                || route.name === "subscription-topics" || route.name === "subscriptions"
                || route.name === "endpoints" || route.name === "consents")
                && !isAdmin(currentUser)) {
            window.location.hash = "#/dashboard";
            return;
        }
        setActive(route.name);
        const view = routes[route.name] || routes.dashboard;
        $("#app-content").html('<div class="text-muted py-5 text-center">Loading…</div>');
        view(route.params);
    }

    function applyUser(user) {
        currentUser = user;
        $("#topbar-username").text(user.displayName || user.username);
        $("#topbar-role").text((user.roles || []).join(", ") || user.mode);
        if (!isAdmin(user)) {
            $(".admin-only").addClass("d-none");
        }
    }

    function initChrome() {
        $("#sidebarToggle, #sidebarToggleTop").on("click", function () {
            if (window.innerWidth < 768) {
                $(".sidebar").toggleClass("mobile-open");
            } else {
                $(".sidebar").toggleClass("toggled");
            }
        });
        $("#logout-link").on("click", function (event) {
            event.preventDefault();
            CadminApi.logout().always(function () {
                window.location.href = "/login.html?logout";
            });
        });
        $("#global-search-form").on("submit", function (event) {
            event.preventDefault();
            const q = $("#global-search").val();
            window.location.hash = "#/patients" + (q ? "/" + encodeURIComponent(q) : "");
        });
    }

    function start() {
        initChrome();
        $.when(CadminApi.get("/api/auth/config"), CadminApi.get("/api/auth/me"))
            .done(function (configRes, meRes) {
                config = configRes[0];
                applyUser(meRes[0]);
                if (config.mode !== "local") {
                    $('.nav-item[data-route="users"]').addClass("d-none");
                }
                $(window).on("hashchange", render);
                render();
            });
    }

    return {
        register: register,
        start: start,
        user: function () { return currentUser; },
        config: function () { return config; },
        isAdmin: function () { return isAdmin(currentUser); },
        navigate: function (hash) { window.location.hash = hash; }
    };
}(jQuery));

$(function () {
    CadminApp.start();
});
