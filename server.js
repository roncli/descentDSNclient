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

        server.emit("raw", line);
    });

    this.console.on("close", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "close",
            port: server.settings.server.port
        });

        server.console.removeAllListeners("close");
        server.console.close();
        server.emit("close");
    });

    this.console.on("end", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "end",
            port: server.settings.server.port
        });

        server.console.removeAllListeners("end");
        server.console.close();
        server.emit("close");
    });

    this.console.on("timeout", function() {
        server.wss.broadcast({
            message: "server.close",
            reason: "timeout",
            port: server.settings.server.port
        });

        server.console.removeAllListeners("timeout");
        server.console.close();
        server.emit("close");
    });

    this.console.on("error", function(err) {
        server.wss.broadcast({
            message: "server.close",
            reason: "error",
            err: err,
            port: server.settings.server.port
        });

        server.console.removeAllListeners("error");
        server.console.close();
        server.emit("close");
    });
};

module.exports = Server;
