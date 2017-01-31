var app = angular.module("ddsn", []),

    directives = [
        {name: "offline", templateUrl: "/templates/offline.htm"},
        {name: "error", templateUrl: "/templates/error.htm"},
        {name: "serverTabs", templateUrl: "/templates/server-tabs.htm"},
        {name: "content", templateUrl: "/templates/content.htm"},
        {name: "news", templateUrl: "/templates/news.htm"},
        {name: "dashboard", templateUrl: "/templates/dashboard.htm"},
        {name: "dashboardCurrent", templateUrl: "/templates/dashboard/current.htm"},
        {name: "dashboardPast", templateUrl: "/templates/dashboard/past.htm"},
        {name: "server", templateUrl: "/templates/server.htm"},
        {name: "serverScoreboard", templateUrl: "/templates/server/scoreboard.htm"},
        {name: "serverConsole", templateUrl: "/templates/server/console.htm"},
        {name: "serverLog", templateUrl: "/templates/server/log.htm"},
        {name: "serverModifications", templateUrl: "/templates/server/modifications.htm"},
        {name: "addServer", templateUrl: "/templates/add-server.htm"},
        {name: "addServerSaved", templateUrl: "/templates/add-server/saved.htm"},
        {name: "addServerServer", templateUrl: "/templates/add-server/server.htm"},
        {name: "addServerGame", templateUrl: "/templates/add-server/game.htm"},
        {name: "addServerAllowed", templateUrl: "/templates/add-server/allowed.htm"},
        {name: "addServerModifications", templateUrl: "/templates/add-server/modifications.htm"},
        {name: "addServerModification", templateUrl: "/templates/add-server/modification.htm"},
        {name: "addServerLaunch", templateUrl: "/templates/add-server/launch.htm"},
        {name: "settings", templateUrl: "/templates/settings.htm"},
        {name: "settingsDescent3", templateUrl: "/templates/settings/descent3.htm"},
        {name: "settingsModifications", templateUrl: "/templates/settings/modifications.htm"},
    ],

    data = {
        serverTab: "news",
        dashboardMenuTab: "current",
        serverMenuTab: "scoreboard",
        addServerMenuTab: "saved",
        settingsMenuTab: "descent3",
        settings: {
            descent3: {
                pathValid: false
            },
            savedServers: []
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

    getServer = (port, callback) => data.servers.filter((item) => item.settings.server.port === port)[0],
    checkPort = (server) => server.settings.server.port === data.settings.addServer.server.port || server.settings.server.gamespyport === data.settings.addServer.server.port,
    checkGameSpyPort = (server) => server.settings.server.gamespyport === data.settings.addServer.server.gamespyport || server.settings.server.port === data.settings.addServer.server.gamespyport,
    getPlayerNum = (server, player) => server.playerNames[player],
    getTeamNum = (server, team) => server.settings.game.setTeamName.indexOf(team);

(() => {
    "use strict";

    var ws, scope;

    app.directive("chrono", ["$interval", ($interval) => {
        return {
            restrict: "E",
            scope: {
                direction: "@",
                time: "@"
            },
            link: (scope, element) => {
                var seconds, minutes, hours, timer,

                    tick = () => {
                        if (scope.direction === "down") {
                            seconds = Math.floor((scope.time - new Date().getTime()) / 1000);
                        } else {
                            seconds = Math.floor((new Date().getTime() - scope.time) / 1000);
                        }

                        if (seconds < 0) {
                            seconds = 0;
                        }

                        minutes = Math.floor(seconds / 60);
                        seconds = seconds % 60;

                        if (minutes < 60) {
                            scope.display = minutes.toString() + ":" + (seconds < 10 ? "0" : "") + seconds;
                            return;
                        }

                        hours = Math.floor(minutes / 60);
                        minutes = minutes % 60;

                        scope.display = hours.toString() + ":" + (minutes < 10 ? "0" : "") + minutes.toString() + ":" + (seconds < 10 ? "0" : "") + seconds;
                    };

                timer = $interval(tick, 1000);

                tick();

                element.on("$destroy", () => {
                    $interval.cancel(timer);
                    timer = null;
                });
            },
            template: "{{display}}"
        };
    }]);

    directives.forEach((directive) => {
        app.directive(directive.name, () => {
            return {
                restrict: "E",
                templateUrl: directive.templateUrl
            }
        });
    });

    app.controller("ddsn", ["$scope", ($scope) => {
        $scope.data = data;

        $scope.Math = Math;

        $scope.titleCase = (text) => {
            return text.replace(/\w[\S\-]*/g, (match) => {
                return match.charAt(0).toUpperCase() + match.substr(1).toLowerCase();
            });
        };

        $scope.getRegionName = (regionId) => {
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

        $scope.getTimestamp = (time) => {
            var seconds = +(time / 1000).toFixed(2),
                minutes, hours;

            if (seconds <= 59.99) {
                return seconds.toFixed(2);
            }

            minutes = Math.floor(seconds / 60);
            seconds = seconds % 60;

            if (minutes < 60) {
                return minutes.toString() + ":" + (seconds <= 9.99 ? "0" : "") + seconds.toFixed(2);
            }

            hours = Math.floor(minutes / 60);
            minutes = minutes % 60;

            return hours.toString() + ":" + (minutes < 10 ? "0" : "") + minutes.toString() + ":" + (seconds <= 9.99 ? "0" : "") + seconds.toFixed(2);
        };

        $scope.addServerServerRemoveTracker = (index) => {
            data.settings.addServer.server.trackers.splice(index, 1);
        };

        $scope.addServerServerAddTracker = () => {
            data.settings.addServer.server.trackers.push({
                region: data.settings.addServer.server.addTrackerRegion,
                server: data.settings.addServer.server.addTrackerServer,
                port: data.settings.addServer.server.addTrackerPort
            });
            data.settings.addServer.server.addTrackerServer = undefined;
            data.settings.addServer.server.addTrackerPort = undefined;
        };

        $scope.openMenu = (screen) => {
            data.serverTab = screen;
        };

        $scope.openServer = (port) => {
            var server = getServer(port),
                serverConsole;

            if (!server) {
                return;
            }

            data.serverTab = "server";
            data.currentServer = server;

            scope.$evalAsync(() => {
                setTimeout(() => {
                    serverConsole = $("#server-console");
                    if (serverConsole.length > 0) {
                        serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                    }
                }, 0);
            });
        };

        $scope.openServerMenu = (screen) => {
            var serverConsole;

            data.serverMenuTab = screen;

            if (screen === "console") {
                scope.$evalAsync(() => {
                    setTimeout(() => {
                        serverConsole = $("#server-console");
                        if (serverConsole.length > 0) {
                            serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                        }
                    }, 0);
                });
            }
        };

        $scope.openDashboard = (screen) => {
            data.dashboardMenuTab = screen;
        };

        $scope.openAddServer = (screen) => {
            data.addServerMenuTab = screen;
        };

        $scope.openSettings = (screen) => {
            data.settingsMenuTab = screen;
        };

        $scope.updateAddServerServerPort = () => {
            data.settings.addServer.server.portValid = typeof data.settings.addServer.server.port === "number" && data.settings.addServer.server.port >= 0 && data.settings.addServer.server.port <= 65535 && data.settings.addServer.server.port % 1 === 0;
            data.settings.addServer.server.portsDiffer = data.settings.addServer.server.port !== data.settings.addServer.server.gamespyport;
            data.settings.addServer.server.portInUse = data.servers.filter(checkPort).length > 0;
        };

        $scope.updateAddServerServerGamespyport = () => {
            data.settings.addServer.server.gamespyportValid = typeof data.settings.addServer.server.gamespyport === "number" && data.settings.addServer.server.gamespyport >= 0 && data.settings.addServer.server.gamespyport <= 65535 && data.settings.addServer.server.gamespyport % 1 === 0;
            data.settings.addServer.server.portsDiffer = data.settings.addServer.server.port !== data.settings.addServer.server.gamespyport;
            data.settings.addServer.server.gamespyportInUse = data.servers.filter(checkGameSpyPort).length > 0;
        };

        $scope.updateAddServerServerFramerate = () => {
            data.settings.addServer.server.framerateValid = typeof data.settings.addServer.server.framerate === "number" && data.settings.addServer.server.framerate >= 1 && data.settings.addServer.server.framerate <= 999 &&  data.settings.addServer.server.framerate % 1 === 0;
        };

        $scope.updateAddServerServerTrackerRegion = () => {
            data.settings.addServer.server.addTrackerRegionValid = typeof data.settings.addServer.server.addTrackerRegion === "number" && data.settings.addServer.server.addTrackerRegion >= 0 && data.settings.addServer.server.addTrackerRegion <= 12 && data.settings.addServer.server.addTrackerRegion % 1 === 0;
        };

        $scope.updateAddServerServerTrackerServer = () => {
            data.settings.addServer.server.addTrackerServerValid = typeof data.settings.addServer.server.addTrackerServer === "string" && data.settings.addServer.server.addTrackerServer.length !== 0;
        };

        $scope.updateAddServerServerTrackerPort = () => {
            data.settings.addServer.server.addTrackerPortValid = typeof data.settings.addServer.server.addTrackerPort === "number" && data.settings.addServer.server.addTrackerPort >= 1 && data.settings.addServer.server.addTrackerPort <= 65535 && data.settings.addServer.server.addTrackerPort % 1 === 0;
        };

        $scope.updateAddServerGameNetworkModel = () => {
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

        $scope.updateAddServerGameMaxPlayers = () => {
            data.settings.addServer.game.maxPlayersValid = typeof data.settings.addServer.game.maxPlayers === "number" && data.settings.addServer.game.maxPlayers >= 1 && data.settings.addServer.game.maxPlayers <= 31 && data.settings.addServer.game.maxPlayers % 1 === 0;
        };

        $scope.updateAddServerGamePps = () => {
            data.settings.addServer.game.ppsValid = typeof data.settings.addServer.game.pps === "number" && data.settings.addServer.game.pps >= 1 && data.settings.addServer.game.pps <= 20 && data.settings.addServer.game.pps % 1 === 0;
        };

        $scope.updateAddServerGameKillGoal = () => {
            data.settings.addServer.game.killGoalValid = data.settings.addServer.game.killGoal === null || typeof data.settings.addServer.game.killGoal === "number" && data.settings.addServer.game.killGoal >= 1 && data.settings.addServer.game.killGoal % 1 === 0;
        };

        $scope.updateAddServerGameTimeLimit = () => {
            data.settings.addServer.game.timeLimitValid = data.settings.addServer.game.timeLimit === null || typeof data.settings.addServer.game.timeLimit === "number" && data.settings.addServer.game.timeLimit >= 1 && data.settings.addServer.game.timeLimit % 1 === 0;
        };

        $scope.validModifications = () => {
            return data.settings.modifications.filter((mod) => {
                return mod.valid;
            });
        };

        $scope.missionSearch = () => {
            if (!data.settings.addServer.game.missionSearch || data.settings.addServer.game.missionSearch.length < 2) {
                return;
            }

            var searchStrings = data.settings.addServer.game.missionSearch.toLowerCase().replace(/[^a-zA-Z0-9'\-\.]+/, " ").trim().split(" ");

            data.missionsList = data.missions.filter((mission) => {
                var index;

                if (
                    data.settings.addServer.game.scriptName === 'ctf' && !mission.data.gameTypes.ctf ||
                    data.settings.addServer.game.scriptName === 'entropy' && !mission.data.gameTypes.entropy ||
                    data.settings.addServer.game.scriptName === 'hoard' && !mission.data.gameTypes.hoard ||
                    data.settings.addServer.game.scriptName === 'monsterball' && !mission.data.gameTypes.monsterball
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

        $scope.refreshMissions = () => {
            data.loadingMissions = true;
            ws.send(JSON.stringify({
                message: "missions"
            }));
        };

        $scope.selectMission = (mission) => {
            data.settings.addServer.game.selectedMission = mission;
            data.settings.addServer.game.missionName = mission.shortFilename;
            data.selectMissionToggle = false;
            data.settings.addServer.game.setLevel = 1;
        };

        $scope.updateAddServerGameTeamName = (teamNum) => {
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

        $scope.updateAddServerGameRespawnTime = () => {
            data.settings.addServer.game.respawnTimeValid = data.settings.addServer.game.respawnTime === null || typeof data.settings.addServer.game.respawnTime === "number" && data.settings.addServer.game.respawnTime >= 1 && data.settings.addServer.game.respawnTime % 1 === 0;
        };

        $scope.updateAddServerGameAudioTauntDelay = () => {
            data.settings.addServer.game.audioTauntDelayValid = data.settings.addServer.game.audioTauntDelay === null || typeof data.settings.addServer.game.audioTauntDelay === "number" && data.settings.addServer.game.audioTauntDelay >= 1 && data.settings.addServer.game.audioTauntDelay % 1 === 0;
        };

        $scope.updateAddServerAllowedShips = () => {
            data.settings.addServer.allowed.shipsValid = data.settings.addServer.allowed.ships.blackpyro || data.settings.addServer.allowed.ships.magnumaht || data.settings.addServer.allowed.ships.phoenix || data.settings.addServer.allowed.ships.pyrogl;
        };

        $scope.deleteSavedServer = (server) => {
            data.settings.savedServers.splice(data.settings.savedServers.indexOf(server), 1);

            ws.send(JSON.stringify({
                message: "settings.deletesavedserver",
                saveServerName: server.saveServerName
            }));
        };

        $scope.quickLaunchServer = (server) => {
            data.settings.addServer = JSON.parse(JSON.stringify(server));

            data.settings.addServer.server.port = 2092;
            data.settings.addServer.server.gamespyport = 20143;

            while (data.servers.filter(checkPort).length > 0) {
                data.settings.addServer.server.port++;
            }

            while (data.servers.filter(checkGameSpyPort).length > 0) {
                data.settings.addServer.server.gamespyport++;
            }

            data.settings.addServer.saveServerName = undefined;

            $scope.launchServer();
        };

        $scope.loadSavedServer = (server) => {
            data.settings.addServer = JSON.parse(JSON.stringify(server));

            data.settings.addServer.server.port = 2092;
            data.settings.addServer.server.gamespyport = 20143;

            while (data.servers.filter(checkPort).length > 0) {
                data.settings.addServer.server.port++;
            }

            while (data.servers.filter(checkGameSpyPort).length > 0) {
                data.settings.addServer.server.gamespyport++;
            }

            data.settings.addServer.saveServerName = undefined;

            $scope.openAddServer("server");
        };

        $scope.launchServer = () => {
            var server, savedServer;

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
                teams: [],
                playerNames: {},
                loading: true,
                logs: []
            };

            data.servers.push(server);

            data.servers.sort((a, b) => {
                return a.settings.server.port > b.settings.server.port ? 1 : -1;
            });

            data.currentServer = server;
            data.serverTab = "server";
            data.serverMenuTab = "scoreboard";
            data.addServerMenuTab = "saved";

            if (data.settings.addServer.saveServerName) {
                savedServer = data.settings.savedServers.filter((server) => {
                    return server.saveServerName === data.settings.addServer.saveServerName;
                });

                if (savedServer.length > 0) {
                    data.settings.savedServers.splice(data.settings.savedServers.indexOf(savedServer), 1);
                }

                data.settings.savedServers.push(JSON.parse(JSON.stringify(data.settings.addServer)));

                data.settings.savedServers.sort((a, b) => {
                    return a.saveServerName.localeCompare(b.saveServerName);
                });
            }

            data.settings.addServer = JSON.parse(JSON.stringify(data.settings.default));

            while (data.servers.filter(checkPort).length > 0) {
                data.settings.addServer.server.port++;
            }

            while (data.servers.filter(checkGameSpyPort).length > 0) {
                data.settings.addServer.server.gamespyport++;
            }
        };

        $scope.updateSettingsDescent3Path = () => {
            ws.send(JSON.stringify({
                message: "settings.descent3.path",
                path: data.settings.descent3.path
            }));
        };
    }]);

    $(document).ready(() => {
        var createWebsocketClient = () => {
            var connected = false;
            ws = new WebSocket("ws://localhost:20921");

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    message: "initialize"
                }));
                connected = true;
            };

            ws.onclose = () => {
                if (connected) {
                    // If the server shut down, attempt to reconnect once.
                    setTimeout(createWebsocketClient, 1000);
                } else {
                    data.offline = true;
                    scope.$apply();
                }
            };

            ws.onmessage = (ev) => {
                var message = JSON.parse(ev.data),

                    server, killerNum, killedNum, playerNum, oldPlayerNum, key, serverConsole, scroll, teamNum;

                switch (message.message) {
                    case "initservers":
                        data.servers = message.servers;

                        if (data.settings.addServer) {
                            while (data.servers.filter(checkPort).length > 0) {
                                data.settings.addServer.server.port++;
                            }

                            while (data.servers.filter(checkGameSpyPort).length > 0) {
                                data.settings.addServer.server.gamespyport++;
                            }
                        }

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
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        if (data.currentServer && data.currentServer.settings.server.port === message.port) {
                            data.currentServer = null;
                            if (data.serverTab === "server") {
                                data.serverTab = "dashboard";
                            }
                        }

                        data.servers.splice(data.servers.indexOf(server), 1);
                        server = null;

                        scope.updateAddServerServerPort();
                        scope.updateAddServerServerGamespyport();

                        // TODO: Notification that the server was closed.

                        scope.$apply();
                        break;
                    case "server.connected":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        server.loading = false;
                        server.startTime = new Date().getTime();

                        scope.$apply();
                        break;
                    case "server.event":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

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
                                    server.players[killerNum].kills++;
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
                                    server.players[killedNum].deaths++;
                                    server.players[killedNum].flags = [];
                                }

                                break;
                            case "suicide":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].connected = true;
                                    server.players[playerNum].suicides++;
                                    server.players[playerNum].flags = [];
                                }

                                break;
                            case "death":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].connected = true;
                                    server.players[playerNum].deaths++;
                                    server.players[playerNum].flags = [];
                                }

                                break;
                            case "robotdeath":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].deaths++;
                                }

                                break;
                            case "monsterballblunder":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].blunders++;
                                }

                                break;
                            case "flagpickup":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].flags.push(message.event.flag);
                                }

                                break;
                            case "flagscore":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].connected = true;
                                    server.players[playerNum].flags = [];
                                }

                                break;
                            case "hyperorb":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].hyperorb = true;
                                }

                                break;
                            case "hyperorblost":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].hyperorb = false;
                                }

                                break;
                            case "left":
                            case "disconnected":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].connected = false;
                                    server.players[playerNum].timeInGame = message.event.connected;
                                    server.players[playerNum].hyperorb = false;
                                    server.players[playerNum].flags = [];
                                }

                                break;
                            case "observing":
                                playerNum = getPlayerNum(server, message.event.player);

                                if (playerNum) {
                                    server.players[playerNum].connected = true;
                                    server.players[playerNum].observing = true;
                                    server.players[playerNum].hyperorb = false;
                                    server.players[playerNum].flags = [];
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
                                    server.players[playerNum].flags = [];
                                }

                                break;
                            case "endlevel":
                                message.event.times.forEach((time, index) => {
                                    server.players[index].timeInGame = time;
                                });

                                break;
                            case "startlevel":
                                server.startTime = new Date().getTime();
                                server.endTime = undefined;
                                server.console = [];
                                server.events = [];
                                server.players = [];
                                server.teams = [];
                                server.playerNames = {};
                                server.logs.push(message.event.log);
                                break;
                        }

                        server.events.push(message.event);

                        scope.$apply();
                        break;
                    case "server.monsterballscore":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        playerNum = getPlayerNum(server, message.player);

                        if (playerNum) {
                            server.players[playerNum].points = message.points;
                            server.players[playerNum].ping = message.ping;
                        }

                        scope.$apply();
                        break;
                    case "server.player":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        oldPlayerNum = getPlayerNum(server, message.name);

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
                                opponents: {},
                                flags: [],
                                kills: 0,
                                deaths: 0,
                                suicides: 0,
                                points: 0,
                                blunders: 0
                            };
                        }
                        server.playerNames[message.name] = message.playerNum;

                        scope.$apply();
                        break;
                    case "server.playerinfo":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

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
                                        server.players[server.lastPlayerNum].startTime = new Date().getTime() - message.info[key] * 1000;
                                        break;
                                    default:
                                        server.players[server.lastPlayerNum][key] = message.info[key];
                                        break;
                                }
                            }
                        }

                        scope.$apply();
                        break;
                    case "server.playerscore":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        playerNum = getPlayerNum(server, message.player);

                        if (playerNum) {
                            server.players[playerNum].points = message.points;
                            server.players[playerNum].ping = message.ping;
                        }

                        scope.$apply();
                        break;
                    case "server.raw":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        serverConsole = $("#server-console");

                        server.console.push(message.data);

                        scroll = serverConsole.length > 0 && serverConsole[0].scrollTop + serverConsole.innerHeight() === serverConsole[0].scrollHeight;

                        scope.$apply();

                        scope.$evalAsync(
                            () => {
                                if (scroll) {
                                    setTimeout(() => {
                                        serverConsole[0].scrollTop = serverConsole[0].scrollHeight;
                                    }, 0);
                                }
                            }
                        );
                        break;
                    case "server.teamplayerscore":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        playerNum = getPlayerNum(server, message.player);

                        if (playerNum) {
                            server.players[playerNum].teamName = message.teamName;
                            server.players[playerNum].points = message.points;
                            server.players[playerNum].ping = message.ping;
                        }

                        scope.$apply();
                        break;
                    case "server.teamscore":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        teamNum = getTeamNum(server, message.teamName);

                        if (teamNum || teamNum === 0) {
                            if (!server.teams[teamNum]) {
                                server.teams[teamNum] = {
                                    teamName: message.teamName
                                };
                            }
                            server.teams[teamNum].points = message.score;
                        }

                        scope.$apply();
                        break;
                    case "server.timeleft":
                        server = getServer(message.port);

                        if (!server) {
                            return;
                        }

                        server.endTime = new Date().getTime() + message.timeLeft * 1000;

                        scope.$apply();
                        break;
                    case "settings":
                        for (key in message.settings) {
                            if (message.settings.hasOwnProperty(key)) {
                                data.settings[key] = message.settings[key];
                            }
                        }

                        if (data.servers) {
                            while (data.servers.filter(checkPort).length > 0) {
                                data.settings.addServer.server.port++;
                            }

                            while (data.servers.filter(checkGameSpyPort).length > 0) {
                                data.settings.addServer.server.gamespyport++;
                            }
                        }

                        if (data.settings.modifications) {
                            data.settings.modifications.forEach((mod) => {
                                var fx;

                                try {
                                    fx = new Function("return " + mod.code);
                                    mod.codeValid = true;
                                    mod.valid = true;
                                } catch (ex) {
                                    mod.codeValid = false;
                                    mod.valid = false;
                                }

                                if (mod.options) {
                                    mod.options.forEach((option) => {
                                        if (option.validations) {
                                            option.validations.forEach((validation) => {
                                                var fx;
                                                try {
                                                    fx = new Function("return " + validation.code);
                                                    validation.fx = fx();
                                                    validation.valid = true;
                                                } catch (ex) {
                                                    validation.valid = false;
                                                    mod.valid = false;
                                                }
                                            });
                                        }
                                    });
                                }
                            });

                            if (scope.validModifications().length > 0) {
                                data.currentAddServerMod = scope.validModifications()[0];
                            }
                        }

                        scope.$apply();
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
})();
