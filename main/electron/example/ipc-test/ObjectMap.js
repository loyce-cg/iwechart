function ObjectMap() {
    this.map = {};
}

ObjectMap.prototype.get = function(id) {
    return this.map[id];
}

ObjectMap.prototype.set = function(id, value) {
    this.map[id] = value;
}

module.exports = new ObjectMap();