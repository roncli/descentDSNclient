/*jslint browser: true*/
/*global $, WebSocket, angular*/

var app = angular.module("ddsn", []),
    data = {
        serverTab: "news",
        serverMenuTab: "scoreboard",
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
        ],
        selectMissionToggle: true,
        servers: []
    },

    getServer = function(port, callback) {
        "use strict";

        var server = data.servers.filter(function(item) {
            return item.settings.server.port === port;
        });

        if (server) {
            callback(server[0]);
            return;
        }

        callback();
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

    app.directive("server", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server.htm"
        };
    });

    app.directive("serverScoreboard", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server-scoreboard.htm"
        };
    });

    app.directive("serverConsole", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server-console.htm"
        };
    });

    app.directive("serverLog", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server-log.htm"
        };
    });

    app.directive("serverModifications", function() {
        return {
            restrict: "E",
            templateUrl: "/templates/server-modifications.htm"
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

        $scope.openMenu = function(screen) {
            data.serverTab = screen;
        };

        $scope.openServer = function(port) {
            getServer(port, function(server) {
                var serverConsole;

                if (!server) {
                    return;
                }

                data.serverTab = "server";
                data.currentServer = server;

                scope.$evalAsync(function() {
                    setTimeout(function() {
                        serverConsole = $("#server-console");
                        if (serverConsole.length > 0) {
                            serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                        }
                    }, 0);
                });
            });
        };

        $scope.openServerMenu = function(screen) {
            var serverConsole;

            data.serverMenuTab = screen;

            if (screen === "console") {
                scope.$evalAsync(function() {
                    setTimeout(function() {
                        serverConsole = $("#server-console");
                        if (serverConsole.length > 0) {
                            serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                        }
                    }, 0);
                });
            }
        };

        $scope.openAddServer = function(screen) {
            data.addServerMenuTab = screen;
        };

        $scope.openSettings = function(screen) {
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

        $scope.missionSearch = function() {
            if (data.settings.addServer.game.missionSearch.length < 2) {
                return;
            }

            var searchStrings = data.settings.addServer.game.missionSearch.toLowerCase().replace(/[^a-zA-Z0-9'\-\.]+/, " ").trim().split(" ");

            data.missionsList = data.missions.filter(function(mission) {
                var index;

                if (
                    (data.settings.addServer.game.scriptName === 'ctf' && !mission.data.gameTypes.ctf) ||
                    (data.settings.addServer.game.scriptName === 'entropy' && !mission.data.gameTypes.entropy) ||
                    (data.settings.addServer.game.scriptName === 'hoard' && !mission.data.gameTypes.hoard) ||
                    (data.settings.addServer.game.scriptName === 'monsterball' && !mission.data.gameTypes.monsterball)
                ) {
                    return false;
                }

                for (index = 0; index < searchStrings.length; index++) {
                    if (mission.mission.indexOf(searchStrings[index]) === -1) {
                        return false;
                    }
                }
                return true;
            });

            data.selectMissionToggle = true;
        };

        $scope.refreshMissions = function() {
            data.loadingMissions = true;
            ws.send(JSON.stringify({
                message: "missions"
            }));
        };

        $scope.selectMission = function(mission) {
            data.settings.addServer.game.selectedMission = mission;
            data.settings.addServer.game.missionName = mission.shortFilename;
            data.selectMissionToggle = false;
            data.settings.addServer.game.setLevel = 1;
        };

        $scope.updateAddServerGameTeamName = function(teamNum) {
            if (data.settings.addServer.game.setTeamName[teamNum].length === 0) {
                switch (teamNum) {
                    case 0:
                        data.settings.addServer.game.setTeamName[0] = "Red";
                        break;
                    case 1:
                        data.settings.addServer.game.setTeamName[1] = "Blue";
                        break;
                    case 2:
                        data.settings.addServer.game.setTeamName[2] = "Green";
                        break;
                    case 3:
                        data.settings.addServer.game.setTeamName[3] = "Yellow";
                        break;
                }
            }
        };

        $scope.updateAddServerGameRespawnTime = function() {
            data.settings.addServer.game.respawnTimeValid = data.settings.addServer.game.respawnTime === null || (typeof data.settings.addServer.game.respawnTime === "number" && data.settings.addServer.game.respawnTime >= 1 && data.settings.addServer.game.respawnTime % 1 === 0);
        };

        $scope.updateAddServerGameAudioTauntDelay = function() {
            data.settings.addServer.game.audioTauntDelayValid = data.settings.addServer.game.audioTauntDelay === null || (typeof data.settings.addServer.game.audioTauntDelay === "number" && data.settings.addServer.game.audioTauntDelay >= 1 && data.settings.addServer.game.audioTauntDelay % 1 === 0);
        };

        $scope.updateAddServerAllowedShips = function() {
            data.settings.addServer.allowed.shipsValid = data.settings.addServer.allowed.ships.blackpyro || data.settings.addServer.allowed.ships.magnumaht || data.settings.addServer.allowed.ships.phoenix || data.settings.addServer.allowed.ships.pyrogl;
        };

        $scope.launchServer = function() {
            var server;

            data.settings.addServer.server.directory = data.settings.descent3.path;
            ws.send(JSON.stringify({
                message: "launchserver",
                settings: data.settings.addServer
            }));

            server = {
                settings: JSON.parse(JSON.stringify(data.settings.addServer)),
                console: [],
                events: [],
                players: [],
                teams: {},
                playerNames: {},
                loading: true,
                logs: []
            };

            data.servers.push(server);

            data.servers.sort(function(a, b) {
                return a.settings.server.port > b.settings.server.port ? 1 : -1;
            });

            data.currentServer = server;
            data.serverTab = "server";
            data.serverMenuTab = "scoreboard";
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

                    getPlayerNum = function(server, player) {
                        return server.playerNames[player];
                    };

                switch (message.message) {
                    case "initservers":
                        data.servers = message.servers;
                        scope.$apply();
                        break;
                    case "missions":
                        data.missions = message.missions;
                        data.loadingMissions = false;
                        scope.$apply();
                        break;
                    case "missions.progress":
                        data.loadingMissionPercent = message.percent;
                        scope.$apply();
                        break;
                    case "server.close":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            if (data.currentServer.settings.server.port === message.port) {
                                data.currentServer = null;
                                if (data.serverTab === "server") {
                                    data.serverTab = "dashboard";
                                }
                            }

                            data.servers.splice(data.servers.indexOf(server), 1);
                            server = null;

                            // TODO: Notification that the server was closed.

                            scope.$apply();
                        });
                        break;
                    case "server.connected":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            server.loading = false;
                            server.startTime = new Date().getTime();

                            scope.$apply();
                        });
                        break;
                    case "server.event":
                        getServer(message.port, function(server) {
                            var killerNum, killedNum, playerNum;

                            if (!server) {
                                return;
                            }

                            server.events.push(message.event);

                            switch (message.event.event) {
                                case "kill":
                                    killerNum = getPlayerNum(server, message.event.killer);
                                    killedNum = getPlayerNum(server, message.event.killed);

                                    if (killerNum) {
                                        server.players[killerNum].connected = true;
                                        if (!server.players[killerNum].opponents[message.event.killed]) {
                                            server.players[killerNum].opponents[message.event.killed] = {
                                                kills: 0,
                                                deaths: 0
                                            };
                                        }
                                        server.players[killerNum].opponents[message.event.killed].kills++;
                                    }

                                    if (killedNum) {
                                        server.players[killedNum].connected = true;
                                        if (!server.players[killedNum].opponents[message.event.killer]) {
                                            server.players[killedNum].opponents[message.event.killer] = {
                                                kills: 0,
                                                deaths: 0
                                            };
                                        }
                                        server.players[killedNum].opponents[message.event.killer].deaths++;
                                    }

                                    break;
                                case "suicide":
                                case "death":
                                case "flagscore":
                                    playerNum = getPlayerNum(server, message.event.player);

                                    if (playerNum) {
                                        server.players[playerNum].connected = true;
                                    }

                                    break;
                                case "left":
                                case "disconnected":
                                    playerNum = getPlayerNum(server, message.event.player);

                                    if (playerNum) {
                                        server.players[playerNum].connected = false;
                                        server.players[playerNum].timeInGame = message.event.connected;
                                    }

                                    break;
                                case "observing":
                                    playerNum = getPlayerNum(server, message.event.player);

                                    if (playerNum) {
                                        server.players[playerNum].connected = true;
                                        server.players[playerNum].observing = true;
                                    }

                                    break;
                                case "unobserving":
                                    playerNum = getPlayerNum(server, message.event.player);

                                    if (playerNum) {
                                        server.players[playerNum].connected = true;
                                        server.players[playerNum].observing = false;
                                    }

                                    break;
                                case "teamchange":
                                    playerNum = getPlayerNum(server, message.event.player);

                                    if (playerNum) {
                                        server.players[playerNum].connected = true;
                                        server.players[playerNum].teamName = message.event.team;
                                    }

                                    break;
                                case "endlevel":
                                    message.event.times.forEach(function(time, index) {
                                        server.players[index].timeInGame = time;
                                    });

                                    break;
                                case "startlevel":
                                    server.startTime = new Date().getTime();
                                    server.console = [];
                                    server.events = [];
                                    server.players = [];
                                    server.teams = {};
                                    server.playerNames = {};
                                    server.logs.push(message.event.log);
                                    break;
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.monsterballscore":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var playerNum = getPlayerNum(server, message.player);

                            if (playerNum) {
                                server.players[playerNum].points = message.points;
                                server.players[playerNum].blunders = message.blunders;
                                server.players[playerNum].kills = message.kills;
                                server.players[playerNum].deaths = message.deaths;
                                server.players[playerNum].suicides = message.suicides;
                                server.players[playerNum].ping = message.ping;
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.player":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var oldPlayerNum = getPlayerNum(server, message.name);

                            if (oldPlayerNum === message.playerNum) {
                                server.players[message.playerNum].connected = true;

                                return;
                            }

                            if (oldPlayerNum) {
                                server.players[message.playerNum] = server.players[oldPlayerNum];
                                server.players[oldPlayerNum] = null;
                            } else {
                                server.players[message.playerNum] = {
                                    name: message.name,
                                    connected: true,
                                    opponents: {}
                                };
                            }
                            server.playerNames[message.name] = message.playerNum;

                            scope.$apply();
                        });
                        break;
                    case "server.playerinfo":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var key;

                            if (message.info.player) {
                                server.lastPlayerNum = getPlayerNum(server, message.info.player);
                            }

                            for (key in message.info) {
                                if (message.info.hasOwnProperty(key)) {
                                    switch (key) {
                                        case "team":
                                            server.players[server.lastPlayerNum].teamName = message.info[key];
                                            break;
                                        case "totalTimeInGame":
                                            server.players[server.lastPlayerNum].startTime = new Date().getTime() - (message.info[key] * 1000);
                                            break;
                                        default:
                                            server.players[server.lastPlayerNum][key] = message.info[key];
                                            break;
                                    }
                                }
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.playerscore":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var playerNum = getPlayerNum(server, message.player);

                            if (playerNum) {
                                server.players[playerNum].points = message.points;
                                server.players[playerNum].kills = message.kills;
                                server.players[playerNum].deaths = message.deaths;
                                server.players[playerNum].suicides = message.suicides;
                                server.players[playerNum].ping = message.ping;
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.playertotalscore":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var playerNum = getPlayerNum(server, message.player);

                            if (playerNum) {
                                server.players[playerNum].points = server.points;
                                server.players[playerNum].totalPoints = server.totalPoints;
                                server.players[playerNum].kills = server.kills;
                                server.players[playerNum].totalKills = server.totalKills;
                                server.players[playerNum].deaths = server.deaths;
                                server.players[playerNum].totalDeaths = server.totalDeaths;
                                server.players[playerNum].suicides = server.suicides;
                                server.players[playerNum].totalSuicides = server.totalSuicides;
                                server.players[playerNum].ping = server.ping;
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.raw":
                        getServer(message.port, function(server) {
                            var serverConsole,
                                scroll;

                            if (!server) {
                                return;
                            }

                            serverConsole = $("#server-console");

                            server.console.push(message.data);

                            scroll = serverConsole.length > 0 && serverConsole[0].scrollTop + serverConsole.innerHeight() === serverConsole[0].scrollHeight;

                            scope.$apply();

                            scope.$evalAsync(
                                function() {
                                    if (scroll) {
                                        setTimeout(function() {
                                            serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                                        }, 0);
                                    }
                                }
                            );
                        });
                        break;
                    case "server.teamplayerscore":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            var playerNum = getPlayerNum(server, message.player);

                            if (playerNum) {
                                server.players[playerNum].teamName = message.teamName;
                                server.players[playerNum].points = message.points;
                                server.players[playerNum].kills = message.kills;
                                server.players[playerNum].deaths = message.deaths;
                                server.players[playerNum].suicides = message.suicides;
                                server.players[playerNum].ping = message.ping;
                            }

                            scope.$apply();
                        });
                        break;
                    case "server.teamscore":
                        getServer(message.port, function(server) {
                            if (!server) {
                                return;
                            }

                            server.teams[message.teamName] = message.score;

                            scope.$apply();
                        });
                        break;
                    case "settings":
                        (function() {
                            var key;

                            for (key in message.settings) {
                                if (message.settings.hasOwnProperty(key)) {
                                    data.settings[key] = message.settings[key];
                                }
                            }
                            scope.$apply();
                        }());
                        break;
                    case "settings.descent3.pathValid":
                        data.settings.descent3.pathValid = message.valid;
                        scope.$apply();
                        break;
                    case "warning":
                        console.log(message);

                        // TODO: Notification of the warning

                        break;
                }
            };
        };

        scope = angular.element("html").scope();
        createWebsocketClient();
    });
}());
