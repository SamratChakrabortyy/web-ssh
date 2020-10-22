var io = require("socket.io-client")('http://ws-control.machinesense.com:8080');
var mac = require('macaddress');
var fs = require('fs');
var id = fs.readFileSync('/sys/class/net/eth0/address').toString('UTF8').substring(0,17).replace(/:/g,''); ;
var termmap = {};
function getMacAddress() {
  mac.one('eth0', (err, mac) => {
    if(err){
      console.error("Error inding macaddress");
      throw err;
    }
    return mac;
  })
}

setInterval (function (){
	for(var key in termmap){
		if(new Date().getTime() - termmap[key].time > 30*60*1000 ){
			termmap.[key].term.destroy();
			termmap[key].term = undefined;
			console.log("Cleaning term Map ",key);
			
		}			
	}
},10*60*1000)

var pty = require('/usr/src/node-pty');
//var term;
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
      let term = termmap[message.from] == undefined ? undefined : termmap[message.from].term;
      if(term == undefined){
        term = pty.spawn('sh', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: process.env
		 
        });
		termmap[message.from] = {
		  term:term,
		  time:new Date().getTime()
		}
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
      }else{
		  termmap[message.from].time = new Date().getTime() ;
	  }
      term.write(message.body+'\r\n');
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
