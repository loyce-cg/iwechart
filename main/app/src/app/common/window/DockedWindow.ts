import {Window} from "./Window";
import {app} from "../../../Types";
import { CommonApplication } from "..";

export class DockedWindow extends Window {
    
    parentWindow: Window;
    id: number;
    load: app.WindowLoadOptions;
    options: app.WindowOptions;
    controllerId: number;
    docked: boolean;
    closable: boolean;
    
    constructor(parentWindow: Window, id: number, load: app.WindowLoadOptions, options: app.WindowOptions, controllerId: number, public ipcChannelName: string, public app: CommonApplication) {
        super();
        this.parentWindow = parentWindow;
        this.id = id;
        this.load = load;
        this.options = options;
        this.controllerId = controllerId;
        this.docked = true;
        this.closable = this.options ? this.options.closable : true;
    }
    
    sendIpc(channel: string, data: any): void {
        this.parentWindow.sendIpc(channel, data);
    }
    
    openContextMenu(): void {
        this.parentWindow.openContextMenu();
    }
    
    isDocked(): boolean {
        return true;
    }
    
    isFocused(): boolean {
        return false;
    }
    
    setTitle(title: string): void {
    }
    
    focus(): void {
    }
    
    close(force?: boolean): void {
        if (!force && !this.getClosable()) {
            return;
        }
    }

    setClosable(closable: boolean): void {
        this.closable = closable;
    }

    getClosable(): boolean {
        return this.closable;
    }

    
    start(): void {
        let app = this.app;
        this.parentWindow.sendFromDocked([this.id.toString()], "controller-start", {
            nodeModulesDir: app.getNodeModulesDir(),
            servicesDefinitions: app.ipcHolder.getServicesDefinitions(),
            viewLogLevel: app.getViewLogLevel(),
            preventLinkOpenageInView: app.preventLinkOpenageInView(),
            controllerId: this.controllerId,
            ipcChannelName: this.ipcChannelName,
            helperModel: app.getMailClientViewHelperModel(),
        });
    }
    
    hideLoadingScreen(): void {
    }
    
    toggleDistractionFreeMode(): void {
        this.parentWindow.toggleDistractionFreeModeFromDocked([this.id.toString()]);
    }
    
    toggleDistractionFreeModeFromDocked(route: string[]) {
        route.push(this.id.toString());
        this.parentWindow.toggleDistractionFreeModeFromDocked(route);
    }
    
    sendFromDocked(route: string[], name: string, data: any): void {
        route.push(this.id.toString());
        this.parentWindow.sendFromDocked(route, name, data);
    }
    
    setDirty(dirty: boolean): void {
    }
    
    setIcon(icon: string): void {
    }
    
    getPosition(): app.Position {
        return this.parentWindow.getPosition();
    }
    
    setPosition(x: number, y: number) {
    }
    
    getPositionX(): number {
        return this.parentWindow.getPositionX();
    }
    
    getPositionY(): number {
        return this.parentWindow.getPositionY();
    }
    
    setPositionX(x: number): void {
    }
    
    setPositionY(y: number): void {
    }
    
    getSize(): app.Size {
        return this.parentWindow.getSize();
    }
    
    setSize(width: number, height: number): void {
    }
    
    setInnerSize(width: number, height: number): void {
    }
    
    getWidth(): number {
        return this.parentWindow.getWidth();
    }
    
    getHeight(): number {
        return this.parentWindow.getHeight();
    }
    
    setWidth(width: number): void {
    }
    
    setHeight(height: number): void {
    }
    
    getWindowState(): app.WindowState {
        return this.parentWindow.getWindowState();
    }
    
    getRestoreState(): app.WindowState {
        return this.parentWindow.getRestoreState();
    }
    
    minimize(): void {
    }
    
    minimizeToggle(): void {
    }
    
    isMinimized(): boolean {
        return false;
    }
    
    maximize(): void {
    }
    
    maximizeToggle(): void {
    }
    
    isMaximized(): boolean {
        return false;
    }
    
    show() {
    }
    
    hide() {
    }
    
    getResizable(): boolean {
        return null;
    }
    
    setResizable(resizable: boolean): void {
    }
    
    getParent(): Window {
        return this.parentWindow;
    }
    
    setZoomLevel(zoomLevel: number): void {
    }
    
    removeSpinner(): void {
    }
    
    isAlwaysOnTop(): boolean {
        return false;
    }
    
    setAlwaysOnTop(alwaysOnTop: boolean): void {
    }
    
    center(): void {
    }
    
}
