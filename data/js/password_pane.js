$(document).ready(function() {
    self.port.on('loginData', function(msg){
        // First, clear everything.
        $('#passwords').html('');
        
        var loginList = [];
        for (var login in msg.loginTable) {
            loginList.push({
                password: login,
                sites: msg.loginTable[login]
            });
        }
        
        // Sort passwords by number of sites they're used on.
        loginList.sort(function(a,b) { return b.sites.length - a.sites.length; });
        
        for (var login in loginList) {
            var httpsOnly = true;
            for (var hostname in loginList[login].sites) {
                if (loginList[login].sites[hostname].hostname.substr(0,8) != 'https://') {
                    httpsOnly = false;
                    break;
                }
            }
            var newPasswordDiv = $('#passwordBase').clone();
            newPasswordDiv.removeAttr('id');
            
            if ((msg.url.substr(0,8) == 'https://') != httpsOnly) {
                newPasswordDiv.addClass('notRecommended');
                
                var httpsOnlyWarning = $('<div>HTTPS only.</div>');
                httpsOnlyWarning.addClass('httpsOnly');
                newPasswordDiv.append(httpsOnlyWarning);
            }

            newPasswordDiv.children('.passwordCleartext').html(loginList[login].password);

            newPasswordDiv.children('.passwordHash').css('background-image','url(' + getDataURLForHash(SHA1(loginList[login].password),200,25) + ')');
            
            var justHosts = loginList[login].sites.map(function(x) { return x.host; });
            newPasswordDiv.find('.passwordSites').html(justHosts.join(', '));

            $('#passwords').append(newPasswordDiv);
            newPasswordDiv.show();
        }
        
        function disappearWarning(passwordHash) {
            $(passwordHash).parent().children(".passwordWarning").remove();
        }
        
        $('.passwordDiv').click(function() {
            self.postMessage({
                type: 'typePassword',
                password: $(this).children('.passwordCleartext').html()
            });
        });
        
        $('.passwordDiv').mouseout(function() {
            var clearTextPassword = $(this).children('.passwordCleartext').html();
            $(this).children('.passwordHash').stop();
            $(this).children('.passwordHash').html('');
            $(this).children('.passwordHash').css('opacity',1);
            $(this).children('.passwordHash').css('background-image','url(' + getDataURLForHash(SHA1(clearTextPassword),200,25) + ')');
            disappearWarning($(this).children('.passwordHash'));
        });
        
        $('.passwordHash').mouseenter(function() {
            var passwordHash = this;
            
            var passwordWarning = $("<div>About to display password...</div>");
            passwordWarning.addClass('passwordWarning');
            
            $(passwordHash).parent().append(passwordWarning);
            
            $(passwordHash).animate({
                opacity: 0.0
            },3000, function() {
                $(passwordHash).html($(passwordHash).parent().children('.passwordCleartext').html());
                // $(passwordHash).html($(passwordHash).parent().children('.passwordCleartext').html());
                $(passwordHash).css('background-image','');
                $(passwordHash).css('background-color','#000000');
                $(passwordHash).css('color','#ffffff');
                $(passwordHash).css('opacity',1);
                disappearWarning(passwordHash);
            });
        });
    });    
});
