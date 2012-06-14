REDIS_HOST = 'localhost';
REDIS_PORT = 6379;
REDIS_TOPIC = 'events';

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs'),
    redis = require('redis');

app.listen(5000);

function handler(req, res) {
  // just return the index HTML
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
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
