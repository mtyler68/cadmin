window.CadminResourceSource = (function () {
    const MODAL_ID = "cadmin-resource-source-modal";
    let currentResource = null;
    let currentGetter = null;
    let editor = null;
    let bound = false;

    function pretty(resource) {
        return JSON.stringify(resource || {}, null, 2);
    }

    function fileName(resource) {
        const type = (resource && resource.resourceType) || "Resource";
        const id = (resource && resource.id) || "resource";
        return type + "-" + id + ".json";
    }

    function activeResource() {
        return currentGetter ? currentGetter() : currentResource;
    }

    function sourceText() {
        return editor ? editor.getValue() : pretty(activeResource());
    }

    function button() {
        return '<button class="btn btn-outline-primary" type="button" data-fhir-source>' +
            '<i class="bi bi-code-slash me-1"></i>FHIR resource</button>';
    }

    function ensureModal() {
        if (document.getElementById(MODAL_ID)) {
            return;
        }
        $("body").append(
            '<div class="modal fade" id="' + MODAL_ID + '" tabindex="-1" aria-labelledby="' +
                MODAL_ID + '-title">' +
                '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header">' +
                            '<h5 class="modal-title" id="' + MODAL_ID + '-title">FHIR resource</h5>' +
                            '<div class="ms-auto d-flex align-items-center gap-1">' +
                                '<button class="btn btn-outline-secondary" type="button" id="' +
                                    MODAL_ID + '-copy" title="Copy" aria-label="Copy">' +
                                    '<i class="bi bi-clipboard" aria-hidden="true"></i></button>' +
                                '<button class="btn btn-outline-secondary" type="button" id="' +
                                    MODAL_ID + '-download" title="Download" aria-label="Download">' +
                                    '<i class="bi bi-download" aria-hidden="true"></i></button>' +
                                '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                            "</div>" +
                        "</div>" +
                        '<div class="modal-body p-0">' +
                            '<textarea id="' + MODAL_ID + '-text" class="d-none"></textarea>' +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</div>"
        );
        const textarea = document.getElementById(MODAL_ID + "-text");
        if (typeof CodeMirror !== "undefined" && textarea) {
            editor = CodeMirror.fromTextArea(textarea, {
                mode: { name: "javascript", json: true },
                theme: "material-darker",
                lineNumbers: true,
                lineWrapping: false,
                readOnly: true,
                matchBrackets: true,
                viewportMargin: Infinity
            });
            editor.getWrapperElement().classList.add("resource-source-editor");
        }
        $("#" + MODAL_ID).on("shown.bs.modal", function () {
            if (editor) {
                editor.refresh();
                editor.setSize("100%", "70vh");
            }
        });
        $("#" + MODAL_ID + "-copy").on("click", copySource);
        $("#" + MODAL_ID + "-download").on("click", downloadSource);
    }

    function showCopySuccess() {
        const $btn = $("#" + MODAL_ID + "-copy");
        $btn.html('<i class="bi bi-clipboard-check" aria-hidden="true"></i>')
            .attr("title", "Copied");
        window.setTimeout(function () {
            $btn.html('<i class="bi bi-clipboard" aria-hidden="true"></i>')
                .attr("title", "Copy");
        }, 1500);
    }

    function copySource() {
        const text = sourceText();
        const done = function () {
            showCopySuccess();
            CadminApi.showToast("success", "Copied to clipboard.");
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () {
                fallbackCopy(text, done);
            });
            return;
        }
        fallbackCopy(text, done);
    }

    function fallbackCopy(text, done) {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.left = "-9999px";
        document.body.appendChild(field);
        field.select();
        try {
            document.execCommand("copy");
            done();
        } catch (err) {
            CadminApi.showToast("danger", "Unable to copy.");
        }
        field.remove();
    }

    function fallbackDownload(blob, name) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function downloadSource() {
        const text = sourceText();
        const name = fileName(activeResource());
        const blob = new Blob([text], { type: "application/fhir+json" });
        if (typeof window.showSaveFilePicker !== "function") {
            fallbackDownload(blob, name);
            return;
        }
        window.showSaveFilePicker({
            suggestedName: name,
            types: [{
                description: "FHIR JSON",
                accept: {
                    "application/fhir+json": [".json"],
                    "application/json": [".json"]
                }
            }]
        }).then(function (handle) {
            return handle.createWritable().then(function (writable) {
                return writable.write(blob).then(function () {
                    return writable.close();
                });
            });
        }).catch(function (err) {
            if (err && err.name === "AbortError") {
                return;
            }
            fallbackDownload(blob, name);
        });
    }

    function open(resource) {
        if (resource) {
            currentResource = resource;
            currentGetter = null;
        }
        const data = activeResource();
        if (!data) {
            return;
        }
        currentResource = data;
        ensureModal();
        const text = pretty(data);
        const title = (data.resourceType || "Resource") +
            (data.id ? " / " + data.id : "");
        $("#" + MODAL_ID + "-title").text(title);
        if (editor) {
            editor.setValue(text);
        } else {
            $("#" + MODAL_ID + "-text").val(text);
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById(MODAL_ID)).show();
    }

    function hide() {
        const el = document.getElementById(MODAL_ID);
        if (!el) {
            return;
        }
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) {
            modal.hide();
        }
    }

    function mount(resource) {
        if (typeof resource === "function") {
            currentGetter = resource;
            currentResource = resource() || null;
        } else {
            currentGetter = null;
            currentResource = resource || null;
        }
        bindOnce();
    }

    function bindOnce() {
        if (bound) {
            return;
        }
        bound = true;
        $(document).on("click.resourcesource", "[data-fhir-source]", function (event) {
            event.preventDefault();
            open();
        });
        $(window).on("hashchange.resourcesource", hide);
    }

    return {
        button: button,
        mount: mount,
        open: open,
        hide: hide
    };
}());
