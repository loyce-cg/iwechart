import {BaseAppWindowView} from "../base/BaseAppWindowView";
import {WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {app} from "../../Types";

@WindowView
export class EmptyWindowView extends BaseAppWindowView<void> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
}
