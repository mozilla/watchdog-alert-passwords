$(document).ready(function() {
    // Store metadata from the form the user right-clicked on here.
    // Pass it through once the user has decided on a password.
    var passwordMetadata = null;
    
    function generateNewPassword() {
        // For now, 12 random characters
        const choiceStr="1234567890ABCEDGHIJKLMNOPQRSTUVWXYZ";
        var newPassword = "";
        
        for (var x = 0; x<12; x++) {
            var choiceStrIdx = parseInt(Math.random()*choiceStr.length);
            newPassword += Math.random() > 0.5 ? choiceStr[choiceStrIdx] : choiceStr[choiceStrIdx].toLowerCase();
        }
        
        return newPassword;
    }
    
    function updatePassword() {
        $('#generatedPassword').html(generateNewPassword());
    }
    
    $('#generateButton').click(updatePassword);
    $('#usePasswordButton').click(function() {
        var passwordStr = $('#generatedPassword').html();
        
        self.postMessage({
            type: 'savePassword',
            password: passwordStr,
            metadata: passwordMetadata
        });
        
        self.postMessage({
            'type': 'typePassword',
            'password': passwordStr
        });
    });
    
    updatePassword();
    
    self.port.on('passwordMetadata', function(msg) {
        passwordMetadata = msg;
    });
});