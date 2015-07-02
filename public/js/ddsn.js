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
        },
        difficulties: [
            {difficulty: 0, name: "Trainee"},
            {difficulty: 1, name: "Rookie"},
            {difficulty: 2, name: "Hotshot"},
            {difficulty: 3, name: "Ace"},
            {difficulty: 4, name: "Insane"}
        ]
    };

(function() {
    "use strict";

    var ws, scope;

    app.directive("convertToNumber", function() {
        return {
            require: "ngModel",
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(val) {
                    return +val;
                });
                ngModel.$formatters.push(function(val) {
                    return val ? val.toString() : "";
                });
            }
        };
    });

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

        $scope.getRegionName = function(regionId) {
            switch (regionId) {
                case 0:
                    return "None";
                case 1:
                    return "Southeast US";
                case 2:
                    return "Western US";
                case 3:
                    return "Midwest US";
                case 4:
                    return "Northwest US & Western Canada";
                case 5:
                    return "Northeast US & Eastern Canada";
                case 6:
                    return "United Kingdom";
                case 7:
                    return "Continental Europe";
                case 8:
                    return "Central Asia & Middle East";
                case 9:
                    return "Southeast Asia & Pacific";
                case 10:
                    return "Africa";
                case 11:
                    return "Australia & New Zealand";
                case 12:
                    return "Central America & South America";
                default:
                    return "Unknown";
            }
        };

        $scope.addServerServerRemoveTracker = function(index) {
            data.settings.addServer.server.trackers.splice(index, 1);
        };

        $scope.addServerServerAddTracker = function() {
            data.settings.addServer.server.trackers.push({
                region: data.settings.addServer.server.addTrackerRegion,
                server: data.settings.addServer.server.addTrackerServer,
                port: data.settings.addServer.server.addTrackerPort
            });
            data.settings.addServer.server.addTrackerServer = undefined;
            data.settings.addServer.server.addTrackerPort = undefined;
        };

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
            data.settings.addServer.server.framerateValid = typeof data.settings.addServer.server.framerate === "number" && data.settings.addServer.server.framerate >= 1 && data.settings.addServer.server.framerate <= 999 &&  data.settings.addServer.server.framerate % 1 === 0;
        };

        $scope.updateAddServerServerTrackerRegion = function() {
            data.settings.addServer.server.addTrackerRegionValid = typeof data.settings.addServer.server.addTrackerRegion === "number" && data.settings.addServer.server.addTrackerRegion >= 0 && data.settings.addServer.server.addTrackerRegion <= 12 && data.settings.addServer.server.addTrackerRegion % 1 === 0;
        };

        $scope.updateAddServerServerTrackerServer = function() {
            data.settings.addServer.server.addTrackerServerValid = typeof data.settings.addServer.server.addTrackerServer === "string" && data.settings.addServer.server.addTrackerServer.length !== 0;
        };

        $scope.updateAddServerServerTrackerPort = function() {
            data.settings.addServer.server.addTrackerPortValid = typeof data.settings.addServer.server.addTrackerPort === "number" && data.settings.addServer.server.addTrackerPort >= 1 && data.settings.addServer.server.addTrackerPort <= 65535 && data.settings.addServer.server.addTrackerPort % 1 === 0;
        };

        $scope.updateAddServerGameNetworkModel = function() {
            switch (data.settings.addServer.game.networkModel) {
                case "p2p":
                    data.settings.addServer.game.peer2peer = true;
                    data.settings.addServer.game.permissible = false;
                    break;
                case "pcs":
                    data.settings.addServer.game.peer2peer = false;
                    data.settings.addServer.game.permissible = true;
                    break;
                default:
                    data.settings.addServer.game.peer2peer = false;
                    data.settings.addServer.game.permissible = false;
                    break;
            }
        };

        $scope.updateAddServerGameMaxPlayers = function() {
            data.settings.addServer.game.maxPlayersValid = typeof data.settings.addServer.game.maxPlayers === "number" && data.settings.addServer.game.maxPlayers >= 1 && data.settings.addServer.game.maxPlayers <= 31 && data.settings.addServer.game.maxPlayers % 1 === 0;
        };

        $scope.updateAddServerGamePps = function() {
            data.settings.addServer.game.ppsValid = typeof data.settings.addServer.game.pps === "number" && data.settings.addServer.game.pps >= 1 && data.settings.addServer.game.pps <= 20 && data.settings.addServer.game.pps % 1 === 0;
        };

        $scope.updateAddServerGameKillGoal = function() {
            data.settings.addServer.game.killGoalValid = data.settings.addServer.game.killGoal === null || (typeof data.settings.addServer.game.killGoal === "number" && data.settings.addServer.game.killGoal >= 1 && data.settings.addServer.game.killGoal % 1 === 0);
        };

        $scope.updateAddServerGameTimeLimit = function() {
            data.settings.addServer.game.timeLimitValid = data.settings.addServer.game.timeLimit === null || (typeof data.settings.addServer.game.timeLimit === "number" && data.settings.addServer.game.timeLimit >= 1 && data.settings.addServer.game.timeLimit % 1 === 0);
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
                    case "missions":
                        // TODO: Handle missions
                        break;
                    case "missions.progress":
                        // TODO: Handle missinos progress
                        break;
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
                    case "warning":
                        // TODO: Handle warning
                        break;
                }
            };
        };

        scope = angular.element("html").scope();
        createWebsocketClient();
    });
}());
