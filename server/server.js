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
var server = http.createServer(app).listen(8080);

// Static file serving
app.use("/:mac", express.static("./"));

// this is specifically to map the name of the client to the socket id
var clientIdMap = new NodeCache({
	stdTTL: (30 * 60),
	checkperiod: (10 * 60),
});


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

/**
 * SessionDataMap will contain the actual input output of the session. 
 * On expiry this data will be flushed into the file opened for this particulat session. 
 */
/* var sessionDataMap = new NodeCache({
	stdTTL: 30,
	checkperiod: 10,
	useClones: false,
})

//Flushing data on deletion from cache
sessionDataMap.on('del', (key, val) => {
	try{
		let stream = sessionMap.get(key).stream;
		stream.write(val);
	} catch (ex){
		logger.error('Error on delete event of sessionDataMap', ex);
	}

}); */

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
        hr = '0' + month;
    if (min.length < 2) 
        min = '0' + day;

    return [hr, min].join('-');
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
		clientIdMap.set(data, socket.id);
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
				fileName = `${time}.log`,
				dir = `${sessionDirBasePath}/${date}/${sessionData.dest}`;
			//checking if folder Exista
			if(!fs.existsSync(dir)){
				fs.mkdir(dir);
			}
			let writeStream = fs.createWriteStream(`${dir}/${fileName}`, {flags:'a'});
			writeStream.write()
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
			data = JSON.parse(data);
			transmit('input', data, socket.id);			
		} catch (ex) {
			logger.error("Error at input event", ex);
			io.to(socket.id).emit('input', 'Error at input event');
		}
	});

	socket.on('output', (data) => {
		try {
			let message = JSON.parse(data);
			transmit('output', data, socket.id);
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
	})

	var transmit = (event, message, id) => {
		try {
			if (event == undefined || !event instanceof String || message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
				throw new Error('Invalid Message template');
			clientIdMap.set(message.from, id);
			if (!clientIdMap.has(message.to))
				throw new Error(`${message.to} Reciver offline`);
			logger.info(`Sending ${event} to sock id ${clientIdMap.get(message.to)} msg ${message} `);
			io.to(clientIdMap.get(message.to)).emit(event, JSON.stringify(message));
			io.to(clientIdMap.get(message.from)).emit(event, 'successful');
		} catch (ex) {
			logger.error('Error while transmitting message', ex);
			io.to(socket.id).emit(event, ex.message);
		}
	};

	clientIdMap.on('expired', (key, val) => {
		let session = sessionMap.get(key);
		logger.info(`Ending session with ${session.dest} and saving the file at ${session.fileName}`);
		stream.end();
		sessionMap.del(key);
		io.to(val).emit('session_end','session_end');
	});

});
