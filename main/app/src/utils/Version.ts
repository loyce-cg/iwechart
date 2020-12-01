import {utils} from "../Types";
let Project: ProjectRawInfo = require("../../package.json");

export interface ProjectRawInfo {
    version: string;
    buildDate: string;
    buildId: string;
}

export class Version {
    
    static get(version?: string): utils.ProjectInfo {
        return version ? {str: version, ver: version} : Version.parse(Project);
    }
    
    static parse(project: ProjectRawInfo): utils.ProjectInfo {
        return {
            str: project.version,
            ver: project.version
        };
    }
}
