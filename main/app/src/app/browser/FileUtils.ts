import * as privfs from "privfs-client";
import * as FileSaver from "eligrey-filesaver";
import * as Q from "q";
import * as $ from "jquery";
import {Lang} from "../../utils/Lang";
import { MimeType } from "../../mail/filetree/MimeType";

let gl = <any>window;

export class FileUtils {
    
    static createBrowserLazyBuffer(file: Blob) {
        let content = new privfs.lazyBuffer.BrowserLazyContent(file);
        content = content.create(MimeType.resolve2(content.getName(), content.getMimeType()), null);
        return content;
    }
    
    static openFile(testMode?: boolean): Q.Promise<privfs.lazyBuffer.BrowserLazyContent> {
        let defer = Q.defer<privfs.lazyBuffer.BrowserLazyContent>();
        let $input = $('<input type="file" style="height:0;width:1px;display:block;margin:0;" />');
        let id = "nightwatch-file-upload-" + new Date().getTime() + "-" + Math.random();
        let id2 = id + "-raw";
        $input.on("change", event => {
            let files = (<HTMLInputElement>event.target).files;
            if (files.length) {
                defer.resolve(FileUtils.createBrowserLazyBuffer(files[0]));
            }
            $input.remove();
            if (testMode) {
                delete gl[id];
                delete gl[id2];
            }
        });
        $("body").append($input);
        if (testMode) {
            $input.addClass("nightwatch-file-upload");
            $input.attr("data", id)
            gl[id] = (file: Blob) => {
                defer.resolve(FileUtils.createBrowserLazyBuffer(file));
                $input.remove();
                delete gl[id];
                delete gl[id2];
            };
            gl[id2] = (file: privfs.lazyBuffer.BrowserLazyContent) => {
                defer.resolve(file);
                $input.remove();
                delete gl[id];
                delete gl[id2];
            };
        }
        else {
            $input.trigger("click");
        }
        return defer.promise;
    }
    
    static openFiles(testMode?: boolean): Q.Promise<privfs.lazyBuffer.BrowserLazyContent[]> {
        let defer = Q.defer<privfs.lazyBuffer.BrowserLazyContent[]>();
        let $input = $('<input type="file" multiple="multiple" style="height:0;width:1px;display:block;margin:0;" />');
        let id = "nightwatch-file-upload-" + new Date().getTime() + "-" + Math.random();
        let id2 = id + "-raw";
        $input.on("change", event => {
            let files = (<HTMLInputElement>event.target).files;
            if (files.length) {
                let array = [];
                for (let i = 0; i < files.length; i++) {
                    array.push(FileUtils.createBrowserLazyBuffer(files[i]));
                }
                defer.resolve(array);
            }
            $input.remove();
            if (testMode) {
                delete gl[id];
                delete gl[id2];
            }
        });
        $("body").append($input);
        if (testMode) {
            $input.addClass("nightwatch-file-upload");
            $input.attr("data", id);
            gl[id] = (files: Blob[]) => {
                defer.resolve(Lang.map(files, x => FileUtils.createBrowserLazyBuffer(x)));
                $input.remove();
                delete gl[id];
                delete gl[id2];
            };
            gl[id2] = (files: privfs.lazyBuffer.BrowserLazyContent[]) => {
                defer.resolve(files);
                $input.remove();
                delete gl[id];
                delete gl[id2];
            };
        }
        else {
            $input.trigger("click");
        }
        return defer.promise;
    }
    
    static saveContent(content: privfs.lazyBuffer.Content, testMode?: boolean): void {
        if (testMode) {
            gl.lastSavedContent = content;
        }
        else {
            FileSaver.saveAs(privfs.crypto.BrowserBuffer.createBlob(content.getBuffer(), content.getMimeType()), content.getName());
        }
    }
}