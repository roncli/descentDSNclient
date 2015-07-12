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
                port: server.settings.server.port
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

    this.console.on("gameinfo", function(info) {
        server.emit("gameinfo", info);
    });

    if (["anarchy", "co-op", "ctf", "entropy", "hoard", "hyper-anarchy", "monsterball", "robo-anarchy", "team anarchy"].indexOf(this.settings.game.scriptName.toLowerCase()) !== -1) {
        this.console.on("kill", function(killer, killed, weapon) {
            server.console.scores();
            server.emit("kill", killer, killed, weapon);
        });

        this.console.on("suicide", function(player) {
            server.console.scores();
            server.emit("suicide", player);
        });

        this.console.on("death", function(player) {
            server.console.scores();
            server.emit("death", player);
        });

        this.console.on("robotdeath", function(player) {
            server.console.scores();
            server.emit("robotdeath", player);
        });

        this.console.on("monsterballpoint", function(player, team) {
            server.console.scores();
            server.emit("monsterballpoint", player, team);
        });

        this.console.on("monsterballblunder", function(player, team) {
            server.console.scores();
            server.emit("monsterballblunder", player, team);
        });

        this.console.on("flagpickup", function(player, team, flag) {
            server.emit("flagpickup", player, team, flag);
        });

        this.console.on("flagreturn", function(player, team) {
            server.emit("flagreturn", player, team);
        });

        this.console.on("flagscore", function(player, team, flag1, flag2, flag3) {
            server.console.scores();
            server.emit("flagscore", player, team, flag1, flag2, flag3);
        });

        this.console.on("entropybase", function(player, team, room) {
            server.console.scores();
            server.emit("entropybase", player, team, room);
        });

        this.console.on("hoardscore", function(player, score) {
            server.console.scores();
            server.emit("hoardscore", player, score);
        });

        this.console.on("hyperorb", function(player) {
            server.emit("hyperorb", player);
        });

        this.console.on("hyperorblost", function(player) {
            server.emit("hyperorblost", player);
        });

        this.console.on("hyperorbscore", function(player, points) {
            server.emit("hyperorbscore", player, points);
        });

        this.console.on("joined", function(player, team) {
            server.console.players();
            server.emit("joined", player, team);
        });

        this.console.on("left", function(player) {
            server.emit("left", player);
        });

        this.console.on("disconnected", function(player) {
            server.emit("disconnected", player);
        });

        this.console.on("observing", function(player) {
            server.emit("observing", player);
        });

        this.console.on("unobserving", function(player) {
            server.emit("unobserving", player);
        });

        this.console.on("teamchange", function(player, team) {
            server.emit("teamchange", player, team);
        });

        this.console.on("playerscore", function(player, points, kills, deaths, suicides, ping) {
            server.emit("playerscore", player, points, kills, deaths, suicides, ping);
            server.wss.broadcast({
                message: "server.playerscore",
                port: server.settings.server.port,
                player: player,
                points: points,
                kills: kills,
                deaths: deaths,
                suicides: suicides,
                ping: ping
            });
        });

        this.console.on("teamscore", function(teamName, score) {
            server.emit("teamscore", teamName, score);
            server.wss.broadcast({
                message: "server.teamscore",
                port: server.settings.server.port,
                teamName: teamName,
                score: score
            });
        });

        this.console.on("teamplayerscore", function(player, teamName, points, kills, deaths, suicides, ping) {
            server.emit("teamplayerscore", player, teamName, points, kills, deaths, suicides, ping);
            server.wss.broadcast({
                message: "server.teamplayerscore",
                port: server.settings.server.port,
                player: player,
                teamName: teamName,
                points: points,
                kills: kills,
                deaths: deaths,
                suicides: suicides,
                ping: ping
            });
        });

        this.console.on("monsterballscore", function(player, points, blunders, kills, deaths, suicides, ping) {
            server.emit("monsterballscore", player, points, blunders, kills, deaths, suicides, ping);
            server.wss.broadcast({
                message: "server.monsterballscore",
                port: server.settings.server.port,
                player: player,
                points: points,
                blunders: blunders,
                kills: kills,
                deaths: deaths,
                suicides: suicides,
                ping: ping
            });
        });

        this.console.on("player", function(playerNum, name) {
            server.console.playerInfo(playerNum);
            server.emit("player", playerNum, name);
            server.wss.broadcast({
                message: "server.player",
                port: server.settings.server.port,
                playerNum: playerNum,
                name: name
            });
        });

        this.console.on("playerinfo", function(info) {
            server.emit("playerinfo", info);
            server.wss.broadcast({
                message: "server.playerinfo",
                port: server.settings.server.port,
                info: info
            });
        });

        this.console.on("endlevel", function() {
            server.emit("endlevel");
        });

        this.console.on("startlevel", function() {
            server.console.netgameInfo();
            server.emit("startlevel");
        });
    }
};

module.exports = Server;
