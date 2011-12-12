var baseurl;
function add_css(url) {
  var head = document.getElementsByTagName("head")[0];
  //dump("using baseurl of "+baseurl+"\n");
  var fileref = document.createElement("link");
  fileref.setAttribute("rel", "stylesheet");
  fileref.setAttribute("type", "text/css");
  fileref.setAttribute("href", baseurl+url);
  head.appendChild(fileref);
}

function add_script(url) {
  var head = document.getElementsByTagName("head")[0];
  var fileref = document.createElement("script");
  fileref.setAttribute("type", "text/javascript");
  fileref.setAttribute("src", baseurl+url);
  head.appendChild(fileref);
}

self.port.on('data-url', function(url) {
  baseurl = url;
  //return; 
  console.log('base url '+baseurl);
  add_css("css/bootstrap.min.css");
  add_css("css/about_passwords.css");
  add_script("js/jquery-1.6.2.min.js");
  add_script("js/jquery.tmpl.min.js");
  add_script("js/about_passwords.js");
});

self.port.on('password-info', function(loginInfo) {
  console.log(JSON.stringify(loginInfo.scores));
  unsafeWindow.setLoginInfo(loginInfo);
});

unsafeWindow.about = {
  ready: function() {
    console.log("ready called");
    self.port.emit("ready");
  },
  console: console
}