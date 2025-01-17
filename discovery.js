"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanUpNode = exports.listen = exports.getNodeList = void 0;
var ioredis_1 = __importDefault(require("ioredis"));
var REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
var NODES_SET = "colyseus:nodes";
var ROOM_COUNT_KEY = "roomcount";
var DISCOVERY_CHANNEL = "colyseus:nodes:discovery";
var redis = new ioredis_1.default(REDIS_URL);
var sub = new ioredis_1.default(REDIS_URL);
function parseNode(data) {
    var _a = data.split("/"), processId = _a[0], address = _a[1];
    return { processId: processId, address: address };
}
function getNodeList() {
    return __awaiter(this, void 0, void 0, function () {
        var nodes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, redis.smembers(NODES_SET)];
                case 1:
                    nodes = _a.sent();
                    return [2 /*return*/, nodes.map(function (data) { return parseNode(data); })];
            }
        });
    });
}
exports.getNodeList = getNodeList;
function listen(cb) {
    sub.subscribe(DISCOVERY_CHANNEL);
    sub.on("message", function (_, message) {
        var _a = JSON.parse(message).split(","), action = _a[0], data = _a[1];
        cb(action, parseNode(data));
    });
}
exports.listen = listen;
function cleanUpNode(node) {
    return __awaiter(this, void 0, void 0, function () {
        var nodeAddress;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    nodeAddress = node.processId + "/" + node.address;
                    return [4 /*yield*/, redis.srem(NODES_SET, nodeAddress)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, redis.hdel(ROOM_COUNT_KEY, node.processId)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.cleanUpNode = cleanUpNode;
