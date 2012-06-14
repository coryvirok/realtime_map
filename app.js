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

var app    = require('http').createServer(handler),
    static = require('node-static'),
    fs     = require('fs'),
    redis  = require('redis'),
    util   = require('util'),
    nowjs  = require('now'),
    geoip  = require('geoip');


var geoipCityData = geoip.open(geoIPDataFile);
console.log('loaded GeoIP City data');

var webroot = './static';
var file = new(static.Server)(webroot, {
  cache: 600,
  headers: {'X-Powered-By': 'Team Jeans'}
});

var redisClient = redis.createClient(redisPort, redisHost, {maxReconnectionAttempts: 2});
redisClient.on('ready', function() {
  console.log('Redis is ready');
})

app.on('close', function() {
  redisClient.quit();
})

var everyone = nowjs.initialize(app);

app.listen(5000);

function handler(req, res) {
  req.addListener('end', function() {
    file.serve(req, res, function(err, result) {
      if (err) {
        console.error('Error serving %s - %s', req.url, err.message);
        if (err.status === 404 || err.status === 500) {
          file.serveFile(util.format('/%d.html', err.status), err.status, {}, req, res);
        } else {
          res.writeHead(err.status, err.headers);
          res.end();
        }
      }
    });
  });
}

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

setInterval(function() {
  // updateMap isn't defined unless a client has connected
  if (!everyone.now.updateMap) {
    return;
  }
  everyone.now.updateMap({foo: 'bar'});
}, 5000);
