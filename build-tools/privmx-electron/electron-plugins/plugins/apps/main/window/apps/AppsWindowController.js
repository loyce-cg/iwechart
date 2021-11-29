"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var Inject = pmc_mail_1.utils.decorators.Inject;
var index_1 = require("./i18n/index");
var UsageStatisticsService_1 = require("../../usagestatistics/UsageStatisticsService");
var AppsWindowController = (function (_super) {
    __extends(AppsWindowController, _super);
    function AppsWindowController(parentWindow) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, null) || this;
        _this.fullyLoadedModule = {};
        _this.pinnedSectionIds = [];
        _this.allSpinnersHidden = false;
        _this.ipcMode = true;
        _this.session = _this.app.sessionManager.getLocalSession();
        _this.setPluginViewAssets("apps");
        _this.openWindowOptions.fullscreen = true;
        _this.openWindowOptions.cssClass = "app-window";
        _this.basicTooltip = _this.addComponent("basicTooltip", _this.componentFactory.createComponent("tooltip", [_this]));
        _this.basicTooltip.getContent = function (id) {
            var dblClick = _this.app.userPreferences.getUnreadBadgeUseDoubleClick();
            return _this.app.localeService.i18n("markAllAsRead.tooltip." + (dblClick ? 'double' : 'single') + "Click");
        };
        _this.refreshPinnedSectionIdsList();
        _this.app.userPreferences.eventDispatcher.addEventListener("userpreferenceschange", function (event) {
            _this.onUserPreferencesChange(event);
        });
        _this.navBar.activeLogo = false;
        return _this;
    }
    AppsWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    AppsWindowController.prototype.refreshBadgesLoaded = function () {
        for (var id in this.fullyLoadedModule) {
            this.callViewMethod("scheduleSetAppWindowBadgeFullyLoaded", id, this.fullyLoadedModule[id]);
        }
    };
    AppsWindowController.prototype.updateStatisticsInView = function (event) {
        this.callViewMethod("updateStatistics", event.messages, event.tasks, event.files);
    };
    AppsWindowController.prototype.registerBadgesEvents = function () {
        var _this = this;
        this.parent.appWindows.forEach(function (x) {
            if (x.count) {
                _this.registerChangeEvent(x.count.changeEvent, function () {
                    _this.callViewMethod("setAppWindowBadge", x.id, x.count.get());
                }, "multi");
            }
            if (x.countFullyLoaded) {
                _this.registerChangeEvent(x.countFullyLoaded.changeEvent, function () {
                    _this.fullyLoadedModule[x.id] = x.countFullyLoaded.get();
                    _this.refreshBadgesLoaded();
                }, "multi");
            }
        });
    };
    AppsWindowController.prototype.registerBadgesEvents_old = function () {
        var _this = this;
        this.parent.appWindows.forEach(function (x) {
            if (x.count) {
                _this.registerChangeEvent(x.count.changeEvent, function () {
                    _this.callViewMethod("setAppWindowBadge", x.id, x.count.get());
                }, "multi");
            }
            if (x.countFullyLoaded) {
                _this.registerChangeEvent(x.countFullyLoaded.changeEvent, function () {
                    _this.callViewMethod("scheduleSetAppWindowBadgeFullyLoaded", x.id, x.countFullyLoaded.get());
                }, "multi");
            }
        });
    };
    AppsWindowController.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.mailClientApi.prepareSectionManager();
        })
            .then(function () {
            _this.sections = _this.addComponent("sections", new pmc_mail_1.utils.collection.FilteredCollection(_this.sectionManager.filteredCollection, function (x) {
                return x.hasAccess() && !x.isPrivateOrUserGroup() && (x.isChatModuleEnabled() || x.isKvdbModuleEnabled() || x.isFileModuleEnabled());
            }));
            var transformCollection = _this.addComponent("transformCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.sections, function (s) {
                var parents = [];
                var lastParent = s.getParent();
                while (lastParent) {
                    parents.unshift(lastParent);
                    lastParent = lastParent.getParent();
                }
                var breadcrumb = "";
                parents.forEach(function (p) {
                    breadcrumb += p.getName() + " / ";
                });
                return {
                    primary: s.sectionData.primary,
                    id: s.getId(),
                    name: s.getName(),
                    private: s.getScope() == "private",
                    breadcrumb: breadcrumb,
                    pinned: _this.pinnedSectionIds.indexOf(s.getId()) >= 0,
                };
            }));
            _this.sortedSectionsCollection = _this.addComponent("sortedList", new pmc_mail_1.utils.collection.SortedCollection(transformCollection, pmc_mail_1.utils.Utils.makeMultiComparatorSorter(_this.sectionComparator_isPrimary.bind(_this), _this.sectionComparator_isPinned.bind(_this))));
            _this.sectionList = _this.addComponent("sectionList", _this.componentFactory.createComponent("extlist", [_this, _this.sortedSectionsCollection]));
            _this.sectionList.ipcMode = true;
            _this.bindEvent(_this.app, "first-login-info-closed", _this.showFilesUserGuide.bind(_this));
            return _this.app.mailClientApi.loadUserPreferences();
        })
            .then(function () {
            _this.registerBadgesEvents();
        })
            .then(function () {
            _this.usageStats = new UsageStatisticsService_1.UsageStatisticsService(_this.app, _this.app.sessionManager.getLocalSession());
            _this.usageStats.eventDispatcher.addEventListener("statistics-change", function (event) {
                _this.currentUsageStats = event;
                _this.updateStatisticsInView(event);
            });
        })
            .then(function () {
            _this.app.addEventListener("update-apps-spinners", function (e) {
                _this.callViewMethod("updateSpinners", e.sectionId, e.moduleName, e.state, true);
            });
        });
    };
    AppsWindowController.prototype.getModel = function () {
        var chatFullyLoaded = false;
        var notes2FullyLoaded = false;
        var tasksFullyLoaded = false;
        var calendarFullyLoaded = false;
        this.parent.appWindows.forEach(function (x) {
            if (x.countFullyLoaded && x.countFullyLoaded.get()) {
                if (x.id == "chat") {
                    chatFullyLoaded = true;
                }
                else if (x.id == "notes2") {
                    notes2FullyLoaded = true;
                }
                else if (x.id == "tasks") {
                    tasksFullyLoaded = true;
                }
                else if (x.id == "calendar") {
                    calendarFullyLoaded = true;
                }
            }
        });
        return {
            instanceName: this.userConfig.instanceName,
            appWindows: this.getAppWindows(),
            chatFullyLoaded: chatFullyLoaded,
            notes2FullyLoaded: notes2FullyLoaded,
            tasksFullyLoaded: tasksFullyLoaded,
            calendarFullyLoaded: calendarFullyLoaded,
            appVersion: this.app.getVersion().ver,
            isElectron: this.app.isElectronApp()
        };
    };
    AppsWindowController.prototype.onViewSetAllSpinnersHidden = function (allSpinnersHidden) {
        this.allSpinnersHidden = allSpinnersHidden;
    };
    AppsWindowController.prototype.onViewLoad = function () {
        if (this.currentUsageStats) {
            this.updateStatisticsInView(this.currentUsageStats);
        }
    };
    AppsWindowController.prototype.onActivate = function () {
        var _this = this;
        this.usageStats.refresh().catch(function (e) {
            _this.logError(e);
        });
    };
    AppsWindowController.prototype.getAppWindows = function () {
        return this.parent.appWindows
            .filter(function (x) { return x.visible !== false; })
            .map(function (x) {
            return {
                id: x.id,
                icon: x.icon,
                label: x.label,
                count: x.count ? x.count.get() : 0,
                action: x.action,
                order: x.order ? x.order : 0,
            };
        }).sort(function (a, b) {
            return a.order - b.order;
        });
    };
    AppsWindowController.prototype.onViewSectionClick = function (id) {
        var _this = this;
        var selected = this.sectionManager.getSection(id);
        var singletonId = "sectionsummarywindow-" + id;
        var registered = this.app.manager.getSingleton(singletonId);
        if (registered) {
            registered.controller.nwin.focus();
            registered.controller.reopenWithParams([this, selected]);
            return;
        }
        this.app.ioc.create(pmc_mail_1.window.sectionsummary.SectionSummaryWindowController, [this, this.session, selected]).then(function (win) {
            _this.app.openChildWindow(win);
            _this.app.manager.registerSingleton(singletonId, win.manager);
        });
    };
    AppsWindowController.prototype.onViewAppWindowOpen = function (appWindowId) {
        this.parent.redirectToAppWindow(appWindowId);
    };
    AppsWindowController.prototype.onNwinInitialized = function () {
        var _this = this;
        return _super.prototype.onNwinInitialized.call(this)
            .then(function () {
            _this.refreshBadgesLoaded();
        });
    };
    AppsWindowController.prototype.isFirstAdmin = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.mailClientApi.privmxRegistry.getIdentityProvider();
        })
            .then(function (identityProvider) {
            if (!identityProvider.isAdmin()) {
                return false;
            }
            else {
                return _this.app.mailClientApi.privmxRegistry.getUserAdminService().then(function (admService) { return admService.refreshUsersCollection().thenResolve(admService); })
                    .then(function (adminService) {
                    return adminService.usersCollection.size() == 1;
                });
            }
        });
    };
    AppsWindowController.prototype.isStartingContentAvailable = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.sectionManager.load();
        })
            .then(function () {
            var privateSectionId = _this.sectionManager.getMyPrivateSection().getId();
            if (_this.sectionManager.sectionsCollection.list.length == 1 && _this.sectionManager.sectionsCollection.list[0].getId() == privateSectionId) {
                return false;
            }
            return true;
        });
    };
    AppsWindowController.prototype.showFilesUserGuide = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2, pmc_mail_1.Q().then(function () {
                        return pmc_mail_1.Q.all([
                            _this.isFirstAdmin(),
                            _this.isStartingContentAvailable()
                        ]);
                    })
                        .then(function (res) {
                        var firstAdmin = res[0], startingContent = res[1];
                        return firstAdmin && startingContent ? _this.retrieveFromView("getFilesPos") : null;
                    })
                        .then(function (result) {
                        if (!result) {
                            return;
                        }
                        _this.userGuide = _this.addComponent("userguide", _this.componentFactory.createComponent("userguide", [_this, {
                                width: 200,
                                height: 200,
                                centerX: result.x,
                                centerY: result.y,
                                shape: "rounded-rectangle",
                                text: _this.i18n("plugin.apps.window.apps.filesUserGuide.text"),
                                side: "bottom",
                            }]));
                        _this.userGuide.ipcMode = true;
                        _this.userGuide.setOnClick(function () {
                            _this.userGuide.close();
                            _this.callViewMethod("closeFilesUserGuide");
                            _this.removeComponent("userguide");
                            _this.parent.redirectToAppWindow("notes2");
                        });
                        _this.callViewMethod("showFilesUserGuide");
                    })];
            });
        });
    };
    AppsWindowController.prototype.onViewModuleBadgeClick = function (moduleName) {
        if (!this.fullyLoadedModule[moduleName] || moduleName == "calendar" || !this.allSpinnersHidden) {
            return;
        }
        this.dispatchEvent({
            type: "try-mark-as-read",
            moduleName: moduleName,
        });
    };
    AppsWindowController.prototype.onViewSectionBadgeClick = function (sectionId) {
        if (!this.fullyLoadedModule["chat"] || !this.fullyLoadedModule["notes2"] || !this.fullyLoadedModule["tasks"] || !this.fullyLoadedModule["calendar"] || !this.allSpinnersHidden) {
            return;
        }
        this.dispatchEvent({
            type: "try-mark-as-read",
            sectionId: sectionId,
        });
    };
    AppsWindowController.prototype.sectionComparator_isPrimary = function (a, b) {
        var ap = a.primary ? 1 : 0;
        var bp = b.primary ? 1 : 0;
        return bp - ap;
    };
    AppsWindowController.prototype.sectionComparator_isPinned = function (a, b) {
        var ap = this.getIsPinned(a) ? 1 : 0;
        var bp = this.getIsPinned(b) ? 1 : 0;
        return bp - ap;
    };
    AppsWindowController.prototype.getIsPinned = function (sectionModel) {
        return this.pinnedSectionIds.indexOf(sectionModel.id) >= 0;
    };
    AppsWindowController.prototype.refreshPinnedSectionIdsList = function () {
        var prevStr = JSON.stringify(this.pinnedSectionIds);
        this.pinnedSectionIds = this.app.userPreferences.getPinnedSectionIds();
        var newStr = JSON.stringify(this.pinnedSectionIds);
        if (prevStr != newStr && this.sortedSectionsCollection) {
            this.sortedSectionsCollection.rebuild();
        }
    };
    AppsWindowController.prototype.onUserPreferencesChange = function (event) {
        _super.prototype.onUserPreferencesChange.call(this, event);
        this.refreshPinnedSectionIdsList();
    };
    AppsWindowController.textsPrefix = "plugin.apps.window.apps.";
    __decorate([
        Inject
    ], AppsWindowController.prototype, "sectionManager", void 0);
    __decorate([
        Inject
    ], AppsWindowController.prototype, "userConfig", void 0);
    return AppsWindowController;
}(pmc_mail_1.window.base.BaseAppWindowController));
exports.AppsWindowController = AppsWindowController;
AppsWindowController.prototype.className = "com.privmx.plugin.apps.window.apps.AppsWindowController";

//# sourceMappingURL=AppsWindowController.js.map
