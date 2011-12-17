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
        $('#generatedPassword').val(generateNewPassword());
        self.port.emit("checkPasswordStrength", {password: $('#generatedPassword').val()});
        $('#generatedPassword').select();
        $('#generatedPassword').focus();
    }
    
    $('#generateButton').click(updatePassword);
    $('#usePasswordButton').click(function() {
        var passwordStr = $('#generatedPassword').val();
        
        self.port.emit('typePassword', {
            'password': passwordStr,
            'data': passwordMetadata
        });
    });
    $('#generatedPassword').change(function() {
        setTimeout(function() {
            self.port.emit("checkPasswordStrength", {password: $('#generatedPassword').val()});
        },1);
    });
    $('#generatedPassword').keypress(function() {
        setTimeout(function() {
            self.port.emit("checkPasswordStrength", {password: $('#generatedPassword').val()});
        },1);
    });
    
    updatePassword();
    
    self.port.on('passwordMetadata', function(msg) {
        passwordMetadata = msg;
        // this is called onShow, so lets set our selection and focus
        console.log("lets select and focus!");
        $('#generatedPassword').select();
        $('#generatedPassword').focus();
    });
    self.port.on('passwordStrength', function(msg) {
        $('#strength').text(msg.strength);
    });
});