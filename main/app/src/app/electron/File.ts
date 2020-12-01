import electron = require("electron");
import {PromiseUtils} from "simplito-promise";
import fs = require("fs");
import * as nodePath from "path";
import * as Q from "q";
import { MimeType } from "../../mail/filetree/MimeType";
import { Path } from "../../mail/filetree/Path";
import * as privfs from "privfs-client";
import { Window as AppWindow } from "../common/window/Window";
import { ElectronWindow } from "./window/ElectronWindow";
import { Session } from "../../mail/session/SessionManager";

export class File {
    
    static createNodeFileLazyBuffer(filePath: string, mimeType: string) {
        let parsed = Path.parsePath(filePath);
        return new privfs.lazyBuffer.NodeFileLazyContent(filePath, mimeType ? MimeType.resolve2(parsed.name.original, mimeType) : MimeType.resolve(parsed.name.original));
    }
    
    static chooseFile(parentWindow?: AppWindow, defaultPath?: string): Q.Promise<privfs.lazyBuffer.NodeFileLazyContent> {
        return File.choose(["openFile"], parentWindow, defaultPath)
        .then(files => {
            return files[0];
        });
    }
    
    static chooseFiles(parentWindow?: AppWindow, defaultPath?: string): Q.Promise<privfs.lazyBuffer.NodeFileLazyContent[]> {
        return File.choose(["openFile", "multiSelections"], parentWindow, defaultPath);
    }
    
    static choose(properties: ("openFile"|"openDirectory"|"multiSelections"|"createDirectory")[], parentWindow?: AppWindow, defaultPath?: string): Q.Promise<privfs.lazyBuffer.NodeFileLazyContent[]> {
        let parent = parentWindow ? (<ElectronWindow>parentWindow).window : null;
        let defer = Q.defer<privfs.lazyBuffer.NodeFileLazyContent[]>();
        electron.dialog.showOpenDialog(parent, {properties: properties, defaultPath}, File.onFileChoose.bind(this, defer));
        return defer.promise;
    }
    
    static onFileChoose(defer: Q.Deferred<privfs.lazyBuffer.NodeFileLazyContent[]>, paths: string[]): void {
        if (!paths) {
            return;
        }
        File.prepareFiles(paths)
        .then(defer.resolve)
        .fail(defer.reject);
    }
    
    static chooseDir(parentWindow?: AppWindow, defaultPath?: string): Q.Promise<string> {
        let parent = parentWindow ? (<ElectronWindow>parentWindow).window : null;
        let deferred = Q.defer<string>();
        electron.dialog.showOpenDialog(parent, { properties: ["openDirectory"], defaultPath }, paths => {
            if (paths && paths.length == 1) {
                deferred.resolve(paths[0]);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    
    static prepareFiles(paths: string[]): Q.Promise<privfs.lazyBuffer.NodeFileLazyContent[]> {
        return PromiseUtils.collect(paths, (_i, filePath) => {
            return File.createNodeFileLazyBuffer(filePath, null);
        });
    }
    
    static saveFileWithChoose(content: privfs.lazyBuffer.IContent, session: Session, parentWindow?: AppWindow): Q.Promise<void> {
        let parentBrowserWindow = parentWindow ? (<ElectronWindow>parentWindow).window : null;
        let defer = Q.defer<void>();
        let filters: electron.FileFilter[];
        let ext = nodePath.extname(content.getName());
        if (ext) {
            filters = [];
            ext = ext.substring(1);
            filters.push({name: ext, extensions: [ext]});
        }

        electron.dialog.showSaveDialog(parentBrowserWindow, {defaultPath: content.getName(), filters: filters}, File.onSaveFileChoose.bind(this, defer, content));
        return defer.promise;
    }
    
    static onSaveFileChoose(defer: Q.Deferred<void>, content: privfs.lazyBuffer.IContent, filePath: string): void {
        if (!filePath) {
            defer.reject("no-choose");
            return;
        }
        File.saveFile(content, filePath)
        .then(defer.resolve)
        .fail(defer.reject);
    }
    
    static saveFile(content: privfs.lazyBuffer.IContent, filePath: string): Q.Promise<void> {
        return Q().then(() => {
            return content.getBuffer();
        })
        .then(buffer => {
            let defer = Q.defer<void>();
            fs.writeFile(filePath, buffer, err => {
                if (err) {
                    defer.reject(err);
                }
                else {
                    defer.resolve();
                }
            });
            return defer.promise;
        });
    }
}
