var os = require("os");
var log = require('loglevel');
// var pty = require('pty.js')
var pty = require('node-pty')
var exec = require('child_process').exec;
var uuid = require('node-uuid');
var async = require('async')
var moment = require('moment-timezone')
var myuuid = uuid.v1();
var sensor = require('ds18x20');
var running = require('is-running')
var hostname = os.hostname();
var iosocket = require('socket.io-client');
var iwconfig = require('wireless-tools/iwconfig');

const zlib = require('zlib');
const MAINTENANCE_TIMEOUT = 20;
SENSOR_STATUS_TAG = 'sensorDetails';
DIAGNOSTICS_MODULE = 'prophecy-diagnostics';

// if the disk space usage is hitting above this value, invoke logrotate to
// rotate and compress the existing log files
const DISK_SPACE_THROTTLE_MAX = 80;

var gwId;
var term;
var myIP;
var myMac;

var locUrl = 'http://localhost';
var liveUrl;
var loc_socket;
var live_socket;

var term_ready          = false;
var gwId_ready          = false;
var redis_ready         = false;
var loc_sock_ready      = false;

var live_socket_regd    = false;
var live_socket_ready   = false;
var live_transmit_ready = false;
var socket_disconn      = true;


var txBuf   = [];
var ipAddrs = [];
var firewall_set = false;
var internalIp_set = false;
var mac_Id ;

//Logger
var originalFactory = log.methodFactory;

log.methodFactory = function(methodName, logLevel, loggerName) {

   var rawMethod = originalFactory(methodName, logLevel, loggerName);

   return function(message) {
      rawMethod("[" + new Date() + "]" + message);
   };
};

//Setting up our trace level, change  between "trace" ,"debug","info","warn","error"
log.setLevel('error');
log.info('prophecy-diagnostics service: start');


liveUrl = 'https://ws-control.machinesense.com:443';
live_socket = iosocket(liveUrl);
live_socket_ready = false;
var one_time_conn = false;


live_socket.on('connect', function (live_socket)
{
	console.log('sock connected');
	if(one_time_conn === false)
	{
	one_time_conn = true;
        live_socket_ready = true;
         
        setInterval(keep_alive, 10000);

        log.debug(liveUrl + ": connected");

        check_transmit();
	openTerm();
	openLocalSocket();
	openLiveSocket();
	}
});

var openLocalSocket = function()
{
   if (loc_sock_ready === false) {

      loc_socket = iosocket(locUrl);

      loc_socket.on('connect', function()
      {
         log.debug('Loc-Socket: connected');
         loc_sock_ready = true;
      });

      loc_socket.on('disconnect', function()
      {
         log.debug('Loc-Socket: disconnected');
	 //socket_disconn = true;
	 console.log('------ Disconnected local ------');
         loc_sock_ready = false;
      });

      loc_socket.on('scanResults', function(data)
      {
         if (live_transmit_ready === true) {
            live_socket.emit('dataHub', { id: gwId, action: 'scanres', cmd: data });
         }
      });

      loc_socket.on('update', function(data)
      {
         if (live_socket_ready === true) {
            live_socket.emit('dataHub', { id: gwId, action: 'updatemsg', cmd: data });
         }
      });

      loc_socket.on('alarm', function(data)
      {
         if (live_socket_ready === true) {
            live_socket.emit('dataHub', data.details);
         }
      });
   }
}

var openLiveSocket = function()
{
   if (live_socket_ready === false) {

      log.debug('live-url: ' + liveUrl);

      //live_socket = iosocket(liveUrl);

      if (live_socket.setKeepAlive) {
         live_socket.setKeepAlive(true, 0);
      }
/*
      live_socket.on('connect', function()
      {
         live_socket_ready = true;
         
         setInterval(keep_alive, 10000);

         log.debug(liveUrl + ": connected");

         check_transmit();
         console.log("Connected!!!!!!!!!!!!!!!!!!!!!!");
      });
*/
      live_socket.on('disconnect', function()
      {
         log.debug(liveUrl + ': disconnected');
	 console.log('---- disconnected ----');
         live_socket_regd    = false;
         live_socket_ready   = false;
         live_transmit_ready = false;
      });
   }
}

var keep_alive = function()
{ 
   var time_tz = moment.tz("America/New_York").format('YYYY-MM-DDTHH:mm:ssZ');
   var temp_1,temp_2,temp_3,temp_4;
   temp_1 = '{"action":"heartbeat","cmd":{"sysInfo":{"temp":"39.7","mem":10.3784},"systemSwVersion":"SmartDatahub-0.1","smart":true,"mac":"';
   temp_2 = '","lterm":true,"sensorDetails":{},"connDetails":{"wifi":[{"mode":"managed","interface":"wlan0","ieee":"802.11bgn"}],"externalIP":"","internalIP":["10.21.230.202"]},"name":"';
   temp_3 = '","queueDepth":0,"processDetails":{},"id":"';
   temp_4 = '","time":"'+time_tz+'","user":{},"wsState":"true"}}';
   var temp = temp_1 + mac_Id + temp_2 + gwId + temp_3 + gwId + temp_4;
   var abc = JSON.parse(temp);
   zlib.gzip(JSON.stringify(abc), function(err, buf) {
   live_socket.compress(true).emit('dataHub', buf);  
   });
}


require('macaddress').one('eth0', function (err, macAddress)
{
   var isLoaded = false;

   gwId_ready = true;

   if (err) {
      mac_Id = myuuid;
      gwId = 'MachineSense_' + myuuid;
   } else {
      mac_Id = macAddress;
      gwId = 'MachineSense_' + macAddress;
      //gwId = 'prophecy_' + macAddress;
   }

   log.debug('mac-address: ' + macAddress);

   myMac = macAddress;

   //Checking the ds18 driver
   try {
      var isLoaded = sensor.isDriverLoaded();
   } catch (e) {
      log.debug(e);
   }

   if (isLoaded) {

      log.debug('Driver: already loaded');
   } else {

      try {

         sensor.loadDriver();
         log.debug('driver: loaded');
         isLoaded = true;
      } catch (err) {

         log.debug('driver: load error(' +  err + ')');
         isLoaded = false;
      }
   }

   check_transmit();
});
var getInternalIP = function()
{
   if (internalIp_set === false) {

      var interfaces = os.networkInterfaces();

      for (var k in interfaces) {

         for (var k2 in interfaces[k]) {

            var address = interfaces[k][k2];

               if ((address.family === 'IPv4') &&
               (address.address.substring(0, 7).indexOf('169.254') == -1) &&
               (address.address.substring(0, 10).indexOf('192.168.42') == -1) &&
               (address.address.indexOf('127.0.0.1') == -1) &&
               (address.address.indexOf('0.0.0.0') == -1) &&
               (address.address.indexOf('10.0.0.1') == -1)) {

               ipAddrs.push(address.address);
               internalIp_set = true;
            }
         }
      }
      log.debug('Internal-IpAddrs:' + ipAddrs);
   }

   // set the firewall for the box, when IP
   // address is up
   if ((internalIp_set === true) && (firewall_set === false)) {

      exec('sudo /sbin/iptables-restore < /etc/iptables.rules',
         function(err, stdout, stderr) {

         if (err) {
            log.warn('Firewall-filters: application failed, ' + err);
         } else {
            log.debug('Firewall-filters: applied');
            firewall_set = true;
         }
      });
   }
}

var openTerm = function()
{
   term = pty.fork(process.env.SHELL || 'sh', [], {
      name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color') ? 'xterm-256color' : 'xterm',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME
   });

   term.on('data', function(data)
   {
      term_ready = true;
      //log.debug('Emitting '+ JSON.stringify({id:gwId, action:'lterm', cmd:data}));
      if (live_transmit_ready === true) {
         console.log("Cmd EXEC    " + data);
         return live_socket.emit('dataHub', { id: gwId, action: 'lterm', cmd: data });
      } else {
         return txBuf.push(data);
      }
   });
}

var check_transmit = function()
{
   if ((gwId_ready === true) &&
       (live_socket_ready === true)) {
      live_transmit_ready = true;
   }

   if (live_transmit_ready === true) {

      while (txBuf.length) {
         live_socket.emit('dataHub', {id: gwId, action: 'lterm', cmd: txBuf.shift()});
      }

      if (live_socket_regd === false) {
         live_socket_regd = true;
         live_socket.on(gwId, function(data) { data_handler(data); });
      }

   }
}

var data_handler = function(data)
{
   console.log("inside data_handler__________________________ " + data.action);
   //log.debug(data);
   switch (data.action) {

   case 'term':
      exec(data.cmd, function(err, stdout, stderr) {

         if (live_transmit_ready === true) {
            if (err) {
               live_socket.emit('dataHub', { id: gwId, action: 'msg', cmd: stderr});
            } else {
               live_socket.emit('dataHub', { id: gwId, action: 'msg', cmd: stdout});
            }
         }
      });
      break;

   case 'lterm':
      if (term_ready === true) {
         term.write(data.cmd);
      }
      break;

   case "scan":
      if (loc_sock_ready === true) {
         loc_socket.emit('scanStart', { action: "scanStart" });
      }
      break;

   case "remote-cli":
      if (live_transmit_ready === true) {
         cliEngine.cliParse(data.cmd, gwId, live_socket);
      }
      break;
   }
}

setTimeout(function()
{
   log.debug('prophecy-diagnostics: maintenance restart');
   process.exit(99);
}, MAINTENANCE_TIMEOUT * 60000);