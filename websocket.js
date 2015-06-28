var cluster = require("cluster"),
    domain = require("domain"),
    WebSocket = require("ws"),
    fs = require("fs"),
    path = require("path"),
    os = require("os"),
    net = require("net"),
    Launcher = require("descent3launcher");

module.exports = function() {
    "use strict";

    var d = domain.create(),
        writingSettings = false,
        writeSettingsCallback,
        wss,

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
        };

    // Run the WebSocket server in a domain.
    d.run(function() {
        wss = new WebSocket.Server({port: 20921});

        // Listen for new connections.
        wss.on("connection", function(ws) {

            // Parse any messages.
            ws.on("message", function(data) {
                var message = JSON.parse(data),
                    settings = {};

                switch (message.message) {
                    case "initialize":
                        // Read in settings JSON.
                        fs.exists("./settings.json", function(exists) {
                            var interfaces = os.networkInterfaces(),
                                key,

                                addInterface = function(network) {
                                    if (network.family === "IPv4") {
                                        settings.interfaces.push({
                                            name: key,
                                            ip: network.address
                                        });
                                    }
                                };

                            // Get saved settings.
                            if (exists) {
                                settings = require("./settings.json");
                            } else {
                                settings = {};
                            }

                            // Get default settings.
                            settings.default = JSON.parse(JSON.stringify(Launcher.defaultOptions));
                            settings.default.server.portValid = true;
                            settings.default.server.gamespyportValid = true;
                            settings.default.server.portsDiffer = true;
                            settings.default.server.framerateValid = true;
                            settings.addServer = JSON.parse(JSON.stringify(settings.default));

                            // Get network interfaces.
                            settings.interfaces = [];
                            for (key in interfaces) {
                                if (interfaces.hasOwnProperty(key)) {
                                    interfaces[key].forEach(addInterface);
                                }
                            }

                            ws.send(JSON.stringify({
                                message: "settings",
                                settings: settings
                            }));
                        });
                        break;
                    case "settings.descent3.path":
                        if (!settings.descent3) {
                            settings.descent3 = {};
                        }
                        settings.descent3.path = message.path;
                        fs.exists(path.join(settings.descent3.path, os.platform() === "win32" ? "main.exe" : "main"), function(exists) {
                            settings.descent3.pathValid = exists;
                            writeSettings(settings);
                            ws.send(JSON.stringify({
                                message: "settings.descent3.pathValid",
                                valid: exists
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
