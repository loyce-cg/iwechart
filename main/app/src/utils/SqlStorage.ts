import * as sqlite3 from "sqlite3";
import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

function name2key(name: string): string {
    return new Buffer(name, "binary").toString("hex");
}

export class SqlStorage {
    static SERVER_DATA_ID_KEY: string = "serverDataId";
    dirPath: string;
    userLevelPath: string;
    workingPath: string;
    db: DbRepository;
    connected: boolean = false;
    inMemoryDb: {[key: string]: string} = {};
    savePromises: {[id: number]: Q.Promise<any>} = {};
    saveId: number = 1;
    userLevel: boolean;

    constructor(dirPath: string) {
        this.dirPath = this.workingPath = dirPath;
        if (!fs.existsSync(this.dirPath)) {
            this.mkdirRecursive(this.dirPath);
        }
        this.db = new DbRepository();
        this.inMemoryDb = {};
    }
    
    closeDb(): Q.Promise<void> {
        return this.connected ? this.waitForDb().then(() => this.db.closeDb().then(result => {
            this.connected = false;
            this.inMemoryDb = {};
            return result;
        })) : Q.resolve();
    }
    

    mkdirRecursive(dir: string) {
        // Starting from node 10.12 we have mkdirSync with recursive option available
        (<any>fs).mkdirSync(dir, {recursive: true});
    }
        
    init(userLevel?: boolean): Q.Promise<void> {
        this.userLevel = userLevel;
        return this.connected ? Q.resolve() : Q().then(() => {
            
            if (!fs.existsSync(this.workingPath)) {
                try {
                    this.mkdirRecursive(this.workingPath);
                }
                catch (e) {
                    console.log("cannot create dir", e);
                    process.exit(1);
                }
            }
            this.db = new DbRepository();
            return this.db.connect(this.workingPath, userLevel)
            .then(() => {
                return this.db.createTable();
            })
            .then(() => {
                this.connected = true;
                return;
            })
        });
    }

    connectIfNotConnected(): Q.Promise<void> {
        this.connected = false;
        this.db = new DbRepository();
        return this.db.connect(this.workingPath, this.userLevel)
        .then(() => {
            return this.db.createTable();
        })
        .then(() => {
            this.connected = true;
            return;
        })
    }

    initBaseLevel(): Q.Promise<void> {
        return this.closeDb()
        .then(() => {
            this.workingPath = this.dirPath;
            return this.init();
        })
    }
        
    switchToUserLevel(user: string, server: string, serverDataId: string): Q.Promise<void> {
        let shasum = crypto.createHash('sha1');
        shasum.update(user + "#" + server);
        
        this.userLevelPath = path.join(this.dirPath, "accounts", shasum.digest("hex"));
        return !this.connected ? Q.resolve() : this.waitForDb().then(() => this.db.closeDb())
        .then(() => {
            this.connected = false;

            this.workingPath = this.userLevelPath;
            return this.init(true)
        })
        .then(() => {
            return this.validateCache(serverDataId);
        })
    }
    
    validateCache(serverDataId: string): Q.Promise<void> {
        return Q().then(() => {
            return this.getItem(SqlStorage.SERVER_DATA_ID_KEY);
        })
        .then(serverDataIdFromCache => {
            if (serverDataId != serverDataIdFromCache) {
                return this.clear().then(() => this.setItem(SqlStorage.SERVER_DATA_ID_KEY, serverDataId));
            }
            return Q.resolve<void>();
        })

    }

    findItemValueByKey(key: string): Q.Promise<string> {
        return Q().then(() => {
            if (key in this.inMemoryDb) {
                return this.inMemoryDb[key];
            }
            else {
                return this.getItemFromDb(key)
                .then(value => {
                    this.inMemoryDb[key] = value;
                    return value;
                })
            }                
        })
    }
    
    getStorageType() {
        return "SQL";
    }
    
    getItem(name: string, prefix: string = ""): Q.Promise<string> {
        let key = prefix+name2key(name);
        return Q().then(() => {
        //     return this.accessToDb();
        // })
        // .then(() => {
            return this.findItemValueByKey(key);
        })
    }
    
    getItemFromDb(key: string): Q.Promise<string> {
        return Q().then(() => {
        //     return this.accessToDb();
        // })
        // .then(() => {
            return this.db && this.connected ? Q.resolve<void>() : this.connectIfNotConnected();
        })
        .then(() => {
            return this.db.select(key)
            .then(value => {
                return value;
            })
        });
    }
    
    savingInProgress(): boolean {
        let saves: number = 0;
        for (let id in this.savePromises) {
            saves++;
        }
        return saves > 0;
    }
    
    waitPromise(wait: number): Q.Promise<void> {
        return Q.Promise((resolve) => {
            setTimeout(() => resolve(), wait)
        });
    }
    
    waitForDb(): Q.Promise<void> {
        return Q().then(() => {
            if (this.savingInProgress()) {
                return this.waitPromise(100).then(() => this.waitForDb())
            }
            else {
                return Q.resolve();
            }
        })
    }
    
    setItem(name: string, val: string, prefix: string = ""): Q.Promise<void> {
        this.saveId++;
        let localId = this.saveId;
        let key = prefix+name2key(name);
        this.inMemoryDb[key] = val;
            
        this.savePromises[localId] = this.setItemToDb(key, val);
        this.savePromises[localId].then(() => {
            delete this.savePromises[localId];
        })
        return Q.resolve();
    }

    setItemToDb(key: string, val: string): Q.Promise<void> {
        return Q().then(() => {
            return this.db && this.connected ? Q.resolve<void>() : this.connectIfNotConnected();
        })
        .then(() => {
            return this.db.insert(key, val);
        })
    }

    removeItem(name: string, prefix: string = ""): Q.Promise<void> {
        let key = prefix + name2key(name);
        this.inMemoryDb[key] = "";
        this.removeItemFromDb(key);
        return Q.resolve();
    }
    
    removeItemFromDb(key: string): Q.Promise<void> {
        return Q().then(() => {
            return this.db.delete(key);
        });
    }
    
    clear(): Q.Promise<void> {
        this.inMemoryDb = {};
        return Q().then(() => {
            return this.db.clear();
        });
    }
        
    length(): Q.Promise<number> {
        return Q().then(() => {
        //     return this.accessToDb();
        // })
        // .then(() => {
            return this.db.getLength();
        });
    }
    
    iterate(func: (key: string, value: string) => void): Q.Promise<void> {
        return Q().then(() => {
        //     return this.accessToDb();
        // })
        // .then(() => {
            return this.db.selectAll().then(results => {
                results.forEach(x => {
                    func(x.key, x.value);
                })
                return;
            })
        });
    }
}

export interface KeyValuePair {
    key: string;
    value: any;
}

class DbRepository {
    static DB_INIT_NAME: string = "init.db";
    static DB_NAME: string = "cache.db";
    static CACHE_TABLE: string = "cache";
    db: sqlite3.Database;
    
    connect(dbDir: string, userLevel?: boolean): Q.Promise<void> {
        return Q.Promise((resolve, reject) => {
            if (! dbDir) {
                reject("Error. dbDir not defined");
            }
            this.db = new sqlite3.Database(path.resolve(dbDir, userLevel ? DbRepository.DB_NAME : DbRepository.DB_INIT_NAME), (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        })
    }

    closeDb(): Q.Promise<void> {
        return Q.Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            })
        })
    }

    run(sql: string, params: any[] = []): Q.Promise<void> {
        return Q.Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    getOne(sql: string, params: string[] = []): Q.Promise<KeyValuePair> {
        return Q.Promise((resolve, reject) => {
            this.db.get(sql, params, (err: Error, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(<KeyValuePair>result);
                }
            });
        });
    }
    
    getMany(sql: string, params: string[] = []): Q.Promise<KeyValuePair[]> {
        return Q.Promise((resolve, reject) => {
            this.db.all(sql, params, (err: Error, results: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(<KeyValuePair[]>results);
                }
            });
        });
    }
    
    getLength(): Q.Promise<number> {
        return this.selectAll()
        .then(results => {
            let size: number = 0;
            results.forEach(x => size += (<Buffer>x.value).length);
            return size;
        });
    }

    createTable(): Q.Promise<void> {
        return this.run("CREATE TABLE IF NOT EXISTS " + DbRepository.CACHE_TABLE + " (key TEXT UNIQUE, value BLOB)");
    }
    
    insert(key: string, value: string): Q.Promise<void> {
        let buffer = new Buffer(value, "binary");
        return this.run("INSERT OR IGNORE INTO " + DbRepository.CACHE_TABLE + " (key, value) VALUES(?, ?)", [key, buffer])
        .then(() => {
            return this.run("UPDATE " + DbRepository.CACHE_TABLE + " SET value = ? WHERE key = ?", [buffer, key]);
        })
    }
    
    delete(key: string): Q.Promise<void> {
        return this.run("DELETE FROM " + DbRepository.CACHE_TABLE + " WHERE key = ?", [key]);
    }
    
    select(key: string): Q.Promise<string> {
        return this.getOne("SELECT key, value FROM " + DbRepository.CACHE_TABLE + " WHERE key = ?", [key])
        .then(keyValue => {
            return keyValue ? (<Buffer>keyValue.value).toString("binary") : "";
        });
    }
    
    selectAll(): Q.Promise<KeyValuePair[]> {
        return this.getMany("SELECT key, value FROM " + DbRepository.CACHE_TABLE);
    }
    
    clear(): Q.Promise<void> {
        return this.run("DROP TABLE IF EXISTS " + DbRepository.CACHE_TABLE)
        .then(() => this.createTable());
    }
    
}
