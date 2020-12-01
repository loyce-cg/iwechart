<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="cache-control" content="public, no-cache" />
    <title>PrivMX Subidentity Example Page</title>
    <style>
      label {
        display: block;
      }
      textarea {
        width: 450px;
        height: 100px;
      }
      input[type=text] {
        width: 450px;
      }
      .buttons {
        margin-top: 10px;
      }
    </style>
    <script type="text/javascript" src="../build/privmx-core-light.js"></script>
  </head>
  <body>
    <h3>PrivMX Subidentity Example Page</h3>
    <div>
      <label for="mnemonic">Sub identity mnemonic</label>
      <textarea id="mnemonic"></textarea>
    </div>
    <div>
      <label for="deviceid">Device ID</label>
      <input type="text" id="deviceid" value="1234"/>
    </div>
    <div>
      <label for="devicename">Device name</label>
      <input type="text" id="devicename" value="Your browser" />
    </div>
    <div class="buttons">
      <button id="login">Login</button>
      <button id="assign">Assign device</button>
    </div>
    <hr />
    <ul id="result">
    </ul>
    <script type="text/javascript">
      var privmxCore = privmxCoreRequire("privmx-core");
      var result = document.getElementById("result");
      function log(message, data) {
        console.log(message, data);
        var li = document.createElement("li");
        li.innerText = message;
        result.appendChild(li);
      }
      privmxCore.Logger.get("privfs-client.gateway.RpcGateway").setLevel(privmxCore.Logger.DEBUG);
      document.getElementById("login").addEventListener("click", function() {
        var mnemonic = document.getElementById("mnemonic").value;
        if (!mnemonic) {
          log("Mnemonic is required");
          return;
        }
        var deviceId = document.getElementById("deviceid").value;
        if (!deviceId) {
          log("Device ID is required");
          return;
        }
        var service = new privmxCore.SubidentityLoginService();
        log("Login in...");
        service.login(document.location.hostname, mnemonic, deviceId).then(function(result) {
          log("Logged!", result);
          log("Logged as " + (result.identity ? result.identity.hashmail : "<unknown>"));
          log("Subaccount shares access to section " + result.section.getId() + " " + result.section.getName());
          //Listing files
          if (result.section.isFileModuleEnabled()) {
            //Load files using fileSystem
            result.section.getFileSystem().then(function(fs) {
              fs.list("/").then(function(entries) {
                log("Files/dirs in root dir: " + entries.length);
                entries.forEach(function(entry) {
                  log("/" + entry.name + " is " + entry.type + " (refId: " + entry.ref.id + ")");
                });
              });
            });
            //Load files using fileTree
            result.section.getFileTree().then(function(tree) {
              return tree.refreshDeep(true).then(function() {
                log("Files/dirs from tree", tree.collection.size());
                tree.collection.forEach(function(entry) {
                  log(entry.path + " is " + entry.type + " (refId: " + entry.ref.id + ") (modifier: " + entry.meta.modifier + ")");
                });
              });
            })
          }
          //Listing messages and polling
          if (result.section.isChatModuleEnabled()) {
            result.section.getChatSinkIndex().then(function(sinkIndex) {
              log("Loaded messages in chat", sinkIndex.entries.size());
              sinkIndex.entries.forEach(function(entry) {
                var msg = entry.getMessage();
                log("Message " + entry.id + " " + msg.type + ", sender: " + msg.sender.hashmail + ", text: " + msg.text);
              });
              //On new message
              sinkIndex.entries.changeEvent.add(function(event) {
                if (event.type == "add") {
                  var entry = event.element;
                  var msg = entry.getMessage();
                  log("Added Message " + entry.id + " " + msg.type + ", sender: " + msg.sender.hashmail + ", text: " + msg.text);
                }
              });
              //Turn on polling
              result.privmxRegistry.getSinkIndexManager().then(function(sinkIndexManager) {
                sinkIndexManager.startSinkPolling();
              })
            })
          }
        })
        .fail(function(e) {
          log("Error " + (e ? (e.message || e.msg || e) : ""), e);
        });
      });
      document.getElementById("assign").addEventListener("click", function() {
        var mnemonic = document.getElementById("mnemonic").value;
        if (!mnemonic) {
          log("Mnemonic is required");
          return;
        }
        var deviceId = document.getElementById("deviceid").value;
        if (!deviceId) {
          log("Device ID is required");
          return;
        }
        var deviceName = document.getElementById("devicename").value;
        if (!deviceName) {
          log("Device name is required");
          return;
        }
        var service = new privmxCore.SubidentityLoginService();
        log("Assigning...");
        service.assignDeviceToSubidentity(document.location.hostname, mnemonic, deviceId, deviceName).then(function(result) {
          log("Device ID assigned to subaccount!", result);
        })
        .fail(function(e) {
          log("Error " + (e ? (e.message || e.msg || e) : ""), e);
        });
      });
    </script>
  </body>
</html>