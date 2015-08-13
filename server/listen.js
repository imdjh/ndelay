#!/usr/bin/env node
"use strict"

// META-data area
// author: dyejarhoo@gmail.com
// lang-spec: es6
//

/**
 *  Module dependencies
 */
var net = require('net');
var program = require('commander');


/**
 * Parse argv
 */
program
  .version('0.1.1')
  .usage('[-v]')
  .option('-v, --verbose', 'Verbose output to console')
  .option('-l, --listen <ip>', 'Listen connection to <ip>, default to all', '0.0.0.0')
  .option('-p, --port <port>', 'ndelay stays at <port>, default to 8100', 8100)
  .option('--package-size <kb>', 'Sends <kb> size package on receiving client connection, default to 1000', 1000)
  .parse(process.argv);

if (program.args.length) {
	program.outputHelp();
	process.exit(1);
}

/**
 * Initialize values
 */
var buf = new Buffer(program.packageSize, 'binary');
var isverbose = 0;
if (program.verbose) {
	isverbose = 1;
	var util = require('util');
}

net.createServer(function (sock) {
	let rAddr = sock.remoteAddress;
	let rPort = sock.remotePort;


	sock.on('data', function (d) {
		if (program.verbose) {
			console.log('Connection established from: ' + rAddr + ':' + rPort);
		}

		// TODO: check the data length is 1kb
		// var bl = Buffer.byteLength(d, 'binary');
		//
		if (program.verbose) {
			console.log('data type is: ' + typeof d);
			console.log('data content is: ' + util.inspect(d));
		}

		// all ok, write back
		sock.write(buf);
	});
	
	sock.on('close', function (c) {
		if (program.verbose) {
			console.log('Connection closed from: ' + rAddr + ':' + rPort);
		}
	});
}).listen(program.port, program.listen);

console.log('server running @ ' + program.listen + ':' + program.port);
