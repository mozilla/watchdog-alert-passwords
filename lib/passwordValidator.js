// quick-n-dirty strength determination, we should look for better, but this
// will let us get moving on other parts.
// source: http://www.intelligent-web.co.uk/examples/passwordstrength/passwordstrength.js.html


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

  return Math.min(Math.max(password.length * 5, percentage * 100), 100); 
}; 

