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
    else if (msg.type == 'savePassword') {
        // Don't actually save the password. Need to figure out heuristics for extracting usernames from the form, etc.
        
        return;
        
        // FIXME:
        // newLoginInfo['formSubmitURL']
        // newLoginInfo['usernameField']
        // newLoginInfo['username']
        // newLoginInfo['httpRealm']
        
        var loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        var newLoginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);
        
        console.log("host: " + msg.metadata.host);
        
        newLoginInfo['password'] = msg.password;
        newLoginInfo['hostname'] = msg.metadata.host;
        newLoginInfo['passwordField'] = msg.metadata.input_name;
        
        // TODO: Update login if one already exists.
        
        loginManager.addLogin(newLoginInfo);
    }
}


var passwordGeneratorPane = require("panel").Panel({
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


var passGenerator = contextMenu.Item({
    label: 'Generate New Password',
    context: contextMenu.SelectorContext('input[type="password"]'),
    contentScript: "self.on('click',function(node) { self.postMessage({'type':'contextmenuclick','url':window.location.href,'host':window.location.host,'form_submit':window.location.href,'input_name': node.name });});",
    image: dataDir.url("lock_blue.png"),
    onMessage: function(msg) {
        passwordGeneratorPane.port.emit('passwordMetadata', msg);
        passwordGeneratorPane.show();
    }
});