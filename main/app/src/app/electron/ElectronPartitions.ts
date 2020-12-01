import { WindowUrl } from "./WindowUrl";

export class ElectronPartitions {
    
    static HTTPS_SECURE_CONTEXT = "https-secure-context";
    
    static getUrlFromHtml(partition: string, host: string, html: string) {
        if (partition == ElectronPartitions.HTTPS_SECURE_CONTEXT) {
            return WindowUrl.buildUrl(host, "text/html", Buffer.from(html, "utf8"));
        }
        return "data:text/html;base64," + new Buffer(html, "utf8").toString("base64");
    }
}