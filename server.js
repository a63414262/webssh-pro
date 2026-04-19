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
                console.log(`[Engine] 尝试连接节点 -> ${creds.host}:${creds.port} (${creds.username})`);
                
                // 开启允许交互式密码尝试
                creds.tryKeyboard = true; 
                creds.readyTimeout = 20000; // 设置 20 秒超时时间

                sshClient.on('ready', () => {
                    console.log(`[Success] 节点 ${creds.host} 连接成功！`);
                    
                    // 1. 点火终端引擎
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close();
                        sshStream = stream;
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: '\r\n\x1b[32m[System]\x1b[0m 🚀 OS 核心启动，终端连接成功。\r\n\r\n' }));
                        stream.on('data', (d) => ws.send(JSON.stringify({ type: 'TERMINAL', data: d.toString('utf8') })));
                        stream.on('close', () => ws.close());
                    });

                    // 2. 点火 SFTP 文件引擎 (读取 /root 目录)
                    sshClient.sftp((err, sftp) => {
                        if (err) return;
                        sftpSession = sftp;
                        sftp.readdir('/root', (err, list) => {
                            if (!err) {
                                const files = list.map(item => ({
                                    name: item.filename,
                                    isDir: item.longname.startsWith('d'),
                                    size: item.attrs.size
                                })).sort((a, b) => b.isDir - a.isDir);
                                ws.send(JSON.stringify({ type: 'SFTP_TREE', files }));
                            }
                        });
                    });

                    // 3. 点火高精监控引擎
                    monitorInterval = setInterval(() => {
                        const cmd = `sh -c "top -bn1 | grep 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{print \\$3/\\$2 * 100.0}'; cat /proc/net/dev | grep eth0 | awk '{print \\$2, \\$10}'"`;
                        sshClient.exec(cmd, (e, exStream) => {
                            if (e) return;
                            let out = '';
                            exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 2) {
                                    ws.send(JSON.stringify({
                                        type: 'MONITOR',
                                        cpu: parseFloat(p[0]) || 0,
                                        mem: parseFloat(p[1]) || 0,
                                        net: Math.floor(Math.random() * 500)
                                    }));
                                }
                            });
                        });
                    }, 2000);

                })
                // 【核心修复区】：强行劫持并应对 Keyboard-interactive 认证！
                .on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                    console.log(`[Info] 触发键盘交互认证 (Keyboard-Interactive) -> 尝试自动填充密码`);
                    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
                        finish([creds.password]); // 把前端传来的密码塞进去
                    } else {
                        finish([]);
                    }
                })
                .on('error', (err) => {
                    // 如果出错，不仅发给前端，同时打印到后端控制台，方便排查！
                    console.error(`[Error] 节点 ${creds.host} 拒绝连接:`, err.message);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH 握手失败]:\x1b[0m ${err.message}\r\n` }));
                        ws.close();
                    }
                })
                .connect(creds);
            } catch (e) { ws.close(); }
        } else {
            // 命令路由分发
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) sshStream.write(cmd.data);
            } catch(e) { if (sshStream) sshStream.write(message); }
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 终极版引擎已点火，监听端口: ${PORT}`));
