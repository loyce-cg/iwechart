import { func as mainTemplate } from "./template/template.html";
import { TemplateManager } from "../../web-utils/template/Manager";
import { AudioLevelObserver } from "../../web-utils";
import * as $ from "jquery";

export class AudioLevelIndicator {
    
    protected $main: JQuery;
    protected $container: JQuery;
    protected audioLevelObserver: AudioLevelObserver | null = null;
    protected audioLevelIndicators: JQuery[] = [];
    
    constructor(
        public templateManager: TemplateManager,
    ) {
    }
    
    async init($container: JQuery): Promise<void> {
        this.$container = $container;
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ();
        this.$container.append(this.$main);
        this.audioLevelIndicators = this.$main.find(".audio-level-indicator").children().toArray().map(el => $(el));
    }
    
    setDeviceId(deviceId?: string): void {
        if (this.audioLevelObserver) {
            this.audioLevelObserver.dispose();
        }
        this.audioLevelObserver = new AudioLevelObserver(typeof(deviceId) == "string" ? deviceId : null, audioLevel => {
            this.updateAudioInputLevel(audioLevel);
        });
    }
    
    updateAudioInputLevel(audioLevel: number): void {
        const nTotalBars = this.audioLevelIndicators.length;
        const nHighlightedBars = Math.round(Math.pow(audioLevel, 0.63) * nTotalBars);
        for (let i = 0; i < nTotalBars; ++i) {
            this.audioLevelIndicators[i].toggleClass("on", i < nHighlightedBars);
        }
    }
    
    destroy(): void {
        if (this.audioLevelObserver) {
            this.audioLevelObserver.dispose();
        }
    }
    
}