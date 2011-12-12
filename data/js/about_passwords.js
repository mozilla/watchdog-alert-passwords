
function setLoginInfo(loginInfo) {
  about.console.log("setLoginInfo");
  var scores = loginInfo.scores;
  var scoreEl = $("#overall-score");
  scoreEl.text(scores.overall);
  if (scores.overall > 80) { 
    scoreEl.addClass("strong"); 
  } else if (scores.overall > 50) { 
    scoreEl.addClass("medium") 
  } else { 
    scoreEl.addClass("weak"); 
  }
  if (scores.avg_strength > 80) {
    $("#avg-strength").text("high ("+scores.avg_strength+")");
    $("#avg-strength").addClass("strong");
  }
  else if (scores.avg_strength > 50) {
    $("#avg-strength").text("medium ("+scores.avg_strength+")");
    $("#avg-strength").addClass("medium");
  }
  else {
    $("#avg-strength").text("low ("+scores.avg_strength+")");
    $("#avg-strength").addClass("weak");
  }
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
