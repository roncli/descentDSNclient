var express = require("express"),
    app = express(),
    WebSocket = require("ws"),
    wss = new WebSocket.Server({port: 20921});

// Setup web server.
app.use(function(req, res, next) {
    "use strict";

    if (req.headers.host === "localhost:20920") {
        next();
    } else {
        res.status(404).send("Not found");
    }
});

app.use(express.static("public"));

app.listen(20920);

// Setup web sockets.
wss.on("connection", function(ws) {
    "use strict";

    ws.on("message", function(ev) {
        // TODO: Handle message.
    });

    ws.on("error", function(ev) {
        // TODO: Handle error.
    });
});
