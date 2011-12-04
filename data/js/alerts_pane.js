$(document).ready(function() {
    self.port.on('populateAlerts', function(alerts){
                // First, clear everything.
                $('#privacyAlerts').html('');

                for (var alertIdx in alerts) {
                    var newAlert = $('#privacyAlertBase').clone();
                    newAlert.removeAttr('id');
                    
                    if (alerts[alertIdx].type == 'similar_passwords') {                        
                        newAlert.append(getPasswordHashSpan(alerts[alertIdx].passwords[0]));
                        
                        newAlert.append(" is very similar to ");
                        
                        newAlert.append(getPasswordHashSpan(alerts[alertIdx].passwords[1]));
                        
                    }
                    else if (alerts[alertIdx].type == 'security_breach') {
                        newAlert.append(alerts[alertIdx].site + " has experienced a security breach. You should change your login there immediately!");
                    }
                                        
                    function makeClickFunction(uuid) {
                        return function() {
                            self.postMessage({type: 'dismissAlert',uuid: uuid});
                            newAlert.remove();
                        }
                    };
                    newAlert.children('.dismissAlert').click(makeClickFunction(alerts[alertIdx].uuid));
                    
                    newAlert.css('padding-top','50px');
                    $('#privacyAlerts').append(newAlert);
                    newAlert.show();
                }
            });
            
    });
    
function getPasswordHashSpan(password) {
    //TODO: fix the CSS so these appear even without the underscores.
    var newSpan = $('<span>____</span>');
    newSpan.addClass('passwordHash');
    newSpan.css('background-image',gradientStringForHash(SHA1(password)));
    return newSpan;
}