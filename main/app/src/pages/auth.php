<?php
$assets = "../app/";
$dir = __DIR__ . "/../app";
if (file_exists($dir)) {
  $files = scandir($dir);
  foreach ($files as $file) {
    if (strpos($file, "20") === 0) {
      $assets = "../app/" . $file . "/";
      break;
    }
  }
}
?>
<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="cache-control" content="public, no-cache" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PrivMX Auth</title>
    <link href="<?= $assets ?>themes/default/css/fonts.css" media="all" rel="stylesheet" />
    <link href="<?= $assets ?>themes/default/css/font-awesome.min.css" media="all" rel="stylesheet" />
    <link rel="shortcut icon" href="<?= $assets ?>favicon.ico" />
    <style>
      * {
        box-sizing: border-box;
        font-family: source_sans_pro, arial, sans-serif;
      }
      html, body {
        height: 100%;
        min-height: 450px;
        margin: 0;
        padding: 0;
        position: relative;
      }
      body {
        background: linear-gradient(45deg, #2caedd 0%, rgba(216, 240, 248, 0) 70%), linear-gradient(135deg, #ffea75 10%, rgba(255, 234, 117, 0) 80%), linear-gradient(225deg, #b8f9cf 10%, rgba(249, 251, 249, 0) 80%), linear-gradient(315deg, #101f23 100%, rgba(16, 31, 35, 0) 70%);
      }
      .login-form {
        position: absolute;
        left: 0;
        top: 50%;
        margin-top: -215px;
        width: 100%;
        background-color: #fff;
        border-radius: 5px;
        padding: 30px;
      }
      @media (min-width: 500px) {
        .login-form  {
          left: 50%;
          width: 478px;
          margin-left: -239px;
        }
      }
      .logotype-container {
        padding-top: 15px;
        text-align: center;
        line-height: 0;
      }
      .lf-header {
        padding-top: 15px;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
      }
      .error {
        color: #f00;
        padding: 15px 0;
        text-align: center;
      }
      .holder {
        position: relative;
        margin-bottom: 20px;
      }
      .holder > span {
        position: absolute;
        top: 0;
        left: 0;
        width: 38px;
        height: 100%;
        text-align: center;
      }
      .holder > span:before {
        padding-top: 13px;
        display: inline-block;
        vertical-align: top;
        font-size: 13px;
      }
      .holder > span.ico-lock::before {
        font-size: 16px;
        padding-top: 12px;
      }
      input {
        display: block;
        width: 100%;
        height: 34px;
        padding: 6px 12px;
        line-height: 1.42857143;
        background-color: #fff;
        background-image: none;
        border: 1px solid #ccc;
        border-radius: 4px;
        -webkit-box-shadow: inset 0 1px 1px rgba(0,0,0,0.075);
        box-shadow: inset 0 1px 1px rgba(0,0,0,0.075);
        -webkit-transition: border-color ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
        -o-transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s;
        transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s;
        color: #1f2223;
        height: 40px;
        padding-left: 38px;
        padding-top: 8px;
        font-size: 13px;
        font-weight: 600;
        font-family: source_code_pro, arial, sans-serif;
        width: 100%;
        -webkit-appearance: none;
      }
      input::placeholder {
        color: #ccc;
        opacity: 1;
        font-weight: normal;
      }
      input:focus {
        border-color: #66afe9;
        outline: 0;
        -webkit-box-shadow: inset 0 1px 1px rgba(0,0,0,.075), 0 0 8px rgba(102, 175, 233, 0.6);
        box-shadow: inset 0 1px 1px rgba(0,0,0,.075), 0 0 8px rgba(102, 175, 233, 0.6);
      }
      input[disabled] {
        cursor: not-allowed;
        background-color: #eee;
      }
      button {
        text-align: center;
        vertical-align: middle;
        margin-bottom: 0;
        touch-action: manipulation;
        background-image: none;
        border: 1px solid transparent;
        white-space: nowrap;
        -moz-user-select: none;
        text-shadow: 0 -1px 0 rgba(0,0,0,0.2);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15),0 1px 1px rgba(0,0,0,0.075);
        -webkit-appearance: button;
        text-transform: none;
        color: #fff;
        border-color: #2e6da4;
        border-radius: 6px;
        display: block;
        width: 100%;
        border-width: 0;
        cursor: pointer;
        text-decoration: none;
        font-weight: bold;
        background-color: #1b404b;
        margin-top: 30px;
        height: 40px;
        line-height: 40px;
        padding: 0 16px;
        font-size: 14px;
      }
      button[disabled] {
        cursor: not-allowed;
        opacity: .65;
      }
      button:focus {
        outline: none;
      }
      button::-moz-focus-inner {
        border: 0;
      }
      button i {
        margin-right: 5px;
      }
      .hide {
        display: none;
      }
    </style>
    <script type="text/javascript" src="../server/secure-form/assets.php?f=privmx-client"></script>
  </head>
  <body>
    <div class="login-form">
      <div class="logotype-container">
        <img src="<?= $assets ?>themes/default/images/logotype.png" />
      </div>
      <div class="lf-header">PrivMX Authorization</div>
      <div id="error" class="error"></div>
      <div class="holder">
        <span class="ico-hash"></span>
        <input type="text" id="username" value="" placeholder="username" />
      </div>
      <div class="holder">
        <span class="ico-lock"></span>
        <input type="password" id="password" value="" placeholder="password" />
      </div>
      <div class="buttons">
        <button id="login">
          <i id="icon" class="hide"></i>
          Autoryzuj się
        </button>
      </div>
    </div>
    <script type="text/javascript">
      // Serialization
      function jsonFromHex(hex) {
        try {
          return JSON.parse(hexToString(hex));
        }
        catch (e) {
          return null;
        }
      }
      function jsonToHex(data) {
        return stringToHex(JSON.stringify(data));
      }
      function hexToString(hex) {
        let array = new Uint8Array(hex.length / 2);
        for (var i = 0; i < hex.length; i += 2) {
          array[i / 2] =  parseInt(hex[i] + hex[i + 1], 16);
        }
        return new TextDecoder("utf-8").decode(array);
      }
      function stringToHex(str) {
        var data = new Uint8Array(new TextEncoder().encode(str));
        var result = "";
        for (var i = 0; i < data.length; i++) {
          var x = data[i].toString(16);
          result += (x.length == 1 ? "0" : "") + x;
        }
        return result;
      }
      
      function generateDeviceId() {
        var array = new Uint8Array(10);
        if (window.crypto && window.crypto.getRandomValues) {
          window.crypto.getRandomValues(array);
        }
        else {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
        }
        var str = "";
        for (var i = 0; i < array.length; i++) {
          str += array[i].toString(16);
        }
        return str;
      }
      
      //===============
      
      if (!window.privmx) {
        alert("PrivMX not present!");
        throw new Error("PrivMX not present");
      }
      var pmx = privmx.privmx;
      var Buffer = privmx.privmx.Buffer.Buffer;
      var query = {};
      location.search.substr(1).split("&").forEach(function(x) {
        var s = x.split("=");
        query[s[0]] = s[1];
      });
      var params = query.auth ? jsonFromHex(query.auth) : null;
      if (!params) {
        alert("Niepoprawne wejściowe dane autoryzacyjne");
        location = "../";
      }
      let deviceId = window.localStorage.getItem("privmx-device-id");
      if (!deviceId) {
          deviceId = this.generateDeviceId();
          window.localStorage.setItem("privmx-device-id", deviceId);
      }
      pmx.core.PrivFsRpcManager.setAgent("externalauth;1.0.1");
      pmx.core.PrivFsRpcManager.setGatewayProperties({
          appVersion: "externalauth@1.0.1",
          sysVersion: navigator.userAgent,
          deviceId: deviceId
      });
      var icon = document.getElementById("icon");
      var error = document.getElementById("error");
      var usernameField = document.getElementById("username");
      var passwordField = document.getElementById("password");
      var loginButton = document.getElementById("login");
      loginButton.addEventListener("click", login);
      usernameField.addEventListener("keydown", loginOnEnter);
      passwordField.addEventListener("keydown", loginOnEnter);
      usernameField.focus();
      function loginOnEnter(e) {
        if (e.keyCode == 13) {
          login();
        }
      }
      function login() {
        var username = usernameField.value;
        if (!username) {
          alert("Username is required");
          return;
        }
        var password = passwordField.value;
        if (!password) {
          alert("Password required");
          return;
        }
        //prepare view
        error.innerHTML = "";
        icon.setAttribute("class", "fa fa-circle-o-notch fa-spin");
        usernameField.disabled = true;
        passwordField.disabled = true;
        loginButton.disabled = true;
        
        var hashmail = new pmx.identity.Hashmail(username.indexOf("#") == -1 ? username + "#" + location.hostname : username);
        pmx.core.PrivFsRpcManager.getHttpSrpByHost(hashmail.host).then(function(srp) {
          srp.additionalLoginStepCallback = function(basicLoginResult, data) {
            if (!data || data.reason != "twofa") {
              throw new Error("Cannot login. There is no additional login step handler for given data " + JSON.stringify(data));
            }
            return new Promise(function(resolve, reject) {
              var tryCode = function(msg) {
                var code = prompt(msg).replace(/\s/g, "");
                if (!code) {
                  reject("additional-login-step-cancel");
                  return;
                }
                basicLoginResult.srpSecure.gateway.request("twofaChallenge", {code: code, rememberDeviceId: false}).then(resolve, function(e) {
                  if (e && e.data && e.data.error && e.data.error.code == 0x7007) {
                    tryCode("Invalid 2FA code, please type valid one");
                  }
                  else {
                    reject(e);
                  }
                });
              }
              tryCode("2FA code");
            });
          };
          return srp.login(hashmail.user, hashmail.host, password, false, true);
        })
        .then(function(lResult) {
          return lResult.srpSecure.request("externalAuth", params);
        })
        .then(function(aResult) {
          let url = aResult.url + "?auth=" + jsonToHex({
            ticketId: params.ticketId,
            username: aResult.username,
            hash: aResult.hash
          });
          location = url;
        })
        .fail(function(e) {
          console.log("Error", e, e ? e.stack : null);
          if (e == "Connection Broken (processMessage - got ALERT: User doesn't exist)" || e == "Connection Broken (processMessage - got ALERT: Different M1)") {
            error.innerHTML = "Niepoprawne dane logownia";
          }
          else if (e && e.msg) {
            var er = e && e.data && e.data.error;
            error.innerHTML = e.msg + (er && er.code ? " (e" + er.code + (er.code == 31 && er.data ? " " + er.data : "") + ")" : "");
          }
          else {
            error.innerHTML = "Niespodziewany błąd";
          }
        })
        .fin(function() {
          icon.setAttribute("class", "hide");
          usernameField.disabled = false;
          passwordField.disabled = false;
          loginButton.disabled = false;
        });
      }
    </script>
  </body>
</html>