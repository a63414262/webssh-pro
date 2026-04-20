const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    let sshClient = new Client();
    let sshStream = null;
    let sftpSession = null;
    let monitorInterval = null;

    const sendDirTree = (sftp) => {
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
    };

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
                        sftpSession = sftp; 
                        sendDirTree(sftpSession);
                    });

                    // 【核心更新】：获取图表数据的同时，直接抓取原生的系统与内存状态输出！
                    monitorInterval = setInterval(() => {
                        const cmd = `sh -c "export LC_ALL=C; top -bn1 | grep -i -m1 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{print \\$3/\\$2 * 100.0}'; cat /proc/net/dev | awk 'NR>2{rx+=\\$2} END{print rx}'; echo '[ System & CPU Load ]'; top -bn1 | head -n 3; echo ''; echo '[ Memory & Swap Usage ]'; free -h"`;
                        sshClient.exec(cmd, (e, exStream) => {
                            if (e) return;
                            let out = '';
                            exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 3) {
                                    const cpu = parseFloat(p[0]) || 0;
                                    const mem = parseFloat(p[1]) || 0;
                                    const net = parseFloat(p[2]) || 0;
                                    const cmdOut = p.slice(3).join('\n'); // 提取原生命令回显
                                    ws.send(JSON.stringify({ type: 'MONITOR', cpu, mem, net, cmdOut }));
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
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) {
                    sshStream.write(cmd.data);
                } 
                else if (cmd.type === 'READ_FILE' && sftpSession) {
                    sftpSession.readFile(`/root/${cmd.filename}`, 'utf8', (err, data) => {
                        if (err) ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.filename, content: `// 读取失败: ${err.message}` }));
                        else ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.filename, content: data }));
                    });
                }
                else if (cmd.type === 'WRITE_FILE' && sftpSession) {
                    sftpSession.writeFile(`/root/${cmd.filename}`, cmd.content, 'utf8', (err) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 文件 ${cmd.filename} 保存失败: ${err.message}\x1b[0m\r\n` }));
                        else {
                            ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📝 文件 ${cmd.filename} 成功保存！\x1b[0m\r\n` }));
                            sendDirTree(sftpSession); 
                        }
                    });
                }
                else if (cmd.type === 'CREATE_FILE' && sftpSession) {
                    sftpSession.writeFile(`/root/${cmd.filename}`, '', 'utf8', (err) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 新建文件失败: ${err.message}\x1b[0m\r\n` }));
                        else {
                            ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📄 成功创建文件: ${cmd.filename}\x1b[0m\r\n` }));
                            sendDirTree(sftpSession); 
                        }
                    });
                }
                else if (cmd.type === 'CREATE_DIR' && sftpSession) {
                    sftpSession.mkdir(`/root/${cmd.dirname}`, (err) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 新建文件夹失败: ${err.message}\x1b[0m\r\n` }));
                        else {
                            ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📁 成功创建文件夹: ${cmd.dirname}\x1b[0m\r\n` }));
                            sendDirTree(sftpSession);
                        }
                    });
                }
                else if (cmd.type === 'DELETE_NODE' && sftpSession) {
                    const targetPath = `/root/${cmd.filename}`;
                    if (cmd.isDir) {
                        sftpSession.rmdir(targetPath, (err) => {
                            if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 删除文件夹失败 (可能非空): ${err.message}\x1b[0m\r\n` }));
                            else {
                                ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 成功删除文件夹: ${cmd.filename}\x1b[0m\r\n` }));
                                sendDirTree(sftpSession);
                            }
                        });
                    } else {
                        sftpSession.unlink(targetPath, (err) => {
                            if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 删除文件失败: ${err.message}\x1b[0m\r\n` }));
                            else {
                                ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 成功删除文件: ${cmd.filename}\x1b[0m\r\n` }));
                                sendDirTree(sftpSession);
                            }
                        });
                    }
                }
                else if (cmd.type === 'RENAME_NODE' && sftpSession) {
                    sftpSession.rename(`/root/${cmd.oldName}`, `/root/${cmd.newName}`, (err) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 重命名失败: ${err.message}\x1b[0m\r\n` }));
                        else {
                            ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] ✏️ 成功重命名: ${cmd.oldName} -> ${cmd.newName}\x1b[0m\r\n` }));
                            sendDirTree(sftpSession);
                        }
                    });
                }
                else if (cmd.type === 'REFRESH_DIR' && sftpSession) {
                    sendDirTree(sftpSession);
                }
            } catch(e) { 
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
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 集群探针回显版已点火，监听端口: ${PORT}`));
