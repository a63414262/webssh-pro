const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { SocksClient } = require('socks');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const setupAutoWarp = () => {
    const confPath = '/usr/src/app/warp.conf';
    if (!fs.existsSync(confPath)) {
        console.log('\x1b[33m[Auto-WARP]\x1b[0m 未检测到配置，正在全自动申请 IPv6 节点...');
        try {
            execSync('wgcf register --accept-tos', { stdio: 'ignore' });
            execSync('wgcf generate', { stdio: 'ignore' });
            let conf = fs.readFileSync('wgcf-profile.conf', 'utf8');
            conf += '\n[Socks5]\nBindAddress = 127.0.0.1:1080\n';
            fs.writeFileSync(confPath, conf);
            console.log('\x1b[32m[Auto-WARP]\x1b[0m 申请成功！已提取专属私钥与 IPv6 出口。');
        } catch (e) {
            console.error('\x1b[31m[Auto-WARP Error]\x1b[0m 自动申请失败:', e.message);
        }
    }
    if (fs.existsSync(confPath)) {
        exec('wireproxy -c ' + confPath + ' -d', (err) => {
            if (err) console.error('[WARP Tunnel Error]', err);
        });
    }
};
setupAutoWarp();

const ipBlocklist = new Map(); 
const ipAttempts = new Map();  
const MAX_ATTEMPTS = 5;        
const BLOCK_TIME = 24 * 60 * 60 * 1000; 

wss.on('connection', (ws, req) => {
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress;

    if (ipBlocklist.has(clientIp)) {
        if (Date.now() < ipBlocklist.get(clientIp)) {
            ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[1;41;37m [ 绝对防御 ] \x1b[0m\x1b[31m IP (${clientIp}) 已被物理隔离 24 小时！\x1b[0m\r\n` }));
            return ws.close();
        } else {
            ipBlocklist.delete(clientIp); ipAttempts.delete(clientIp);
        }
    }

    let sshClient = new Client();
    let sshStream = null;
    let sftpSession = null;
    let monitorInterval = null;

    const sendDirTree = (sftp) => {
        sftp.readdir('/root', (err, list) => {
            if (!err) {
                const files = list.map(item => ({ name: item.filename, isDir: item.longname.startsWith('d'), size: item.attrs.size })).sort((a, b) => b.isDir - a.isDir);
                ws.send(JSON.stringify({ type: 'SFTP_TREE', files }));
            }
        });
    };

    ws.on('message', (message) => {
        if (!sshStream) {
            try {
                const creds = JSON.parse(message);
                creds.tryKeyboard = true; creds.readyTimeout = 20000;

                sshClient.on('ready', () => {
                    ipAttempts.delete(clientIp);

                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close();
                        sshStream = stream;
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: '\r\n\x1b[32m[System]\x1b[0m 🚀 OS 核心启动，终端连接成功。您可以直接将文件拖拽至此窗口进行秒传。\r\n\r\n' }));
                        stream.on('data', (d) => ws.send(JSON.stringify({ type: 'TERMINAL', data: d.toString('utf8') })));
                        stream.on('close', () => ws.close());
                    });

                    sshClient.sftp((err, sftp) => { if (!err) { sftpSession = sftp; sendDirTree(sftpSession); } });

                    sshClient.lastRx = undefined; sshClient.lastTx = undefined;

                    monitorInterval = setInterval(() => {
                        const cmd = `sh -c "export LC_ALL=C; top -bn1 | grep -i -m1 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{m=\\$3/\\$2*100.0} /Swap:/{s=(\\$2>0?\\$3/\\$2*100.0:0)} END{print m; print s+0}'; cat /proc/net/dev | awk 'NR>2{rx+=\\$2; tx+=\\$10} END{print rx, tx}'; cat /proc/uptime | awk '{print \\$1}'; cat /proc/loadavg | awk '{print \\$1,\\$2,\\$3}'; ps -eo rss,pcpu,comm --sort=-%cpu | head -n 6"`;
                        sshClient.exec(cmd, (e, exStream) => {
                            if (e) return; let out = ''; exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 6) {
                                    const cpu = parseFloat(p[0]) || 0; const mem = parseFloat(p[1]) || 0; const swap = parseFloat(p[2]) || 0;
                                    const netParts = p[3].split(/\s+/); const currentRx = parseFloat(netParts[0]) || 0; const currentTx = parseFloat(netParts[1]) || 0;
                                    const uptime = parseFloat(p[4]) || 0; const load = p[5] || '0.00 0.00 0.00';
                                    
                                    let rxSpeed = 0, txSpeed = 0;
                                    if (sshClient.lastRx !== undefined && currentRx >= sshClient.lastRx) { rxSpeed = (currentRx - sshClient.lastRx) / 1024 / 2; txSpeed = (currentTx - sshClient.lastTx) / 1024 / 2; }
                                    sshClient.lastRx = currentRx; sshClient.lastTx = currentTx;

                                    const processLines = p.slice(6);
                                    const processes = processLines.map(line => {
                                        const parts = line.trim().split(/\s+/);
                                        if(parts.length >= 3) {
                                            let rss = parseInt(parts[0]); let memStr = rss > 1024 ? (rss/1024).toFixed(1) + 'M' : rss + 'K'; if (rss === 0) memStr = '0';
                                            return { mem: memStr, cpu: parts[1], cmd: parts.slice(2).join(' ') };
                                        }
                                        return null;
                                    }).filter(Boolean);
                                    ws.send(JSON.stringify({ type: 'MONITOR', cpu, mem, swap, rxSpeed: parseFloat(rxSpeed.toFixed(1)), txSpeed: parseFloat(txSpeed.toFixed(1)), uptime, load, processes }));
                                }
                            });
                        });
                    }, 2000);
                }).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish([creds.password]); else finish([]);
                }).on('error', (err) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        if (err.message.toLowerCase().includes('authenticat') || err.message.includes('Handshake failed')) {
                            let attempts = (ipAttempts.get(clientIp) || 0) + 1; ipAttempts.set(clientIp, attempts);
                            if (attempts >= MAX_ATTEMPTS) {
                                ipBlocklist.set(clientIp, Date.now() + BLOCK_TIME);
                                ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[1;41;37m [ 警报 ] \x1b[0m\x1b[31m 触发防爆破保护，您的 IP 已封禁 24 小时。\x1b[0m\r\n` }));
                            } else ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH 鉴权失败]:\x1b[0m 密码或私钥错误！(剩余尝试: ${MAX_ATTEMPTS - attempts})\r\n` }));
                        } else ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH Error]:\x1b[0m ${err.message}\r\n` }));
                        ws.close();
                    }
                });

                if (creds.host.includes(':')) {
                    SocksClient.createConnection({ proxy: { ipaddress: '127.0.0.1', port: 1080, type: 5 }, command: 'connect', destination: { host: creds.host, port: creds.port } }, (err, info) => {
                        if (err) { if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[WARP Error]:\x1b[0m 隧道未就绪。\r\n` })); ws.close(); } return; }
                        creds.sock = info.socket; sshClient.connect(creds);
                    });
                } else sshClient.connect(creds);
            } catch (e) { ws.close(); }
        } else {
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) sshStream.write(cmd.data);
                
                // 【云端流式解压缩引擎】
                else if (cmd.type === 'UNZIP' && sshClient) {
                    const ext = cmd.filename.toLowerCase();
                    let execCmd = '';
                    if (ext.endsWith('.zip')) execCmd = `unzip -o "/root/${cmd.filename}" -d "/root/"`;
                    else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) execCmd = `tar -xzf "/root/${cmd.filename}" -C "/root/"`;
                    
                    if (execCmd) {
                        sshClient.exec(execCmd, (err, stream) => {
                            if (err) return ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 解压失败: ${err.message}\x1b[0m\r\n` }));
                            stream.on('close', () => {
                                ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📦 文件 ${cmd.filename} 云端解压完成！\x1b[0m\r\n` }));
                                sendDirTree(sftpSession);
                            });
                        });
                    }
                }
                // 【云端文件下载】
                else if (cmd.type === 'DOWNLOAD_FILE' && sftpSession) {
                    sftpSession.readFile(`/root/${cmd.filename}`, (err, data) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 下载失败: ${err.message}\x1b[0m\r\n` }));
                        else ws.send(JSON.stringify({ type: 'DOWNLOAD_READY', filename: cmd.filename, data: data.toString('base64') }));
                    });
                }
                // 【终端黑洞秒传 (上传)】
                else if (cmd.type === 'UPLOAD_FILE' && sftpSession) {
                    const buffer = Buffer.from(cmd.data, 'base64');
                    sftpSession.writeFile(`/root/${cmd.filename}`, buffer, (err) => {
                        if (err) ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 上传失败: ${err.message}\x1b[0m\r\n` }));
                        else {
                            ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🚀 终端秒传成功：已保存至 /root/${cmd.filename} \x1b[0m\r\n` }));
                            sendDirTree(sftpSession);
                        }
                    });
                }
                
                else if (cmd.type === 'GET_PROCESS_LIST' && sshClient) {
                    sshClient.exec(`export LC_ALL=C; ps -eo pid,user,rss,pcpu,comm,args --sort=-%cpu | head -n 101`, (e, stream) => {
                        if (e) return; let out = ''; stream.on('data', d => out += d.toString());
                        stream.on('close', () => {
                            const list = out.trim().split('\n').slice(1).map(line => {
                                const parts = line.trim().split(/\s+/); if (parts.length < 6) return null;
                                let rss = parseInt(parts[2]); let memStr = rss > 1024 ? (rss/1024).toFixed(1) + 'M' : rss + 'K'; if (rss === 0) memStr = '0';
                                return { pid: parts[0], user: parts[1], mem: memStr, cpu: parts[3], name: parts[4], cmdline: parts.slice(5).join(' ') };
                            }).filter(Boolean);
                            ws.send(JSON.stringify({ type: 'FULL_PROCESS_LIST', list }));
                        });
                    });
                }
                else if (cmd.type === 'READ_FILE' && sftpSession) { sftpSession.readFile(`/root/${cmd.filename}`, 'utf8', (err, data) => { ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.filename, content: err ? `// 读取失败: ${err.message}` : data })); }); }
                else if (cmd.type === 'WRITE_FILE' && sftpSession) { sftpSession.writeFile(`/root/${cmd.filename}`, cmd.content, 'utf8', (err) => { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: err ? `\r\n\x1b[31m[System] 保存失败: ${err.message}\x1b[0m\r\n` : `\r\n\x1b[32m[System] 📝 文件 ${cmd.filename} 成功保存！\x1b[0m\r\n` })); if(!err) sendDirTree(sftpSession); }); }
                else if (cmd.type === 'CREATE_FILE' && sftpSession) { sftpSession.writeFile(`/root/${cmd.filename}`, '', 'utf8', (err) => { if (!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📄 创建文件: ${cmd.filename}\x1b[0m\r\n` })); sendDirTree(sftpSession); } }); }
                else if (cmd.type === 'CREATE_DIR' && sftpSession) { sftpSession.mkdir(`/root/${cmd.dirname}`, (err) => { if (!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📁 创建文件夹: ${cmd.dirname}\x1b[0m\r\n` })); sendDirTree(sftpSession); } }); }
                else if (cmd.type === 'DELETE_NODE' && sftpSession) { const targetPath = `/root/${cmd.filename}`; if (cmd.isDir) { sftpSession.rmdir(targetPath, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 删除文件夹: ${cmd.filename}\x1b[0m\r\n` })); sendDirTree(sftpSession); } }); } else { sftpSession.unlink(targetPath, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 删除文件: ${cmd.filename}\x1b[0m\r\n` })); sendDirTree(sftpSession); } }); } }
                else if (cmd.type === 'RENAME_NODE' && sftpSession) { sftpSession.rename(`/root/${cmd.oldName}`, `/root/${cmd.newName}`, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] ✏️ 重命名: ${cmd.oldName} -> ${cmd.newName}\x1b[0m\r\n` })); sendDirTree(sftpSession); } }); }
                else if (cmd.type === 'REFRESH_DIR' && sftpSession) sendDirTree(sftpSession);
            } catch(e) { if (sshStream) sshStream.write(message); }
        }
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 终极云盘与广播版已点火，端口: ${PORT}`));
