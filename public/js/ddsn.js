/*jslint browser: true*/
/*global $, WebSocket, angular*/

var app = angular.module("ddsn", []),
    data = {
        serverTab: "news",
        settingsMenuTab: "descent3",
        settings: {
            descent3: {
                pathValid: false
            }
        }
    };

(function() {
    "use strict";

    var ws, scope;

    app.directive("offline", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/offline.htm"
        };
    });

    app.directive("error", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/error.htm"
        };
    });

    app.directive("serverTabs", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server-tabs.htm"
        };
    });

    app.directive("content", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/content.htm"
        };
    });

    app.directive("news", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/news.htm"
        };
    });

    app.directive("dashboard", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/dashboard.htm"
        };
    });

    app.directive("addServer", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server.htm"
        };
    });

    app.directive("settings", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/settings.htm"
        };
    });

    app.directive("settingsDescent3", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/settings-descent3.htm"
        };
    });

    app.directive("settingsModifications", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/settings-modifications.htm"
        };
    });

    app.controller("ddsn", ["$scope", function($scope) {
        $scope.data = data;

        $scope.openMenu = function(ev, screen) {
            $("button.server-tab").removeClass("btn-success").addClass("btn-primary");
            $(ev.currentTarget).removeClass("btn-primary").addClass("btn-success");
            data.serverTab = screen;
            //scope.$apply();
        };

        $scope.openSettings = function(ev, screen) {
            $("button.settings-menu-tab").removeClass("btn-success").addClass("btn-primary");
            $(ev.currentTarget).removeClass("btn-primary").addClass("btn-success");
            data.settingsMenuTab = screen;
            //scope.$apply();
        };

        $scope.updateSettingsDescent3Path = function() {
            ws.send(JSON.stringify({
                message: "settings.descent3.path",
                path: data.settings.descent3.path
            }));
        };
    }]);

    $(document).ready(function() {
        var createWebsocketClient = function() {
            var connected = false;
            ws = new WebSocket("ws://localhost:20921");

            ws.onopen = function() {
                ws.send(JSON.stringify({
                    message: "initialize"
                }));
                connected = true;
            };

            ws.onclose = function() {
                if (connected) {
                    // If the server shut down, attempt to reconnect once.
                    setTimeout(function() {
                        createWebsocketClient();
                    }, 1000);
                } else {
                    data.offline = true;
                    scope.$apply();
                }
            };

            ws.onmessage = function(ev) {
                var message = JSON.parse(ev.data),
                    key;

                switch (message.message) {
                    case "settings":
                        for (key in message.settings) {
                            if (message.settings.hasOwnProperty(key)) {
                                data.settings[key] = message.settings[key];
                            }
                        }
                        scope.$apply();
                        break;
                    case "settings.descent3.pathValid":
                        data.settings.descent3.pathValid = message.valid;
                        scope.$apply();
                        break;
                }
            };
        };

        scope = angular.element("html").scope();
        createWebsocketClient();
    });
}());
