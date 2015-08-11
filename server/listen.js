var net = require('net');
//var util = require('util');

var host = '0.0.0.0';
var port = 2223;
var killo = new Buffer(1000, 'binary');

net.createServer(function (sock) {
        console.log('Connection established from: ' + sock.remoteAddress + ':' + sock.remotePort);

        // on receive data
        sock.on('data', function (d) {
                // TODO: check the data length is 1kb
                // var bl = Buffer.byteLength(d, 'binary');
                //
                // DEBUG: console.log('yes, the type is: ' + util.inspect(d));
                //
                // write back 1kb
                sock.write(killo);
        });

        sock.on('close', function (c) {
                console.log('Connection closed from: ' + sock.remoteAddress + ':' + sock.remotePort);
        });
}).listen(port, host);

console.log('Server started on: ' + host + ':' + port);

