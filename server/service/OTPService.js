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
    axios = require('axios').default;
/**
 * OTP generation Service
 * @param {String} dest OTP Destinatio 
 * @param {String} dhMac MAC Address
 */
async function generateOTP(dest, dhMac) {
    return new Promise(async function (resolve, reject) {
        try {
            logger.info('Generating OTP for ', dest, dhMac);
            var payload;
            await axios.get(`${LOOPBACK_ENDPOINT}/api/users/generateotp/` + dest + '/' + dhMac)
                .then((res) => {
                    let data = res.data;
                    if (data.success) {
                        logger.info('OPT generation succesful ', dest, dhMac);
                        accessLogger.info('OTP generation successful, response', dest, dhMac, data);
                        payload = {
                            success: true,
                            message: data.reason
                        }
                        resolve(payload);
                    } else {
                        logger.error('Failed to generate OTP', dest, dhMac, data);
                        accessLogger.info('OTP generation unsuccessful, response', dest, dhMac, data);
                        payload = {
                            success: false,
                            message: data.reason
                        }
                        resolve(payload);
                    }
                }).catch((error) => {
                    throw error;
                });
        } catch (ex) {
            logger.error(`Error while gerating OTP for destination: ${dest}, dhMac ${dhMac}`, ex);
            payload = {
                success: false,
                message: ex.message
            };
            reject(payload);
        }

    });

};
exports.generateOTP = generateOTP;


async function verifyAndExpireOTP(otp, dhMac, dest) {
    return new Promise(async function (resolve, reject) {
        try {
            logger.info('verifying OTP for ', dhMac, dest, otp);
            let payload,
                recieverId = dhMac.replace(/:/g, '');
            await axios.get(`${LOOPBACK_ENDPOINT}/api/users/verifyotp/` + dhMac + '/' + otp)
                .then((res) => {
                    let data = res.data;
                    if (!data.success) {
                        logger.error('Failed to verify OTP', dest, dhMac, data);
                        payload = {
                            success: false,
                            message: data.reason
                        }
                    } else if (!clientIdMap.has(recieverId)) {
                        logger.error(`Client ${dhMac} is offline. Session creation failed`);
                        payload = {
                            success: false,
                            message: `Client ${dhMac} is offline. Please try later`
                        }
                    } else if (clientIdMap.get(recieverId).currSessionCount > maxConcurrentSessionPerDH) {
                        logger.error(`Client ${dhMac} already has max concurrent sessions running. `);
                        payload = {
                            success: false,
                            message: `Client ${dhMac} already has max concurrent sessions running. Please try later`
                        }
                    } else if (sessionMap.stats.keys > maxConcurrentSession) {
                        logger.warn(`Overall maximum number of concurrent sessions running. Cannot accept new session request`);
                        payload = {
                            success: false,
                            message: `Maximum number of concurrent sessions running. Please try later`
                        }
                    } else {
                        logger.info('OPT verfied succesful ', dest, dhMac);
                        accessLogger.info('OTP verification successful, response', dest, dhMac, data);
                        clientIdMap.get(recieverId).currSessionCount++;
                        let sessionId = generateRandomAlphanumeric(25);
                        date = getCurrDate_DD_mm_YYYY(),
                            time = getCurrTime_HHMM(),
                            fileName = `${time}-${dest}`,
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
                        writeStream.write(`${dest} succssfully logged in to ${dhMac} at ${new Date()}`)
                        // Saving sessionMap data
                        sessionMap.set(sessionId, {
                            dest: recieverId,
                            user: dest,
                            stream: writeStream,
                            fileName: `${dir}/${fileName}`
                        })
                        payload = {
                            id: sessionId,
                            success: true,
                            message: data.reason
                        };
                        axios.get(`${LOOPBACK_ENDPOINT}/api/users/expireOTP/` + dest + '/' + dhMac)
                            .then((res) => {
                                let data = res.data;
                                if (data.success) {
                                    logger.info('OPT expired succesful ', dest, dhMac, otp);
                                    logger.debug('OTP expired response', data);

                                } else {
                                    logger.error('Failed to expire OTP', dest, dhMac, data);
                                    accessLogger.info('Failed to expire OTP, response', dest, dhMac, data);

                                }
                            }).catch((error) => {
                                throw error;
                            });
                    }
                    resolve(payload);
                }).catch((error) => {
                    throw error;
                });
        } catch (ex) {
            logger.error(`Error while verifying OTP for destination: ${dest}, dhMac ${dhMac}`, ex);
            payload = {
                success: false,
                message: ex.message
            };
            reject(payload);
        }

    });

};
exports.verifyAndExpireOTP = verifyAndExpireOTP;
