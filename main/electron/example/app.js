var electron = require("electron");
var path = require("path");
var fs = require("fs");
var app = electron.app;
var win;

app.on("window-all-closed", function() {
    if (process.platform != "darwin") {
        app.quit();
    }
});

function normal() {
    app.on("ready", function() {
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "example.html"));
        win.webContents.openDevTools();
    });
}


function test_showInactive() {
    app.on("ready", function() {
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "example.html"));
        win.webContents.openDevTools();
        
        console.log("Wait 5s to open inactive window");
        setTimeout(function() {
            win2 = new electron.BrowserWindow({
                show: false,
                parent: win
            });
            win2.loadURL("file://" + path.resolve(__dirname, "example.html"));
            win2.showInactive();
        }, 5000);
    });
}

function test_privmx_chat() {
    app.on("ready", function() {
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "privmx-chat/iframe.html"));
    });
}

function test_absolute_table_perf() {
    app.on("ready", function() {
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "absolute-table/index.html"));
    });
}

function test_ipc() {
    app.on("ready", function() {
        var objectMap = require("./ipc-test/ObjectMap");
        var Manager = require("./ipc-test/Test").Manager;
        objectMap.set("manager", new Manager());
        
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "ipc-test/index.html"));
        win.webContents.openDevTools();
    });
}

function test_main_thread_freeze() {
    app.on("ready", function() {
        let delay = (x) => {
            return new Promise((resolve, reject) => {
                setTimeout(resolve, x);
            });
        }
        let freeze = () => {
            console.log("Receiving test event");
            let i = 0;
            let next = () => {
                if (i > 100000) {
                    return;
                }
                return Promise.resolve().then(() => {
                    fs.readFileSync("/home/lukas/.ssh/config");
                    i++;
                    if (i % 100 == 0) {
                        return delay(1).then(next);
                    }
                    return next();
                });
            };
            next().then(() => console.log("The end"));
        };
        electron.ipcMain.on("test", (event, arg) => {
            freeze();
        });
        //setTimeout(() => freeze(), 3000);
        win = new electron.BrowserWindow({
            show: true
        });
        win.loadURL("file://" + path.resolve(__dirname, "freeze-test/index.html"));
        //win.webContents.openDevTools();
    });
}

//normal();
//test_showInactive();
//test_privmx_chat();
//test_absolute_table_perf();
//test_ipc();
test_main_thread_freeze();
