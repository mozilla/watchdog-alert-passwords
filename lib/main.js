const {Cc,Ci,Cu} = require("chrome");

const dataDir = require("self").data;
const unload = require("unload");
const observers = require("observer-service");
const pagemod = require("page-mod");
const url = require("url");

let unloaders = [];

var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
var { Services } = tmp;


function windowInit(win) {
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  // Load stylesheet with icons for our notification popups
  let uri = require("self").data.url("css/global-overlay.css");
  let document = win.document;
  let pi = document.createProcessingInstruction("xml-stylesheet", "href=\"" + uri + "\" type=\"text/css\"");
  document.insertBefore(pi, document.firstChild);
  
  // add an icon we can attach our notification popups to
  let noticons = document.getElementById("notification-popup-box");
  let icon = document.createElementNS(XUL_NS, "image");
  icon.setAttribute('id', "watchdog-password-icon");
  icon.setAttribute('class', "notification-anchor-icon");
  icon.setAttribute('role', "button");
  noticons.appendChild(icon);
}

exports.main = function(options, callbacks) {
  unload.when(shutdown);

  /* We use winWatcher to create an instance per window (current and future) */
  let iter = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator("navigator:browser");
  while (iter.hasMoreElements()) {
    let aWindow = iter.getNext().QueryInterface(Ci.nsIDOMWindow);
    windowInit(aWindow);
  }

  function winWatcher(subject, topic) {
    if (topic != "domwindowopened") return;
    subject.addEventListener("load", function() {
      subject.removeEventListener("load", arguments.callee, false);
      let doc = subject.document.documentElement;
      if (doc.getAttribute("windowtype") == "navigator:browser") {
        windowInit(subject);
      }
    }, false);
  }
  Services.ww.registerNotification(winWatcher);
  unloaders.push(function() Services.ww.unregisterNotification(winWatcher));

  // initialize our various modules
  require('./about.js').init(unloaders);
  require('./passwordValidator.js').init(unloaders);
  require('./password_pane_manager').init(unloaders);
  var { unsecuredLoginManager } = require('unsecuredLogin');
  unsecuredLoginManager.init();
}

function shutdown(reason) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) {
    if (unload) {
      try {
        unload();
      } catch(ex) {
        console.error("unloader failed:", ex, ex.stack);
      }
    }
  });
}

console.log("Watchdog started.");