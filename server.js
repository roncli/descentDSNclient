var Console = require("descent3console");

function getConsole(server, port, password) {
    "use strict";

    var console = new Console();

    console.options.server = server;
    console.options.port = port;
    console.options.password = password;
    return console;
}

function Server(settings, wss) {
    "use strict";

    this.settings = settings;
    this.wss = wss;

    this.startTime = new Date().getTime();

    this.connect();

    return this;
}

Server.prototype.connect = function() {
    "use strict";

    var server = this;

    this.console = getConsole(this.settings.server.ip || "localhost", this.settings.game.remoteConsolePort, this.settings.game.consolePassword);

    this.console.on("connected", function() {
        server.init();
    });

    this.console.once("error", function(err) {
        server.console = undefined;

        if (new Date().getTime() > server.startTime + 60000) {
            server.wss.broadcast({
                message: "server.close",
                reason: "failed",
                port: server.console.port
            });
            return;
        }

        setTimeout(function() {
            server.connect();
        }, 1000);
    });

    this.console.connect();
};

Server.prototype.init = function() {
    "use strict";

    var server = this;

    this.console.removeAllListeners("error");

    this.wss.broadcast({
        message: "server.connected",
        port: server.settings.server.port
    });

    this.console.on("raw", function(line) {
        server.wss.broadcast({
            message: "server.raw",
            port: server.settings.server.port,
            data: line
        });
    });

    this.console.on("close", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "close",
            port: server.settings.server.port
        });
    });

    this.console.on("end", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "end",
            port: server.settings.server.port
        });
    });

    this.console.on("timeout", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "timeout",
            port: server.settings.server.port
        });
    });
};

module.exports = Server;
