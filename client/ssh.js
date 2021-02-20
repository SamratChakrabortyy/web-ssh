const config = require('/usr/src/conf/webSSHClientConfig.json');
const io = require("socket.io-client")(config.socketServerEndpoint), // socket-io Client
 NodeCache = require("node-cache"),
 fs = require('fs'),
 id = fs.readFileSync(config.macAddressFilePath).toString('UTF8').substring(0, 17).replace(/:/g, ''), // mac id of the device
 pty = require(config.nodePtyPath);

var termmap;
try {
  io.on('connect', function () {
    console.log('Socket Connected');
    //Registering socket name
    console.log(`Registering mac : ${id}`);
    io.emit('register', id);
    console.log('Initiating Terminal caches');
    termmap = new NodeCache({   //cache for cahing the terminals for each of the sessions
      stdTTL: (30 * 60),
      checkperiod: (10 * 60),
      useClones: false
    });
    //The terminals for each of the sessions will be disconnected at exipry
    termmap.on("del", function (key, value) {
      console.log(`Session with ${key} has expired, destroying associated terminal`);
      value.destroy();
    });
  });

  //Registering at an regular intervla as keep alive signals to server
  setInterval(function () {
    if (io.connected) {
      console.log(`Registering mac : ${id}`);
      io.emit('register', id);
    }
  }, 10 * 60 * 1000);


  io.on('register', (regMsg) => {
    console.log('Registation msg', regMsg);
  })

  // Handling input to the client
  io.on(`input`, function (message) {
    try {
      console.log('Input message', message);
      message = JSON.parse(message);
      if (message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
        throw new Error('Invalid Message template');
      else {
        console.log('Executing message', message);
        execute(message);
      }
    } catch (ex) {
      console.error('Error while transmitting message', ex);
      io.emit('input', ex.message);
    }
  })


  //Execution of the command
  let execute = (message) => {
    console.log('executing', message);
    try {
      let term;
      if (!termmap.has(message.from)) {
        term = pty.spawn('sh', [], {
          name: 'xterm-color',
          cols: config.terminalSize.rows,
          rows: config.terminalSize.cols,
          cwd: process.env.HOME,
          env: process.env

        });
        term.on('data', function (data) {
          console.log(`terminal data size ${data.length}`);
          let msg = {
            to: message.from,
            from: id,
            body: data
          };
          io.emit(`output`, JSON.stringify(msg));
        });
        isTerm = true;
      } else {
        term = termmap.get(message.from);
      }
      termmap.set(message.from, term);
      term.write(message.body + '\r');
    } catch (ex) {
      console.log('Error executing command', ex);
      let msg = {
        to: message.from,
        from: id,
        body: ex.message
      };
      io.emit('output', JSON.stringify(msg));
    }
  }

  io.on('fetch', (message) => {
    try {
      message = JSON.parse(message);
      io.emit('output', JSON.stringify({
        to: message.from,
        from: id,
        body: `\nfetch ${message.body}\n`
      }));
      let data = fs.readFileSync(message.body).toString('utf8');
      io.emit('fetched', JSON.stringify({
        to: message.from,
        from: id,
        body: data,
        path: message.body
      }));
    } catch (ex) {
      console.error('Error while fetching file', ex);
      io.emit('fetched', JSON.stringify({
        to: message.from,
        from: id,
        path: message.body,
        err: ex
      }));
      io.emit('output', JSON.stringify({
        to: message.from,
        from: id,
        body: `Failed to fetch as : ${ex.message}`
      }));
    }
  });

  io.on('publish', (data) => {
    try {
      let message = JSON.parse(data);
      console.log('Saving published file at ', message.path);
      let tempArr = message.path.split('/'), dir = tempArr.slice(0, tempArr.length - 1).join('/'), fileName = tempArr.slice(-1);
      console.log(`Dir for $ ${message.path}: ${dir}`);
      console.log(`FileName for  ${message.path}: ${fileName}`);
      if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${fileName}`, message.body, {
        encoding: 'utf-8'
      });
      console.log(`Successfully saved published file : ${message.path} from session: ${message.from}`);
      io.emit('output', JSON.stringify({
        from: message.to,
        to: message.from,
        body: `\r\npublish ${message.path}\r\nPublished\r\n`
      }));
    } catch (ex) {
      console.error('Error while saving published file', ex);
      io.emit('output', JSON.stringify({
        from: message.to,
        to: message.from,
        body: `\r\n${data}\r\nFailed to publish : ${ex.message}\r\n`
      }));
    }
  });

  io.on('resize', function (data) {
    console.log(`resize data ${data}`);
    term.resize(data[0], data[1]);
  });

  // When socket disconnects, destroy the terminal
  io.on("disconnect", function () {
    console.log(`disconnected`);
    termmap.flushAll();
    termmap.flushStats();
    isTerm = false;
    console.log("bye");
  });

  io.on('session_end', (sessionId) => {
    try {
      console.log(`${sessionId} ended. Cleaning up`);
      termmap.del(sessionId);
    } catch (ex) {
      console.error('Error on session_end');
    }
  });
} catch (global_excption) {
  console.log("Global Exception", global_excption);
}