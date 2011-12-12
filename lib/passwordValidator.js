// quick-n-dirty strength determination, we should look for better, but this
// will let us get moving on other parts.
// source: http://www.intelligent-web.co.uk/examples/passwordstrength/passwordstrength.js.html


const {Cc,Ci,Cu} = require("chrome");
var spellclass = "@mozilla.org/spellchecker/myspell;1";
if ("@mozilla.org/spellchecker/hunspell;1" in Cc)
        spellclass = "@mozilla.org/spellchecker/hunspell;1";
if ("@mozilla.org/spellchecker/engine;1" in Cc)
        spellclass = "@mozilla.org/spellchecker/engine;1";
        
gSpellCheckEngine = Cc[spellclass].createInstance(Ci.mozISpellCheckingEngine);
gSpellCheckEngine.dictionary = 'en-US';

var tr = {
  'l': /1/g,
  'z': /2/g,
  'e': /3/g,
  's': /5/g,
  'g': /6/g,
  'L': /7/g,
  'b': /8/g,
  'y': /9/g,
  'o': /0/g,
  'i': /!/g,
  'a': /@/g,
  't': /\+/g,
  'S': /\$/g,
  'h': /#/g,
  'c': /\(/
  // I could go on, but why
}
function simpleLeet(pw) {
  let p = pw;
  for (var i in tr) p = p.replace(tr[i], i);
  //if (p !== pw) console.log("l337 translation: "+pw+" > "+p);
  return p;
}

exports.checkDictionary = function(password) {
  if (gSpellCheckEngine.check(password)) {
    //console.log("simple dictionary hit on "+password);
    return true;
  }
  return false;
  // we could do these other things, not sure about the value
  if (gSpellCheckEngine.check(simpleLeet(password))) {
    //console.log("l337 dictionary hit on "+password+" -> "+simpleLeet(password));
    return true;
  }
  let p = /^\d*(\D+)\d*$/.exec(password);
  if (p !== null && gSpellCheckEngine.check(p[1])) {
    //console.log("prefix/postfix dictionary hit on "+password);
    return true;
  }
  return false;
}
/** 
 * Checks the supplied password 
 * @param {String} password 
 * @return The predicted lifetime of the password, as a percentage of the defined password lifetime. 
 */ 
exports.checkPassword = function checkPassword(password) {
  var secondsInADay = 86400;
  var passwordLifeTimeInDays = 365; 
  var passwordAttemptsPerSecond = 500;
  
  var expressions = [ 
    { 
      regex : /[A-Z]+/, 
      uniqueChars : 26 
    }, 
    { 
      regex : /[a-z]+/, 
      uniqueChars : 26 
    }, 
    { 
      regex : /[0-9]+/, 
      uniqueChars : 10 
    }, 
    { 
      regex : /[!\?.;,\\@$£#*()%~<>{}\[\]]+/, 
      uniqueChars : 17 
    } 
  ];
  var 
      i, 
      l = expressions.length, 
      expression, 
      possibilitiesPerLetterInPassword = 0; 

  for (i = 0; i < l; i++) { 
    expression = expressions[i]; 
    if (expression.regex.exec(password)) { 
      possibilitiesPerLetterInPassword += expression.uniqueChars; 
    } 
  } 

  var 
      totalCombinations = Math.pow(possibilitiesPerLetterInPassword, password.length), 
    // how long, on average, it would take to crack this (@ 200 attempts per second) 
      crackTime = ((totalCombinations / passwordAttemptsPerSecond) / 2) / secondsInADay, 
    // how close is the time to the projected time? 
      percentage = crackTime / passwordLifeTimeInDays; 

      //console.log("strength "+(password.length * 5)+" or "+(percentage))
  var c= Math.min(Math.max(password.length * 5, percentage), 100); 
  if (exports.checkDictionary(password)) {
    // simple words are more suseptible to simple dictionary attacks, lets account for that.
    // I'm making this up.  If the avg person knows an avg of 40K words, cut in half for somewhat common
    // words, then continue the calculation used above to figure out how long to crack. 
    var words = 200000,
      crackTime = ((words / passwordAttemptsPerSecond) ) / secondsInADay, 
    // how close is the time to the projected time? 
      percentage = crackTime / passwordLifeTimeInDays; 

    var s= Math.min(Math.max(password.length * 5, percentage), 100); 
    //console.log("whoa, a simple password "+password+" with strength "+s+" otherwise it would be "+(percentage*100));
    c = Math.min(c, s);
  }
  return Math.round(c);

}; 

