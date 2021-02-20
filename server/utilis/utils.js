const { logger } = require("../logger");
const { execSync, spawn } = require('child_process');
const { resolve } = require("path");
const { rejects } = require("assert");

/**
 * Mac address Validator
 * @param {String} mac MAC address containing ':'
 */
exports.isValidMAC = (mac) => {
    return /^[0-9a-f]{1,2}([:])[0-9a-f]{1,2}(?:\1[0-9a-f]{1,2}){4}$/i.test(mac);
}

/**
 * Generate Random alphanureic String of given length
 * @param {Integer} length Length of the Random String; 
 */
exports.generateRandomAlphanumeric = (length) => {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
/**
 * Returns current date in DD-mm-YYYY format
 */
exports.getCurrDate_DD_mm_YYYY = () => {
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

/**
 * Returns curr time in HHMM formar
 */
exports.getCurrTime_HHMM = () => {
    let d = new Date(),
        hr = '' + (d.getHours()),
        min = '' + d.getMinutes()

    if (hr.length < 2)
        hr = '0' + hr;
    if (min.length < 2)
        min = '0' + min;

    return `${hr}${min}`;
}

/**
 * 
 * @param {Number} port 
 * @returns {Boolean} 
 */
exports.isPortAvailable = (port) => {
    try{
        return parseInt(execSync(`./checkPort.sh ${port}`, {
            cwd : `../scripts`,
            encoding: 'utf-8',
            timeout: 1000
        })) == 0;
    } catch (ex) {
        logger.error('Error while checking port available',ex);
        return false;
    }
};

/**
 * 
 * @param {String} cmd 
 * @param {Array} args 
 * @param {*} stdOutWriteStream 
 * @param {*} stdErrWriteStream 
 * @returns childProcess
 */
exports.runCmd = (cmd, args, stdOutWriteStream, stdErrWriteStream) => {
    return new Promise((resolve, reject) => {
        try {
            let child = spawn(cmd, args, {
                timeout: 60 * 60 * 1000,
                detached: true
            });
            child.stdout.on('data', (data) => {
                stdOutWriteStream.write(data);
            })
            child.stderr.on('data', (data) => {
                stdErrWriteStream.write(data);
            })
            child.on('error', (err) => {
                logger.error('Error while starting process', err);
            })
            child.on('close', (code) => {
                if (code !== 0) {
                  logger.warn(`${cmd} process exited with code ${code}`);
                }
            })
            resolve(child);
        } catch (ex) {
            logger.error('Error while spawing process', ex);
            reject(ex);
        }
    });
    
};
