/*jslint browser: true*/
/*global $, WebSocket, angular*/

var createWebsocketClient = function() {
    "use strict";

    var ws = new WebSocket("ws://localhost:20921"),
        connected = false;

    ws.onopen = function() {
        ws.send(JSON.stringify({
            message: "initialize"
        }));
        connected = true;
    };

    ws.onclose = function() {
        // If the server shut down, attempt to reconnect once.
        console.log("Closed.");
        if (connected) {
            setTimeout(function() {
                createWebsocketClient();
            }, 1000);
        }
    };

    ws.onmessage = function(ev) {
        // TODO: Handle message.
    };

    ws.onerror = function(ev) {
        // TODO: Display error and shut down the web page.
        console.log("An error occurred.", ev);
    };
};

$(document).ready(function() {
    "use strict";

    createWebsocketClient();
});

// Set up Angular application.
var app = angular.module("ddsn", []);

app.directive("serverTabs", function() {
    "use strict";

    return {
        restrict: "E",
        templateUrl: "/templates/server-tabs.htm"
    };
});

app.controller("ddsn", ["$scope", function($scope) {
    "use strict";

    $scope.servers = [
        {
            gameName: "Descent 3 Dedicated Server",
            port: 2092
        },
        {
            gameName: "Descent 3 Dedicated Server",
            port: 2093
        }
    ];
}]);
