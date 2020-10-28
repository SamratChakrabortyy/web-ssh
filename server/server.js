var express = require('express');
var http = require('http');
const NodeCache = require( "node-cache" );


// Setup the express app
var app = express();

// Create Server using the app and bind it to a port
var server = http.createServer(app).listen(8080);

// Static file serving
app.use("/:mac",express.static("./"));
var clientIdMap = new NodeCache({
   stdTTL: (30 * 60),
   checkperiod: (10 * 60)
});

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
    clientIdMap.set(data, socket.id);
    //console.log('Client Id Map', clientIdMap);
    console.log(`${data} successfully registered with id ${socket.id}`);
    io.to(socket.id).emit('register','successful');
  });

  socket.on('input', (data) => {
    try { 
      console.log('input data 1', data);
      data = JSON.parse(data);
      console.log(`input data`, data);
      transmit('input', data, socket.id);
    } catch(ex){
      console.error("Error at input event", ex);
      io.to(socket.id).emit('input','Error at input event');
    }
  });

  socket.on('output', (data) => {
    try {
      console.log('output data 1', data);
      data = JSON.parse(data);
      console.log(`output data`, data);
      transmit('output', data, socket.id);
    } catch(ex){
      console.error('Error at output event', ex);
      io.to(socket.id).emit('output','Error at output event');
    }
  })

  var transmit = (event, message, id) => {
    try{
      if(event == undefined || !event instanceof String || message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
        throw new Error('Invalid Message template');
      clientIdMap.set(message.from, id);
      if(!clientIdMap.has(message.to))
        throw new Error(`${message.to} Reciver offline`);
      console.log(`Sending ${event} to sock id ${clientIdMap.get(message.to)} body ${message.body}`);
      io.to(clientIdMap.get(message.to)).emit(event, JSON.stringify(message));
      io.to(clientIdMap.get(message.from)).emit(event, 'successful');
    } catch (ex){
      console.error('Error while transmitting message', ex);
      io.to(socket.id).emit(event, ex.message);
    }
  };
});
