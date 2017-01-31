var express = require("express"),
    app = express(),
    server;

// Only allow connections on the localhost.
app.use(function(req, res, next) {
    if (req.headers.host === "localhost:20920") {
        next();
    } else {
        res.status(404).send("Not found");
    }
});

// Allow for static content in the public directory.
app.use(express.static("public", {index: "index.htm"}));

// Force quit Descent DSN entirely.
app.get("/quit", function(req, res) {
    res.status(200).send("Descent DSN has been force quit.  You should close all other running Descent 3 servers manually.");
    server.close();
});

// Create the server.
server = app.listen(20920);
console.log("Listening on port 20920.");
