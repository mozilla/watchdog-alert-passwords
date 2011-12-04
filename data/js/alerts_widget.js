self.port.on('update', function(msg) {
    if (msg.numAlerts > 0) {
        document.getElementById('numAlertsBox').className = "alertsWidget alertsWaiting";
    }
    else {
        document.getElementById('numAlertsBox').className = "alertsWidget noAlerts";
    }
    document.getElementById('numAlertsBox').innerHTML = msg.numAlerts.toString();
});

document.body.addEventListener('click', function() {
    self.port.emit('click');
});
