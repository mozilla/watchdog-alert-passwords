const {Cc,Ci,Cu} = require("chrome");
const url = require("sdk/url");
const util = require("util");
const { checkPassword } = require("passwordValidator");

var tmp = {};
Cu.import("resource://gre/modules/PlacesUtils.jsm", tmp);
var { PlacesUtils } = tmp;

var loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

function passwordSimilarityCheck(password1,password2) {
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
            
            if (passwordSimilarityCheck(password1,password2)) {
                loginsTable[password1].similarTo.push.apply(loginsTable[password1].similarTo, loginsTable[password2].hosts);
                loginsTable[password2].similarTo.push.apply(loginsTable[password2].similarTo, loginsTable[password1].hosts);
            }
        }
        passwordsChecked[password1] = true;
    }    
}

function _baseHostname(hostname) {
    let host;
    try {
        // assume that .net, .com, .org etc are owned by same organization, not
        // always accurate but reduces common case single signon
        host = /([\w-_]+)\.\w+$/.exec(url.URL(hostname).host)[1];
    }
    catch (e) {
        // These might not all be valid URLs, e.g. chrome://...
        // So if the URL class throws an error, just use the hostname again.
        try {
            host = /([\w-_]+)\.\w+$/.exec(hostname)[1];
        } catch(e) {
            //console.log("unable to parse "+li.hostname);
            host = hostname;
        }
    }
    return host;
}

function _baseDomain(hostname) {
    let host;
    try {
        // assume that .net, .com, .org etc are owned by same organization, not
        // always accurate but reduces common case single signon
        host = /([\w-_]+\.\w+)$/.exec(url.URL(hostname).host)[1];
    }
    catch (e) {
        // These might not all be valid URLs, e.g. chrome://...
        // So if the URL class throws an error, just use the hostname again.
        try {
            host = /([\w-_]+\.\w+)$/.exec(hostname)[1];
        } catch(e) {
            //console.log("unable to parse "+li.hostname);
            host = hostname;
        }
    }
    return host;
}
exports.baseDomain = _baseDomain;

function reverse(s){
    return s.split("").reverse().join("");
}


function frecencyForUrl(host)
{
  // XXX there has got to be a better way to do this!
  let dbconn = PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase)
                                  .DBConnection;
  let frecency = 0;
  let stmt = dbconn.createStatement(
    "SELECT frecency FROM moz_places WHERE rev_host = ?1"
  );
  try {
    stmt.bindByIndex(0, reverse(host)+'.');
    if (stmt.executeStep())
      frecency = stmt.getInt32(0);
  } finally {
    stmt.finalize();
  }

  return frecency;
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
        logins: 0,
        unsecure: 0
    };
    var metaInfo = {};

    // first, get details about the password itself, such as strength, duplicity
    // and similarity
    var pwInfo = {};
    var s_tot = 0;
    var frecencies = {};
    var max_frecency = 0;
    for (let login in logins) {
        let li = logins[login];
        if (!li.hostname || li.hostname.indexOf("chrome://") === 0) continue;
        scores.logins++;
        let baseHost = _baseDomain(li.hostname);
        let host = url.URL(li.hostname).host;
        let frecency = frecencyForUrl(host);
        max_frecency = Math.max(frecency, max_frecency);
        if (frecencies[baseHost+':'+li.username])
            frecencies[baseHost+':'+li.username] += frecency
        else
            frecencies[baseHost+':'+li.username] = frecency;
        let fullHost = li.username+":"+host;
        
        if (!pwInfo[li.password]) {
            let strength = checkPassword(li.password);

            pwInfo[li.password] = {
                hosts: [baseHost],
                allHosts: [fullHost],
                strength: strength,
                similarTo: [],
                hasUnsecure: false
            };
        } else if (pwInfo[li.password].hosts.indexOf(baseHost) < 0) {
            //console.log("duplicate "+host+" not in "+pwInfo[li.password].hosts)
            pwInfo[li.password].hosts.push(baseHost);
        }
        if (pwInfo[li.password].allHosts.indexOf(fullHost) < 0) {
            pwInfo[li.password].allHosts.push(fullHost);
        }
        if (!pwInfo[li.password].hasUnsecure) {
            pwInfo[li.password].hasUnsecure = li.formSubmitURL ?
                            li.formSubmitURL.indexOf("http://") === 0 :
                            li.hostname.indexOf("http://") === 0;
        }
        s_tot += pwInfo[li.password].strength;
    }
    getSimiliarities(pwInfo);
    scores.avg_strength = Math.round(s_tot / scores.logins);

    // now get get a list by host, narrow down to top-level domains for
    // well-known services
    var a_tot = 0;
    for (let login in logins) {
        let li = logins[login];
        if (!li.hostname || li.hostname.indexOf("chrome://") === 0) continue;

        let host = _baseDomain(li.hostname);
        //let host = url.URL(li.hostname).host;
        if (metaInfo[host+":"+li.username]) continue;

        let lim = li.QueryInterface(Ci.nsILoginMetaInfo);

        let age = Math.ceil((Date.now() - lim.timePasswordChanged)/86400000);
        a_tot += age;
        if (age > 90) scores.over_ninty++;

        // unless someone is not entering data correctly, we should have
        // the formSubmitURL field.  this is critical to knowing if a password
        // is SENT in a secure manor.
        var unsecure = li.formSubmitURL ?
                            li.formSubmitURL.indexOf("http://") === 0 :
                            li.hostname.indexOf("http://") === 0;
        if (unsecure) {
            //console.log("unsecure site "+li.hostname);
            scores.unsecure++;
        }

        var info = {
            hostname: li.hostname,
            formSubmitURL: li.formSubmitURL,
            username: li.username,
            strength: pwInfo[li.password].strength,
            strong: pwInfo[li.password].strength >= 90,
            medium: 90 > pwInfo[li.password].strength >= 50,
            weak: pwInfo[li.password].strength < 50,
            shared: pwInfo[li.password].hosts.length > 1,
            usedBy: pwInfo[li.password].hosts,
            usedByAll: pwInfo[li.password].allHosts,
            similar: pwInfo[li.password].similarTo.length > 0,
            similarTo: pwInfo[li.password].similarTo,
            hasUnsecure: pwInfo[li.password].hasUnsecure, // a site sharing the password is unsecure
            age: age,
            over90: age > 90,
            unsecure: unsecure,
            host: host,
            frecency: frecencies[host+':'+li.username]
        };
        info.usedByText = info.usedBy.join(', ');
        info.similarToText = info.similarTo.join(', ');

        // create a score for this site, which for now is ONLY a sorting
        // mechanism. frecency is important to this score, since sites I
        // frequent should have a higher weight on my security. as well,
        // important sites like banks, social networks, etc. contain more
        // sensitive information and should score a higher importance. For that
        // to happen, we need to get the top1000 list and use the categories to
        // score importance, maybe giving a few select sites an importance bonus
        // (e.g. those that act as identity providers). For now, we rely on
        // frecency as importance.
        info.importance = Math.round((info.frecency / max_frecency) * 100);
        info.score = info.strength;
        let problems = (info.usedBy.length-1)*10 +
                        info.unsecure*10 +
                        info.similarTo.length +
                        (info.age > 90 ? info.age * .1: 0) +
                        (info.hasUnsecure && !info.unsecure ? 20:0);
        if (problems > 0) {
            info.score = Math.round(info.strength - problems) - info.importance;
        }
        
        if (info.usedBy.length > 1) scores.duplicates++;
        if (info.similarTo.length > 0) scores.similarity++;

        metaInfo[info.host+":"+info.username] = info;
    }
    scores.avg_age = Math.round(a_tot / logins.length);
    
    // make the grade! password strength takes 70% of grade, duplicates 10%, similarity and
    // age 5% each.  There is no rhyme or reason to these amounts.
    let dup = (scores.duplicates / scores.logins) * 100,
        sim = (scores.similarity / scores.logins) * 100,
        age = (scores.over_ninty / scores.logins) * 100;
    scores.overall = Math.round(scores.avg_strength - (dup * .2) - (sim * .1) - (age * .1));
    //console.log("str: "+scores.avg_strength+" dup: "+dup+":"+Math.round(dup * .2)+" sim: "+sim+":"+Math.round(sim * .1)+" age:"+age+":"+Math.round(age * .1)+" = "+scores.overall);
    //scores.overall = Math.round(scores.avg_strength * .4 + dup * .4 + sim * .05 + age * .05);
    return {
        scores: scores,
        logins: metaInfo
    };
}

