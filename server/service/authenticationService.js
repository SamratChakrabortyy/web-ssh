const { sessionMap, clientIdMap } = require("../caches");
const { generateRandomAlphanumeric, getCurrDate_DD_mm_YYYY, getCurrTime_HHMM } = require("../utilis/utils");
const fs = require('fs');
const { 
        loopbackEndPoint: LOOPBACK_ENDPOINT,
        sessionDirBasePath,
        maxConcurrentSession,
        maxConcurrentSessionPerDH ,
        sessionDirRoot
    } = require('../config.json');
const path = require('path');
const { logger, accessLogger } = require("../logger"),
    axios = require('axios').default,
    users = require('../users.json');
/**
 * OTP generation Service
 * @param {String} user OTP Destinatio 
 * @param {String} dhMac MAC Address
 */
async function validateUser(user, dhMac) {
    return new Promise(async function (resolve, reject) {
        try {
            logger.info('Validating User ', user, dhMac);
            var payload;
            if(users[user] != null) {
                payload = {
                    success: true,
                    message: data.reason
                }
                resolve(payload);
            } else
                throw new Error("Unauthorised User");
        } catch (ex) {
            logger.error(`Error while vlaiating user: ${user}, dhMac ${dhMac}`, ex);
            payload = {
                success: false,
                message: ex.message
            };
            reject(payload);
        }

    });

};
exports.validateUser = validateUser;


async function verifyPass(pass, dhMac, user) {
    return new Promise(async function (resolve, reject) {
        try {
            logger.debug('verifying pass for ', dhMac, user, pass);
            let payload;
            if (pass != users[user]) {
                logger.error('Failed to verify pass', user, dhMac);
                payload = {
                    success: false,
                    message: "Unauthenticated request"
                }
                throw new Error("Unauthorised User");
            } else {
                logger.info('Pass verfied succesfully ', user, dhMac);
                accessLogger.info('Pass verification successful, response', user, dhMac, data);
                clientIdMap.get(recieverId).currSessionCount++;
                let sessionId = generateRandomAlphanumeric(25);
                date = getCurrDate_DD_mm_YYYY(),
                    time = getCurrTime_HHMM(),
                    fileName = `${time}-${user}`,
                    dir = path.join(sessionDirBasePath, date, recieverId);
                logger.info(`sessionId `, sessionId);
                //checking if folder Exista
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, {
                        recursive: true
                    })
                }
                let notebookRoot = path.join(sessionDirRoot, sessionId).toString('utf-8');
                if (!fs.existsSync(notebookRoot)) {
                    fs.mkdirSync(notebookRoot, {
                        recursive: true
                    })
                }
                let writeStream = fs.createWriteStream(`${dir}/${fileName}.log`, { flags: 'a' });
                logger.debug('commands audit log file opened at ', `${dir}/${fileName}`);
                writeStream.write(`${user} succssfully logged in to ${dhMac} at ${new Date()}`)
                // Saving sessionMap data
                sessionMap.set(sessionId, {
                    dest: recieverId,
                    user: user,
                    stream: writeStream,
                    fileName: `${dir}/${fileName}`
                })
                payload = {
                    id: sessionId,
                    success: true,
                    message: data.reason
                };
            }
            resolve(payload);

        } catch (ex) {
            logger.error(`Error while verifying Pass for user: ${user}, dhMac ${dhMac}`, ex);
            payload = {
                success: false,
                message: ex.message
            };
            reject(payload);
        }

    });

};
exports.verifyPass = verifyPass;
