var redisHost = 'localhost';
var redisPort = 6379;
var redisTopic = 'events';
var geoIPDataFile = 'GeoLiteCity.dat';
var geoJsonStatesFile = 'static/us-states.json';
var geoJsonCountriesFile = 'static/world-countries.json';
var eventWhitelist = {'game_start': true, 'purchased_subscription': true, 'sign_up': true};

/***** Configure the realtime map server *****/

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

/***** Require dependencies *****/

var express = require('express'),
    fs      = require('fs'),
    redis   = require('redis'),
    util    = require('util'),
    nowjs   = require('now'),
    geoip   = require('geoip'),
    jade    = require('jade');


/***** Load and index external data files *****/

var indexGeoData = function(countriesGeoData, usStatesGeoData) {
  var _createIndex = function(features) {
    var ret = {};
    var numFeatures = features.length;
    var curFeature;
    for (var index = 0; index < numFeatures; index++) {
      curFeature = features[index];
      ret[curFeature.properties.name] = {counter: 0, childIndex: {}};
    }
    return ret;
  };

  // Create a mapping from country name to counter and subIndex
  var geoIndex = _createIndex(countriesGeoData.features);
  geoIndex['United States'].childIndex = _createIndex(usStatesGeoData.features);

  return geoIndex;
};

var geoipCityData = geoip.open(geoIPDataFile);
console.log('loaded GeoIP City data');

var worldCountriesData = JSON.parse(fs.readFileSync(geoJsonCountriesFile));
console.log('loaded country geo data');

var usStatesData = JSON.parse(fs.readFileSync(geoJsonStatesFile));
console.log('loaded US states geo data');

// Stores counters for locations and events seen since server startup
var bucketIndex = {countries: indexGeoData(worldCountriesData, usStatesData),
                   events: {}};

console.log('indexed geo data');
console.log(bucketIndex.countries);
console.log(bucketIndex.countries['United States'].childIndex);

/***** Instantiate and start the server *****/

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


/***** Instantiate redis client and subscribe to events channel *****/

var redisClient = redis.createClient(redisPort, redisHost, {maxReconnectionAttempts: 2});
redisClient.on('ready', function() {
  console.log('Redis is ready');
})

app.on('close', function() {
  redisClient.quit();
})


/***** Initialize and start the nowjs server *****/

var everyone = nowjs.initialize(app);

redisClient.on('ready', function() {
  redisClient.on('message', function(channel, data) {
    if (everyone.now.message) {
      var msg = JSON.parse(data);
      if (eventWhitelist[msg.message.body.event.name]) {
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
