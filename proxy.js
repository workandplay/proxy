"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var http_1 = __importDefault(require("http"));
var https_1 = __importDefault(require("https"));
var http_proxy_1 = __importDefault(require("http-proxy"));
var discovery_1 = require("./discovery");
var HTTPS_PORT = 443;
var HTTP_PORT = Number(process.env.PORT || 80);
var HTTP_IP = process.env.IP || '0.0.0.0';
var SOCKET_TIMEOUT = Number(process.env.SOCKET_TIMEOUT || 30000); // 30 seconds default socket timeout
var processIds = {};
var currProxy = 0;
var proxies = [];
http_1.default.globalAgent = new http_1.default.Agent({ keepAlive: true });
https_1.default.globalAgent = new https_1.default.Agent({ keepAlive: true });
function getProxy(url) {
    var proxy;
    /**
     * Initialize proxy
     */
    var matchedProcessId = url.match(/\/([a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]+\?/);
    if (matchedProcessId && matchedProcessId[1]) {
        proxy = processIds[matchedProcessId[1]];
    }
    if (proxy) {
        console.debug("Room is at proxy", proxies.indexOf(proxy));
        return proxy;
    }
    else {
        currProxy = (currProxy + 1) % proxies.length;
        console.debug("Using proxy", currProxy, url);
        return proxies[currProxy];
    }
}
function register(node) {
    // skip if already registered
    if (processIds[node.processId]) {
        return;
    }
    var _a = node.address.split(":"), host = _a[0], port = _a[1];
    var proxy = http_proxy_1.default.createProxy({
        agent: http_1.default.globalAgent,
        target: { host: host, port: port },
        ws: true
    });
    proxy.on('proxyReqWs', function (proxyReq, req, socket, options, head) {
        /**
         * Prevent stale socket connections / memory-leaks
         */
        socket.on('timeout', function () {
            console.log("Socket timed out.");
            socket.end();
            socket.destroy();
        });
        socket.setTimeout(SOCKET_TIMEOUT);
    });
    proxy.on("error", function (err, req, res) {
        console.error("Proxy error during: " + req.url);
        console.error(err.stack);
        if (err.message !== "socket hang up") {
            console.warn("node " + node.processId + "/" + node.address + " failed, unregistering");
            unregister(node);
            (0, discovery_1.cleanUpNode)(node).then(function () { return console.log("cleaned up " + node.processId + " presence"); });
            reqHandler(req, res); // try again!
        }
    });
    processIds[node.processId] = proxy;
    proxies.push(proxy);
    currProxy = proxies.length - 1;
}
function unregister(node) {
    var proxy = processIds[node.processId];
    var idx = proxies.indexOf(proxy);
    if (idx > -1) {
        proxies.splice(proxies.indexOf(proxy), 1);
        delete processIds[node.processId];
        currProxy = proxies.length - 1;
    }
}
// listen for node additions and removals through Redis
(0, discovery_1.listen)(function (action, node) {
    console.debug("LISTEN", action, node);
    if (action === 'add') {
        register(node);
    }
    else if (action == 'remove') {
        unregister(node);
    }
});
// query pre-existing nodes
(0, discovery_1.getNodeList)().
    then(function (nodes) { return nodes.forEach(function (node) { return register(node); }); }).
    catch(function (err) { return console.error(err); });
var reqHandler = function (req, res) {
    var proxy = getProxy(req.url);
    if (proxy) {
        proxy.web(req, res);
    }
    else {
        console.error("No proxy available!", processIds);
        res.statusCode = 503;
        res.end();
    }
};
var server = (process.env.SSL_KEY && process.env.SSL_CERT)
    // HTTPS
    ? https_1.default.createServer({
        key: fs_1.default.readFileSync(process.env.SSL_KEY, 'utf8'),
        cert: fs_1.default.readFileSync(process.env.SSL_CERT, 'utf8'),
    }, reqHandler)
    // HTTP
    : http_1.default.createServer(reqHandler);
server.on('error', function (err) {
    console.error("Server error: " + err.stack);
});
server.on('upgrade', function (req, socket, head) {
    var proxy = getProxy(req.url);
    if (proxy) {
        // forward original ip
        req.headers['x-forwarded-for'] = req.connection.remoteAddress;
        proxy.ws(req, socket, head);
    }
    else {
        console.error("No proxy available!", processIds);
    }
});
server.on('listening', function () { return console.debug("@colyseus/proxy listening at", JSON.stringify(server.address())); });
/**
 * Create HTTP -> HTTPS redirection server.
 */
if (server instanceof https_1.default.Server) {
    server.listen(HTTPS_PORT, HTTP_IP);
    var httpServer = http_1.default.createServer(function (req, res) {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    });
    httpServer.on('listening', function () { return console.debug("@colyseus/proxy http -> https listening at", 80); });
    httpServer.listen(HTTP_PORT, HTTP_IP);
}
else {
    server.listen(HTTP_PORT, HTTP_IP);
}
