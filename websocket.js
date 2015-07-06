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
                            var launcher, data, server;

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

                            data = {
                                settings: launcher.options,
                                console: [],
                                loading: true
                            };

                            servers.data.push(data);

                            launcher.createServer(function(err) {
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
                                    data.loading = false;
                                });

                                server.on("raw", function(line) {
                                    data.console.push(line);
                                });

                                server.on("close", function() {
                                    servers.data.splice(servers.data.indexOf(data), 1);
                                    servers.servers.splice(servers.servers.indexOf(server), 1);
                                    server = null;
                                    data = null;
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
    d.on("error", function(err) {
        console.log("An error occurred:", err);

        if (wss) {
            wss.close();
        }
        cluster.worker.disconnect();
        process.exit();
    });
};
