import {utils, component, privfs, window, Q, Types, mail} from "pmc-mail";
import {Notes2Plugin} from "../../main/Notes2Plugin";
import {RecentOpenedFile, RecentService} from "../../main/RecentService";
import {Locations, LocationInfo, FilesMeta, FileInfo} from "../../main/LocationService";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import * as fs from "fs";
import { LocalFS } from "../../main/LocalFS";
import { i18n } from "./i18n";

export interface LocationModel {
    id: string;
    channelName?: string;
    channelScope?: string;
    hashmail?: string;
    convModel?: Types.webUtils.ConversationModel;
}

export interface EntryViewModel extends LocationModel {
    fileName: string;
    fileId: string;
    icon: string;
    modified: number;
    systemLabel: string;
    did: string;
}

@Dependencies(["persons", "conversationlist", "conv2list", "extlist", "notification"])
export class RecentFilesWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.recentfiles.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    
    deferred: Q.Deferred<RecentOpenedFile>;
    loadRecentFilesListDeferred: Q.Deferred<void>;
    afterViewLoadedDeferred: Q.Deferred<void>;
    notes2Plugin: Notes2Plugin;
    allowClose: boolean = false;
    
    recentOpenedFiles: RecentOpenedFile[] = [];
    locations: Locations;
    filesMeta: FilesMeta;
    recentFilesLocations: {id: string, locationInfo: LocationInfo}[] = [];
    dataPreparedPromise: Q.Promise<void> = null;
    metaCache: { [id: string]: FileInfo } = {};
    
    conversations: component.conversationlist.ConversationListController;
    conv2list: component.conv2list.Conv2ListController;
    personsComponent: component.persons.PersonsController;
    activeCollection: utils.collection.WithActiveCollection<EntryViewModel>;
    mutableCollection: utils.collection.MutableCollection<EntryViewModel>;
    sortedCollection: utils.collection.SortedCollection<EntryViewModel>;
    recentList: component.extlist.ExtListController<EntryViewModel>;
    notifications: component.notification.NotificationController;
    
    constructor(parent: Types.app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.setPluginViewAssets("notes2");
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 560,
            height: 360,
            minWidth: 400,
            minHeight: 230,
            resizable: true,
            modal: false,
            title: this.i18n("plugin.notes2.window.recentfiles.title"),
        };
        this.deferred = Q.defer();
        this.afterViewLoadedDeferred = Q.defer();
    }
    
    init(): Q.IWhenable<void> {
        this.loadRecentFilesList();
            
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.conversations = this.addComponent("conversations", this.componentFactory.createComponent("conversationlist", [this, ""]));
        this.conv2list = this.addComponent("conv2list", this.componentFactory.createComponent("conv2list", [this, {}]));
        this.mutableCollection = this.addComponent("mutableCollection", new utils.collection.MutableCollection([]));
        this.sortedCollection = this.addComponent("sortedCollection", new utils.collection.SortedCollection(this.mutableCollection, (x, y) => y.modified - x.modified));
        this.activeCollection = this.addComponent("activeCollection", new utils.collection.WithActiveCollection(this.sortedCollection));
        this.recentList = this.addComponent("recentList", this.componentFactory.createComponent("extlist", [this, this.activeCollection]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.recentList.ipcMode = true;
    }
    
    onViewLoad(): void {
        this.afterViewLoadedDeferred.resolve();
    }
    
    checkDataPrepared(): Q.Promise<void> {
        if (this.dataPreparedPromise) {
            return this.dataPreparedPromise;
        }
        return this.dataPreparedPromise = Q().then(() => {
            return Q.all([
                this.app.mailClientApi.checkLoginCore(),
                this.app.mailClientApi.loadUserPreferences()
            ]);
        })
        .then(() => {
            return this.notes2Plugin.locationService.getLocationsInfo();
        })
        .then(res => {
            this.locations = res;
        });
    }
    
    loadRecentFilesList(): Q.Promise<void> {
        let allIds: string[] = [];
        let allDids: string[] = [];
        let previousLoadRecentFilesListDeferred = this.loadRecentFilesListDeferred;
        this.loadRecentFilesListDeferred = Q.defer();
        let loadRecentFilesListDeferred = this.loadRecentFilesListDeferred;
        Q().then(() => {
            if (previousLoadRecentFilesListDeferred && previousLoadRecentFilesListDeferred.promise.isPending()) {
                return previousLoadRecentFilesListDeferred.promise;
            }
        })
        .then(() => {
            return this.checkDataPrepared();
        })
        .then(() => {
            this.callViewMethod("recentFilesListLoading");
            return this.notes2Plugin.recentService.getRecentOpenedFiles();
        })
        .then(res => {
            this.recentOpenedFiles = res;
            this.recentOpenedFiles.filter(x => !(x.id in this.metaCache) && !x.isLocal).forEach(item => {
                allIds.push(item.id);
                allDids.push(item.did);
            });
            return this.notes2Plugin.locationService.getFilesMetaByIds(allIds, allDids, this.locations);
        })
        .then(filesMeta => {
            this.filesMeta = filesMeta;
            
            for (let id of allIds) {
                if (!(id in this.filesMeta)) {
                    this.metaCache[id] = null;
                }
            }
            for (let id in this.filesMeta) {
                this.metaCache[id] = this.filesMeta[id];
            }
            for (let id in this.metaCache) {
                if (this.metaCache[id]) {
                    this.filesMeta[id] = this.metaCache[id];
                }
            }
            
            let locationsToGet: Q.Promise<{id: string, locationInfo: LocationInfo}>[] = [];
            this.recentOpenedFiles.forEach(file => {
                if (file.isLocal && this.app.isElectronApp() && fs.existsSync(file.id) && LocalFS.isWritable(file.id)) {
                    locationsToGet.push(Q().then(() => {
                        let x = LocalFS.getEntry(file.id);
                        filesMeta[file.id] = {
                            icon: this.app.shellRegistry.resolveIcon(x.mime),
                            meta: {
                                modifiedDate: x.mtime.getTime(),
                                size: x.size,
                            },
                        };
                        return {
                            id: file.id,
                            locationInfo: { type: "local", locationName: "", section: null },
                        };
                    }));
                    return;
                }
                if (!(file.id in filesMeta)) {
                    return;
                }
                let nameFromMeta = filesMeta[file.id].name;
                if (nameFromMeta && file.name != nameFromMeta) {
                    file.name = nameFromMeta;
                    let f = this.notes2Plugin.recentService.recentOpenFiles.filter(x => x.did == file.did)[0];
                    if (f) {
                        f.name = nameFromMeta;
                    }
                }
                let getOneFileLocation = Q().then(() => this.notes2Plugin.locationService.getLocationByEntryId(file.id, this.locations)
                .then(locationInfo => {
                    return {id: file.id, locationInfo: locationInfo};
                }));
                locationsToGet.push(getOneFileLocation);
            });
            return Q.all(locationsToGet);
        })
        .then(results => {
            // Uwaga: przy otwieraniu plików z lokalnego filesystemu dopisywały się one do recent files, ale bez locationInfo, co powodowało błąd.
            // hack: pliki z lokalnego filesystemu są ignorowane (do ewentualnego przegadania)
            this.recentFilesLocations = results.filter(x => x.locationInfo != undefined);
            this.recentOpenedFiles = this.recentOpenedFiles.filter(x => {
                let exists = false;
                this.recentFilesLocations.forEach(location => {
                    if (location.id == x.id) {
                        exists = true;
                        return;
                    }
                });
                return exists;
            });
            let locations: {[id: string]: {location: LocationInfo, locationModel: LocationModel} & FileInfo} = {};
            this.recentFilesLocations.forEach(fileInfo => {
                locations[fileInfo.id] = {
                    location: fileInfo.locationInfo,
                    locationModel: this.getLocationModel(fileInfo.locationInfo),
                    icon: this.filesMeta[fileInfo.id].icon,
                    meta: this.filesMeta[fileInfo.id].meta
                };
            });
            let list: EntryViewModel[] = [];
            this.recentOpenedFiles.forEach(file => {
                let location = locations[file.id];
                let item = {
                    id: location.locationModel.id,
                    channelName: location.locationModel.channelName,
                    channelScope: location.locationModel.channelScope,
                    hashmail: location.locationModel.hashmail,
                    convModel: location.locationModel.convModel,
                    fileName: file.name,
                    fileId: file.id,
                    icon: location.icon,
                    modified: location.meta.modifiedDate,
                    systemLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : "",
                    did: file.did,
                };
                if (location.location && location.location.tree && location.location.tree.collection) {
                    let found = location.location.tree.collection.find(x => x.ref.did == file.did);
                    if (!found) {
                        return;
                    }
                    item.fileName = found.name;
                }
                list.push(item);
            });
            this.mutableCollection.clear();
            this.mutableCollection.addAll(list);
            this.activeCollection.setActive(this.activeCollection.get(0));
            return this.afterViewLoadedDeferred.promise;
        })
        .fin(() => {
            loadRecentFilesListDeferred.resolve();
            this.callViewMethod("recentFilesListLoaded");
        });
        return loadRecentFilesListDeferred.promise;
    }
    
    afterRecentFileRenamed(file: RecentOpenedFile): void {
        let elem = this.mutableCollection.find(x => x.did == file.did);
        if (elem) {
            elem.fileId = file.id;
            elem.fileName = file.name;
            this.mutableCollection.triggerUpdateElement(elem);
        }
    }
    
    invalidateCache(fileId: string): void {
        if (fileId in this.metaCache) {
            delete this.metaCache[fileId];
            this.loadRecentFilesList();
        }
    }
    
    createNewDeferred(): void {
        this.deferred = Q.defer();
    }
    
    getPromise(): Q.Promise<RecentOpenedFile> {
        return this.deferred.promise;
    }
    
    getLocationModel(location: LocationInfo): LocationModel {
        let model: LocationModel = {
            id: location.type,
        }
        if (location.type == "conversation") {
            let active = this.conversations.conversationCollection.getBy("id", location.locationName);
            model.convModel = utils.Converter.convertConversation(active, null);
        }
        else if (location.type == "channel") {
            if (location.section && location.section.isUserGroup()) {
                let active = this.conv2list.conversationCollection.find(x => x.section == location.section);
                model.id = "conversation";
                model.convModel = utils.Converter.convertConv2(active, 0, null, 0, true, 0, false, false, false, null);
            }
            else {
                model.channelName = location.locationName;
                model.channelScope = location.scope;
            }
            if (location.section && location.section.isPrivate()) {
                model.hashmail = this.identity.hashmail;
            }
        }
        else if (location.type == "local") {
        }
        else {
            model.hashmail = this.identity.hashmail;
        }
        return model;
    }
    
    onViewSetActive(fileId: string, did: string) {
        let active = this.activeCollection.find(x => x.fileId == fileId && x.did == did);
        if (active != null) {
            this.activeCollection.setActive(active);
        }
    }
    
    onViewOpenSelected(): void {
        let active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        let file = utils.Lang.find(this.recentOpenedFiles, x => x.id == active.fileId);
        if (file == null) {
            return;
        }
        this.deferred.resolve(file);
        this.closeOrHide();
    }
    
    onViewSelectUp() {
        if (this.activeCollection.active) {
            let currentIndex = this.activeCollection.active.index;
            if (currentIndex > 0) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex - 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    }
    
    onViewSelectDown() {
        if (this.activeCollection.active) {
            let currentIndex = this.activeCollection.active.index;
            if (currentIndex < this.activeCollection.size() - 1) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex + 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    }
    
    onViewClearList() {
        if (this.notes2Plugin.recentService && this.notes2Plugin.recentService.recentOpenFiles && this.notes2Plugin.recentService.recentOpenFiles.length == 0) {
            return;
        }
        let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.window.recentfiles.notifier.clearingList"), {autoHide: false, progress: true});
        Q().then(() => {
            return this.loadRecentFilesListDeferred ? this.loadRecentFilesListDeferred.promise : null;
        })
        .then(() => {
            return this.notes2Plugin.recentService.clearRecentFiles();
        })
        .then(() => {
            return this.loadRecentFilesList();
        })
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        });
    }
    
    onViewRefresh(): void {
        this.dataPreparedPromise = null;
        let t0 = new Date().getTime();
        Q().then(() => {
            this.callViewMethod("setRefreshing", true);
            return this.loadRecentFilesList();
        })
        .then(() => {
            let t1 = new Date().getTime();
            let dt = t1 - t0;
            let timeLeft = 500 - dt;
            if (timeLeft > 0) {
                let def = Q.defer();
                setTimeout(() => {
                    def.resolve();
                }, timeLeft);
                return def.promise;
            }
        })
        .fin(() => {
            this.callViewMethod("setRefreshing", false);
        })
    }
    
    onViewClose(): void {
        this.closeOrHide();
    }
    
    onNwinClose(): void {
        this.closeOrHide();
    }
    
    closeOrHide(): void {
        if (this.app.isQuitting() || this.allowClose) {
            this.close();
        }
        else {
            this.hide();
        }
    }
    
    hide() {
        this.nwin.hide();
    }
    
}
