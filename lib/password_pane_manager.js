const {Cc,Ci,Cu} = require("chrome");

const contextMenu = require("context-menu");
const dataDir = require("self").data;
const tabs = require("tabs");

const passwordManager = require('passwordManager');

function typePasswordHandler(msg) {
    if (msg.type == 'typePassword') {
        // XXX this needs to be much more robust, we need to set focus to the
        // next form field, etc.
        tabs.activeTab.attach({
            contentScript:
                "document.getElementsByName('"+msg.data.pwField+"')[0].value = '" + msg.password + "';"+
                "document.getElementsByName('"+msg.data.verify+"')[0].value = '" + msg.password + "';"
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
                if (pwFields[0].element.value) {
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
                exports.passwordGenerator.port.emit('passwordMetadata', data);
                exports.passwordGenerator.show();
            }
        }
    });
}
