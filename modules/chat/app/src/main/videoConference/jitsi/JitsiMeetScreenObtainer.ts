// @todo: (requires TS 3.8+) uncomment following import
// import type { DesktopCapturer, DesktopCapturerSource } from "electron";
// then use (<DesktopCapturer>electron.desktopCapturer) and remove ": any" in then/catch

// declare function electronRequire(name: string): any;

export type DesktopSharingSource = "screen" | "window";

export interface JitsiMeetScreenObtainerOptions {
    desktopSharingSources?: DesktopSharingSource[];
}

export type JitsiMeetScreenObtainerCallback = (streamId: string, streamType: DesktopSharingSource, screenShareAudio: boolean) => void;

export interface JitsiMeetScreenObtainer {
    openDesktopPicker(options: JitsiMeetScreenObtainerOptions, callback: JitsiMeetScreenObtainerCallback): void;
}
