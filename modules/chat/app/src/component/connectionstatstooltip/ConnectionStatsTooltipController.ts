import { Types, component, mail } from "pmc-mail";
import { i18n } from "./i18n";
import { ConnectionStatsModel } from "./Types";

export class ConnectionStatsTooltipController extends component.tooltip.TooltipController {
    
    static textsPrefix: string = "plugin.chat.component.connectionStatsTooltip.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    
    
    
    
    private statsCache: { [participantId: string]: JitsiMeetJS.ConferenceStats } = {};
    private modelsCache: { [participantId: string]: ConnectionStatsModel } = {};
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewRequestContent(participantId: string): void {
        this.updateViewModel(participantId);
    }
    
    private updateViewModel(participantId: string): void {
        const model: ConnectionStatsModel = this.getConnectionStatsModel(participantId);
        this.callViewMethod("setContent", participantId, JSON.stringify(model));
    }
    
    private async updateViewModelIfShowingTheParticipant(participantId: string): Promise<void> {
        const currentTargetId = await this.retrieveFromView("getCurrentTargetId");
        if (currentTargetId === participantId) {
            this.updateViewModel(participantId);
        }
    }
    
    private getConnectionStatsModel(participantId: string): ConnectionStatsModel {
        if (!(participantId in this.modelsCache)) {
            return this.getMissingConnectionStatsModel()
        }
        return this.modelsCache[participantId];
    }
    
    private getMissingConnectionStatsModel(): ConnectionStatsModel {
        return {
            bandwidthDownload: Number.NaN,
            bandwidthUpload: Number.NaN,
            videoBitrateDownload: Number.NaN,
            videoBitrateUpload: Number.NaN,
            audioBitrateDownload: Number.NaN,
            audioBitrateUpload: Number.NaN,
            totalBitrateDownload: Number.NaN,
            totalBitrateUpload: Number.NaN,
            packetLossDownload: Number.NaN,
            packetLossUpload: Number.NaN,
            ping: Number.NaN,
            e2ePing: Number.NaN,
            connectionQuality: Number.NaN,
            maxEnabledResolution: Number.NaN,
        };
    }
    
    async setStats(participantId: string, stats: JitsiMeetJS.ConferenceStats): Promise<void> {
        if (this.statsCache[participantId]) {
            stats = {
                ...this.statsCache[participantId],
                ...stats,
            };
        }
        const model: ConnectionStatsModel = {
            bandwidthDownload: this.hasNumberProperty(stats, ["bandwidth", "download"]) ? stats.bandwidth.download : Number.NaN,
            bandwidthUpload: this.hasNumberProperty(stats, ["bandwidth", "upload"]) ? stats.bandwidth.upload : Number.NaN,
            videoBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "video", "download"]) ? stats.bitrate.video.download : Number.NaN,
            videoBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "video", "upload"]) ? stats.bitrate.video.upload : Number.NaN,
            audioBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "audio", "download"]) ? stats.bitrate.audio.download : Number.NaN,
            audioBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "audio", "upload"]) ? stats.bitrate.audio.upload : Number.NaN,
            totalBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "download"]) ? stats.bitrate.download : Number.NaN,
            totalBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "upload"]) ? stats.bitrate.upload : Number.NaN,
            packetLossDownload: this.hasNumberProperty(stats, ["packetLoss", "download"]) ? stats.packetLoss.download : Number.NaN,
            packetLossUpload: this.hasNumberProperty(stats, ["packetLoss", "upload"]) ? stats.packetLoss.upload : Number.NaN,
            ping: this.hasNumberProperty(stats, ["jvbRTT"]) ? stats.jvbRTT : Number.NaN,
            e2ePing: this.hasNumberProperty(stats, ["e2ePing"]) ? stats.e2ePing : Number.NaN,
            connectionQuality: this.hasNumberProperty(stats, ["connectionQuality"]) ? stats.connectionQuality : Number.NaN,
            maxEnabledResolution: this.hasNumberProperty(stats, ["maxEnabledResolution"]) ? stats.maxEnabledResolution : Number.NaN,
        };
        this.statsCache[participantId] = stats;
        this.modelsCache[participantId] = model;
        await this.updateViewModelIfShowingTheParticipant(participantId);
    }
    
    private hasNumberProperty(object: any, path: string[]): boolean {
        let currentObject = object;
        for (let propertyName of path) {
            if (!currentObject || !(propertyName in currentObject)) {
                return false;
            }
            currentObject = currentObject[propertyName];
        }
        return typeof(currentObject) === "number";
    }
    
    removeStats(participantId: string): void {
        if (participantId in this.statsCache) {
            delete this.statsCache[participantId];
        }
        if (participantId in this.modelsCache) {
            delete this.modelsCache[participantId];
        }
    }
    
    clearStats(): void {
        this.statsCache = {};
        this.modelsCache = {};
    }
    
}