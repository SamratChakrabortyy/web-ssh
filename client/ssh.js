var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
var id = ""

var pty = require('node-pty');
var term;

io.on('connect', function (io){
  term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });
})

io.on(`input/${id}`, function(data){
  term.write(data);
})

term.on('data', function(data){
  io.emit(`output/${id}`, data);
});

io.on('resize', function(data){
  term.resize(data[0], data[1]);
});

// When socket disconnects, destroy the terminal
io.on("disconnect", function(){
  term.destroy();
  console.log("bye");
});