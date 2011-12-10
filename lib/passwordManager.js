const {Cc,Ci,Cu} = require("chrome");
const url = require("url");
const util = require("util");
const { checkPassword } = require("passwordValidator");

var loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

exports.getLoginsTable = function getLoginsTable() {
    var logins = loginManager.getAllLogins();
    var loginsTable = {};
    for (var login in logins) {
        var loginInfo = logins[login];
        if (!loginsTable[loginInfo.password])
            loginsTable[loginInfo.password] = [];
        var loginSite = {
            hostname: loginInfo.hostname
        };
        
        try {
             loginSite.host = url.URL(loginInfo.hostname).host;   
        }
        catch (e) {
            // These might not all be valid URLs, e.g. chrome://...
            // So if the URL class throws an error, just use the hostname again.
            loginSite.host = loginInfo.hostname;
        }
        
        loginsTable[loginInfo.password].push(loginSite);
    }
    return loginsTable;
}

exports.detectSimilarPasswords = function detectSimilarPasswords(loginsTable) {
    var passwordsChecked = {};
    var similarPasswordPairs = [];
    
    for (var password1 in loginsTable) {
        for (var password2 in loginsTable) {
            if (password1 == password2)
                continue;
            if (passwordsChecked[password2])
                continue;
            
            if (exports.passwordSimilarityCheck(password1,password2))
                similarPasswordPairs.push([password1,password2]);
        }
        passwordsChecked[password1] = true;
    }
    return similarPasswordPairs;
}

exports.passwordSimilarityCheck = function passwordSimilarityCheck(password1,password2) {
    return util.levenshtein(password1,password2) < Math.max(password1.length,password2.length)/2;
}

function getSimiliarities(loginsTable) {
    var passwordsChecked = {};
    var similarPasswordPairs = [];
    
    for (var password1 in loginsTable) {
        for (var password2 in loginsTable) {
            if (password1 == password2)
                continue;
            if (passwordsChecked[password2])
                continue;
            
            if (exports.passwordSimilarityCheck(password1,password2)) {
                loginsTable[password1].similarity++;
                loginsTable[password2].similarity++;
            }
        }
        passwordsChecked[password1] = true;
    }    
}

// domain, duplicate_flag, similarity, strength, age
exports.getLoginMetaInfo = function getLoginMetaInfo() {
    var logins = loginManager.getAllLogins();
    var scores = {
        avg_age: 0,
        over_ninty: 0,
        avg_strength: 0,
        duplicates: 0,
        similarity: 0,
        logins: logins.length
    };
    var metaInfo = [];

    // first, get details about the password itself, such as strength, duplicity
    // and similarity
    var pwInfo = {};
    var s_tot = 0;
    for (let login in logins) {
        let li = logins[login];
        if (!pwInfo[li.password]) {
            let strength = checkPassword(li.password);
            pwInfo[li.password] = {
                count: 1,
                strength: strength,
                similarity: 0
            };
            s_tot += strength;
        } else {
            pwInfo[li.password].count++;
        }
    }
    getSimiliarities(pwInfo);
    scores.avg_strength = Math.round(s_tot / logins.length);

    // now get get a list by host, narrow down to top-level domains for
    // well-known services
    var a_tot = 0;
    for (let login in logins) {
        let li = logins[login];
        let lim = li.QueryInterface(Ci.nsILoginMetaInfo);

        let age = Math.ceil((Date.now() - lim.timePasswordChanged)/86400000);
        a_tot += age;
        if (age > 90) scores.over_ninty++;

        var info = {
            hostname: li.hostname,
            username: li.username,
            strength: pwInfo[li.password].strength,
            duplicates: pwInfo[li.password].count - 1,
            similarity: pwInfo[li.password].similarity,
            age: age
        };

        if (info.duplicates > 0) scores.duplicates++;
        if (info.similarity > 0) scores.similarity++;
        
        try {
            info.host = url.URL(li.hostname).host;   
        }
        catch (e) {
            // These might not all be valid URLs, e.g. chrome://...
            // So if the URL class throws an error, just use the hostname again.
            info.host = li.hostname;
        }
        
        metaInfo.push(info);
    }
    scores.avg_age = Math.round(a_tot / logins.length);
    return {
        scores: scores,
        logins: metaInfo
    };
}

