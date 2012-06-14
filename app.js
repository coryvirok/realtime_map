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
  io.set('close timeout', 60*60*24); // 24h time out
});

function SessionController (user) {
  // session controller class for storing redis connections
  // this is more a workaround for the proof-of-concept
  // in "real" applications session handling should NOT
  // be done like this
  this.sub = redis.createClient(REDIS_PORT, REDIS_HOST, {maxReconnectionAttempts: 2});
  this.pub = redis.createClient(REDIS_PORT, REDIS_HOST, {maxReconnectionAttempts: 2});

  this.user = user;
}

SessionController.prototype.subscribe = function(socket) {
  var sub = this.sub;
  var client = sub.client;
  var self = this;

  console.log('SessionController.subscribe');

  sub.on('message', function(channel, message) {
    console.log('REDIS MESSAGE: ' + message);
    socket.emit(channel, message);
  });

  sub.on('subscribe', function(channel, count) {
    console.log('REDIS SUBSCRIBE count: ' + count);
    socket.emit(channel, JSON.stringify({action: 'join', user: this.user});
  });
  console.log('subscribing to redis topic: ' + REDIS_TOPIC);
  sub.subscribe(REDIS_TOPIC);
};

SessionController.prototype.unsubscribe = function() {
  console.log('SessionController.unsubscribe');
  this.sub.unsubscribe('map');
};

SessionController.prototype.publish = function(message) {
  console.log('SessionController.publish: ' + message);
  this.pub.publish('map', message);
};

SessionController.prototype.destroyRedis = function() {
  console.log('SessionController.destroyRedis');
  if (this.sub !== null) this.sub.quit();
  if (this.pub !== null) this.pub.quit();
};

io.sockets.on('connection', function (socket) {
  console.log('socket.io connection');
  console.log(socket.id);

  socket.on('join', function(data) {
    console.log('socket.io join');
    var msg = JSON.parse(data);
    var sessionController = new SessionController(msg.user);
    socket.set('sessionController', sessionController);
    sessionController.subscribe(socket);
    // just some logging to trace the chat data
    console.log(data);
  });

  socket.on('disconnect', function() {
    console.log('socket.io disconnect');
    socket.get('sessionController', function(err, sessionController) {
      if (sessionController != null) {
        sessionController.unsubscribe();
        var leaveMessage = JSON.stringify({action: 'leave', user: sessionController.user});
        sessionController.publish(leaveMessage);
        sessionController.destroyRedis();
      }
    });
  });
});
