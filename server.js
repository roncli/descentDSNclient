var events = require("events"),
    util = require("util"),
    Console = require("descent3console");

function getConsole(server, port, password) {
    "use strict";

    var d3console = new Console();

    d3console.options.server = server;
    d3console.options.port = port;
    d3console.options.password = password;
    return d3console;
}

function Server(settings, wss) {
    "use strict";

    events.EventEmitter.call(this);

    this.settings = settings;
    this.wss = wss;

    this.startTime = new Date().getTime();

    this.connect();

    return this;
}

util.inherits(Server, events.EventEmitter);

Server.prototype.connect = function() {
    "use strict";

    var server = this;

    this.console = getConsole(this.settings.server.ip || "localhost", this.settings.game.remoteConsolePort, this.settings.game.consolePassword);

    this.console.on("connected", function() {
        server.emit("connected");
        server.init();
    });

    this.console.once("error", function() {
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

    var server = this,

        closeServer = function(reason, err) {
            server.wss.broadcast({
                message: "server.close",
                reason: reason,
                err: err,
                port: server.settings.server.port
            });

            server.console.removeAllListeners("close");
            server.console.close();
            server.emit("close");
        };

    server.console.removeAllListeners("error");

    server.wss.broadcast({
        message: "server.connected",
        port: server.settings.server.port
    });

    this.console.on("raw", function(line) {
        server.wss.broadcast({
            message: "server.raw",
            port: server.settings.server.port,
            data: line
        });

        server.emit("raw", line);
    });

    this.console.on("close", function() {
        closeServer("close");
    });

    this.console.on("end", function() {
        closeServer("end");
    });

    this.console.on("timeout", function() {
        closeServer("timeout");
    });

    this.console.on("error", function(err) {
        closeServer("error", err);
    });

    this.console.once("loggedin", function() {
        server.console.netgameInfo();
        server.console.players();
    });
};

module.exports = Server;
