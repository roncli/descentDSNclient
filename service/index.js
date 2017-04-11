var fs = require("fs"),
    path = require("path"),
    os = require("os"),
    crypto = require("crypto"),
    Server = require("./server"),
    Queue = require("./queue"),
    WebSocket = require("ws"),
    Launcher = require("descent3launcher"),
    mn3tools = require("descent3mn3tools"),
    dsndata = require("./dsndata"),

    writeSettingsQueue = new Queue(),

    writeSettings = () => {
        writeSettingsQueue.push(() => {
            return new Promise((resolve, reject) => {
                fs.writeFile("./settings.json", JSON.stringify(dsndata.settings), (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    },

    getConnectionAndGameTypes = (d3path) => {
        return new Promise((resolve, reject) => {
            var connectionTypes = [],
                gameTypes = [];

            fs.readdir(path.join(d3path, "online"), (err, connectionFiles) => {
                if (err) {
                    reject(err);
                    return;
                }

                connectionFiles.forEach((filename) => {
                    var match = /^(.*)\.d3c$/.safeexec(filename);

                    if (match) {
                        connectionTypes.push(match[1]);
                    }
                });

                fs.readdir(path.join(d3path, "netgames"), (err, gameTypeFiles) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    gameTypeFiles.forEach((filename) => {
                        var match = /^(.*)\.d3m$/.safeexec(filename);

                        if (match) {
                            gameTypes.push(match[1]);
                        }
                    });

                    resolve({
                        connectionTypes: connectionTypes,
                        gameTypes: gameTypes
                    });
                });
            });
        });
    },

    randomPassword = () => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(24, (err, buffer) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(buffer.toString("base64"));
            });
        });
    };

dsndata.wss = new WebSocket.Server({port: 20921});

dsndata.wss.broadcast = (message) => {
    message = JSON.stringify(message);

    dsndata.wss.clients.forEach((client) => {
        client.send(message);
    });
};

// Listen for new connections.
dsndata.wss.on("connection", (ws) => {
    var sendMissions = (missions) => {
        ws.send(JSON.stringify({
            message: "missions",
            missions: missions.map((mission) => {
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

    // Parse any messages.
    ws.on("message", (data) => {
        var message = JSON.parse(data),
            savedServer;

        switch (message.message) {
            case "initialize":
                // Read in settings JSON.
                fs.exists("./settings.json", (exists) => {
                    var interfaces = os.networkInterfaces();

                    // Get saved settings.
                    new Promise((resolve, reject) => {
                        if (exists) {
                            fs.readFile("./settings.json", (err, settingsJson) => {
                                if (err) {
                                    ws.send(JSON.stringify({
                                        message: "warning",
                                        text: "There was an error reading the settings.json file.",
                                        err: err
                                    }));
                                    dsndata.settings = {};
                                } else {
                                    dsndata.settings = JSON.parse(settingsJson);
                                }
                                resolve();
                            });
                        } else {
                            dsndata.settings = {};
                            resolve();
                        }
                    }).then(() => {
                        // Get default settings.
                        dsndata.settings.default = JSON.parse(JSON.stringify(Launcher.defaultOptions));
                        dsndata.settings.default.server.portValid = true;
                        dsndata.settings.default.server.gamespyportValid = true;
                        dsndata.settings.default.server.portsDiffer = true;
                        dsndata.settings.default.server.framerateValid = true;
                        dsndata.settings.default.server.addTrackerRegionValid = false;
                        dsndata.settings.default.server.addTrackerServerValid = false;
                        dsndata.settings.default.server.addTrackerPortValid = false;
                        dsndata.settings.default.game.networkModel = "cs";
                        dsndata.settings.default.game.maxPlayersValid = true;
                        dsndata.settings.default.game.ppsValid = true;
                        dsndata.settings.default.game.killGoalValid = true;
                        dsndata.settings.default.game.timeLimitValid = true;
                        dsndata.settings.default.game.respawnTimeValid = true;
                        dsndata.settings.default.game.audioTauntDelayValid = true;
                        dsndata.settings.default.allowed.shipsValid = true;
                        dsndata.settings.default.modifications = [];
                        dsndata.settings.addServer = JSON.parse(JSON.stringify(dsndata.settings.default));

                        // Get network interfaces.
                        dsndata.settings.interfaces = [];
                        Object.keys(interfaces).forEach((key) => {
                            interfaces[key].forEach((network) => {
                                if (network.family === "IPv4") {
                                    dsndata.settings.interfaces.push({
                                        name: key,
                                        ip: network.address
                                    });
                                }
                            });
                        });

                        // Get mods.
                        if (!dsndata.settings.modifications) {
                            dsndata.settings.modifications = [
                                {
                                    name: "autoShutdown",
                                    title: "Auto Shutdown",
                                    description: "Shutdown the server after a period of inactivity.",
                                    options: [
                                        {
                                            name: "inactivity",
                                            description: "Minutes of inactivity to shutdown server after:",
                                            default: 5,
                                            validations: [
                                                {
                                                    code:
"(param) => {\
return typeof param === \"number\" && param > 0 && param % 1 === 0;\
}",
                                                    message: "You must enter a positive integer."
                                                }
                                            ]
                                        }
                                    ],
                                    code:
"(server, options) => {\
var players = 0,\
serverTimeout = null,\
timeout = () => {\
    serverTimeout = setTimeout(() => {\
        server.quit();\
    }, options.inactivity * 60000);\
};\
\
server.on(\"joined\", () => {\
players++;\
clearTimeout(serverTimeout);\
});\
\
server.on(\"left\", () => {\
players--;\
if (players === 0) {\
    timeout();\
}\
});\
\
server.on(\"disconnected\", () => {\
players--;\
if (players === 0) {\
    timeout();\
}\
});\
\
timeout();\
}"
                                }
                            ];
                        }

                        new Promise((resolve, reject) => {
                            if (dsndata.settings.descent3 && dsndata.settings.descent3.pathValid) {
                                // Get connection types.
                                getConnectionAndGameTypes(dsndata.settings.descent3.path).then((types) => {
                                    dsndata.settings.connectionTypes = types.connectionTypes;
                                    dsndata.settings.gameTypes = types.gameTypes;
                                }).catch((err) => {
                                    ws.send(JSON.stringify({
                                        message: "warning",
                                        text: "There was an error initializing the connection and game types.",
                                        err: err
                                    }));
                                }).then(() => {
                                    resolve();
                                });
                            } else {
                                resolve();
                            }
                        }).then(() => {
                            ws.send(JSON.stringify({
                                message: "settings",
                                settings: dsndata.settings
                            }));
                        });
                    });
                });

                // Read in missions JSON.
                fs.exists("./missions.json", (exists) => {
                    if (exists) {
                        fs.readFile("./missions.json", (err, missions) => {
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
                    servers: dsndata.servers.data
                }));

                break;
            case "launchserver":
                randomPassword().then((password) => {
                    return Promise.resolve(password);
                }).catch((err) => {
                    ws.send(JSON.stringify({
                        message: "warning",
                        text: "There was a system error while generating the password to launch the server.",
                        err: err
                    }));
                }).then((password) => {
                    var launcher, serverData, server;

                    if (!password) {
                        return;
                    }

                    launcher = new Launcher();
                    launcher.options = message.settings;
                    launcher.options.game.allowRemoteConsole = true;
                    launcher.options.game.consolePassword = password;
                    launcher.options.game.remoteConsolePort = launcher.options.server.port;

                    if (launcher.options.saveServerName) {
                        if (dsndata.settings.savedServers) {
                            savedServer = dsndata.settings.savedServers.filter((server) => server.saveServerName === launcher.options.saveServerName);

                            if (savedServer.length > 0) {
                                dsndata.settings.savedServers.splice(dsndata.settings.savedServers.indexOf(savedServer), 1);
                            }
                        } else {
                            dsndata.settings.savedServers = [];
                        }

                        dsndata.settings.savedServers.push(JSON.parse(JSON.stringify(launcher.options)));

                        dsndata.settings.savedServers.sort((a, b) => a.saveServerName.localeCompare(b.saveServerName));

                        writeSettings();
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

                    dsndata.servers.data.push(serverData);

                    launcher.createServer((err) => {
                        var lastPlayerNum,

                            getElapsedTime = () => new Date().getTime() - serverData.startTime,

                            getPlayerNum = (player) => serverData.playerNames[player],

                            getTeamNum = (team) => serverData.settings.game.setTeamName.indexOf(team),

                            addEvent = (event) => {
                                event.time = getElapsedTime();
                                serverData.events.push(event);

                                dsndata.wss.broadcast({
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

                        server = new Server(launcher.options, dsndata.wss);

                        server.on("connected", () => {
                            serverData.loading = false;
                            serverData.startTime = new Date().getTime();
                        });

                        server.on("raw", (line) => {
                            serverData.console.push(line);
                        });

                        server.on("close", () => {
                            dsndata.servers.data.splice(dsndata.servers.data.indexOf(serverData), 1);
                            dsndata.servers.servers.splice(dsndata.servers.servers.indexOf(server), 1);
                            server = null;
                            serverData = null;
                        });

                        server.on("gameinfo", (info) => {
                            Object.keys(info).forEach((key) => {
                                switch (key) {
                                    case "timeLeft":
                                        serverData.timeLeft = new Date().getTime() + info[key] * 1000;
                                        dsndata.wss.broadcast({
                                            message: "server.timeleft",
                                            timeLeft: info[key],
                                            port: launcher.options.server.port
                                        });
                                        break;
                                }
                            });
                        });

                        server.on("kill", (killer, killed, weapon) => {
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

                        server.on("suicide", (player) => {
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

                        server.on("death", (player) => {
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

                        server.on("robotdeath", (player) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].deaths++;
                            }

                            addEvent({
                                event: "robotdeath",
                                player: player
                            });
                        });

                        server.on("monsterballpoint", (player, team) => {
                            addEvent({
                                event: "monsterballpoint",
                                player: player,
                                team: team
                            });
                        });

                        server.on("monsterballblunder", (player, team) => {
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

                        server.on("flagpickup", (player, team, flag) => {
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

                        server.on("flagreturn", (player, team) => {
                            addEvent({
                                event: "flagreturn",
                                player: player,
                                team: team
                            });
                        });

                        server.on("flagscore", (player, team, flag1, flag2, flag3) => {
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

                        server.on("entropybase", (player, team, base) => {
                            addEvent({
                                event: "entropybase",
                                player: player,
                                team: team,
                                base: base
                            });
                        });

                        server.on("hoardscore", (player, score) => {
                            addEvent({
                                event: "hoardscore",
                                player: player,
                                score: score
                            });
                        });

                        server.on("hyperorb", (player) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].hyperorb = true;
                            }

                            addEvent({
                                event: "hyperorb",
                                player: player
                            });
                        });

                        server.on("hyperorblost", (player) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].hyperorb = false;
                            }

                            addEvent({
                                event: "hyperorblost",
                                player: player
                            });
                        });

                        server.on("hyperorbscore", (player, points) => {
                            addEvent({
                                event: "hyperorbscore",
                                player: player,
                                points: points
                            });
                        });

                        server.on("joined", (player, team) => {
                            addEvent({
                                event: "joined",
                                player: player,
                                team: team
                            });
                        });

                        server.on("left", (player) => {
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

                        server.on("disconnected", (player) => {
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

                        server.on("observing", (player) => {
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

                        server.on("unobserving", (player) => {
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

                        server.on("teamchange", (player, team) => {
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

                        server.on("playerscore", (player, points, kills, deaths, suicides, ping) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].points = points;
                                serverData.players[playerNum].ping = ping;
                            }
                        });

                        server.on("teamscore", (teamName, score) => {
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

                        server.on("teamplayerscore", (player, teamName, points, kills, deaths, suicides, ping) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].teamName = teamName;
                                serverData.players[playerNum].points = points;
                                serverData.players[playerNum].ping = ping;
                            }
                        });

                        server.on("monsterballscore", (player, points, blunders, kills, deaths, suicides, ping) => {
                            var playerNum = getPlayerNum(player);

                            if (playerNum) {
                                serverData.players[playerNum].points = points;
                                serverData.players[playerNum].ping = ping;
                            }
                        });

                        server.on("player", (playerNum, name) => {
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

                        server.on("playerinfo", (info) => {
                            if (info.player) {
                                lastPlayerNum = getPlayerNum(info.player);
                            }

                            Object.keys(info).forEach((key) => {
                                switch (key) {
                                    case "team":
                                        serverData.players[lastPlayerNum].teamName = info[key];
                                        break;
                                    case "totalTimeInGame":
                                        serverData.players[lastPlayerNum].startTime = new Date().getTime() - info[key] * 1000;
                                        break;
                                    default:
                                        serverData.players[lastPlayerNum][key] = info[key];
                                        break;
                                }
                            });
                        });

                        server.on("endlevel", () => {
                            var playerTimes = [];

                            serverData.players.forEach((player) => {
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

                        server.on("startlevel", () => {
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

                        dsndata.servers.servers.push(server);
                    });
                });
                break;
            case "missions":
                if (dsndata.settings.descent3.pathValid) {
                    fs.readdir(path.join(dsndata.settings.descent3.path, "missions"), (err, files) => {
                        var index = 0,
                            hadError = false,
                            missions = [],
                            getMn3;

                        if (err) {
                            ws.send(JSON.stringify({
                                message: "warning",
                                text: "There was an error while reading your Descnet 3 directory.",
                                err: err
                            }));
                            return;
                        }

                        getMn3 = () => {
                            return new Promise((resolve, reject) => {
                                ws.send(JSON.stringify({
                                    message: "missions.progress",
                                    percent: 100 * index / files.length
                                }));

                                new Promise((resolve, reject) => {
                                    if (/\.mn3$/.test(files[index]) && !/_2\.mn3$/.test(files[index])) {
                                        mn3tools.parse(path.join(dsndata.settings.descent3.path, "missions", files[index]), (err, file) => {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    message: "warning",
                                                    text: "There was an error while reading " + files[index] + ".",
                                                    err: err
                                                }));
                                                resolve();
                                                return;
                                            }

                                            if (file.exists && file.levels && file.levels.length > 0) {
                                                file.shortFilename = files[index];
                                                missions.push(file);
                                            }
                                            resolve();
                                        });
                                    } else {
                                        resolve();
                                    }
                                }).then(() => {
                                    index++;
                                    if (index < files.length) {
                                        getMn3().then(resolve);
                                        return;
                                    }

                                    resolve();
                                });
                            });
                        };
                        
                        getMn3().then(() => {
                            missions.sort((a, b) => {
                                return a.name.localeCompare(b.name);
                            });

                            fs.writeFile("./missions.json", JSON.stringify(missions), () => {
                                sendMissions(missions);
                            });
                        });
                    });
                }

                break;
            case "settings.deletesavedserver":
                savedServer = dsndata.settings.savedServers.filter((server) => server.saveServerName === message.saveServerName);

                if (savedServer.length > 0) {
                    dsndata.settings.savedServers.splice(dsndata.settings.savedServers.indexOf(savedServer), 1);
                    writeSettings();
                }

                break;
            case "settings.descent3.path":
                if (!dsndata.settings.descent3) {
                    dsndata.settings.descent3 = {};
                }
                dsndata.settings.descent3.path = message.path;
                fs.exists(path.join(dsndata.settings.descent3.path, os.platform() === "win32" ? "main.exe" : "main"), (exists) => {
                    dsndata.settings.descent3.pathValid = exists;

                    new Promise((resolve, reject) => {
                        if (exists) {
                            // Get connection types.
                            getConnectionAndGameTypes(dsndata.settings.descent3.path).then((types) => {
                                dsndata.settings.connectionTypes = types.connectionTypes;
                                dsndata.settings.gameTypes = types.gameTypes;

                                ws.send(JSON.stringify({
                                    message: "settings",
                                    settings: {
                                        connectionTypes: connectionTypes,
                                        gameTypes: gameTypes
                                    }
                                }));
                            }).catch((err) => {
                                ws.send(JSON.stringify({
                                    message: "warning",
                                    text: "There was an error initializing the connection and game types.",
                                    err: err
                                }));
                            }).then(() => {
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    }).then(() => {
                        writeSettings();
                        ws.send(JSON.stringify({
                            message: "settings.descent3.pathValid",
                            valid: exists
                        }));
                    });
                });
                break;
        }
    });
});
