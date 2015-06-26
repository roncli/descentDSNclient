var cluster = require("cluster"),
    domain = require("domain"),
    express = require("express");

module.exports = function() {
    "use strict";

    var d = domain.create(),
        server;

    // Run the web server in a domain.
    d.run(function() {
        var app = express();

        // Only allow connections on the localhost.
        app.use(function(req, res, next) {
            if (req.headers.host === "localhost:20920") {
                next();
            } else {
                res.status(404).send("Not found");
            }
        });

        // Allow for static content in the public directory.
        app.use(express.static("public"));

        // Force quit Descent DSN entirely.
        app.get("/quit", function(req, res) {
            res.status(200).send("Descent DSN has been force quit.  You should close all other running Descent 3 servers manually.");
            server.close();
            cluster.worker.kill();
        });

        // Create the server.
        server = app.listen(20920);
    });

    // Log any errors and restart the worker.
    d.on("error", function(err) {
        console.log("An error occurred:", err);

        if (server) {
            server.close();
        }
        cluster.worker.disconnect();
        process.exit();
    });
};
