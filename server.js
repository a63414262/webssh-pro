const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();

// 将 public 文件夹设为静态网页目录，直接吐出前端 UI
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let sshClient = new Client();
    let sshStream = null;

    ws.on('message', (message) => {
        if (!sshStream) {
            try {
                const creds = JSON.parse(message);
                
                sshClient.on('ready', () => {
                    ws.send('\r\n\x1b[32m[System]\x1b[0m 成功接入私有物理节点，满血加密握手完成！\r\n');
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) { 
                            ws.send('\r\n\x1b[31mShell 申请失败: \x1b[0m' + err.message + '\r\n'); 
                            return ws.close(); 
                        }
                        sshStream = stream;
                        ws.send('\r\n\x1b[32m[System]\x1b[0m 🚀 成功打穿终端！您已获取服务器最高权限。\r\n\r\n');
                        
                        stream.on('data', (d) => ws.send(d.toString('utf8')));
                        stream.on('close', () => ws.close());
                    });
                }).on('error', (err) => {
                    ws.send(`\r\n\x1b[31m[System] 目标服务器拒绝连接:\x1b[0m ${err.message}\r\n`);
                    ws.close();
                }).connect(creds);

            } catch (e) {
                ws.send('\r\n\x1b[31m[System] 凭证解析致命错误\x1b[0m\r\n');
                ws.close();
            }
        } else {
            sshStream.write(message);
        }
    });

    ws.on('close', () => { 
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSSH Pro is running on port ${PORT}`);
});
