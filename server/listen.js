#!/usr/bin/env node
"use strict"

/**
 * META-data 
 * Author: dyejarhoo@gmail.com
 * lang-spec: es6
 * version: 0.1.1
 */


/**
 *  Module dependencies
 */
var program = require('commander');
var qs = require('querystring');


/**
 * Parse argv
 */
program
  .version('0.1.1')
  .usage('[-v]')
  .option('-v, --verbose', 'Verbose output to console')
  .option('--enable-debug', 'Output debug info to console')
  .option('-l, --listen <ip>', 'Listen connection to <ip>, default to all', '0.0.0.0')
  .option('-p, --port <port>', 'ndelay stays at <port>, default to 8100', 8100)
  .option('--packet-size <kb>', 'Sends <kb> size packet on receiving client connection, default to 1000', 1000)
  .option('--http-server', 'Server is http server, default to TCP socket server')
  .parse(process.argv);

if (program.args.length) {
	program.outputHelp();
	process.exit(1);
}

/**
 * Initialize values
 */
var buf = new Buffer(program.packetSize, 'binary');
var isVerbose = 0;
if (program.verbose || program.enableDebug) {
	isVerbose = 1;
	var util = require('util');
}


/**
 * Main Logic
 */
if (!program.httpServer) {
	var net = require('net');
	net.createServer(function (sock) {
		let rAddr = sock.remoteAddress;
		let rPort = sock.remotePort;


		sock.on('data', function (d) {
			if (isVerbose) {
				console.log(`Connection established from: ${rAddr}:${rPort}`);
			}

			// TODO: check the data length is 1kb
			// var bl = Buffer.byteLength(d, 'binary');
			//
			if (program.enableDebug) {
				console.log('data type is: ' + typeof d);
				console.log('data content is: ' + util.inspect(d));
			}

			sock.write(buf);
		});

		sock.on('close', function (c) {
			if (isVerbose) {
				console.log(`Connection closed from: ${rAddr}:${rPort}`);
			}
		});
	}).listen(program.port, program.listen, logservertype('TCP SOCKET')); // end of tcp socket server
} else {
	var http = require('http');

	var server = http.createServer(function (req, res) {
		let rAddr = req.socket.remoteAddress;
		let rPort = req.socket.remotePort;
		if (isVerbose) {
			console.log(`Connection established from: ${rAddr}:${rPort}`);
		} else if (program.enableDebug) {
			console.log('HTTP header :' + JSON.stringify(req.headers));
		}

		if (req.method === 'POST') {
		
			req.on('data', (chunk) => {
				let jsonReq = qs.parse(chunk.toString());
				let reqData = jsonReq.ndelay;
				
				if (reqData === undefined || reqData.length < 990) {
					banConn(req, res);
				} else {
						if (isVerbose) {
							console.log('Received', reqData.length, 'bytes');
							if (program.enableDebug) {
								console.log('Received data:', util.inspect(jsonReq));
							}
						}
						let c = genRandomString();
						res.writeHead(200, {
							'Conetent-Length': c.length,
							'Content-Type': 'text/plain' });
						res.end(c, () => {
							console.log(`Connection closed to: ${rAddr}:${rPort}`);
						});
				}
			});
		} else {
			res.writeHead(405, "Method not supported");
			banConn(req, res);
		}

	
	}).listen(program.port, program.listen, 99999, logservertype('HTTP'));
// Refuse unexcept connections
function banConn(req, res) {
	console.log('Bad request from:', req.socket.remoteAddress + ':' + req.socket.remotePort, '/!\\Connection closed/!\\');
	res.end('You are not supported.');
}

// Verify connection
function isVerifiedConn(req) {
	if (req.method === 'POST') {
		return true
	}
	return false
}

// generate random but fixed-size string
function genRandomString() {
	let arrSeed = ['4', '2', 'L', 'K'];
	let arrString = [];

	for (let i = 0; i < program.packetSize; i++) {
		let r = Math.random() * arrSeed.length;
		arrString.push(arrSeed[Math.floor(r)]);
	}

	return arrString.join('');
}
	
}


function logservertype(type) {
	console.log(type, 'server running @', program.listen + ':' + program.port);
}
