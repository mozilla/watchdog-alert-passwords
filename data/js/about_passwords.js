
function setLoginInfo(loginInfo) {
  about.console.log("setLoginInfo");
  var scores = loginInfo.scores;
  var scoreEl = $("#overall-score");
  scoreEl.text(scores.overall);
  if (scores.overall > 90) { 
    scoreEl.addClass("strong"); 
  } else if (scores.overall > 50) { 
    scoreEl.addClass("medium") 
  } else { 
    scoreEl.addClass("weak"); 
  }
  $("#avg-strength").text(scores.avg_strength);
  $("#num-duplicates").text(scores.duplicates);
  $("#num-similar").text(scores.similarity);
  $("#num-unsecure").text(scores.unsecure);
  $("#num-old").text(scores.over_ninty);
  $("#total-logins").text(scores.logins);


  $("#logins-list").empty();
  $("#logins-tmpl").tmpl({logins: loginInfo.logins}).appendTo("#logins-list");
}

$(document).ready(function() {
  about.ready();
  about.console.log("about is loaded");
});
