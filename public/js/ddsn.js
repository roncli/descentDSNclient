/*jslint browser: true*/
/*global $, WebSocket, angular*/

var app = angular.module("ddsn", []),
    data = {
        serverTab: "news",
        addServerMenuTab: "saved",
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

    app.directive("addServerSaved", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-saved.htm"
        };
    });

    app.directive("addServerServer", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-server.htm"
        };
    });

    app.directive("addServerGame", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-game.htm"
        };
    });

    app.directive("addServerAllowed", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-allowed.htm"
        };
    });

    app.directive("addServerModifications", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-modifications.htm"
        };
    });

    app.directive("addServerLaunch", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/add-server-launch.htm"
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
        };

        $scope.openAddServer = function(ev, screen) {
            $("button.add-server-menu-tab").removeClass("btn-success").addClass("btn-primary");
            $(ev.currentTarget).removeClass("btn-primary").addClass("btn-success");
            data.addServerMenuTab = screen;
        };

        $scope.openSettings = function(ev, screen) {
            $("button.settings-menu-tab").removeClass("btn-success").addClass("btn-primary");
            $(ev.currentTarget).removeClass("btn-primary").addClass("btn-success");
            data.settingsMenuTab = screen;
        };

        $scope.updateAddServerServerPort = function() {
            data.settings.addServer.server.portValid = typeof data.settings.addServer.server.port === "number" && data.settings.addServer.server.port >= 0 && data.settings.addServer.server.port <= 65535 && data.settings.addServer.server.port % 1 === 0;
            data.settings.addServer.server.portsDiffer = data.settings.addServer.server.port !== data.settings.addServer.server.gamespyport;
        };

        $scope.updateAddServerServerGamespyport = function() {
            data.settings.addServer.server.gamespyportValid = typeof data.settings.addServer.server.gamespyport === "number" && data.settings.addServer.server.gamespyport >= 0 && data.settings.addServer.server.gamespyport <= 65535 && data.settings.addServer.server.gamespyport % 1 === 0;
            data.settings.addServer.server.portsDiffer = data.settings.addServer.server.port !== data.settings.addServer.server.gamespyport;
        };

        $scope.updateAddServerServerFramerate = function() {
            data.settings.addServer.server.framerateValid = typeof data.settings.addServer.server.framerate === "number" && data.settings.addServer.server.framerate >= 1 && data.settings.addServer.server.framerate <= 999 && data && data.settings.addServer.server.framerate % 1 === 0;
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
