var express = require('express');
//var https = require('https');
var http = require('http');
//var fs = require('fs');

//var pty = require('pty.js');
//var pty = require('/usr/src/node-pty');


// Setup the express app
var app = express();
// HTTPS key and certificate files
/* var options = {
  key: fs.readFileSync('keys/key.pem'),
  cert: fs.readFileSync('keys/cert.pem')
}; */

// Create Server using the app and bind it to a port
//https.createServer(options, app).listen(4000)
var server = http.createServer(app).listen(8080);

// Static file serving
app.use("/",express.static("./"));
var clientIdMap = {};
var idClientMap = {}

// Bind socket.io to the server
var io = require('socket.io')(server);
io.on('connection', function(socket){
  console.log("New Client Conmected");
  socket.on('register', function(data){
    if(data == undefined || !data instanceof String){
      console.log(`Invalid client Id provided with registration request`);
      io.to(socket.id).emit('register', 'falied');
      return;
    }
    console.log(`new Registration for ${data} sock Id ${socket.id}`);
    clientIdMap[data] = socket.id;
    idClientMap[socket.id] = data;
    console.log('Client Id Map', clientIdMap);
    console.log(`${data} successfully registered`);
    io.to(socket.id).emit('register','successful');
  });

  socket.on('input', (data) => {
    try {
      data = JSON.parse(data);
      console.log(`input data`, data);
      transmit('input', data);
    } catch(ex){
      console.error("Error at input event", ex);
      io.to(socket.id).emit('input','Error at input event');
    }
  });

  socket.on('output', (data) => {
    try {
      data = JSON.parse(data);
      console.data(`output data`, data);
      transmit('output', data);
    } catch(ex){
      console.error('Error at output event', ex);
      io.to(socket.id).emit('output','Error at output event');
    }
  })

  var transmit = (event, message) => {
    try{
      if(event == undefined || !event instanceof String || message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
        throw new Error('Invalid Message template');
      if(clientIdMap[message.to] == undefined)
        throw new Error(`${message.to} Reciver offline`);
      console.log(`Sending ${event} to sock id ${clientIdMap[message.to]} body ${message.body}`);
      io.to(clientIdMap[message.to]).emit(event, JSON.stringify(message));
      io.to(socket.id).emit(event, 'successful');
    } catch (ex){
      console.error('Error while transmitting message', ex);
      io.to(socket.id).emit(event, ex.message);
    }
  };
});



io.on('term-lb1', function(socket){
  console.log("term");
  io.emit('term-lb1',"start");
});/* 

// When a new socket connects
io.on('connection', function(socket){
  // Create terminal
  var term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });
  // Listen on the terminal for output and send it to the client
  term.on('data', function(data){
    socket.emit('output', data);
  });

  // Listen on the client and send any input to the terminal
  socket.on('input', function(data){
    term.write(data);
  });

  // Listen for a resize request and update the terminal size
  socket.on('resize', function(data){
    term.resize(data[0], data[1]);
  });

  // When socket disconnects, destroy the terminal
  socket.on("disconnect", function(){
    term.destroy();
    console.log("bye");
  });
});
 */