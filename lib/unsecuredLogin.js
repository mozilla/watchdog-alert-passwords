const {Cc,Ci,Cu} = require("chrome");
const dataDir = require("self").data;

var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
var { XPCOMUtils, Services } = tmp;

// Detect any form submittal, examine the form for a password.  If there
// is one, check whether the target is on https or not.  if not, warn the
// user with a modal dialog first, allow them to cancel the transaction

// Much of this code is taken from
// https://mxr.mozilla.org/mozilla-central/source/toolkit/components/passwordmgr/nsLoginManager.js

const passwordManager = require('passwordManager');


var secureLoginChecker = {

    /* ---------- private memebers ---------- */
    _prefBranch  : null, // Preferences service
    _nsLoginInfo : null, // Constructor for nsILoginInfo implementation


    /*
     * init
     *
     * Initialize the Login Manager. Automatically called when service
     * is created.
     *
     * Note: Service created in /browser/base/content/browser.js,
     *       delayedStartup()
     */
    init : function () {
        this.loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

        // Preferences. Add observer so we get notified of changes.
        this._prefBranch = Services.prefs.getBranch("watchdog.securelogin.");
        this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);

        // Cache references to current |this| in utility objects
        this._observer._pwmgr            = this;

        // Get constructor for nsILoginInfo
        this._nsLoginInfo = new Components.Constructor(
            "@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo);

        // Form submit observer checks forms for new logins and pw changes.
        Services.obs.addObserver(this._observer, "earlyformsubmit", false);
        Services.obs.addObserver(this._observer, "xpcom-shutdown", false);
        Services.obs.addObserver(this._observer, 'document-element-inserted', false);
        Services.obs.addObserver(this._observer, 'passwordmgr-storage-changed', false);
    },



    /* ---------- Utility objects ---------- */


    /*
     * _observer object
     *
     * Internal utility object, implements the nsIObserver interface.
     * Used to receive notification for: form submission, preference changes.
     */
    _observer : {
        _pwmgr : null,

        QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver,
                                                Ci.nsIFormSubmitObserver,
                                                Ci.nsISupportsWeakReference]),


        // nsFormSubmitObserver
        notify : function (formElement, aWindow, actionURI, cancelSubmit) {
            //console.log("observer notified for form submission.");

            // We're invoked before the content's |onsubmit| handlers, so we
            // can grab form data before it might be modified (see bug 257781).

            try {
                // if the user cancels in any of our notifications, stop
                // the login from happening
                this._pwmgr._onFormSubmit(formElement, cancelSubmit);
            } catch (e) {
                console.log("Caught error in onFormSubmit: " + e);
            }
        },

        // nsObserver
        observe : function (subject, topic, data) {
            if (topic == "document-element-inserted") {
              if (!subject.defaultView) return;
              //console.log("got document "+subject.defaultView.document.location);
              try {
                // we have a new document, issue our warnings
                this._pwmgr._newDocument(subject.defaultView)
              } catch(e) {
                console.log(e);
              }
            } else
            if (topic == "passwordmgr-storage-changed") {
              this._pwmgr.__loginData = null;
            } else
            if (topic == "xpcom-shutdown") {
                for (let i in this._pwmgr) {
                  try {
                    this._pwmgr[i] = null;
                  } catch(ex) {}
                }
                this._pwmgr = null;
            } else {
                console.log("Oops! Unexpected notification: " + topic);
            }
        }
    },

    /*
     * _getPasswordFields
     *
     * Returns an array of password field elements for the specified form.
     * If no pw fields are found, or if more than 3 are found, then null
     * is returned.
     *
     * skipEmptyFields can be set to ignore password fields with no value.
     */
    _getPasswordFields : function (form, skipEmptyFields) {
        // Locate the password fields in the form.
        var pwFields = [];
        for (var i = 0; i < form.elements.length; i++) {
            var element = form.elements[i];
            if (!(element instanceof Ci.nsIDOMHTMLInputElement) ||
                element.type != "password")
                continue;

            if (skipEmptyFields && !element.value)
                continue;

            pwFields[pwFields.length] = {
                                            index   : i,
                                            element : element
                                        };
        }

        // If too few or too many fields, bail out.
        if (pwFields.length == 0) {
            //console.log("(form ignored -- no password fields.)");
            return null;
        } else if (pwFields.length > 3) {
            console.log("(form ignored -- too many password fields. [got " +
                        pwFields.length + "])");
            return null;
        }

        return pwFields;
    },


    /*
     * _getFormFields
     *
     * Returns the username and password fields found in the form.
     * Can handle complex forms by trying to figure out what the
     * relevant fields are.
     *
     * Returns: [usernameField, newPasswordField, oldPasswordField]
     *
     * usernameField may be null.
     * newPasswordField will always be non-null.
     * oldPasswordField may be null. If null, newPasswordField is just
     * "theLoginField". If not null, the form is apparently a
     * change-password field, with oldPasswordField containing the password
     * that is being changed.
     */
    _getFormFields : function (form, isSubmission) {
        var usernameField = null;

        // Locate the password field(s) in the form. Up to 3 supported.
        // If there's no password field, there's nothing for us to do.
        var pwFields = this._getPasswordFields(form, isSubmission);
        if (!pwFields)
            return [null, null, null];


        // Locate the username field in the form by searching backwards
        // from the first passwordfield, assume the first text field is the
        // username. We might not find a username field if the user is
        // already logged in to the site.
        for (var i = pwFields[0].index - 1; i >= 0; i--) {
            var element = form.elements[i];
            var fieldType = (element.hasAttribute("type") ?
                             element.getAttribute("type").toLowerCase() :
                             element.type);
            if (fieldType == "text"  ||
                fieldType == "email" ||
                fieldType == "url"   ||
                fieldType == "tel"   ||
                fieldType == "number") {
                usernameField = element;
                break;
            }
        }

        if (!usernameField)
            console.log("(form -- no username field found)");


        // If we're not submitting a form (it's a page load), there are no
        // password field values for us to use for identifying fields. So,
        // just assume the first password field is the one to be filled in.
        if (!isSubmission || pwFields.length == 1)
            return [usernameField, pwFields[0].element, null];


        // Try to figure out WTF is in the form based on the password values.
        var oldPasswordField, newPasswordField;
        var pw1 = pwFields[0].element.value;
        var pw2 = pwFields[1].element.value;
        var pw3 = (pwFields[2] ? pwFields[2].element.value : null);

        if (pwFields.length == 3) {
            // Look for two identical passwords, that's the new password

            if (pw1 == pw2 && pw2 == pw3) {
                // All 3 passwords the same? Weird! Treat as if 1 pw field.
                newPasswordField = pwFields[0].element;
                oldPasswordField = null;
            } else if (pw1 == pw2) {
                newPasswordField = pwFields[0].element;
                oldPasswordField = pwFields[2].element;
            } else if (pw2 == pw3) {
                oldPasswordField = pwFields[0].element;
                newPasswordField = pwFields[2].element;
            } else  if (pw1 == pw3) {
                // A bit odd, but could make sense with the right page layout.
                newPasswordField = pwFields[0].element;
                oldPasswordField = pwFields[1].element;
            } else {
                // We can't tell which of the 3 passwords should be saved.
                console.log("(form ignored -- all 3 pw fields differ)");
                return [null, null, null];
            }
        } else { // pwFields.length == 2
            if (pw1 == pw2) {
                // Treat as if 1 pw field
                newPasswordField = pwFields[0].element;
                oldPasswordField = null;
            } else {
                // Just assume that the 2nd password is the new password
                oldPasswordField = pwFields[0].element;
                newPasswordField = pwFields[1].element;
            }
        }

        return [usernameField, newPasswordField, oldPasswordField];
    },

    __loginData: null,
    get _loginData() {
      if (!this.__loginData)
        this.__loginData = passwordManager.getLoginMetaInfo();
      return this.__loginData
    },

    _newDocument: function(aWindow) {
      // XXX refactor this perhaps
        var hostname      = this._getPasswordOrigin(aWindow.top.document.documentURI);
        if (!hostname)
          return;
        var uri = Services.io.newURI(hostname, null, null);
        var host = uri.host;

        // Look for an existing login that matches the form login.
        var data = this._loginData;
        var count=0, strength=100, dups=0, similar=0, age=0;
        for (var h in data.logins) {
          var login = data.logins[h];
          if (login.hostname == hostname) {
            count++;
            dups = Math.max(dups, login.usedBy.length-1);
            similar = Math.max(similar, login.similarTo.length);
            age = Math.max(age, login.age);
            strength = Math.min(strength, login.strength);
          }
        }

        var xulWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                          .getInterface(Ci.nsIWebNavigation)
                          .QueryInterface(Ci.nsIDocShell)
                          .chromeEventHandler.ownerDocument.defaultView.wrappedJSObject;

        let gBrowser = xulWindow.gBrowser;
        if (!gBrowser)
          return;
        let _browser = gBrowser.getBrowserForDocument(aWindow.top.document);

        this.watchForAccountSetup(xulWindow, _browser);

        let nBox = gBrowser.getNotificationBox(_browser);
        if (nBox.getNotificationWithValue("watchdog-password-notification"))
          return;

        let msg = "";
        let level = nBox.PRIORITY_WARNING_MEDIUM;
        if (dups > 0) {
          msg = "Your password for this site is used on " + dups +
                " other sites. We recommend you change this password.";
          level = nBox.PRIORITY_CRITICAL_MEDIUM;
        }
        else if (strength < 50 ) {
          msg = "Your password for this site is weak. We recommend you change this password.";
          level = nBox.PRIORITY_CRITICAL_MEDIUM;
        }
        else if (age > 90) {
          msg = "You've been using this password on this website for over " +
                age + " days. We recommend you change this password.";
        }
        else if (similar > 0 ) {
          msg = "Your password for this site is similar to passwords you use on other sites.";
          level = nBox.PRIORITY_INFO_MEDIUM;
        }
        else {
          //console.log("no warning for "+host);
          //console.log("host: "+host+" s:"+strength+" d:"+dups+" s:"+similar+" age:"+age);
          return;
        }

        let self = this;
        let buttons = [
            {
            label: "learn more",
            accessKey: 'm',
            callback: function() {
                xulWindow.openUILinkIn("about:passwords?host="+host, "tab", null, null, null);;
            }
        },
        {
            label: "ignore these warnings",
            accessKey: 'i',
            callback: function() {
                self._prefBranch.setBoolPref(host+".ignore", true);
            }
        }];
        
        try {
          var ignore = this._prefBranch.getBoolPref(host+".ignore");
        } catch(e) {}
        if (!ignore)
          nBox.appendNotification(msg, "watchdog-password-notification",
                                  dataDir.url("css/security-medium.png"),
                                  level, buttons);

        var popup = xulWindow.PopupNotifications.show(_browser,"watchdog-password-notification",msg, "watchdog-password-icon", 
            // Possible feature: repo of URLs to redirect users to change their passwords at?
            {
                label: "Close",
                accessKey: 'c',
                callback: function(){
                    // FIXME: does it make sense to dismiss the alert right when the user clicks "okay"?
                }
            },
            buttons,
            {
                persistWhileVisible: true,
                dismissed: true, //ignore,
                eventCallback: function(event) {
                }
            });

        
    },
    
    watchForAccountSetup: function(xulWindow, browser) {
      let self = this;
      browser.addEventListener('load', function() {
        browser.removeEventListener('load', this, true);
        let document = browser.contentDocument;
        for (var i=0; i < document.forms.length; i++) {
          // Get the appropriate fields from the form.
          var pwFields = self._getPasswordFields(document.forms[i], false);
          if (!pwFields || pwFields.length < 2) {
            continue;
          }
          //console.log("  form has "+pwFields.length+" password fields ["+browser.contentWindow.location);
          self.installPasswordHandlers(xulWindow, browser, document.forms[i], pwFields);
        }
      }, true);
    },
    
    installPasswordHandlers: function(xulWindow, browser, form, pwFields) {
        // we have a form with at least two password fields.  We expect:
        // 1. new account
        //    two empty password fields, second is verify, watch the first
        // 2. update password
        //    3 fields
        //      first might be filled in already
        //      last is the verify field
        //      we'll watch the second field
        // 3. update password
        //    2 fields
        //      - if the first is filled in already, then they are not using a
        //        verify field, watch the first field
        //      - if both are emtpy, treat same as #1
        let passwordGenerator = require('./password_pane_manager').passwordGenerator;
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
        let nBox = xulWindow.gBrowser.getNotificationBox(browser);
        if (nBox.getNotificationWithValue("watchdog-password-generator-help"))
          return;
        
        field.element.addEventListener('focus', function () {

          let buttons = [
              {
              label: "Yes!",
              accessKey: 'y',
              callback: function() {
                // tell the password generator some details about the form
                // that we are working with
                let msg = {
                  name: form.name,
                  action: form.action || form.baseURI,
                  pwField: field.element.name,
                  verify: verify && verify.element.name
                };
                passwordGenerator.port.emit('passwordMetadata', msg);
                passwordGenerator.show();
              }
          },
          {
              label: "No, Don't ask again",
              accessKey: 'n',
              callback: function() {
              }
          }];
        
          nBox.appendNotification("It looks like you need a password, would you like help?",
                                  "watchdog-password-generator-help",
                                  dataDir.url("css/security-medium.png"),
                                  nBox.PRIORITY_WARNING_MEDIUM, buttons);
        });
    },

    /*
     * _onFormSubmit
     *
     * Called by the our observer when notified of a form submission.
     * [Note that this happens before any DOM onsubmit handlers are invoked.]
     * This verifies that passwords previously used on secure connections
     * are not used on insecure connections without the user knowing.
     */
    _onFormSubmit : function (form, cancelSubmit) {

        var doc = form.ownerDocument;
        var win = doc.defaultView;

        var hostname      = this._getPasswordOrigin(doc.documentURI);
        var uri = Services.io.newURI(hostname, null, null);
        var host = uri.host;
        // if this is on a secure connection, bail now
        if (this._getActionScheme(form) === 'https') {
            console.log("(form submission is secure for: " + host + ")");
            return;
        }
        try {
            // if the user previously choose to ignore security, let them go
            if (this._prefBranch.getBoolPref(host+".ignore")) {
                console.log("(user has opted-out of secure passwords for: " + host + ")");
                return;
            }
        } catch(e) {
            console.log("no pref for "+host+".ignore");
        }

        // Get the appropriate fields from the form.
        var [usernameField, newPasswordField, oldPasswordField] =
            this._getFormFields(form, true);

        // Need at least 1 valid password field to do anything.
        if (newPasswordField == null)
                return;

        var formSubmitURL = this._getActionOrigin(form)
        var formLogin = new this._nsLoginInfo();
        formLogin.init(hostname, formSubmitURL, null,
                    (usernameField ? usernameField.value : ""),
                    newPasswordField.value,
                    (usernameField ? usernameField.name  : ""),
                    newPasswordField.name);

        // Look for an existing login that matches the form login.
        var existingLogin = null;
        var logins = this.loginManager.findLogins({}, hostname, formSubmitURL, null);

        for (var i = 0; i < logins.length; i++) {
            var same, login = logins[i];

            // If one login has a username but the other doesn't, ignore
            // the username when comparing and only match if they have the
            // same password. Otherwise, compare the logins and match even
            // if the passwords differ.
            if (!login.username && formLogin.username) {
                var restoreMe = formLogin.username;
                formLogin.username = "";
                same = formLogin.matches(login, false);
                formLogin.username = restoreMe;
            } else if (!formLogin.username && login.username) {
                formLogin.username = login.username;
                same = formLogin.matches(login, false);
                formLogin.username = ""; // we know it's always blank.
            } else {
                same = formLogin.matches(login, true);
            }

            if (same) {
                existingLogin = login;
                break;
            }
        }

        var prompterSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                        createInstance(Ci.nsIPromptService);
        if (existingLogin) {
            console.log("Found an existing login matching this form submission");
            var uri = Services.io.newURI(existingLogin.formSubmitURL, null, null);
            if (uri.scheme === "https") {
              // we have a problem, warn the user!
              console.log("A previously secure password is being used over a non-secure channel");
              var checked = {value: false};
              var ok = prompterSvc.confirmCheck(win, "Unsecured Password Warning",
                                       "You are attempting to use a previously secure password on an unsecured connection.  Are you sure you want to continue?",
                                       "Always allow for "+host+".", checked);
              // XXX save the pref
              if (ok)
                this._prefBranch.setBoolPref(host+".ignore", checked.value);
              cancelSubmit.value = !ok;

              return;
            }
            // XXX I'm slightly of the opinion we should always tell someone
            // that they are passing a password unsecurely.  So we'll drop
            // through to the next dialog
        }

        console.log("This appears to be a login over a non-secure channel");
        var checked = {value: false};
        var ok = prompterSvc.confirmCheck(win, "Unsecured Password Warning",
                                 "You are logging in over an unsecured connection.  Are you sure you want to continue?",
                                 "Always allow for "+host+".", checked);
        // XXX save the pref
        if (ok && checked.value)
          this._prefBranch.setBoolPref(host+".ignore", true);
        cancelSubmit.value = !ok;
        return;
    },


    /*
     * _getPasswordOrigin
     *
     * Get the parts of the URL we want for identification.
     */
    _getPasswordOrigin : function (uriString, allowJS) {
        var realm = "";
        try {
            var uri = Services.io.newURI(uriString, null, null);

            if (allowJS && uri.scheme == "javascript")
                return "javascript:"

            realm = uri.scheme + "://" + uri.host;

            // If the URI explicitly specified a port, only include it when
            // it's not the default. (We never want "http://foo.com:80")
            var port = uri.port;
            if (port != -1) {
                var handler = Services.io.getProtocolHandler(uri.scheme);
                if (port != handler.defaultPort)
                    realm += ":" + port;
            }

        } catch (e) {
            // bug 159484 - disallow url types that don't support a hostPort.
            // (although we handle "javascript:..." as a special case above.)
            console.log("Couldn't parse origin for " + uriString);
            realm = null;
        }

        return realm;
    },

    _getActionOrigin : function (form) {
        var uriString = form.action;

        // A blank or missing action submits to where it came from.
        if (uriString == "")
            uriString = form.baseURI; // ala bug 297761

        return this._getPasswordOrigin(uriString, true);
    },

    _getActionScheme : function (form) {
        var uriString = form.action;

        // A blank or missing action submits to where it came from.
        if (uriString == "")
            uriString = form.baseURI; // ala bug 297761

        var uri = Services.io.newURI(uriString, null, null);
        return uri.scheme;
    }
}; 

exports.unsecuredLoginManager = secureLoginChecker;
