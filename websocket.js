var cluster = require("cluster"),
    domain = require("domain"),
    WebSocket = require("ws");

module.exports = function() {
    "use strict";

    var d = domain.create(),
        wss;

    // Run the WebSocket server in a domain.
    d.run(function() {
        wss = new WebSocket.Server({port: 20921});

        // Listen for new connections.
        wss.on("connection", function(ws) {

            // Parse any messages.
            ws.on("message", function(data) {
                var message = JSON.parse(data);

                switch (message.message) {
                    case "initialize":
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
