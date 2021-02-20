#!/bin/bash
cd /usr/src/ 
git clone  https://github.com/SamratChakrabortyy/node-pty.git  
git clone --branch v1.1.0  https://github.com/Novatec1/web-ssh.git  
yum install -y make python build-essential gcc-c++
cd node-pty/  
npm install  
npm run build  
cd ../web-ssh/client/    
cp webSSHClientConfig.json /usr/src/conf/webSSHClientConfig.json
npm install  
nohup  node ssh.js >> /dev/null &