var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
var id = ""

var pty = require('node-pty');
var term;

io.on('connect', function (io) {
  console.log('Socket Connected');
  term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  term.on('data', function (data) {
    console.log(`terminal data size ${data.length}`);
    io.emit(`output/${id}`, data);
  });

  io.on(`input/${id}`, function (data) {
    console.log(`input data  ${data}`);
    term.write(data);
  })

  io.on('resize', function (data) {
    console.log(`resize data ${data}`);
    term.resize(data[0], data[1]);
  });

  // When socket disconnects, destroy the terminal
  io.on("disconnect", function () {
    console.log(`disconnect data  ${data}`);
    term.destroy();
    console.log("bye");
  });
})
