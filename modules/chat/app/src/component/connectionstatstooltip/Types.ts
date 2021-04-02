export class ConnectionStatsModel {
    bandwidthDownload: number;
    bandwidthUpload: number;
    videoBitrateDownload: number;
    videoBitrateUpload: number;
    audioBitrateDownload: number;
    audioBitrateUpload: number;
    totalBitrateDownload: number;
    totalBitrateUpload: number;
    packetLossDownload: number;
    packetLossUpload: number;
    ping: number;
    e2ePing: number;
    connectionQuality: number;
    maxEnabledResolution: number;
}
