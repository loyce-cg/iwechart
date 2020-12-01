function SomeObj() {
    this.id = Math.random();
    this.text = this.id + "ble ble";
}

SomeObj.prototype.method1 = function() {
    this.id += 1;
    //console.log("SomeObj.method1", this.id);
}

SomeObj.prototype.method2 = function() {
    console.log("SomeObj.method2", this.id);
}

SomeObj.prototype.method3 = function() {
    console.log("SomeObj.method3", this.id);
}

SomeObj.prototype.method4 = function() {
    console.log("SomeObj.method4", this.id);
}

SomeObj.prototype.method5 = function() {
    console.log("SomeObj.method5", this.id);
}

SomeObj.prototype.method6 = function() {
    console.log("SomeObj.method6", this.id);
}

function Manager() {
    this.id = Math.random();
    this.list = [];
    for (var i = 0; i < 1000; i++) {
        this.list.push(new SomeObj());
    }
}

Manager.prototype.method1 = function() {
    console.log("Manager.method1", this.id);
}

Manager.prototype.method2 = function() {
    console.log("Manager.method2", this.id);
}

Manager.prototype.method3 = function() {
    console.log("Manager.method3", this.id);
}

module.exports = {
    Manager: Manager,
    SomeObj: SomeObj
}