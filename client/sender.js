var net = require('net');

var host = '115.29.160.249';
var port = 2223;
var killo = new Buffer(1000, 'binary');
var timeList = [];

var stamp1, stamp2;

var client = new net.Socket();

// satify the watchdog
client.setMaxListeners(0);

client.on('data', function (d) {
        // TODO: check the data first
        //
        // write down the timestamp2
        stamp2 = Date.now();

	// push result into array timeList
	timeList.push(stamp2 - stamp1);

        // DEBUG: console.log('diff tmie: ' + (stamp2 - stamp1) );
	// Calculate the average
	avg();

	// Mission complete
        client.destroy();

});

client.on('close', function (c) {
        console.log('Self destruct Successful!');
});

// TODO: loop for MAGIC times
setInterval(function () {
	client.connect(port, host, function () {
		// write 1kb
		client.write(killo);

		// write down the timestamp1
		stamp1 = Date.now();
});
}, 150);


// Sent enough package, log the avage result
function avg() {
var sum = 0;
for (var i = 0; i < timeList.length; i++) {
	sum += timeList[i];
}
console.log('Average is :' + (sum / timeList.length));
}
