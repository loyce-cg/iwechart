"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var UsageStatisticsService = (function () {
    function UsageStatisticsService(app, session) {
        this.app = app;
        this.session = session;
        this.loadedModules = {};
        this.currentState = { files: null, messages: null, tasks: null };
        this.stateModifiedTime = 0;
        this.refreshLock = false;
        this.eventDispatcher = new pmc_mail_1.utils.EventDispatcher();
        this.bindToModulesLoadEvents();
    }
    UsageStatisticsService.prototype.bindToModulesLoadEvents = function () {
        var _this = this;
        this.app.bindEvent(this.app, "plugin-module-ready", function (event) {
            _this.setModuleLoaded(event.name);
        });
    };
    UsageStatisticsService.prototype.setModuleLoaded = function (moduleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.loadedModules[moduleName] = true;
                if (moduleName == "chat") {
                    this.getSectionsMessagesCount();
                }
                if (moduleName == "tasks") {
                    this.getTasksCount();
                }
                if (moduleName == "notes2") {
                    this.getFilesAndDirsCount();
                }
                return [2];
            });
        });
    };
    UsageStatisticsService.prototype.getSectionsMessagesCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var manager, messages;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!("chat" in this.loadedModules)) return [3, 2];
                        return [4, this.session.mailClientApi.privmxRegistry.getSinkIndexManager()];
                    case 1:
                        manager = _a.sent();
                        messages = manager.sinkIndexCollection.list.filter(function (x) { return x.sink.acl == "shared"; }).reduce(function (a, b) { return a + b.getReadableMessagesCount(); }, 0);
                        this.updateMessagesState(messages);
                        return [2, messages];
                    case 2: return [2, this.currentState.messages];
                }
            });
        });
    };
    UsageStatisticsService.prototype.updateMessagesState = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.currentState.messages != messages)) return [3, 2];
                        this.currentState.messages = messages;
                        return [4, this.saveState(this.currentState)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    UsageStatisticsService.prototype.getTasksCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tasks, allTasks, tasksCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!("tasks" in this.loadedModules)) return [3, 3];
                        return [4, this.app.components["tasks-plugin"]];
                    case 1:
                        tasks = _a.sent();
                        return [4, tasks.getTasks(this.session, null)];
                    case 2:
                        allTasks = _a.sent();
                        tasksCount = Object.keys(allTasks).length;
                        this.updateTasksState(tasksCount);
                        return [2, tasksCount];
                    case 3: return [2, this.currentState.tasks];
                }
            });
        });
    };
    UsageStatisticsService.prototype.updateTasksState = function (tasks) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.currentState.tasks != tasks)) return [3, 2];
                        this.currentState.tasks = tasks;
                        return [4, this.saveState(this.currentState)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    UsageStatisticsService.prototype.getAllFileTrees = function () {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, Promise.all(this.session.sectionManager.filteredCollection.list.map(function (x) { return x.getFileTree(); }))];
                    case 1:
                        list = _a.sent();
                        return [2, list.filter(function (x) { return !!x; })];
                }
            });
        });
    };
    UsageStatisticsService.prototype.sumFilesAndDirsInFileTrees = function (fileTrees) {
        return fileTrees.reduce(function (a, b) { return a + b.collection.size(); }, 0);
    };
    UsageStatisticsService.prototype.getFilesAndDirsCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fileTrees, filesCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!("notes2" in this.loadedModules)) return [3, 2];
                        return [4, this.getAllFileTrees()];
                    case 1:
                        fileTrees = _a.sent();
                        filesCount = this.sumFilesAndDirsInFileTrees(fileTrees);
                        this.updateFilesState(filesCount);
                        return [2, filesCount];
                    case 2: return [2, this.currentState.files];
                }
            });
        });
    };
    UsageStatisticsService.prototype.updateFilesState = function (files) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.currentState.files != files)) return [3, 2];
                        this.currentState.files = files;
                        return [4, this.saveState(this.currentState)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    UsageStatisticsService.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.initializeDefer) {
                    this.initializeDefer = new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        var _this = this;
                        return __generator(this, function (_a) {
                            return [2, this.loadState()
                                    .then(function (result) {
                                    _this.currentState = result;
                                    _this.dispatchChangeEvent();
                                    resolve();
                                })];
                        });
                    }); });
                }
                return [2, this.initializeDefer];
            });
        });
    };
    UsageStatisticsService.prototype.loadState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var prefs, stateRaw, state;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.session.mailClientApi.privmxRegistry.getUserPreferences()];
                    case 1:
                        prefs = _a.sent();
                        stateRaw = prefs.getValue(UsageStatisticsService.STATE_KEY, null);
                        state = stateRaw ? JSON.parse(stateRaw) : { messages: null, files: null, tasks: null };
                        return [2, state];
                }
            });
        });
    };
    UsageStatisticsService.prototype.saveState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            var currTime, prefs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currTime = Date.now();
                        if (currTime < this.stateModifiedTime) {
                            return [2];
                        }
                        this.dispatchChangeEvent();
                        this.stateModifiedTime = currTime;
                        return [4, this.session.mailClientApi.privmxRegistry.getUserPreferences()];
                    case 1:
                        prefs = _a.sent();
                        return [4, prefs.set(UsageStatisticsService.STATE_KEY, JSON.stringify(state), true)];
                    case 2:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    UsageStatisticsService.prototype.dispatchChangeEvent = function () {
        this.eventDispatcher.dispatchEvent({
            type: "statistics-change",
            messages: this.currentState.messages,
            files: this.currentState.files,
            tasks: this.currentState.tasks
        });
    };
    UsageStatisticsService.prototype.refresh = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.refreshLock) {
                            return [2];
                        }
                        this.refreshLock = true;
                        return [4, this.init()];
                    case 1:
                        _a.sent();
                        return [4, this.getFilesAndDirsCount()];
                    case 2:
                        _a.sent();
                        return [4, this.getTasksCount()];
                    case 3:
                        _a.sent();
                        return [4, this.getSectionsMessagesCount()];
                    case 4:
                        _a.sent();
                        this.refreshLock = false;
                        return [2];
                }
            });
        });
    };
    UsageStatisticsService.PREFERENCES_MAIN_KEY = "usage-statistics-service";
    UsageStatisticsService.STATE_KEY = UsageStatisticsService.PREFERENCES_MAIN_KEY + ":state";
    return UsageStatisticsService;
}());
exports.UsageStatisticsService = UsageStatisticsService;
UsageStatisticsService.prototype.className = "com.privmx.plugin.apps.usagestatistics.UsageStatisticsService";

//# sourceMappingURL=UsageStatisticsService.js.map
