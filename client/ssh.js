const io = require("socket.io-client")('http://diag.machinesense.com:4050'), // socket-io Client
 NodeCache = require("node-cache") 
 fs = require('fs')
 id = fs.readFileSync('/sys/class/net/eth0/address').toString('UTF8').substring(0, 17).replace(/:/g, '') // mac id of the device
 termmap = new NodeCache({   //cache for cahing the terminals for each of the sessions
  stdTTL: (30 * 60),
  checkperiod: (10 * 60),
  useClones: false
}), 
pty = require('/usr/src/node-pty');

//The terminals for each of the sessions will be disconnected at exipry
termmap.on("del", function (key, value) {
  console.log(`Session with ${key} has expired, destroying associated terminal`);
  value.destroy();
});


io.on('connect',  function () {
  console.log('Socket Connected');
  termmap.flushAll();
  termmap.flushStats();

  //Registering socket name
  console.log(`Registering mac : ${id}`);
  io.emit('register', id);
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
        cols: 80,
        rows: 30,
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
  try{
    console.log(`${sessionId} ended. Cleaning up`);
    termmap.del(sessionId);
  } catch(ex){
    console.error('Error on session_end');
  }
});
