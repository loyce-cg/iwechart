import {ProxyCollection} from "./ProxyCollection";
import {BaseCollection} from "./BaseCollection";
import {utils} from "../../Types";
import collection = utils.collection;

export class TransformCollection<T, U> extends ProxyCollection<T, U> {
    
    mapper: (org: U, index: number, collection: ProxyCollection<T, U>) => T;
    
    constructor(collection: BaseCollection<U>, mapper: (org: U, index: number, collection: ProxyCollection<T, U>) => T) {
        super(false);
        this.mapper = mapper;
        this.setCollectionSafe(collection);
    }
    
    convert(org: U, index: number, collection: ProxyCollection<T, U>): T {
        return this.mapper(org, index, collection);
    }
}