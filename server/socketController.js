const { clientIdMap, sessionMap } = require("./caches");
const { logger } = require("./logger");
const sessionDirBasePath = require('./config.json').sessionDirBasePath;
const fs = require('fs');
const {sessionDirRoot} = require('./config.json');
const path = require('path');
const ansiHTML = require('ansi-to-html');
const convert = new ansiHTML();

const addToCache = (name, id) => {
    clientIdMap.set(name, id);
    clientIdMap.set(id, name);
}
/**
 * 
 * @param {Http Server} server Http Server 
 */
exports.initiateSocketController = (server) => {
    var io = require('socket.io')(server)
    io.on('connection', function (socket) {
        logger.info("New Client Conmected");
        socket.on('register', function (data) {
            if (data == undefined || !data instanceof String) {
                logger.info(`Invalid client Id provided with registration request`);
                io.to(socket.id).emit('register', 'falied');
                return;
            }
            let status = register(data, socket);
            clientIdMap.get(data).currSessionCount = 0;
            io.to(socket.id).emit('register', status);
        });

        socket.on('web-register', function (data) {
            if (data == undefined || !data instanceof String || !sessionMap.has(data)) {
                logger.info(`Invalid client Id provided with registration request`);
                io.to(socket.id).emit('register', 'falied');
                return;
            }
            let status = register(data, socket);
            io.to(socket.id).emit('register', status);
        });

        let register = (data, socket) => {
            try {
                logger.info(`new Registration for ${data} sock Id ${socket.id}`);
                addToCache(data, socket.id);
                //logger.info('Client Id Map', clientIdMap);
                logger.info(`${data} successfully registered with id ${socket.id}`);
                return 'successful';
            } catch (ex) {
                logger.error('Error while registring socket id', ex);
                return 'failed';
            }
        };


        socket.on('input', (data) => {
            try {
                let message = JSON.parse(data);
                let event = 'input';
                logger.debug('input msg', message);
                let cmd = message.body.trim().split(' ');
                if (cmd[0].toLowerCase() === "stop") {
                    message.body = String.fromCharCode(3);
                } else if(cmd[0].toLowerCase() == 'fetch'){
                    event = 'fetch';
                    message.body = cmd[1];
                } else if(cmd[0].toLowerCase() == 'publish'){
                    event = 'publish';
                    message.path = cmd[1];
                    let filePath = path.join(sessionDirRoot, message.from, message.path).toString();
                    logger.debug(`Trying to read file, to publish for session: `, message.from, filePath)                    
                    try{
                        if(!fs.existsSync(filePath)) {
                            logger.error(`file Path doesn't exist`, filePath);
                            throw new Error(`no such file or directory ${message.path}`);
                        }
                        message.body = fs.readFileSync(filePath).toString('utf-8');
                    } catch (ex){
                        logger.error('Error while reading file to be bublished', ex);
                        sessionMap.get(message.from).stream.write(`\n${data}\nFailed to publish : ${ex.message}\n`);

                        io.to(clientIdMap.get(message.from)).emit('output', JSON.stringify({
                            from: message.to,
                            to: message.from,
                            body: `\r\n${JSON.parse(data).body}\r\nFailed to publish : ${ex.message}\r\n`.replace(`${sessionDirRoot}/${message.from}/`,'')
                        }));
                        return; 
                    }
                } else {
                    message.body = message.body
                }
                transmit(event, message, socket.id);
            } catch (ex) {
                logger.error("Error at input event", ex);
                io.to(socket.id).emit('input', 'Error at input event');
            }
        });

        socket.on('output', (data) => {
            try {
                let message = JSON.parse(data);
                logger.debug('Writting msg body ', message.body);
                //message.body = ansiHTML(message.body.toString());
                message.body = convert.toHtml(message.body)
                transmit('output', message, socket.id);
                sessionMap.get(message.to).stream.write(message.body);
            } catch (ex) {
                logger.error('Error at output event', ex);
                io.to(socket.id).emit('output', 'Error at output event');
            }
        });

        socket.on('disconnect', (data) => {
            try {
                let id = clientIdMap.get(socket.id);
                clientIdMap.del(socket.id);
                clientIdMap.del(id);
                logger.info(`${id} disconnected. Cleaning  up!`);
            } catch (ex) {
                logger.error('Error on disconnect', ex);
            }
        });

        var transmit = (event, message, id) => {
            try {
                addToCache(message.from, id);
                if (!clientIdMap.has(message.to))
                    throw new Error(`${message.to} Reciver offline`);
                io.to(clientIdMap.get(message.to)).emit(event, JSON.stringify(message));
                io.to(clientIdMap.get(message.from)).emit(event, 'successful');
            } catch (ex) {
                logger.error('Error while transmitting message', ex);
                io.to(socket.id).emit(event, ex.message);
            }
        };
        /**
         * data ={
                to: <sessionId>,
                from: <dh client id>,
                body: {optional when successfiull} file data
                err: {optional when unsuccessfiull} exception
                path: <filePath>
            }
         */
        socket.on('fetched', (data) => {
            try{
                let message = JSON.parse(data);
                try {
                    if(message.err){
                        logger.error(`Failed to fetch file ${message.path}, `,message.err);
                        return;
                    }
                    let tempArr = message.path.split('/'), dir = path.join(sessionDirRoot, message.to, tempArr.slice(0,tempArr.length-1).join('/')), fileName = tempArr.slice(-1);
                    logger.debug(`Dir for ${message.to}, ${message.path}: ${dir}`);
                    logger.debug(`FileName for ${message.to}, ${message.path}: ${fileName}`);
                    if(!fs.existsSync(dir))
                        fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(`${dir}/${fileName}`, message.body, {
                        encoding: 'utf-8'
                    });
                    logger.info(`Successfully fetched file : ${message.path} for session: ${message.to}`);
                    sessionMap.get(message.to).stream.write('Fetched\r\n');
                    io.to(clientIdMap.get(message.to)).emit('output',JSON.stringify({
                        from: message.from,
                        to: message.to,
                        body: 'Fetched\r\n'
                    }));
                } catch (ex) {
                    logger.error('Error while witting fetched file file', message, ex);
                    io.to(clientIdMap.get(message.to)).emit('output', JSON.stringify({
                        to: message.to,
                        from: message.from,
                        body: `Failed to fetch as : ${ex.message}\r\n`
                    }));
                }
            } catch(ex) {
                logger.error('Error while fetching file', data, ex);
            }
        });

        clientIdMap.on('del', (key, val) => {
            try {
                if (sessionMap.has(key)) {
                    let session = sessionMap.get(key);
                    logger.info(`Ending session between ${session.user} ${session.dest} and saving the file at ${session.fileName}`);
                    session.stream.end();
                    sessionMap.del(key);
                    if(fs.existsSync(`${sessionDirRoot}/${key}`)){
                        logger.debug(`Files present for session. Deleting all files fetched during this session`);
                        fs.rmdirSync(`${sessionDirRoot}/${key}`, {recursive: true});
                        logger.info(`Deleted all files fetched in this session`);
                    }
                    if(session.notebookProcess != undefined){
                        logger.info(`Notebook child process exists for ${key}. Killing notebook Process`);
                        session.notebookProcess.kill(0);
                    }
                    if(session.notebookStream != undefined){
                        logger.info('Closing notebook log stream for ', key);
                        session.notebookStream.end();
                    }
                    io.to(val).emit('session_end', key);
                    clientIdMap.get(session.dest).currSessionCount = Math.max(0, clientIdMap.get(session.dest).currSessionCount - 1);
                    io.to(clientIdMap.get(session.dest)).emit('session_end', key);
                }
            } catch (ex) {
                logger.error('Error on xpired event of clientIdMap', ex)
            }
        });

    });
}; 
