const {Cc,Ci,Cu} = require("chrome");

const contextMenu = require("sdk/context-menu");
const dataDir = require("sdk/self").data;
const tabs = require("sdk/tabs");

const passwordManager = require('passwordManager');


let passwordGenerator = require("sdk/panel").Panel({
        contentURL: dataDir.url('password_generator.html'),
        contentScriptFile: [
            dataDir.url("js/jquery-1.11.0.min.js"),
            dataDir.url("js/util.js"),
            dataDir.url("js/password_generator.js")],
        width: 350,
        height: 200,
        contentScriptWhen: 'ready',
        onHide: function() {
            let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
            let window = wm.getMostRecentWindow("navigator:browser");
            window.PopupNotifications.iconBox.hidden=true;
            window.PopupNotifications.iconBox.setAttribute("anchorid", "");
        },
        onShow: function() {
        }
    });
passwordGenerator.showPopup = function(anchorId, data) {
    this.port.emit('passwordMetadata', data);
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    let window = wm.getMostRecentWindow("navigator:browser");
    let anchor = window.document.getElementById("watchdog-password-generate-icon");
    window.PopupNotifications.iconBox.hidden=false;
    window.PopupNotifications.iconBox.setAttribute("anchorid", "watchdog-password-generate-icon");
    this.show(anchor);
}
passwordGenerator.port.on('typePassword', function(msg) {
    let cs = "document.getElementsByName('"+msg.data.pwField+"')[0].value = '" + msg.password + "';";
    if (msg.data.verify) {
        cs += "document.getElementsByName('"+msg.data.verify+"')[0].value = '" + msg.password + "';";
    }
    tabs.activeTab.attach({ contentScript: cs });
    passwordGenerator.hide();
});
passwordGenerator.port.on('checkPasswordStrength', function(msg) {
    let { checkPassword } = require("passwordValidator");
    let strength = checkPassword(msg.password);
    passwordGenerator.port.emit('passwordStrength', {strength: strength});
});

exports.passwordGenerator = passwordGenerator;

exports.init = function(unloaders) {
    var passGenerator = contextMenu.Item({
        label: 'Generate New Password',
        context: contextMenu.SelectorContext('input[type="password"]'),
        contentScript: "self.on('click',function(node) { self.postMessage({'type': 'watchdog-password-entry', 'name' : node.form.name, 'id': node.form.id})});",
        image: dataDir.url("css/lock_blue.png"),
        onMessage: function(msg) {
            if (msg.type == 'watchdog-password-entry') {
                console.log("got "+JSON.stringify(msg));
                // we got to get the form from the current document, get the
                // password fields so we can enter the password into the
                // verify-password field if it exists
                let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
                let window = wm.getMostRecentWindow("navigator:browser");
                let gBrowser = window.gBrowser;
                let form;
                if (msg.name)
                    form = gBrowser.contentDocument.getElementsByName(msg.name)[0];
                else if (msg.id)
                    form = gBrowser.contentDocument.getElementById(msg.id);
                else // can't really do anything
                    return;
                let { unsecuredLoginManager } = require('unsecuredLogin');
                let pwFields = unsecuredLoginManager.getPasswordFields(form, false);
                let field, verify;
                if (pwFields.length == 3) {
                  field = pwFields[1];
                  verify = pwFields[2];
                } else
                if (pwFields[0].element.value && pwFields[1]) {
                  field = pwFields[1];
                } else {
                  field = pwFields[0];
                  verify = pwFields[1];
                }

                let data = {
                  name: form.name,
                  action: form.action || form.baseURI,
                  pwField: field.element.name,
                  verify: verify && verify.element.name
                };
                console.log("sending "+JSON.stringify(data));
                passwordGenerator.showPopup("watchdog-password-generate-icon", data);
            }
        }
    });
}
