import * as privfs from "privfs-client";
import SinkQuery = privfs.types.message.SinkQuery;

export class Query {
    
    query: SinkQuery;
    
    static create(value: SinkQuery, not: boolean): SinkQuery {
        return not ? {
            operand: "NOT",
            value: value
        } : value;
    }
    
    static createDate(date: {relation: string, value: Date}): SinkQuery {
        return {
            operand: "DATE",
            relation: date.relation,
            value: date.value.getTime()
        };
    }
    
    and(value: Query|SinkQuery): Query {
        if (value instanceof Query) {
            if (value.query) {
                value = value.query;
            }
        }
        else if (value) {
            this.query = this.query ? {
                operand: "AND",
                left: this.query,
                right: value
            } : value;
        }
        return this;
    }
    
    or(value: Query|SinkQuery): Query {
        if (value instanceof Query) {
            if (value.query) {
                value = value.query;
            }
        }
        else if (value) {
            this.query = this.query ? {
                operand: "OR",
                left: this.query,
                right: value
            } : value;
        }
        return this;
    }
}

