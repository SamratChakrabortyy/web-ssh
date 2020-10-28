var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
const NodeCache = require( "node-cache" );
var fs = require('fs');
var id = fs.readFileSync('/sys/class/net/eth0/address').toString('UTF8').substring(0,17).replace(/:/g,''); ;
var termmap = new NodeCache({
   stdTTL: (30 * 60),
   checkperiod: (10 * 60),
   useClones: false
});

termmap.on("expired", function( key, value ){
    console.log(`Session with ${key} has expired, destroying associated terminal`);
    value.destroy();
});

var pty = require('/usr/src/node-pty');
io.on('connect', async function(){  
  console.log('Socket Connected');

  console.log(`Registering mac : ${id}`);
  io.emit('register', id);
  setInterval(function(){
    console.log(`Registering mac : ${id}`);
    io.emit('register', id);
  }, 10*60*1000);
  io.on('register', (regMsg) =>{
    console.log('Registation msg', regMsg);
  })
  io.on("disconnect", function () {
    console.log(`disconnect `);
    console.log("bye");
  });  

 
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
      let term;
      if(!termmap.has(message.from)){
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
            to : message.from,
            from : id,
            body : data
          };
          io.emit(`output`, JSON.stringify(msg));
        });
        isTerm = true;
      } else {
		      term = termmap.get(message.from);
      }
      termmap.set(message.from, term);
      term.write(message.body+'\r');
    } catch(ex){
      console.log('Error executing command', ex);
      let msg = {
        to : message.from,
        from : id,
        body : ex.message
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
    isTerm = false;
    console.log("bye");
  });
});
