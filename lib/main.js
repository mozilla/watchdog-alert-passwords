const {Cc,Ci,Cu} = require("chrome");

const dataDir = require("self").data;
const observers = require("observer-service");
const pagemod = require("page-mod");
const panel = require("panel");
const tabs = require("tabs");
const url = require("url");
const util = require("util");
const widgets = require("widget");

const passwordManager = require('passwordManager');

const Alerts = require('alerts');

// Alerts.AlertManager.addAlert({'type' : 'similar_passwords', passwords: ['abc','def']});
// Alerts.AlertManager.addAlert({'type' : 'security_breach', site: 'sony.com', hostname: 'www.sony.com'});
// Alerts.AlertManager.addAlert({'type' : 'security_breach', site: 'facebook.com', hostname: 'www.facebook.com'});

loginManagerObserver();


pagemod.PageMod({
    include: "*",
    contentScriptFile: [dataDir.url("js/util.js"),dataDir.url("js/form_detector.js")],
    contentScriptWhen: 'end',
    onAttach: function(worker) {
        worker.port.on('blur', function(msg) {
            var newPassword = msg.password;
            var loginsTable = passwordManager.getLoginsTable();
            var newAlertUUIDs = [];
            
            // If this password isn't saved in password manager, there's nothing we can do.
            // TODO: use this as an opportunity to tell the user how secure their password is?
            if (!loginsTable[newPassword])
                return;
            
            if (loginsTable[newPassword].filter(function(x) { return x.host != msg.host; }).length > 0) {
                var newAlert = Alerts.AlertManager.addAlert({
                    type: 'password_exists_on_other_sites',
                    num_other_sites: loginsTable[newPassword].length-1,
                    password: newPassword
                });
                if (newAlert)
                    newAlertUUIDs.push(newAlert);
            }
            
            // If this site is non-HTTPs
            if (msg.href.substr(0,7) != "https://") {
                // And the user has previously only used this password on HTTPs enabled sites
                if (loginsTable[newPassword].length == loginsTable[newPassword].filter(function(x) { return x.hostname.substr(0,8) == 'https://'; }).length) {
                    var newAlert = Alerts.AlertManager.addAlert({
                       type: 'login_used_only_for_https',
                       password: newPassword
                    });
                    if (newAlert)
                        newAlertUUIDs.push(newAlert);
                }
            }
            
            if (newAlertUUIDs.length > 0) {
                worker.port.emit('inContentWarning', {
                    warningIconURL: dataDir.url("warning_icon.png"),
                    alertUUIDs : newAlertUUIDs
                });
            }

            // for (var password in loginsTable) {
            //     if (password != newPassword && passwordSimilarityCheck(password, newPassword)) {
            //         console.log("loginsTable[password].length = " + loginsTable[password].length);
            //         // Ensure that this host doesn't already have this password
            //         var httpURLs = loginsTable[password].filter(function(x) { return x.host.substr(0,7) == 'http://' || x.host.substr(0,8) == 'https://'; });
            //         var hostnames = httpURLs.map(function(x) { return url.URL(x.host).host; });
            //         console.log("msg.host: " + msg.host);
            //         console.log("hostnames:" + hostnames.length);
            //         
            //         for (var hostname in hostnames)
            //             dump(hostnames[hostname]);
            //         if (hostnames.indexOf(msg.host))
            //             browserAlert("Passwords are similar, but the site already knows.");
            //         else
            //             browserAlert("This password is very similar to one you're already using!");   
            //     }
            // }
            
            // if (this.panel && !msg.hasFocus) {
            //     this.panel.hide();
            // }
        });
        
        worker.port.on('moreInfo', function(msg) {
            for (var alertUUID in msg.alertUUIDs) {
                var alert = Alerts.AlertManager.getAlertByUUID(msg.alertUUIDs[alertUUID]);
                // alert may be null - could have been dismissed by the user by clicking on the widget and then the doorhanger.
                if (alert) {
                    Alerts.PopupAlertsManager.displayPopupAlert(alert);
                    noPendingAlerts = false;                    
                }
            }
        });
    }
});

function loginManagerObserver() {
    function onStorageChanged(aSubject, aData) {
        if (aData == 'modifyLogin')
            aSubject = aSubject.QueryInterface(Ci.nsIArray).queryElementAt(1, Ci.nsILoginMetaInfo);

        var loginInfo = aSubject.QueryInterface(Ci.nsILoginMetaInfo).QueryInterface(Ci.nsILoginInfo);

        switch(aData) {
            case 'modifyLogin':
                // modifyLogin fires even when an old login is used, and not modified. (?)
                
                // TODO: find a better way of doing this. For now, look to see if the
                // password was just modified.
                if ((Date.now() - aSubject.timePasswordChanged) < 100) {
                    Alerts.AlertManager.passwordChanged(url.URL(loginInfo.hostname).host);
                }
                else {
                    var passwordAgeInDays = (Date.now() - aSubject.timePasswordChanged)/1000/60/60/24;
                    if (passwordAgeInDays > 90) {
                        Alerts.PopupAlertsManager.displayPopupAlert({
                           type: 'stale_password',
                           password: loginInfo.password,
                           age_in_days: passwordAgeInDays,
                           threshold: 90,
                           hostname: url.URL(loginInfo.hostname).host
                        });                        
                    }
                }
                
                break;
        }


    }
    observers.add('passwordmgr-storage-changed', onStorageChanged);
}

function browserAlert(msg,title) {
    if (!title)
        title = "Alert";
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);
    var win = wm.getMostRecentWindow("navigator:browser");
    var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Ci.nsIPromptService);
    promptService.alert(win,title,msg);
}

function openPasswordVisualizer() {
    tabs.open(dataDir.url("view_passwords.html"));
}

function obfuscateLoginsTable(loginsTable) {
    var obfuscateTable = {};
    
    // obfuscate passwords
    for (var password in loginsTable) {
        var obfuscatedPassword = obfuscatePassword(loginsTable[password]);
        // Resolve any collisions by tacking on *'s
        while (obfuscateTable[obfuscatedPassword])
            obfuscatedPassword += '*';
        obfuscateTable[obfuscatedPassword] = loginsTable[password];
    }
    
    return obfuscateTable;   
}

function obfuscatePassword(password) {
    var obfuscatePassword = password[0];
    for (var x = 0; x < password.length-2; x++)
        obfuscatePassword += '*';
    obfuscatePassword += password[password.length-1];
    return obfuscatePassword;
}

function detectSimilarPasswords(loginsTable) {
    var passwordsChecked = {};
    var similarPasswordPairs = [];
    
    for (var password1 in loginsTable) {
        for (var password2 in loginsTable) {
            if (password1 == password2)
                continue;
            if (passwordsChecked[password2])
                continue;
            
            if (passwordSimilarityCheck(password1,password2))
                similarPasswordPairs.push([password1,password2]);
        }
        passwordsChecked[password1] = true;
    }
    return similarPasswordPairs;
}

function passwordSimilarityCheck(password1,password2) {
    return util.levenshtein(password1,password2) < Math.max(password1.length,password2.length)/2;
}

console.log("Watchdog started.");