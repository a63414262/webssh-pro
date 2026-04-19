const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let sshClient = new Client();
    let sshStream = null;
    let sftpSession = null;
    let monitorInterval = null;

    ws.on('message', (message) => {
        if (!sshStream) {
            try {
                const creds = JSON.parse(message);
                sshClient.on('ready', () => {
                    ws.send(JSON.stringify({ type: 'SYSTEM', msg: '\r\n\x1b[32m[System]\x1b[0m 成功接入私有物理节点！\r\n' }));
                    
                    // 1. 点火终端引擎
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close();
                        sshStream = stream;
                        ws.send(JSON.stringify({ type: 'SYSTEM', msg: '\x1b[32m[System]\x1b[0m 🚀 终端流打通！\r\n' }));
                        
                        stream.on('data', (d) => ws.send(JSON.stringify({ type: 'TERMINAL', data: d.toString('utf8') })));
                        stream.on('close', () => ws.close());
                    });

                    // 2. 点火 SFTP 文件引擎 (新增核心)
                    sshClient.sftp((err, sftp) => {
                        if (err) return;
                        sftpSession = sftp;
                        // 测试读取根目录发给前端
                        sftp.readdir('/root', (err, list) => {
                            if (!err) {
                                ws.send(JSON.stringify({ 
                                    type: 'SFTP_INIT', 
                                    files: list.map(f => f.filename).slice(0, 15) // 暂取前15个展示
                                }));
                            }
                        });
                    });

                    // 3. ECharts 满血监控引擎 (模拟复杂数据发往前端)
                    monitorInterval = setInterval(() => {
                        ws.send(JSON.stringify({
                            type: 'MONITOR',
                            cpuCores: [Math.random()*100, Math.random()*100, Math.random()*100, Math.random()*100],
                            memUsage: 1.5 + Math.random(),
                            netDown: Math.floor(Math.random() * 500)
                        }));
                    }, 2000);

                }).on('error', (err) => {
                    ws.send(JSON.stringify({ type: 'SYSTEM', msg: `\r\n\x1b[31m[Error]:\x1b[0m ${err.message}\r\n` }));
                    ws.close();
                }).connect(creds);
            } catch (e) { ws.close(); }
        } else {
            // 解析前端发来的复杂指令
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) {
                    sshStream.write(cmd.data);
                }
            } catch(e) {
                // 兼容纯文本回退
                if (sshStream) sshStream.write(message);
            }
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Success] 完全体骨架监听: http://0.0.0.0:${PORT}`));
