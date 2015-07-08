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
                            var launcher, serverData, server;

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

                            serverData = {
                                settings: launcher.options,
                                console: [],
                                events: [],
                                players: [],
                                teams: {},
                                playerNames: {},
                                loading: true
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

                                    addEvent = function(event) {
                                        event.time = getElapsedTime();
                                        serverData.events.push(event);
                                        event.message = "server.event";
                                        event.port = launcher.options.server.port;
                                        wss.broadcast(event);
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
                                    servers.data.splice(servers.data.indexOf(data), 1);
                                    servers.servers.splice(servers.servers.indexOf(server), 1);
                                    server = null;
                                    data = null;
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
                                    }
                                });

                                server.on("suicide", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
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
                                    }

                                    addEvent({
                                        event: "death",
                                        player: player
                                    });
                                });

                                server.on("robotdeath", function(player) {
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
                                    addEvent({
                                        event: "monsterballblunder",
                                        player: player,
                                        team: team
                                    });
                                });

                                server.on("flagscore", function(player, team, flag1, flag2, flag3) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
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
                                    }

                                    addEvent({
                                        event: "left",
                                        player: player
                                    });
                                });

                                server.on("disconnected", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = false;
                                    }

                                    addEvent({
                                        event: "disconnected",
                                        player: player
                                    });
                                });

                                server.on("observing", function(player) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].connected = true;
                                        serverData.players[playerNum].observing = true;
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
                                        serverData.players[playerNum].kills = kills;
                                        serverData.players[playerNum].deaths = deaths;
                                        serverData.players[playerNum].suicides = suicides;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("teamscore", function(teamName, score) {
                                    serverData[teamName] = score;
                                });

                                server.on("teamplayerscore", function(player, teamName, points, kills, deaths, suicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].teamName = teamName;
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].kills = kills;
                                        serverData.players[playerNum].deaths = deaths;
                                        serverData.players[playerNum].suicides = suicides;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("playertotalscore", function(player, points, totalPoints, kills, totalKills, deaths, totalDeaths, suicides, totalSuicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].totalPoints = totalPoints;
                                        serverData.players[playerNum].kills = kills;
                                        serverData.players[playerNum].totalKills = totalKills;
                                        serverData.players[playerNum].deaths = deaths;
                                        serverData.players[playerNum].totalDeaths = totalDeaths;
                                        serverData.players[playerNum].suicides = suicides;
                                        serverData.players[playerNum].totalSuicides = totalSuicides;
                                        serverData.players[playerNum].ping = ping;
                                    }
                                });

                                server.on("monsterballscore", function(player, points, blunders, kills, deaths, suicides, ping) {
                                    var playerNum = getPlayerNum(player);

                                    if (playerNum) {
                                        serverData.players[playerNum].points = points;
                                        serverData.players[playerNum].blunders = blunders;
                                        serverData.players[playerNum].kills = kills;
                                        serverData.players[playerNum].deaths = deaths;
                                        serverData.players[playerNum].suicides = suicides;
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
                                            connected: true
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
                                    addEvent({
                                        event: "endlevel"
                                    });
                                });

                                server.on("startlevel", function() {
                                    // TODO: Save previous game to file.
                                    serverData.startTime = new Date().getTime();
                                    addEvent({
                                        event: "startlevel"
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
