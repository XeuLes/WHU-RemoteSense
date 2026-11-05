import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import os from 'os';

//获取ip地址的函数
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
const users = {
  online: [],
  offline: []
};

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
    const formattedIp = clientIp.replace('::ffff:', '');// 格式化IP地址（去除IPv6前缀）
 console.log('有新的用户端连接入网络，其IP地址为:'+formattedIp);

 
  socket.on('register user', (user) => {
    // 将用户添加到在线列表
    users.online.push({
      deviceId: user.deviceId,
      nickname: user.nickname,
      socketId: socket.id // 保存socketId用于后续追踪
    });
    const existingOfflineIndex = users.offline.findIndex(u => u.deviceId === user.deviceId);
if (existingOfflineIndex > -1) {
  users.offline.splice(existingOfflineIndex, 1);
}
    // 广播更新用户列表
    io.emit('update user list', users);
  });

  socket.on('nickname changed', (data) => {
    const { oldNickname, newNickname } = data;
    // 生成系统消息（与进入聊天室的系统消息格式保持一致）
    const systemMsg = {
      type: 'system',
      content: `${oldNickname} 修改昵称为 ${newNickname}`,
      time: new Date().toLocaleString()
    };
    // 广播给所有用户
    io.emit('chat message', systemMsg);
    console.log(`系统消息：${systemMsg.content}`);
  });

socket.on('chat message', (data) => {
  const { text: msg, deviceId, nickname } = data;
  // 构建包含所有需要的字段的消息对象
  const messageTime = new Date().toLocaleString();
  const chatMessage = {
      type: 'chat',
      nickname: nickname,
      text: msg,
      deviceId: deviceId,
      ip: formattedIp,
      time: messageTime // 新增时间字段
    };
    console.log('message: ' + `${nickname} (${deviceId}) [${formattedIp}]:${msg}`);
    io.emit('chat message', chatMessage);
});

socket.on('user connected', (data) => {
    const { nickname } = data;
    // 获取当前时间并格式化
    const joinTime = new Date().toLocaleTimeString(); // 格式：2024/9/25 15:30:45
    // 构造系统消息（区分普通消息，方便前端样式处理）
    const systemMsg = {
      type: 'system', // 标识为系统消息
      content: `${nickname}[${formattedIp}]进入了聊天室`,
      time: joinTime
    };
    // 广播给所有用户（包括自己）
    io.emit('chat message', systemMsg);
  });
   socket.on('user connected', (user) => {
    socket.nickname = user.nickname; // 保存用户昵称到socket对象
    // 其他连接逻辑...
  });

  // 监听断开连接事件
  socket.on('disconnect', () => {
    if (socket.nickname) {
      // 在命令行显示用户断开连接
      console.log(` ${socket.nickname}[${formattedIp}] 已断开连接`);
      
      // 向所有客户端广播用户离开消息
      io.emit('chat message', {
        type: 'system',
        content: `${socket.nickname} [${formattedIp}]离开聊天室`,
        time: new Date().toLocaleTimeString() // 添加时间戳
      });
    }
    // 查找断开连接的用户
    const offlineUser = users.online.find(u => u.socketId === socket.id);
    if (offlineUser) {
      // 从在线列表移除并添加到离线列表
      users.online = users.online.filter(u => u.socketId !== socket.id);
      users.offline.push(offlineUser);
      // 广播更新用户列表
      io.emit('update user list', users);
    }
  });
  socket.on('nickname changed', (data) => {
    const user = users.online.find(u => u.deviceId === data.deviceId);
    if (user) {
      user.nickname = data.newNickname;
      io.emit('update user list', users);
    }
  });
});
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});