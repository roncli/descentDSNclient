/*jslint browser: true*/
/*global $, WebSocket*/
$(document).ready(function() {
    "use strict";

    var ws = new WebSocket("ws://localhost:20921");

    ws.onopen = function() {
        // TODO: Request initialization data.
    };

    ws.onclose = function() {
        // TODO: Shut down the web page.
    };

    ws.onmessage = function(ev) {
        // TODO: Handle message.
    };

    ws.onerror = function(ev) {
        // TODO: Display error and shut down the web page.
    };
});
