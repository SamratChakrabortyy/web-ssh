const NodeCache = require('node-cache');
const { logger } = require('./logger');
const config = require('./config.json');

// this is specifically to map the name of the client to the socket id
let clientIdMap = new NodeCache({
	stdTTL: (config.maxIdleTimeInMin * 60),
	checkperiod: (config.maxIdleTimeInMin * 20),
	useClones: false
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
let sessionMap = new NodeCache({
	useClones: false,
	stdTTL: (config.maxSessionTimeinMin * 60),
	checkperiod: (config.maxSessionTimeinMin * 20),
	deleteOnExpire: false
});

sessionMap.on('expired', (key, val) => {
	try {
		logger.info(`Session between ${val.user} and ${val.dest} expired after max time out.`);
		logger.debug(`Session Id `, key);
		if (clientIdMap.has(key)) {
			logger.info(`Session id present in clientIdMap, clossing session!`);
			clientIdMap.del(key);
		}
	} catch (ex) {
		logger.error('Error while deregistering session', ex);
	}
});

sessionMap.flushStats();
sessionMap.flushAll();


exports.clientIdMap = clientIdMap;
exports.sessionMap = sessionMap;