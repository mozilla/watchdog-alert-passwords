const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");
const addon = require("self");
const pagemod = require("addon-kit/page-mod");
const PWM = require("passwordManager");

var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
var { XPCOMUtils, Services } = tmp;

pagemod.PageMod({
  include: ["about:passwords*", "file:///Users/shanec/moz/watchdog-alert-passwords/data/about_passwords.html*"],
  contentScriptFile: [addon.data.url("js/about_passwords_api.js")],
  contentScriptWhen: 'start',
  onAttach: function(worker) {
    worker.port.emit('data-url', addon.data.url());
    worker.port.on('ready', function() {
      worker.port.emit('password-info', PWM.getLoginMetaInfo());
    });
  }
});


//----- about:passwords implementation
const AboutPasswordsUUID = components.ID("{6e45e722-d5eb-ed40-a3b8-f4f6fff464b9}");
const AboutPasswordsContract = "@mozilla.org/network/protocol/about;1?what=passwords";
let AboutPasswordsFactory = {
  createInstance: function(outer, iid) {
    if (outer != null) throw Cr.NS_ERROR_NO_AGGREGATION;
    return AboutPasswords.QueryInterface(iid);
  }
};
let AboutPasswords = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel(addon.data.url("about_passwords.html"), null, null);
    channel.originalURI = aURI;
    return channel;
  }
};


Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
  AboutPasswordsUUID, "About Passwords", AboutPasswordsContract, AboutPasswordsFactory
);

//unloaders.push(function() {
//  Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
//    AboutPasswordsUUID, AboutPasswordsFactory
//  );
//});

//----- end about:passwords (but see ComponentRegistrar call in startup())

