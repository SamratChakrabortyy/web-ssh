var express = require('express');
var http = require('http');
const NodeCache = require( "node-cache" );
const logger = require('./logger').logger;


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
  logger.info("New Client Conmected");
  socket.on('register', function(data){
    if(data == undefined || !data instanceof String){
      logger.info(`Invalid client Id provided with registration request`);
      io.to(socket.id).emit('register', 'falied');
      return;
    }
    logger.info(`new Registration for ${data} sock Id ${socket.id}`);
    clientIdMap.set(data, socket.id);
    //logger.info('Client Id Map', clientIdMap);
    logger.info(`${data} successfully registered with id ${socket.id}`);
    io.to(socket.id).emit('register','successful');
  });

  socket.on('input', (data) => {
    try { 
      logger.info('input data 1', data);
      data = JSON.parse(data);
      logger.info(`input data`, data);
      transmit('input', data, socket.id);
    } catch(ex){
      logger.error("Error at input event", ex);
      io.to(socket.id).emit('input','Error at input event');
    }
  });

  socket.on('output', (data) => {
    try {
      logger.info('output data 1', data);
      data = JSON.parse(data);
      logger.info(`output data`, data);
      transmit('output', data, socket.id);
    } catch(ex){
      logger.error('Error at output event', ex);
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
      logger.info(`Sending ${event} to sock id ${clientIdMap.get(message.to)} body ${message.body}`);
      io.to(clientIdMap.get(message.to)).emit(event, JSON.stringify(message));
      io.to(clientIdMap.get(message.from)).emit(event, 'successful');
    } catch (ex){
      logger.error('Error while transmitting message', ex);
      io.to(socket.id).emit(event, ex.message);
    }
  };
});
