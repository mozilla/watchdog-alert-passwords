
self.port.on('data-url', function(baseurl) {
  // attach our css file
  let head = document.getElementsByTagName("head")[0];
  
  var fileref=document.createElement("link")
  fileref.setAttribute("rel", "stylesheet")
  fileref.setAttribute("type", "text/css")
  fileref.setAttribute("href", baseurl+"skin/about_passwords.css");
  head.appendChild(fileref)

  fileref=document.createElement("script")
  fileref.setAttribute("type", "application/javascript")
  fileref.setAttribute("src", baseurl+"js/jquery-1.6.2.min.js");
  head.appendChild(fileref)

  fileref=document.createElement("script")
  fileref.setAttribute("type", "application/javascript")
  fileref.setAttribute("src", baseurl+"js/jquery.tmpl.min.js");
  head.appendChild(fileref)

  fileref=document.createElement("script")
  fileref.setAttribute("type", "application/javascript")
  fileref.setAttribute("src", baseurl+"js/about_passwords.js");
  head.appendChild(fileref)
});

self.port.on('password-info', function(loginInfo) {
  console.log(JSON.stringify(loginInfo));
});