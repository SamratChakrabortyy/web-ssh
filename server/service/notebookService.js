//const TinyQueue = require('tinyqueue');
const { sessionMap } = require('../caches');
//const { notebook} = require('../config.json');
const {  runCmd } = require('../utilis/utils');
const { execSync, spawn } = require('child_process');
const { jupyterconfig, sessionDirRoot, jupyterPath } = require('../config.json');
const { logger } = require('../logger');
const fs = require('fs');

//const portQueuue = new TinyQueue(Array.from(new Array(notebook.endPort - notebook.startPort), (x, i) => i + notebook.startPort));

exports.getNotebookPid = (sessionId) => {
    return new Promise(async (resolve, reject) => {
        try {
            let sessionInfo = sessionMap.get(sessionId);
            if(sessionInfo != undefined && sessionInfo.notebookProcess != undefined && !sessionInfo.notebookProcess.killed ){
                logger.info('notebook process exists for this session, returing the same ')
            } else {
                logger.info(`Initiatiing notebook process for `,sessionId);
                let notebookLogs = fs.createWriteStream(`${sessionInfo.fileName}-notebook.log`, { flags: 'a' });
                logger.debug(`jupyter-notebook --config ${jupyterconfig} --notebook-dir ${sessionDirRoot}/${sessionId}`)
                let notebookProcess = await spawanNotebookForSessionId(jupyterPath, [`--config`, `${jupyterconfig}`], notebookLogs, notebookLogs, sessionId)
                //let notebookProcess = await spawanNotebookForSessionId(`runuser`,  [`-l`, `centos`, `-c`, `'/usr/src/web-ssh/server/scripts/runJupyter.sh ${sessionDirRoot}/${sessionId}'`], notebookLogs, notebookLogs, sessionId)
                sessionInfo.notebookProcess = notebookProcess;
                sessionInfo.notebookStream = notebookLogs;
            }
            let pid = sessionInfo.notebookProcess.pid;
            resolve(pid);
        } catch (ex) {
            logger.error('Error finding notebook path', ex);
            reject(ex);
        }
    }) 
};

let spawanNotebookForSessionId = (cmd, args, stdOutWriteStream, stdErrWriteStream, sessionId) => {
    return new Promise((resolve, reject) => {
        logger.info('Spawnning process for notebbok sessionId: ', sessionId);
        try {
            let child = spawn(cmd, args, {
                timeout: 60 * 60 * 1000,
                detached: false,
                cwd: `${sessionDirRoot}/${sessionId}`
            });
            child.stdout.on('data', async (data) => {
                logger.debug('STDOUT data', data.toString('utf-8'));
                try {
                    stdOutWriteStream.write(data);
                    if( await setNotebbokURL(sessionId, data)){
                        resolve(child)
                    }
                } catch (ex) {
                    logger.error('Error while finding notebook URL', ex)
                }
            })
            child.stderr.on('data', async (data) => {
                logger.debug('STDERR data', data.toString('utf-8'));
                try {
                    stdErrWriteStream.write(data);
                    if( await setNotebbokURL(sessionId, data)){
                        resolve(child)
                    }
                } catch (ex) {
                    logger.error('Error while finding notebook URL', ex)
                }
            })
            child.on('error', (err) => {
                logger.error('Error while starting process', err);
            })
            child.on('close', (code) => {
                logger.warn(`${cmd} process exited with code ${code}`);
                sessionMap.get(sessionId).notebookProcess = undefined;

            });
            setTimeout(() => {
                if(sessionMap.get(sessionId).notebookUrl == undefined){
                    logger.error('Max waiting time for notebook exceeded!');
                    reject('Failed to create Notebook')
                }
            }, 1 * 60 * 1000);
        } catch (ex) {
            logger.error('Error while spawing process', ex);
            reject(ex);
        }
    });
    
};

let setNotebbokURL = (sessionId, data) => {
    return new Promise((resolve, reject) => {
        try {
            let sessionInfo = sessionMap.get(sessionId);
            if(sessionInfo != undefined && (sessionInfo.notebookProcess == undefined || sessionInfo.notebookProcess.killed) ){
                data = data.toString('utf-8');
                let noteookUrls = data.match(/https?:\/\/([0-9a-z-]*|\.?)*machinesense.com(\/?.+)token=(\/?.+)?/ig);
                if(noteookUrls != null && noteookUrls != undefined && noteookUrls.length > 0){
                    logger.info(`Notebook URL for this session `, noteookUrls[0]);
                    sessionInfo.notebookUrl = noteookUrls[0];
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        } catch (ex){
            logger.error('Error while setting Notebook URL', ex);
            reject(ex);
        }
    })
}
