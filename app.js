var redisHost = 'localhost';
var redisPort = 6379;
var redisTopic = 'events';
var geoIPDataFile = 'GeoLiteCity.dat';

if (process.argv.length >= 3) {
  redisHost = process.argv[2]
  if (process.argv.length >= 4) {
    redisPort = parseInt(process.argv[3]);
    if (process.argv.length >= 5) {
      redisTopic = process.argv[4];
      if (process.argv.length >= 6) {
        geoIPDataFile = process.argv[5];
      }
    }
  }
}
console.log('starting realtime map with redisHost: ' + 
            redisHost +
            ':' + redisPort +
            ' redisTopic: ' + redisTopic);

var express = require('express'),

    fs      = require('fs'),
    redis   = require('redis'),
    util    = require('util'),
    nowjs   = require('now'),
    geoip   = require('geoip'),
    jade    = require('jade');

var app = express.createServer(
  require('connect-assets')(),
  express.favicon(),
  express.static(__dirname + '/static'),
  function(req, res, next) {
    res.setHeader('X-Powered-By', 'Team Jeans');
    next();
  }
);

app.get('/map', function(req, res, next) {
  res.render('map.jade');
});

app.get('/controls', function(req, res, next) {
  res.render('controls.jade');
});

app.listen(5000);

var geoipCityData = geoip.open(geoIPDataFile);
console.log('loaded GeoIP City data');

// FIXME restore this
// var webroot = './static';
// var file = new(static.Server)(webroot, {
//   cache: 600,
//   headers: {'X-Powered-By': 'Team Jeans'}
// });

var redisClient = redis.createClient(redisPort, redisHost, {maxReconnectionAttempts: 2});
redisClient.on('ready', function() {
  console.log('Redis is ready');
})

app.on('close', function() {
  redisClient.quit();
})

var everyone = nowjs.initialize(app);

redisClient.on('ready', function() {
  redisClient.on('message', function(channel, data) {
    if (everyone.now.message) {
      var msg = JSON.parse(data);
      console.log(msg.message.body.event.name);
      if (msg.message.body.visit && msg.message.body.visit.prop_map && msg.message.body.visit.prop_map.ip_address) {
        var ipAddress = msg.message.body.visit.prop_map.ip_address
        var geoData = parseCityFromIP(ipAddress);
        if (geoData) {
          everyone.now.message({geoData: geoData, data: msg});
        } else {
          console.log('could not parse geoData from ip address: ' + ipAddress);
        }
      } else {
        console.log('message does not have .message.visit.prop_map.ip_address: ' + data);
      }
    }
  });
  redisClient.subscribe(redisTopic);
});

var parseCityFromIP = function(ipAddress) {
  return geoip.City.record_by_addr(geoipCityData, ipAddress);
};

var pause = false;
everyone.now.togglePause = function() {
  pause = !pause;
  everyone.now.pause(pause);
};

everyone.now.start = function() {
  this.now.pause(pause);
}
