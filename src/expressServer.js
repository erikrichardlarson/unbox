const express = require("express");
const path = require("path");
const { app } = require('electron');
const isDevelopment = process.env.NODE_ENV === 'development';

let publicPath;
if (isDevelopment) {
    publicPath = path.resolve(__dirname, "..", "public");
} else {
    publicPath = app.getPath('userData');
}

let serverInstance = null;

function startExpressServer() {
    const server = express();
    const port = 8001;

    server.use(express.static(publicPath, {
        maxAge: 0,
        etag: false
    }));

    server.use(function (req, res, next) {
        res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
        res.header("Expires", "-1");
        res.header("Pragma", "no-cache");
        next();
    });

    serverInstance = server.listen(port, () => {
    });

    return server;
}

function closeExpressServer() {
    if (serverInstance) {
        serverInstance.close();
    }
}

module.exports = {
    startExpressServer,
    closeExpressServer,
};
