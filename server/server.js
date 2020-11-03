var express = require('express');
var http = require('http');
const NodeCache = require("node-cache");
const logger = require('./logger').logger;
const fs = require('fs');
const { Session } = require('inspector');
const sessionDirBasePath = "/var/log/web-ssh-sessions"


// Setup the express app
var app = express();

// Create Server using the app and bind it to a port
var server = http.createServer(app).listen(4050);

// Static file serving
app.use("/:mac", express.static("./"));

// this is specifically to map the name of the client to the socket id
var clientIdMap = new NodeCache({
	stdTTL: (30 * 60),
	checkperiod: (10 * 60),
});

clientIdMap.flushAll();
clientIdMap.flushStats();

/**
 * sessionMap will contain metadata about the session. Values of session map will be like: 
 * {
 *    dest: <datahubName>,
 *    file:  <file object for the particular session log file>,
 * 	  fileName : <name of the file>
 * }
 */
var sessionMap = new NodeCache({
	useClones: false
});

sessionMap.flushStats();
sessionMap.flushAll();

function formatCurrDate() {
    let d = new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [day, month, year].join('-');
}

function formatCurrTime() {
    let d = new Date(),
        hr = '' + (d.getHours() + 1),
        min = '' + d.getMinutes()

    if (hr.length < 2) 
        hr = '0' + hr;
    if (min.length < 2) 
        min = '0' + min;

    return `${hr}${min}`;
}
function addToCache(name, id){
	clientIdMap.set(name, id);
	clientIdMap.set(id,name);
}
// Bind socket.io to the server
var io = require('socket.io')(server);
io.on('connection', function (socket) {
	logger.info("New Client Conmected");
	socket.on('register', function (data) {
		if (data == undefined || !data instanceof String) {
			logger.info(`Invalid client Id provided with registration request`);
			io.to(socket.id).emit('register', 'falied');
			return;
		}
		logger.info(`new Registration for ${data} sock Id ${socket.id}`);
		addToCache(data, socket.id);
		//logger.info('Client Id Map', clientIdMap);
		logger.info(`${data} successfully registered with id ${socket.id}`);
		io.to(socket.id).emit('register', 'successful');
	});

	socket.on('session_start', (data) => {
		try{
			if (data == undefined || !data instanceof String) {
				logger.info(`Invalid data provided with session_start request`);
				throw new Error('Invalid Session start data');
			} 
			let sessionData = JSON.parse(data);
			if(sessionData == undefined || sessionData.id == undefined || sessionData.dest == undefined){
				logger.error('Invalid format of session data');
				throw new Error('Invalid format of session data');
			} 
			let date = formatCurrDate(),
				time = formatCurrTime(),
				fileName = `${sessionData.id}-${time}.log`,
				dir = `${sessionDirBasePath}/${date}/${sessionData.dest}`;
			//checking if folder Exista
			if(!fs.existsSync(dir)){
				fs.mkdirSync(dir, {
					recursive: true
				})
			}
			let writeStream = fs.createWriteStream(`${dir}/${fileName}`, {flags:'a'});
			// Saving sessionMap data
			sessionMap.set(sessionData.id, {
				dest: sessionData.dest,
				stream: writeStream,
				fileName: `${dir}/${fileName}`
			});
			io.to(socket.id).emit('session_start', 'successful');
		} catch (ex) {
			logger.error('Error on session_start event', ex);
			io.to(socket.id).emit('session_start', ex.message);
		}
	});

	socket.on('input', (data) => {
		try {
			let message = JSON.parse(data);
			/* if(!isValidMsg(message))
				throw new Error('Inavlid input data format'); */
			if(message.body.toLowerCase().trim() === "stop"){
				message.body = String.fromCharCode(3);
			}
			transmit('input', message, socket.id);
		} catch (ex) {
			logger.error("Error at input event", ex);
			io.to(socket.id).emit('input', 'Error at input event');
		}
	});

	socket.on('output', (data) => {
		try {
			let message = JSON.parse(data);
			transmit('output', message, socket.id);
			if(message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
				throw new Error('Invalid Output data format');
			/* let sessionData = sessionDataMap.has(data.to) ? sessionDataMap.get(data.to) : "";
			if(sessionData.length > 2*1000){
				sessionDataMap.del(message.to);
			} 
			sessionDataMap.set(message.to, sessionData); */
			sessionMap.get(message.to).stream.write(message.body);
		} catch (ex) {
			logger.error('Error at output event', ex);
			io.to(socket.id).emit('output', 'Error at output event');
		}
	});

	socket.on('disconnect', (data) => {
		try{
			let id = clientIdMap.get(socket.id);
			clientIdMap.del(socket.id);
			clientIdMap.del(id);
			logger.info(`${id} disconnected. Cleaning  up!`);
		} catch(ex){
			logger.error('Error on disconnect',ex);
		}
	});

	var transmit = (event, message, id) => {
		try {
			if (event == undefined || !event instanceof String || message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
				throw new Error('Invalid Message template');
			addToCache(message.from, id);
			if (!clientIdMap.has(message.to))
				throw new Error(`${message.to} Reciver offline`);
			logger.debug(`Sending ${event} to sock id ${clientIdMap.get(message.to)} msg `, message);
			io.to(clientIdMap.get(message.to)).emit(event, JSON.stringify(message));
			io.to(clientIdMap.get(message.from)).emit(event, 'successful');
		} catch (ex) {
			logger.error('Error while transmitting message', ex);
			io.to(socket.id).emit(event, ex.message);
		}
	};

	clientIdMap.on('del', (key, val) => {
		try{
			if(sessionMap.has(key)){
				let session = sessionMap.get(key);
				logger.info(`Ending session with ${session.dest} and saving the file at ${session.fileName}`);
				session.stream.end();
				sessionMap.del(key);
				io.to(val).emit('session_end',key);
				io.to(clientIdMap.get(session.dest)).emit('session_end',key);
			}
		} catch (ex){
			logger.error('Error on xpired event of clientIdMap', ex)
		}
	});

});
