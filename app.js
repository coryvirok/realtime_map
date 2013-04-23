var redisHost = 'localhost';
var redisPort = 6379;
var redisTopic = 'events';
var eventWhitelist = {'game_start': true,
                      'game_finish': true,
                      'purchased_subscription': true,
                      'sign_up': true};

var geoIPDataFile = 'GeoLiteCity.dat';
var geoJsonCountriesFile = 'static/world-countries.json';
var geoJsonUsFile = 'static/us.json';
var geoJsonCanFile = 'static/canada.json';
var geoJsonAusFile = 'static/australia.json';

var timestamp_lifetime_ms = 86400 * 1000;
//var timestamp_lifetime_ms = 30 * 1000;

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
    jade    = require('jade'),
    gzippo  = require('gzippo');


/***** Load and index external data files *****/

var indexGeoData = function(countriesGeoData, countryDetailData) {
  var _createIndex = function(features, useId) {
    var ret = {};
    var numFeatures = features.length;
    var curFeature;
    var curName;

    for (var index = 0; index < numFeatures; index++) {
      curFeature = features[index];
      if (useId) {
        curName = curFeature.id;
      } else {
        curName = curFeature.properties.abbrev;
      }
      ret[curName] = {totalCount: 0, timestamps: [], childIndex: {}};
    }
    return ret;
  };

  // Create a mapping from country name to counter and childIndex.
  var geoIndex = _createIndex(countriesGeoData.features, true);

  for (var countryCode in countryDetailData) {
    geoIndex[countryCode].childIndex = _createIndex(countryDetailData[countryCode].features, false);
  }

  return geoIndex;
};

var geoipCityData = geoip.open(geoIPDataFile);
console.log('loaded GeoIP City data');

var worldCountriesData = JSON.parse(fs.readFileSync(geoJsonCountriesFile));
console.log('loaded country geo data');

var usData = JSON.parse(fs.readFileSync(geoJsonUsFile));
console.log('loaded US geo data');

var canData = JSON.parse(fs.readFileSync(geoJsonCanFile));
console.log('loaded CAN geo data');

var ausData = JSON.parse(fs.readFileSync(geoJsonAusFile));
console.log('loaded AUS geo data');

// Stores counters for locations and events seen since server startup
var indexData = indexGeoData(worldCountriesData,
                             {'USA': usData,
                              'CAN': canData,
                              'AUS': ausData});

var bucketIndex = {countries: indexData, events: {}};

console.log('indexed geo data');
console.log(bucketIndex.countries.USA);
console.log(bucketIndex.countries.CAN);


/***** Instantiate and start the server *****/

var app = express();
app.use(require('connect-assets')());
app.use(express.favicon());
app.use(gzippo.staticGzip(__dirname + '/static'));
app.use(function(req, res, next) {
  res.setHeader('X-Powered-By', 'Team Jeans');
  next();
});

app.get('/map', function(req, res, next) {
  res.render('map.jade');
});

app.get('/controls', function(req, res, next) {
  res.render('controls.jade');
});

var httpServer = app.listen(5000);


/***** Instantiate redis client and subscribe to events channel *****/

var redisClient = redis.createClient(redisPort, redisHost, {maxReconnectionAttempts: 2});
redisClient.on('ready', function() {
  console.log('Redis is ready');
})

app.on('close', function() {
  redisClient.quit();
})


/***** Initialize and start the nowjs server *****/

var everyone = nowjs.initialize(httpServer);

redisClient.on('ready', function() {
  redisClient.on('message', function(channel, data) {
    if (everyone.now.message) {
      var msg = JSON.parse(data);
      var eventName = msg.message.body.event.name;
      if (eventWhitelist[eventName]) {
        if (msg.message.body.visit && msg.message.body.visit.prop_map && msg.message.body.visit.prop_map.ip_address) {
          var ipAddress = msg.message.body.visit.prop_map.ip_address
          var geoData = parseCityFromIP(ipAddress);
          var eventTimestamp = msg.message.body.visit.timestamp;

          if (geoData) {
            // Increment country and region indices
            var countryIndex = bucketIndex.countries[geoData.country_code3];
            if (countryIndex) {
              var regionIndex = countryIndex.childIndex[geoData.region];
              countryIndex.totalCount = (countryIndex.totalCount || 0) + 1;
              countryIndex.timestamps.push(eventTimestamp);
              countryIndex.timestamps = pruneTimestamps(countryIndex.timestamps);

              if (regionIndex) {
                regionIndex.totalCount = (regionIndex.totalCount || 0) + 1;
              }
            } else {
              console.log('> unknown country name/data: ' + geoData.country_code3);
              console.log('> ' + JSON.stringify(geoData));
            }

            // store a counter for events so we can send to clients on load
            var eventDetails = bucketIndex.events[eventName] || {totalCount: 0, timestamps: []};
            eventDetails.totalCount = eventDetails.totalCount + 1;
            eventDetails.timestamps.push(eventTimestamp);
            eventDetails.timestamps = pruneTimestamps(eventDetails.timestamps);

            bucketIndex.events[eventName] = eventDetails;

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

var pruneTimestamps = function(timestamps) {
  var now = (new Date()).getTime();
  var cutOff = now - timestamp_lifetime_ms;

  return timestamps.filter(function(element, index, array) {
    return element >= cutOff;
  });
};

var pause = false;
everyone.now.togglePause = function() {
  pause = !pause;
  everyone.now.pause(pause);
};

everyone.now.start = function() {
  this.now.pause(pause);
}

everyone.now.getIndex = function() {
  this.now.receiveIndex(bucketIndex);
}
