const {Cc,Ci,Cu} = require("chrome");

const contextMenu = require("context-menu");
const dataDir = require("self").data;
const tabs = require("tabs");

const passwordManager = require('passwordManager');

function typePasswordHandler(msg) {
    if (msg.type == 'typePassword') {
        tabs.activeTab.attach({
            contentScript: "if (document.activeElement.type == 'password') document.activeElement.value = '" + msg.password + "';"
        });
        this.hide();
    }
}

exports.passwordGenerator = require("panel").Panel({
        contentURL: dataDir.url('password_generator.html'),
        contentScriptFile: [
            dataDir.url("js/jquery-1.6.2.min.js"),
            dataDir.url("js/util.js"),
            dataDir.url("js/password_generator.js")],
        width: 500,
        height: 500,
        contentScriptWhen: 'ready',
        onMessage: typePasswordHandler
    });

exports.init = function(unloaders) {
    var passGenerator = contextMenu.Item({
        label: 'Generate New Password',
        context: contextMenu.SelectorContext('input[type="password"]'),
        contentScript: "self.on('click',function(node) { self.postMessage({'type':'contextmenuclick','url':window.location.href,'host':window.location.host,'form_submit':window.location.href,'input_name': node.name });});",
        image: dataDir.url("css/lock_blue.png"),
        onMessage: function(msg) {
            exports.passwordGenerator.port.emit('passwordMetadata', msg);
            exports.passwordGenerator.show();
        }
    });
}
