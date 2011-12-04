const {Cc,Ci,Cu} = require("chrome");

const contextMenu = require("context-menu");
const dataDir = require("self").data;
const tabs = require("tabs");

const passwordManager = require('passwordManager');

var passwordPane = require("panel").Panel({
    contentURL: dataDir.url("password_pane.html"),
    contentScriptFile: [
      dataDir.url("js/jquery-1.6.2.min.js"),
      dataDir.url("js/util.js"),
      dataDir.url("js/password_pane.js")],
    width: 500,
    height: 500,
    contentScriptWhen: 'ready',
    onMessage: function(msg) {
        if (msg.type == 'typePassword') {
            tabs.activeTab.attach({
                contentScript: "if (document.activeElement.type == 'password') document.activeElement.value = '" + msg.password + "';"
            });
            passwordPane.hide();
        }
    }
});

var trackerMenu = contextMenu.Item({
    label: 'Choose New Password',
    context: contextMenu.SelectorContext('input[type="password"]'),
    contentScript: "self.on('click',function() { self.postMessage({'type':'contextmenuclick','url':window.location.href});});",
    image: dataDir.url("lock_blue.png"),
    onMessage: function(e) {
        var loginTable = passwordManager.getLoginsTable();
        passwordPane.show();
        passwordPane.port.emit('loginData', {
            loginTable: loginTable,
            url: e.url
        });
    }
});