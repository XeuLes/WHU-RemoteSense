import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import os from 'os';
function getLocalIP() {
  const interfaces = os.networkInterfaces(); // 获取所有网络接口
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (const alias of iface) {
      // 筛选条件：IPv4、非回环地址、已启用
      if (
        alias.family === 'IPv4' &&
        alias.address !== '127.0.0.1' &&
        !alias.internal
      ) {
        return alias.address; // 返回第一个符合条件的IP
      }
    }
  }
  return '127.0.0.1'; // 兜底（理论上不会走到这一步）
}

const app = express();
const server = createServer(app);
const io = new Server(server);


const __dirname = dirname(fileURLToPath(import.meta.url));

const localIP = getLocalIP();//获取本机IP地址

app.get('/chat', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => 
  {
   let clientIp = socket.handshake.address || 
                    (socket.request.connection && socket.request.connection.remoteAddress) ||
                    (socket.request.socket && socket.request.socket.remoteAddress);
    if (clientIp === '127.0.0.1' || clientIp === '::1') {
    clientIp = localIP;
  }//显示本机地址而非本机回环地址
    // 格式化IP地址（去除IPv6前缀）
    const formattedIp = clientIp.replace('::ffff:', '');
 console.log('有新的用户端连接入网络，其IP地址为:'+formattedIp);
 socket.on('chat message', (msg) => {
  const chatmessage = formattedIp+':'+msg;
 console.log('message: ' + chatmessage);
 io.emit('chat message', chatmessage);
 });
});
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});