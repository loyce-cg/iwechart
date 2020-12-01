import {privfs} from "pmc-mail";
import {ConflictType, OperationType} from "./Common";

export class Helper {
    
    static convertConflictType(status: privfs.fs.file.multi.OperationStatus): ConflictType {
        if (status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE) {
            return ConflictType.FILE_OVERWRITE;
        }
        if (status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE) {
            return ConflictType.DIRECTORIES_MERGE;
        }
        if (status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {
            return ConflictType.FILE_OVERWRITE_BY_DIRECTORY;
        }
        if (status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE) {
            return ConflictType.DIRECTORY_OVERWRITE_BY_FILE;
        }
        throw new Error("Invalid status " + status);
    }
    
    static convertOperationType(type: privfs.fs.file.multi.OperationType): OperationType {
        if (type == privfs.fs.file.multi.OperationType.COPY) {
            return OperationType.COPY;
        }
        if (type == privfs.fs.file.multi.OperationType.MOVE) {
            return OperationType.MOVE;
        }
        if (type == privfs.fs.file.multi.OperationType.REMOVE) {
            return OperationType.REMOVE;
        }
        if (type == privfs.fs.file.multi.OperationType.REMOVE_EMPTY_DIR) {
            return OperationType.REMOVE;
        }
        throw new Error("Invalid operation type " + type);
    }
}