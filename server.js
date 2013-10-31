var express = require('express')
  , path = require('path')
  , app = express()
  , port = process.env.PORT || 5000
  //, host = process.env.IP || 'localhost'
  //, io = require('socket.io').listen(app.listen(port, host));
  , io = require('socket.io').listen(app.listen(port));

app.configure(function(){
  // serve css, js, images folders as static files
  app.use('/css', express.static(path.join(__dirname, 'css')));
  app.use('/js', express.static(path.join(__dirname, 'js')));
  app.use('/images', express.static(path.join(__dirname, 'images')));
  app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
});

app.get('/', function(req, res){
  res.sendfile('index.html');
});

console.log('Listening on port ' + port);

/* Heroku Socket.IO configuration https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku */
// assuming io is the Socket.IO server object
// io.configure(function () {
//   io.set("transports", ["xhr-polling"]);
//   io.set("polling duration", 10);
// });
/* END Heroku Socket.IO configuration */


/** Here be multiplayer dragons */

var tanks = {};

io.sockets.on('connection', function (socket) {
  //console.log("new player connecting", socket.id);

  new Player(socket);
});

/** An server side instance of a Player */
function Player(socket) {
  var SELF = this;

  this.id = socket.id;

  var _private = {
    socket: socket
  }

  var _events = {
    // when a player is connected
    connected: function() {
      // send new player all existing tanks
      for (var id in tanks) {
        _private.socket.emit('add-tank', tanks[id]);
      }
    },

    /** When a player's tank is killed, or player is disconnected */
    removeTank: function() {
      // delete this tank from server data
      delete tanks[SELF.id];

      //remove this tank from all remotes
      _private.socket.broadcast.emit('remove-tank', SELF.id);
    }
  }

  // when a player deploys a tank
  _private.socket.on('add-player-tank', function (data) {
    //console.log("add-player-tank");

    data.id = _private.socket.id;

    // add tank to server data
    tanks[data.id] = data;

    //update the tanks data
    //tanks[data.id].x = data.x;
    //tanks[data.id].y = data.y;
    //tanks[data.id].angle = data.angle;
    //tanks[data.id].aimAngle = data.aimAngle;

    //send update to all players (including the player that added the tank)
    io.sockets.emit('add-tank', tanks[data.id]);
  });

  // when this player is updated, send data to all remote players
  _private.socket.on('player-tank-update', function (data) {
    //console.log("player-tank-update", data);
    //update the server data with the tanks data
    if (tanks[data.id]) {
      tanks[data.id].x = data.x;
      tanks[data.id].y = data.y;
      tanks[data.id].angle = data.angle;
      tanks[data.id].aimAngle = data.aimAngle;

      //send update to other players
      _private.socket.broadcast.emit('remote-tank-update', tanks[data.id]);
    } else {
      console.log("tank not found", data.id);
    }
  });

  // when a tank is killed, send data to all remotes
  _private.socket.on('tank-killed', function () {
    //console.log("tank-killed");
    _events.removeTank();
  });

  // when a player fires a bullet, send data to all remotes
  _private.socket.on('add-bullet', function (data) {
    //console.log("add-bullet");
    //send update to other users
    _private.socket.broadcast.emit('add-bullet', data);
  });

  /* when a player disconnects */
  _private.socket.on('disconnect', function () {
    //console.log("player disconnected " + SELF.id);
    // if this player had a tank, remove it
    if (tanks[SELF.id]) {
      _events.removeTank();
    }
  });

  // init
  (function() {
    _events.connected();
  })();
}