import { CommonApplication } from ".";
import * as Types from "../../Types";

export class FileRenameObserver {
    
    constructor(public app: CommonApplication) {
        app.addEventListener<Types.event.AfterLoginEvent>("afterlogin", _event => {
            app.mailClientApi.privmxRegistry.getMessagesCollection().then(mc => {
                mc.changeEvent.add(e => {
                    if (e.type == "add") {
                        if (e.element && e.element.source && e.element.source.data
                            && e.element.source.data.sender && e.element.source.data.sender.hashmail != this.app.identity.hashmail
                            && e.element.source.data.type == "chat-message" && e.element.source.data.contentType == "application/json"
                        ) {
                            let msg = JSON.parse(e.element.source.data.text);
                            if (msg && msg.type == "rename-file") {
                                let oldPath = msg.oldPath;
                                let newPath = msg.newPath;
                                let did = msg.did;
                                //TODO: event jest rejestrowany na afterLogin, a sessionManager i local session po logowaniu na pewno istnieje
                                //TODO: wiec to sprawdzenie jest zbedne.
                                //TODO: mamy tutaj wolane getLocalSession - czyli ze FileRenameObserver nie powinien tez dzialac dla sekcji remote?
                                let session = app.sessionManager ? app.sessionManager.getLocalSession() : null;
                                let hostHash = (session ? session.hostHash : null) || null;
                                this.dispatchFileRenamedEvent(did, newPath, oldPath, hostHash);
                            }
                        }
                    }
                });
            });
        });
    }
    
    dispatchFileRenamedEvent(did: string, newPath: string, oldPath: string, hostHash: string): void {
        if (did && newPath && newPath != oldPath) {
            this.app.dispatchEvent<Types.event.FileRenamedEvent>({
                type: "fileRenamed",
                did,
                oldPath,
                newPath,
                isLocal: false,
                hostHash: hostHash,
            });
        }
    }
    
    dispatchLocalFileRenamedEvent(newPath: string, oldPath: string): void {
        if (newPath && newPath != oldPath) {
            this.app.dispatchEvent<Types.event.FileRenamedEvent>({
                type: "fileRenamed",
                did: null,
                oldPath,
                newPath,
                isLocal: true,
            });
        }
    }
    
}
