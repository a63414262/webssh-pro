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
    let monitorInterval = null; // 监控定时器

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

                        // 【核心绝杀】：启动并行暗影监控通道！
                        // 每 3 秒执行一次底层的 CPU、内存、磁盘查询命令
                        monitorInterval = setInterval(() => {
                            const cmd = `sh -c "vmstat 1 2 | tail -1 | awk '{print 100-\\$15}'; free | awk '/Mem:/{print \\$3/\\$2 * 100.0}'; df -h / | awk 'NR==2 {print \\$3 \\"/\\" \\$2}'"`;
                            
                            sshClient.exec(cmd, (execErr, execStream) => {
                                if (execErr) return;
                                let output = '';
                                execStream.on('data', (d) => output += d.toString());
                                execStream.on('close', () => {
                                    try {
                                        const parts = output.trim().split('\n');
                                        if (parts.length >= 3) {
                                            // 将提取到的真实服务器数据发给前端！
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

            } catch (e) {
                ws.close();
            }
        } else {
            sshStream.write(message);
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSSH Pro with Dashboard running on port ${PORT}`);
});
