const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const { httpLogger, logger } = require('./logger');
const config = require('./config.json');
const PORT = config.port;
const apiOtp = require('./routes/auth');
const { sessionMap } = require('./caches');
const { initiateSocketController } = require('./socketController');
const notebookService = require('./service/notebookService');
const fs = require('fs');
const path = require('path');

// Setup the express app
var app = express();

// Create Server using the app and bind it to a port
var server;
if(config.isHttpsEnabled){
	let options = {
		key: fs.readFileSync(config.httpsOptions.key),
		cert: fs.readFileSync(config.httpsOptions.cert)
	}
	server = https.createServer(options, app);
} else {
	server = http.createServer(app);
}
server.listen(PORT);
app.use(express.static("./views/static"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(log4js.connectLogger(httpLogger, {
	level: 'info',
	format: (req, res, format) => format(':remote-addr - ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"'),
}));
// set the view engine to ejs
app.set('view engine', 'ejs');
//OTP Controller
app.use('/api/otp', apiOtp);


// viewed at http://localhost:8080
app.get("/", (req, res) => {
	res.render('index', {
		error: false
	});
});

/**
 * Key shoudld be the base64 encoded version of mobileNo<>dhMac
 */
app.get('/terminal/:key', async (req, res) => {
	try {
		let key = req.params.key;
		if (!sessionMap.has(key) || sessionMap.get(key).active)
			throw new Error('Unauthorized Access');
		sessionMap.get(key)['active'] = true;
		let dest =  sessionMap.get(key).dest;
		logger.info(`Opennng terminal for ${key}`);
		res.status(200).render('term', {
			key,
			dest
		})

	} catch (ex) {
		logger.error('Error while Rendering web-ssh terminal', ex);
		let status = ex.message == 'Unauthorized Access' ? 401 : 500;
		res.status(status).render('index', {
			error: true
		})
	}
});

/* app.get('/notebook/:key', async(req, res) => {
	try{
		let key = req.params.key;
		if(!sessionMap.has(key) || sessionMap.get(key).active != true)
			throw new Error('Unauthorized Access');
		let notebookForsession = await notebookService.getNotebookFile(key);

		let notepadHtml = fs.readFileSync(path.join(config.jupyterNotebookBasePath, notebookForsession.toString('utf-8'))).toString('utf-8');
		logger.debug(`notepadhtml length: `, notepadHtml.length);
		res.redirect(path.join(config.jupyterNotebookBasePath, notebookForsession.toString('utf-8')))
	} catch (ex){
		logger.error('Error while notebook web-ssh', ex);
		let status = ex.message == 'Unauthorized Access' ? 401 : 500;
		res.status(status).render('index', {
			error: true
		});
	}
}); */

	app.get('/notebook/:key', async(req, res) => {
		try{
			let key = req.params.key;
			if(!sessionMap.has(key) || sessionMap.get(key).active != true)
				throw new Error('Unauthorized Access');
			/*
			 * notebookService.getNotebookForSessioId(key) determines the directory of the user
			 * runs an instance of jupyter-notebook at that particular directory using '--notepad-dir'
			 * Collects the notebook info using 'jupyter-notebook list --jsonlist'
			 * return the info back to the route
			 */
			let notebookPID = await notebookService.getNotebookPid(key);
			let notebookUrl = sessionMap.get(key).notebookUrl;
			logger.debug('Pid   url', notebookPID, notebookUrl)
			logger.info('redirecting notebook req for ', key, sessionMap.get(key).notebookUrl)
			res.redirect(notebookUrl)
		} catch (ex){
			logger.error('Error while notebook web-ssh', ex);
			let status = ex.message == 'Unauthorized Access' ? 401 : 500;
			res.status(status).render('index', {
				error: true
			});
		}
	});

//Cleaning up client roots if present
if(fs.existsSync(`${config.sessionDirRoot}`)){
	logger.debug(`Files present older cleint  sessions. Deleting all files fetched previously`);
	fs.rmdirSync(`${config.sessionDirRoot}`, {recursive: true});
	logger.info(`Deleted all files fetched previouslys`);
}

//Initiating socket Server
initiateSocketController(server);
