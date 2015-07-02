var cluster = require("cluster"),
    webserver = require("./webserver"),
    websocket = require("./websocket"),
    webServerWorker, webSocketWorker;

// A safe regexp exec method that does not leak memory.
RegExp.prototype.safeexec = function(string) {
    "use strict";

    var result = this.exec(string);

    if (result) {
        result.forEach(function(item, index) {
            result[index] = item.split("").join("");
        });
    }

    return result;
};

// Use clustering to spawn separate processes.
if (cluster.isMaster) {
    webServerWorker = cluster.fork({
        ddsnJob: "webserver"
    });
    webSocketWorker = cluster.fork({
        ddsnJob: "websocket"
    });

    cluster.on("disconnect", function(worker) {
        "use strict";

        if (worker.suicide) {
            // Worker was intentionally disconnected, end the application.
            if (webServerWorker.isConnected()) {
                webServerWorker.kill();
            }
            if (webSocketWorker.isConnected()) {
                webSocketWorker.kill();
            }
            process.exit();
        } else {
            // Worker was unintentionally disconnected, restart any disconnected workers.
            if (!webServerWorker.isConnected()) {
                webServerWorker = cluster.fork({
                    ddsnJob: "webserver"
                });
            }
            if (!webSocketWorker.isConnected()) {
                webSocketWorker = cluster.fork({
                    ddsnJob: "websocket"
                });
            }
        }
    });

    cluster.on("exit", function() {
        "use strict";

        if (!webServerWorker.isConnected()) {
            webServerWorker = cluster.fork({
                ddsnJob: "webserver"
            });
        }
        if (!webSocketWorker.isConnected()) {
            webSocketWorker = cluster.fork({
                ddsnJob: "websocket"
            });
        }
    });
} else {
    switch (process.env.ddsnJob) {
        case "webserver":
            webserver();
            break;
        case "websocket":
            websocket();
            break;
    }
}
