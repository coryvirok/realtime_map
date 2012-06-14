redis_host = 'localhost';
redis_port = 6379;
redis_topic = 'events';

if (process.argv.length >= 3) {
  redis_host = process.argv[2]
  if (process.argv.length >= 4) {
    redis_port = parseInt(process.argv[3]);
    if (process.argv.length >= 5) {
      redis_topic = process.argv[4];
    }
  }
}
console.log('starting realtime map with redis_host: ' + 
            redis_host +
            ':' + redis_port +
            ' redis_topic: ' + redis_topic);

var app    = require('http').createServer(handler),
    static = require('node-static'),
    fs     = require('fs'),
    redis  = require('redis'),
    util   = require('util'),
    nowjs  = require('now');

var webroot = './static';
var file = new(static.Server)(webroot, {
  cache: 600,
  headers: {'X-Powered-By': 'Team Jeans'}
});

var redisClient = redis.createClient(redis_port, redis_host, {maxReconnectionAttempts: 2});
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
  redisClient.on('message', function(channel, message) {
    if (everyone.now.message) {
      everyone.now.message({message: message});
    }
  });
  redisClient.subscribe(redis_topic);
});

setInterval(function() {
  // updateMap isn't defined unless a client has connected
  if (!everyone.now.updateMap) {
    return;
  }
  everyone.now.updateMap({foo: 'bar'});
}, 5000);
