import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {func as mainTemplate} from "./template/main.html";

@WindowView
export class UpdateWindowView extends BaseWindowView<void> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
}
