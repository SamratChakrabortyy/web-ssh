var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
var id = "ssh"

var pty = require('/usr/src/node-pty');
var term;
io.on('connect', function(socket){  
  console.log('Socket Connected');
  io.emit('register', id);
  io.on('register', (regMsg) =>{
    console.log(regMsg);
  })
  io.on("disconnect", function () {
    console.log(`disconnect `);
    if(term != undefined)
      term.destroy();
    console.log("bye");
  });
})
io.on('term', function (termMsg) {
  console.log('Opening term');
  term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

 /*  term.on('data', function (data) {
    console.log(`terminal data size ${data.length}`);
    let msg = {
      to : termMsg.from,
      from : id,
      body : data
    }
    io.emit(`output`, JSON.stringify(msg));
  }); */

  io.on(`input`, function (message) {
    try{
      message = JSON.parse(message);
      if(message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
        throw new Error('Invalid Message template');
      term.write(message.body);
      term.on('data', function (data) {
        console.log(`terminal data size ${data.length}`);
        let msg = {
          to : message.from,
          from : id,
          body : data
        }
        io.emit(`output`, JSON.stringify(msg));
      });
    } catch (ex){
      console.error('Error while transmitting message', ex);
      io.emit('input', ex.message);
    }
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
