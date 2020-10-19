var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
var mac = require('macaddress');
var fs = require('fs');
var id = fs.readFileSync('/sys/class/net/eth0/address').toString('UTF8').substring(0,17).replace(/:/g,''); ;

function getMacAddress() {
  mac.one('eth0', (err, mac) => {
    if(err){
      console.error("Error inding macaddress");
      throw err;
    }
    return mac;
  })
}

var pty = require('/usr/src/node-pty');
var term;
io.on('connect', async function(){  
  console.log('Socket Connected');
  //id = await getMacAddress();
  console.log(`Registering mac : ${id}`);
  io.emit('register', id);
  io.on('register', (regMsg) =>{
    console.log('Registation msg', regMsg);
  })
  io.on("disconnect", function () {
    console.log(`disconnect `);
    if(term != undefined)
      term.destroy();
    console.log("bye");
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
  var isTerm = false;
  io.on(`input`, function (message) {
    try{
      console.log('Input message', message);
      message = JSON.parse(message);
      if(message == undefined || !message instanceof Object || message.to == undefined || message.from == undefined || message.body == undefined)
        throw new Error('Invalid Message template');
      else{
        console.log('Executing message', message);
        execute(message);
      }
    } catch (ex){
      console.error('Error while transmitting message', ex);
      io.emit('input', ex.message);
    }
  })

  function execute(message){
    console.log('executing', message);
    try{
      let msg = {
        to : message.from,
        from : id
      }
      let term = pty.spawn('sh', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: process.env
        });
        // if(message.body == 'term'){
        //   term.destroy();
        //   term = pty.spawn('sh', [], {
        //     name: 'xterm-color',
        //     cols: 80,
        //     rows: 30,
        //     cwd: process.env.HOME,
        //     env: process.env
        //   });
        //   msg.body = 'pwd';
        // }
        term.on('data', function (data) {
          console.log(`terminal data size ${data.length}`);
          msg.body = data;
          io.emit(`output`, JSON.stringify(msg));
        });
        isTerm = true;
      term.write(message.body+'\r\n');
      if(term != undefined){
        term.destroy();
        term = undefined
      }
    } catch(ex){
      console.log('Error executing command', ex);
      msg.body = ex.message
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
    console.log("bye");
  });
});
