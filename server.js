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
                creds.tryKeyboard = true; 
                creds.readyTimeout = 20000;

                sshClient.on('ready', () => {
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close();
                        sshStream = stream;
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: '\r\n\x1b[32m[System]\x1b[0m 🚀 OS 核心启动，终端连接成功。\r\n\r\n' }));
                        stream.on('data', (d) => ws.send(JSON.stringify({ type: 'TERMINAL', data: d.toString('utf8') })));
                        stream.on('close', () => ws.close());
                    });

                    sshClient.sftp((err, sftp) => {
                        if (err) return;
                        sftpSession = sftp; // 挂载 SFTP 实例
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

                    monitorInterval = setInterval(() => {
                        const cmd = `sh -c "top -bn1 | grep 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{print \\$3/\\$2 * 100.0}'; cat /proc/net/dev | grep eth0 | awk '{print \\$2, \\$10}'"`;
                        sshClient.exec(cmd, (e, exStream) => {
                            if (e) return;
                            let out = '';
                            exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 2) {
                                    ws.send(JSON.stringify({ type: 'MONITOR', cpu: parseFloat(p[0]) || 0, mem: parseFloat(p[1]) || 0, net: Math.floor(Math.random() * 500) }));
                                }
                            });
                        });
                    }, 2000);
                })
                .on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish([creds.password]);
                    else finish([]);
                })
                .on('error', (err) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH Error]:\x1b[0m ${err.message}\r\n` }));
                        ws.close();
                    }
                }).connect(creds);
            } catch (e) { ws.close(); }
        } else {
            // 【核心新增逻辑】：接收前端的指令
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) {
                    sshStream.write(cmd.data);
                } 
                // 新增：如果前端要求读取文件
                else if (cmd.type === 'READ_FILE' && sftpSession) {
                    sftpSession.readFile(`/root/${cmd.filename}`, 'utf8', (err, data) => {
                        if (err) {
                            ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.filename, content: `// 读取失败: ${err.message}` }));
                        } else {
                            ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.filename, content: data }));
                        }
                    });
                }
            } catch(e) { if (sshStream) sshStream.write(message); }
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 终极版监听端口: ${PORT}`));
