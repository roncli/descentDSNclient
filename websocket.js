var cluster = require("cluster"),
    domain = require("domain"),
    WebSocket = require("ws"),
    fs = require("fs"),
    path = require("path"),
    os = require("os"),
    crypto = require("crypto"),
    Server = require("./server"),
    Launcher = require("descent3launcher"),
    mn3tools = require("descent3mn3tools");

module.exports = function() {
    "use strict";

    var d = domain.create(),
        wss;

    // Run the WebSocket server in a domain.
    d.run(function() {
        var settings = {},
            writingSettings = false,
            servers = {
                data: [],
                servers: []
            },
            writeSettingsCallback,

            titleCase = function(text) {
                return text.replace(/\w[\S\-]*/g, function(match) {
                    return match.charAt(0).toUpperCase() + match.substr(1).toLowerCase();
                });
            },

            writeSettings = function(settings, callback) {
                if (writingSettings) {
                    writeSettingsCallback = function() {
                        writeSettings(settings, callback);
                    };
                    return;
                }
                writingSettings = true;
                fs.writeFile("./settings.json", JSON.stringify(settings), function() {
                    if (typeof writeSettingsCallback === "function") {
                        writeSettingsCallback();
                    }
                    writingSettings = false;
                    writeSettingsCallback = undefined;
                    if (typeof callback === "function") {
                        callback();
                    }
                });
            },

            getConnectionAndGameTypes = function(d3path, callback) {
                var connectionTypes = [],
                    gameTypes = [];

                fs.readdir(path.join(d3path, "online"), function(err, connectionFiles) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    connectionFiles.forEach(function(filename) {
                        var match = /^(.*)\.d3c$/.safeexec(filename);

                        if (match) {
                            connectionTypes.push({
                                name: match[1],
                                titleName: titleCase(match[1])
                            });
                        }
                    });

                    fs.readdir(path.join(d3path, "netgames"), function(err, gameTypeFiles) {
                        if (err) {
                            callback(err);
                            return;
                        }

                        gameTypeFiles.forEach(function(filename) {
                            var match = /^(.*)\.d3m$/.safeexec(filename);

                            if (match) {
                                gameTypes.push({
                                    name: match[1],
                                    titleName: titleCase(match[1])
                                });
                            }
                        });

                        callback(null, connectionTypes, gameTypes);
                    });
                });
            },

            randomPassword = function(callback) {
                crypto.randomBytes(24, function(err, buffer) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    callback(null, buffer.toString("base64"));
                });
            };

        wss = new WebSocket.Server({port: 20921});

        // Listen for new connections.
        wss.on("connection", function(ws) {
            var sendMissions = function(missions) {
                ws.send(JSON.stringify({
                    message: "missions",
                    missions: missions.map(function(mission) {
                        return {
                            name: mission.name,
                            filename: mission.filename,
                            mission: JSON.stringify(mission).toLowerCase(),
                            data: mission,
                            shortFilename: mission.shortFilename
                        };
                    })
                }));
            };

            wss.broadcast = function(message) {
                message = JSON.stringify(message);

                wss.clients.forEach(function(client) {
                    client.send(message);
                });
            };

            // Parse any messages.
            ws.on("message", function(data) {
                var message = JSON.parse(data);

                switch (message.message) {
                    case "initialize":
                        // Read in settings JSON.
                        fs.exists("./settings.json", function(exists) {
                            var interfaces = os.networkInterfaces();

                            // Get saved settings.
                            (function(callback) {
                                if (exists) {
                                    fs.readFile("./settings.json", function(err, settingsJson) {
                                        if (err) {
                                            ws.send(JSON.stringify({
                                                message: "warning",
                                                text: "There was an error reading the settings.json file.",
                                                err: err
                                            }));
                                            settings = {};
                                        } else {
                                            settings = JSON.parse(settingsJson);
                                        }
                                        callback();
                                    });
                                } else {
                                    settings = {};
                                    callback();
                                }
                            }(function() {
                                var key,
                                    addInterface = function(network) {
                                        if (network.family === "IPv4") {
                                            settings.interfaces.push({
                                                name: key,
                                                ip: network.address
                                            });
                                        }
                                    };

                                // Get default settings.
                                settings.default = JSON.parse(JSON.stringify(Launcher.defaultOptions));
                                settings.default.server.portValid = true;
                                settings.default.server.gamespyportValid = true;
                                settings.default.server.portsDiffer = true;
                                settings.default.server.framerateValid = true;
                                settings.default.server.addTrackerRegionValid = false;
                                settings.default.server.addTrackerServerValid = false;
                                settings.default.server.addTrackerPortValid = false;
                                settings.default.game.networkModel = "cs";
                                settings.default.game.maxPlayersValid = true;
                                settings.default.game.ppsValid = true;
                                settings.default.game.killGoalValid = true;
                                settings.default.game.timeLimitValid = true;
                                settings.default.game.respawnTimeValid = true;
                                settings.default.game.audioTauntDelayValid = true;
                                settings.default.allowed.shipsValid = true;
                                settings.addServer = JSON.parse(JSON.stringify(settings.default));

                                // Get network interfaces.
                                settings.interfaces = [];
                                for (key in interfaces) {
                                    if (interfaces.hasOwnProperty(key)) {
                                        interfaces[key].forEach(addInterface);
                                    }
                                }

                                (function(callback) {
                                    if (settings.descent3 && settings.descent3.pathValid) {
                                        // Get connection types.
                                        getConnectionAndGameTypes(settings.descent3.path, function(err, connectionTypes, gameTypes) {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    message: "warning",
                                                    text: "There was an error initializing the connection and game types.",
                                                    err: err
                                                }));
                                            } else {
                                                settings.connectionTypes = connectionTypes;
                                                settings.gameTypes = gameTypes;
                                            }

                                            callback();
                                        });
                                    } else {
                                        callback();
                                    }
                                }(function() {
                                    ws.send(JSON.stringify({
                                        message: "settings",
                                        settings: settings
                                    }));
                                }));
                            }));
                        });

                        // Read in missions JSON.
                        fs.exists("./missions.json", function(exists) {
                            if (exists) {
                                fs.readFile("./missions.json", function(err, missions) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            message: "warning",
                                            text: "There was an error reading the missions.json file.  You will need to refresh your missions.",
                                            err: err
                                        }));
                                        return;
                                    }
                                    sendMissions(JSON.parse(missions));
                                });
                            }
                        });

                        // Return currently active servers.
                        ws.send(JSON.stringify({
                            message: "initservers",
                            servers: servers.data
                        }));

                        break;
                    case "launchserver":
                        randomPassword(function(err, password) {
                            var launcher, savedServer, serverData, server;

                            if (err) {
                                ws.send(JSON.stringify({
                                    message: "warning",
                                    text: "There was a system error while generating the password to launch the server.",
                                    err: err
                                }));
                                return;
                            }

                            launcher = new Launcher();
                            launcher.options = message.settings;
                            launcher.options.game.allowRemoteConsole = true;
                            launcher.options.game.consolePassword = password;
                            launcher.options.game.remoteConsolePort = launcher.options.server.port;

                            if (launcher.options.saveServerName) {
                                if (settings.savedServers) {
                                    savedServer = settings.savedServers.filter(function(server) {
                                        return server.saveServerName === launcher.options.saveServerName;
                                    });

                                    if (savedServer.length > 0) {
                                        settings.savedServers.splice(settings.savedServers.indexOf(savedServer), 1);
                                    }
                                } else {
                                    settings.savedServers = [];
                                }

                                settings.savedServers.push(JSON.parse(JSON.stringify(launcher.options)));

                                settings.savedServers.sort(function(a, b) {
                                    return a.saveServerName.localeCompare(b.saveServerName);
                                });

                                writeSettings(settings);
                            }

                            serverData = {
                                settings: launcher.options,
                                console: [],
                                events: [],
                                players: [],
                                teams: [],
                                playerNames: {},
                                loading: true,
                                logs: []
                            };

                            servers.data.push(serverData);

                            launcher.createServer(function(err) {
                                var lastPlayerNum,

                                    getElapsedTime = function() {
                                        return new Date().getTime() - serverData.startTime;
                                    },

                                    getPlayerNum = function(player) {
                                        return serverData.playerNames[player];
                                    },

                                    getTeamNum = function(team) {
                                        return serverData.settings.game.setTeamName.indexOf(team);
                                    },

                                    addEvent = function(event) {
                                        event.time = getElapsedTime();
                                        serverData.events.push(event);

                                        wss.broadcast({
                                            message: "server.event",
                                            event: event,
                                            port: launcher.options.server.port
                                        });
                                    };

                                if (err) {
                                    ws.send(JSON.stringify({
                                        message: "warning",
                                        text: "There was an error launching the server.",
                                        err: err
                                    }));
                                    return;
                                }

                                ws.send(JSON.stringify({
                                    message: "serverlaunched",
                                    port: message.settings.server.port
                                }));

                                server = new Server(launcher.options, wss);

                                server.on("connected", function() {
                                    serverData.loading = false;
                                    serverData.startTime = new Date().getTime();
                                });

                                server.on("raw", function(line) {
                                    serverData.console.push(line);
                                });

                                server.on("close", function() {
                                    servers.data.splice(servers.data.indexOf(serverData), 1);
                                    servers.servers.splice(servers.servers.indexOf(server), 1);
                                    server = null;
                                    serverData = null;
                                });

                                server.on("gameinfo", function(info) {
                                    var key;

                                    for (key in info) {
                                        if (info.hasOwnProperty(key)) {
                                            switch (key) {
                                                case "timeLeft":
                                                    serverData.timeLeft = new Date().getTime() + info[key] * 1000;
                                                    wss.broadcast({
                                                        message: "server.timeleft",
                                                        timeLeft: info[key],
                                                        port: launcher.options.server.port
                                                    });
                                                    break;
                                            }
                                        }
                                    }
                                });

                                server.on("kill", function(killer, killed, weapon) {
                                    var killerNum = getPlayerNum(killer),
                                        killedNum = getPlayerNum(killed);

                                    addEvent({
                                        event: "kill",
                                        killer: killer,
                                        killed: killed,
                                        weapon: weapon
                                    });

                                    if (killerNum) {
                                        serverData.players[killerNum].connected = true;
                                        if (!serverData.players[killerNum].opponents[killed]) {
                                            serverData.players[killerNum].opponents[killed] = {
                                                kills: 0,
                                                deaths: 0
                                            };
                                        }
                                        serverData.players[killerNum].opponents[killed].kills++;
                                        serverData.players[killerNum].kills++;
                                    }

                                    if (killedNum) {
                                        serverData.players[killedNum].connected = true;
                                        if (!serverData.players[killedNum].opponents[killer]) {
                                            serverData.players[killedNum].opponents[killer] = {
                                                kills: 0,
                                                deaths: 0
                                            };
                                        }
                                        serverData.players[killedNum].opponents[killer].deaths++;
                                        serverData.players[killedNum].deaths++;
                                        serverData.players[killedNum].flags = [];
                                    }
                                });

                                server.on("suicide", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].suicides++;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "suicide",
                                        player: player
                                    });
                                });

                                server.on("death", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].deaths++;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "death",
                                        player: player
                                    });
                                });

                                server.on("robotdeath", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].deaths++;
                                    }

                                    addEvent({
                                        event: "robotdeath",
                                        player: player
                                    });
                                });

                                server.on("monsterballpoint", function(player, team) {
                                    addEvent({
                                        event: "monsterballpoint",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("monsterballblunder", function(player, team) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].blunders++;
                                    }

                                    addEvent({
                                        event: "monsterballblunder",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("flagpickup", function(player, team, flag) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].flags.push(flag);
                                    }

                                    addEvent({
                                        event: "flagpickup",
                                        player: player,
                                        team: team,
                                        flag: flag
                                    });
                                });

                                server.on("flagreturn", function(player, team) {
                                    addEvent({
                                        event: "flagreturn",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("flagscore", function(player, team, flag1, flag2, flag3) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "flagscore",
                                        player: player,
                                        team: team,
                                        flag1: flag1,
                                        flag2: flag2,
                                        flag3: flag3
                                    });
                                });

                                server.on("entropybase", function(player, team, base) {
                                    addEvent({
                                        event: "entropybase",
                                        player: player,
                                        team: team,
                                        base: base
                                    });
                                });

                                server.on("hoardscore", function(player, score) {
                                    addEvent({
                                        event: "hoardscore",
                                        player: player,
                                        score: score
                                    });
                                });

                                server.on("hyperorb", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].hyperorb = true;
                                    }

                                    addEvent({
                                        event: "hyperorb",
                                        player: player
                                    });
                                });

                                server.on("hyperorblost", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].hyperorb = false;
                                    }

                                    addEvent({
                                        event: "hyperorblost",
                                        player: player
                                    });
                                });

                                server.on("hyperorbscore", function(player, points) {
                                    addEvent({
                                        event: "hyperorbscore",
                                        player: player,
                                        points: points
                                    });
                                });

                                server.on("joined", function(player, team) {
                                    addEvent({
                                        event: "joined",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("left", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = false;
                                        serverData.players[playerNum].timeInGame = Math.ceil((new Date().getTime() - serverData.startTime) / 1000);
                                        serverData.players[playerNum].hyperorb = false;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "left",
                                        player: player,
                                        connected: serverData.players[playerNum].timeInGame
                                    });
                                });

                                server.on("disconnected", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = false;
                                        serverData.players[playerNum].timeInGame = Math.ceil((new Date().getTime() - serverData.startTime) / 1000);
                                        serverData.players[playerNum].hyperorb = false;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "disconnected",
                                        player: player,
                                        connected: serverData.players[playerNum].timeInGame
                                    });
                                });

                                server.on("observing", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].observing = true;
                                        serverData.players[playerNum].hyperorb = false;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "observing",
                                        player: player
                                    });
                                });

                                server.on("unobserving", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].observing = false;
                                    }

                                    addEvent({
                                        event: "unobserving",
                                        player: player
                                    });
                                });

                                server.on("teamchange", function(player, team) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].teamName = team;
                                        serverData.players[playerNum].flags = [];
                                    }

                                    addEvent({
                                        event: "teamchange",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("playerscore", function(player, points, kills, deaths, suicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("teamscore", function(teamName, score) {
                                    var teamNum = getTeamNum(teamName);

                                    if (teamNum || teamNum === 0) {
                                        if (!serverData.teams[teamNum]) {
                                            serverData.teams[teamNum] = {
                                                teamName: teamName
                                            };
                                        }
                                        serverData.teams[teamNum].points = score;
                                    }
                                });

                                server.on("teamplayerscore", function(player, teamName, points, kills, deaths, suicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].teamName = teamName;
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("monsterballscore", function(player, points, blunders, kills, deaths, suicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("player", function(playerNum, name) {
                                    var oldPlayerNum = getPlayerNum(name);

                                    if (oldPlayerNum === playerNum) {
                                        serverData.players[playerNum].connected = true;

                                        return;
                                    }

                                    if (oldPlayerNum) {
                                        serverData.players[playerNum] = serverData.players[oldPlayerNum];
                                        serverData.players[oldPlayerNum] = null;
                                    } else {
                                        serverData.players[playerNum] = {
                                            name: name,
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
                                    serverData.playerNames[name] = playerNum;
                                });

                                server.on("playerinfo", function(info) {
                                    var key;

                                    if (info.player) {
                                        lastPlayerNum = getPlayerNum(info.player);
                                    }

                                    for (key in info) {
                                        if (info.hasOwnProperty(key)) {
                                            switch (key) {
                                                case "team":
                                                    serverData.players[lastPlayerNum].teamName = info[key];
                                                    break;
                                                case "totalTimeInGame":
                                                    serverData.players[lastPlayerNum].startTime = new Date().getTime() - (info[key] * 1000);
                                                    break;
                                                default:
                                                    serverData.players[lastPlayerNum][key] = info[key];
                                                    break;
                                            }
                                        }
                                    }
                                });

                                server.on("endlevel", function() {
                                    var playerTimes = [];

                                    serverData.players.forEach(function(player) {
                                        player.timeInGame = Math.ceil((new Date().getTime() - serverData.startTime) / 1000);
                                        if (player.playerNum || player.playerNum === 0) {
                                            playerTimes[player.playerNum] = player.timeInGame;
                                        }
                                    });

                                    addEvent({
                                        event: "endlevel",
                                        times: playerTimes
                                    });
                                });

                                server.on("startlevel", function() {
                                    var date = new Date(),
                                        filename = "./log." + serverData.settings.server.port.toString() + "." + date.getFullYear().toString() + "." + (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1).toString() + "." + (date.getDate() < 10 ? "0" : "") + date.getDate().toString() + "." + (date.getHours() < 10 ? "0" : "") + date.getHours().toString() + "." + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes().toString() + "." + (date.getSeconds() < 10 ? "0" : "") + date.getSeconds().toString() + ".json";

                                    fs.writeFile(filename, JSON.stringify(serverData));

                                    serverData.startTime = date.getTime();
                                    serverData.endTime = undefined;
                                    serverData.console = [];
                                    serverData.events = [];
                                    serverData.players = [];
                                    serverData.teams = [];
                                    serverData.playerNames = {};
                                    serverData.logs.push({
                                        date: date,
                                        filename: filename
                                    });
                                    addEvent({
                                        event: "startlevel",
                                        log: {
                                            date: date,
                                            filename: filename
                                        }
                                    });
                                });

                                servers.servers.push(server);
                            });
                        });
                        break;
                    case "missions":
                        if (settings.descent3.pathValid) {
                            fs.readdir(path.join(settings.descent3.path, "missions"), function(err, files) {
                                var index = 0,
                                    hadError = false,
                                    missions = [];

                                if (err) {
                                    ws.send(JSON.stringify({
                                        message: "warning",
                                        text: "There was an error while reading your Descnet 3 directory.",
                                        err: err
                                    }));
                                    return;
                                }

                                (function getMn3(callback) {
                                    ws.send(JSON.stringify({
                                        message: "missions.progress",
                                        percent: 100 * index / files.length
                                    }));
                                    if (/\.mn3$/.test(files[index]) && !/_2\.mn3$/.test(files[index])) {
                                        mn3tools.parse(path.join(settings.descent3.path, "missions", files[index]), function(err, file) {
                                            if (err) {
                                                if (hadError) {
                                                    hadError = true;
                                                    ws.send(JSON.stringify({
                                                        message: "warning",
                                                        text: "There was an error while reading " + files[index] + ".",
                                                        err: err
                                                    }));
                                                } else {
                                                    hadError = true;
                                                    ws.send(JSON.stringify({
                                                        message: "warning",
                                                        text: "There was an error while reading " + files[index] + ".",
                                                        err: err
                                                    }));
                                                    index++;
                                                    if (index < files.length) {
                                                        getMn3(callback);
                                                        return;
                                                    }
                                                }
                                            }

                                            if (file.exists && file.levels && file.levels.length > 0) {
                                                file.shortFilename = files[index];
                                                missions.push(file);
                                            }

                                            index++;
                                            if (index < files.length) {
                                                getMn3(callback);
                                                return;
                                            }

                                            callback();
                                        });
                                    } else {
                                        index++;
                                        if (index < files.length) {
                                            getMn3(callback);
                                            return;
                                        }

                                        callback();
                                    }
                                }(function() {
                                    missions.sort(function(a, b) {
                                        return a.name.localeCompare(b.name);
                                    });

                                    fs.writeFile("./missions.json", JSON.stringify(missions), function() {
                                        sendMissions(missions);
                                    });
                                }));
                            });
                        }

                        break;
                    case "settings.descent3.path":
                        if (!settings.descent3) {
                            settings.descent3 = {};
                        }
                        settings.descent3.path = message.path;
                        fs.exists(path.join(settings.descent3.path, os.platform() === "win32" ? "main.exe" : "main"), function(exists) {
                            settings.descent3.pathValid = exists;
                            (function(callback) {
                                if (exists) {
                                    // Get connection types.
                                    getConnectionAndGameTypes(settings.descent3.path, function(err, connectionTypes, gameTypes) {
                                        if (err) {
                                            ws.send(JSON.stringify({
                                                message: "warning",
                                                text: "There was an error initializing the connection and game types.",
                                                err: err
                                            }));
                                        } else {
                                            settings.connectionTypes = connectionTypes;
                                            settings.gameTypes = gameTypes;

                                            ws.send(JSON.stringify({
                                                message: "settings",
                                                settings: {
                                                    connectionTypes: connectionTypes,
                                                    gameTypes: gameTypes
                                                }
                                            }));
                                        }

                                        callback();
                                    });
                                } else {
                                    callback();
                                }
                            }(function() {
                                writeSettings(settings);
                                ws.send(JSON.stringify({
                                    message: "settings.descent3.pathValid",
                                    valid: exists
                                }));
                            }));
                        });
                        break;
                }
            });
        });
    });

    // Log any errors and restart the worker.
    d.on("error2", function(err) {
        console.log("An error occurred:", err);

        if (wss) {
            wss.close();
        }
        cluster.worker.disconnect();
        process.exit();
    });
};
