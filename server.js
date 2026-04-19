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
    let monitorInterval = null;

    ws.on('message', (message) => {
        if (!sshStream) {
            try {
                const creds = JSON.parse(message);
                
                sshClient.on('ready', () => {
                    ws.send('\r\n\x1b[32m[System]\x1b[0m 成功接入私有物理节点，满血加密握手完成！\r\n');
                    
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close();
                        sshStream = stream;
                        ws.send('\r\n\x1b[32m[System]\x1b[0m 🚀 成功打穿终端！监控引擎已启动。\r\n\r\n');
                        
                        stream.on('data', (d) => ws.send(d.toString('utf8')));
                        stream.on('close', () => ws.close());

                        // 核心：启动并行暗影监控通道
                        monitorInterval = setInterval(() => {
                            // 优化后的指令：更兼容、更精准
                            const cmd = `sh -c "top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'; free | awk '/Mem:/{print $3/$2 * 100.0}'; df -h / | awk 'NR==2 {print $3 \"/\" $2}'"`;
                            
                            sshClient.exec(cmd, (execErr, execStream) => {
                                if (execErr) return;
                                let output = '';
                                execStream.on('data', (d) => output += d.toString());
                                execStream.on('close', () => {
                                    try {
                                        const parts = output.trim().split('\n');
                                        if (parts.length >= 3) {
                                            ws.send(JSON.stringify({
                                                type: '__MONITOR__',
                                                cpu: parseFloat(parts[0]) || 0,
                                                mem: parseFloat(parts[1]) || 0,
                                                disk: parts[2]
                                            }));
                                        }
                                    } catch (e) {}
                                });
                            });
                        }, 3000);
                    });
                }).on('error', (err) => {
                    ws.send(`\r\n\x1b[31m[System] 目标服务器拒绝连接:\x1b[0m ${err.message}\r\n`);
                    ws.close();
                }).connect(creds);
            } catch (e) { ws.close(); }
        } else {
            if (sshStream) sshStream.write(message);
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

// 适配 Claw Cloud：显式监听 0.0.0.0
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Success] WebSSH Pro 引擎已点火！`);
    console.log(`[Network] 监听地址: http://0.0.0.0:${PORT}`);
});
