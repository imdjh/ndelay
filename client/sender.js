#!/usr/bin/env node
"use strict"

/**
 * META-data
 * Author: dyejarhoo@gmail.com
 * lang-spec: es6
 * version: 0.4.1
 */

/**
 * Module dependencies
 */
var net = require('net'); //TODO : move 2 condition

var program = require('commander');	// parse cli arguments
var express = require('express');	// powering result page


/**
 * Parse argv
 */
program
    .version('0.2.1')
    .usage('-t <ip> [-d] [-l <ms> | --bandwith <bps>] [--http]')
    .option('-v, --verbose', 'Make verbose')
    .option('-t, --target <ip>', 'Specify target host', '127.0.0.1') // MAGIC
    .option('-p, --port <port>', 'Specify target port', 8100)
    .option('-d, --daemon', 'Work in daemon mode')
    .option('-l, --limit <ms>', 'Connect every <ms> seconds, default to 200')
    .option('--bandwith <bps>', 'Make ndelay takes up to ~<bps> bandwidth, can\'t use with --limit')
    .option('--http', 'Testing with target in http mode')
    .option('--local-port <port>', 'Set result page in localhost:<port>, default to 8188', 8188)
    .option('--packet-size <byte>', 'Sends <byte> size packet against target, default to 1000', 1000)
    .parse(process.argv);

if (program.args.length) {
    program.outputHelp();
    process.exit(1);
}


/**
 * Initialize values
 */
var isVerbose = 0;
var getInited = 0;
if (program.verbose) {
    isVerbose = 1;
    var util = require('util');
}
if (!program.bandwith) {
    if (!program.limit) {
        program.limit = 200;
    }
}
if (program.bandwith) {
    if (!program.limit) {
        program.limit = Math.floor(program.packetSize / program.bandwith);
    }
}

/**
 * Main Logic
 */
if (!program.http) {
    let arrTimeList = [];
    let errCount = 0;
    let timeStamp1, timeStamp2;
    let client = new net.Socket();
    // Would have 10+ event listeners
    client.setMaxListeners(0);

    client.on('error', function (e) {
        if (isVerbose) {
            console.log('Connection error happens');
        }
        errCount++;
        client.destroy();
    });

    client.on('data', function (d) {
        // TODO: check the data first
        timeStamp2 = Date.now();

        // push result into array arrTimeList
        arrTimeList.push(timeStamp2 - timeStamp1);

        if (isVerbose) {
            console.log('diff tmie: ' + (timeStamp2 - timeStamp1));
            avg();	// report per connection
        }

        // Mission complete
        client.destroy();
    });

    client.on('close', function (c) {
        if (isVerbose) {
            console.log('Self destruct Successful!');
        }
    });

    setInterval(function () {
        client.connect(program.port, program.target, function () {
            let buf = new Buffer(program.packetSize, 'binary');
            client.write(buf);
            // write down the timestamp1
            timeStamp1 = Date.now();
        });
    }, program.limit);


    // Give result on SIGINT
    process.on('SIGINT', function () {
        avg();

        let timeListLength = arrTimeList.length;
        let errRate = errCount / timeListLength;

        // Output ERR connection times & rate
        if (errCount) {
            console.log('ERR happen: ' + errCount + ' times!');
            console.log(`ERR rate: ${errCount} / ${timeListLength} = ${errRate}`);
        }

        // Output worst delay
        console.log('Max delay: ' + Math.max.apply(null, arrTimeList));
        process.exit();
    });
} else {
    let http = require('http');
    let qs = require('querystring');
    let redis = require('redis'),
        client = redis.createClient(); // TODO: configurable via cli
    client.on('error', (err) => {
        console.log("Error", err);
    });

    let webapp = require('express')();

    client.on('ready', () => {
        client.del("counting, stor, logging");
        let date = new Date();
        client.rpush("logging", date.getHours());
        if (isVerbose) {
            console.log("Redis ready to receive data.");
        }
    });

    let noKeepAliveAgent = new http.Agent({keepAlive: false});
    let options = {
        port: program.port,
        host: program.target,
        method: 'POST',
        path: '/',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    options.agent = noKeepAliveAgent;

    // TODO: timeout exception handler

    if (isVerbose) {
        console.log(`Packet sends once ${program.limit} ms`);
    }

    setInterval(function () {
        let date = new Date();
        if (date.getMinutes() < 1 && getInited == 0) { // MAGIC
            getInited = 1;
            // get result &  restore
            http.get(`http://localhost:${program.localPort}`, (res) => {  // get result from API
                res.on('data', (chunk) => {
                    client.rpush("logging", chunk.toString());
                    if (isVerbose) {
                        console.log(chunk.toString());
                    }
                    client.zunionstore("stor", 2, "counting", "stor");
                    client.del("counting");
                })
            });
        } else if (getInited && date.getMinutes() >= 1) {
            getInited = 0;
        }
        let self = this;
        let timeStamp = {
            one: 0,
            two: 0
        }
        self.timeStamp = timeStamp;

        let data = qs.stringify({
            ndelay: genRandomString()
        });
        let bufSize = Buffer.byteLength(data);
        // TODO: sent Content-Length

        let req = http.request(options, function (res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                if (chunk.toString().length > 990) {
                    self.timeStamp.two = Date.now();
                    if (isVerbose) {
                        console.log('timeStamp.two', self.timeStamp.two, 'been written');
                    }

                    // write result to database
                    let tdiff = self.timeStamp.two - self.timeStamp.one;
                    client.zincrby("counting", "1", tdiff, function (err, res) {
                        if (err || res === undefined) {
                            console.log('Unexpected Redis error, quitting...');
                            process.exit(255);
                        }
                    })
                    if (isVerbose) {
                        console.log('network delay:', tdiff);
                    }
                } else {
                    console.log('Response packet invalid! /!\\Connection Closed/!\\');
                    return false;
                }
            });
        });
        req.on('error', (err) => {
            if (err.message.indexOf('REF') !== -1) {
                console.log('Server refused connection! Maybe in wrong running mode.(http/tcp)');
                process.exit(1);
            }
        })
        req.write(data);
        if (isVerbose) {
            console.log(`${program.packetSize} size packet has been sent!`, 'Listen for response');
        }
        req.end();
        self.timeStamp.one = Date.now();
        if (isVerbose) {
            console.log('timeStamp.one', self.timeStamp.one, 'been written');
        }
    }, program.limit);


    var packetCount, totalTimeTransfer,
        delayMax, delayMin;
    setInterval(() => {
        // redis manipulate

        // Get packet count
        packetCount = 0;
        client.zrange("counting", 0, -1, 'WITHSCORES', (err, reply) => {
            if (false) { // TODO: debug info
                console.log('Received:', reply.length / 2);
                console.log(util.inspect(reply));
            }
            reply.forEach((raw, index) => {
                if (index % 2 !== 0) {
                    packetCount += Number(raw);
                }
            });
        });

        // Get packet total transfer time
        totalTimeTransfer = 0;
        client.zrange("counting", 0, -1, 'WITHSCORES', (err, reply) => {
            if (false) {  // TODO: debug info
                console.log('Received:', reply.length);
                console.log(util.inspect(reply));
            }
            for (let i = 0; i <= reply.length - 1; i += 2) {
                totalTimeTransfer += Number(reply[i]) * Number(reply[i + 1]);
            }
        });

        // Max delay
        client.sort("counting", "DESC", "LIMIT", 0, 1, (err, reply) => {
            delayMax = Number(reply)
        });

        // Most common delay, as 'min'
        client.zrange("counting", -1, -1, (err, reply) => {
            delayMin = Number(reply)
        })
    }, program.limit * 1); // MAGIC number

    /**
     * Web interface implements
     */
    webapp.get('/sum', function (req, res) {
        if (isVerbose) {
            console.log('Total packet transfer time is', totalTimeTransfer);
            console.log('Total packet count is', packetCount);
        }

        // TODO: persudo succ num, implement setTimeout event first
        // mdev value
        let avg = Math.floor(totalTimeTransfer / packetCount);
        res.append('Access-Control-Allow-Origin', '*');
        res.json({
            'count': packetCount, 'succ': packetCount, 'sumTime': totalTimeTransfer, 'result': {
                'avg': avg,
                'max': delayMax,
                'min': delayMin
            }
        });

    });
    webapp.get('/api/hourly', function (req, res) {
        let dataset = [];
        client.zrange("counting", 0, -1, 'WITHSCORES', (err, reply) => {
            let interobj = {};
            reply.forEach((raw, index) => {
                if (index % 2 == 0) {
                    // 0, 2, 4... is data
                    interobj.y = raw;
                } else {
                    // 1, 3, 5... is count
                    interobj.x = raw;
                    dataset.push((function (obj) {
                            let clone = {};
                            for (var key in obj) {
                                if (obj.hasOwnProperty(key)) //ensure not adding inherited props
                                    clone[key] = obj[key];
                            }
                            return clone;
                        }(interobj))
                    ); // js .push push only reference
                }
            });
            res.append('Access-Control-Allow-Origin', '*');
            res.json(dataset);
        });

    });

    webapp.listen(program.localPort, () => {
        console.log('Web interface running @ localhost:' + program.localPort);
    })


}

// generate random but fixed-size string
function genRandomString() {
    let arrSeed = ['4', '2', 'L', 'K'];  // Full of MAGIC
    let arrString = [];

    for (let i = 0; i < program.packetSize; i++) {
        let r = Math.random() * arrSeed.length;
        arrString.push(arrSeed[Math.floor(r)]);
    }

    return arrString.join('');
}

// current avg result
// TODO: rewrite as helper
function avg() {
    let sum = 0;
    for (let i = 0; i < arrTimeList.length; i++) {
        sum += arrTimeList[i];
    }
    console.log('Average is :' + (sum / arrTimeList.length));
}
