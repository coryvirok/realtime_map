REDIS_HOST = 'localhost';
REDIS_PORT = 6379;
REDIS_TOPIC = 'events';

var app = require('http').createServer(handler),
    static = require('node-static'),
    io = require('socket.io').listen(app),
    fs = require('fs'),
    redis = require('redis'),
    util = require('util');

var webroot = './static';
var file = new(static.Server)(webroot, {
  cache: 600,
  headers: {'X-Powered-By': 'Team Jeans'}
});

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
      } else {
        console.log('%s - %s', req.url, res.message);
      }
    });
  });
}

io.configure( function() {
  io.set('close timeout', 60 * 60 * 24); // 24h time out
});

io.sockets.on('connection', function (socket) {

  socket.on('join', function(name) {
    socket.get('session', function (err, session) {
      if (session === null) {
        var redisClient = redis.createClient(REDIS_PORT, REDIS_HOST, {maxReconnectionAttempts: 2});
        socket.set('session', {redisClient: redisClient, name: name});
        socket.emit('ready');
      }
    });
  });

  socket.on('disconnect', function () {
    socket.get('session', function (err, session) {
      console.log('Disconnect ', session.name);
      if (session !== null) {
        var client = session.redisClient;
        if (client) {
          client.quit();
        }
      }
    });
    socket.emit('ready');
  });
});
