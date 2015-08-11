var net = require('net');
var stringformat = require('stringformat');

// Enable format stings syntax
stringformat.extendString();

var host = '115.29.160.249';
var port = 2223;
var killo = new Buffer(1000, 'binary');
var timeList = [];
var errCount = 0;

var stamp1, stamp2;

var client = new net.Socket();

// satify the watchdog
client.setMaxListeners(0);

// connection error handling
client.on('error', function (e) {
	// DEBUG: console.log('Connection error happens');
	errCount++;
	client.destroy();
});
	
client.on('data', function (d) {
        // TODO: check the data first
        //
        // write down the timestamp2
        stamp2 = Date.now();

	// push result into array timeList
	timeList.push(stamp2 - stamp1);

        // DEBUG: console.log('diff tmie: ' + (stamp2 - stamp1) );
	// Calculate the average
	// DEBUG: VERBOSE: avg();

	// Mission complete
        client.destroy();

});

client.on('close', function (c) {
        // DEBUG: console.log('Self destruct Successful!');
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

// Give result on SIGINT
process.on('SIGINT', function () {
	avg();
	
	// Output ERR connection times & rate
	if (errCount) {
		console.log('ERR happen: ' + errCount + ' times!');
		var stringErrRate = 'ERR rate: {0}/{1} = {2}'.format(errCount, timeList.length, (errCount/timeList.length));
		console.log(stringErrRate);
	}


	// Output worst delay
	console.log('Max delay: ' + Math.max.apply(null, timeList));
	process.exit();
});
