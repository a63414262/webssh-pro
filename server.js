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
        console.log('\x1b[33m[Auto-WARP]\x1b[0m 未检测到配置，正在全自动向 Cloudflare 申请免费 IPv6 节点...\n(这可能需要 5~10 秒，请稍候)');
        try {
            execSync('wgcf register --accept-tos', { stdio: 'ignore' });
            execSync('wgcf generate', { stdio: 'ignore' });
            let conf = fs.readFileSync('wgcf-profile.conf', 'utf8');
            conf += '\n[Socks5]\nBindAddress = 127.0.0.1:1080\n';
            fs.writeFileSync(confPath, conf);
            console.log('\x1b[32m[Auto-WARP]\x1b[0m 申请成功！已提取专属私钥与 IPv6 出口地址。');
        } catch (e) {
            console.error('\x1b[31m[Auto-WARP Error]\x1b[0m 自动申请失败 (可能被 CF 盾拦截)，IPv6 代理将暂不可用。', e.message);
        }
    }
    if (fs.existsSync(confPath)) {
        console.log('\x1b[32m[System]\x1b[0m 启动 Wireproxy 引擎，IPv6 SOCKS5 隧道就绪 (Port: 1080)...');
        exec('wireproxy -c ' + confPath + ' -d', (err) => {
            if (err) console.error('[WARP Tunnel Error] Wireproxy 进程异常:', err);
        });
    }
};

setupAutoWarp();

wss.on('connection', (ws, req) => {
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

                    sshClient.sftp((err, sftp) => { if (!err) { sftpSession = sftp; sendDirTree(sftpSession); } });

                    sshClient.lastRx = undefined;
                    sshClient.lastTx = undefined;

                    // 【核心更新】：使用 awk 同时抓取 Mem 和 Swap，确保行数严格对齐
                    monitorInterval = setInterval(() => {
                        const cmd = `sh -c "export LC_ALL=C; top -bn1 | grep -i -m1 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{m=\\$3/\\$2*100.0} /Swap:/{s=(\\$2>0?\\$3/\\$2*100.0:0)} END{print m; print s+0}'; cat /proc/net/dev | awk 'NR>2{rx+=\\$2; tx+=\\$10} END{print rx, tx}'; cat /proc/uptime | awk '{print \\$1}'; cat /proc/loadavg | awk '{print \\$1,\\$2,\\$3}'; ps -eo rss,pcpu,comm --sort=-%cpu | head -n 6"`;
                        sshClient.exec(cmd, (e, exStream) => {
                            if (e) return;
                            let out = '';
                            exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 6) { // 行数增加，变为 6 项基础数据
                                    const cpu = parseFloat(p[0]) || 0; 
                                    const mem = parseFloat(p[1]) || 0;
                                    const swap = parseFloat(p[2]) || 0; // 新增 Swap 变量
                                    
                                    const netParts = p[3].split(/\s+/); 
                                    const currentRx = parseFloat(netParts[0]) || 0; 
                                    const currentTx = parseFloat(netParts[1]) || 0;
                                    
                                    const uptime = parseFloat(p[4]) || 0; 
                                    const load = p[5] || '0.00 0.00 0.00';
                                    
                                    let rxSpeed = 0, txSpeed = 0;
                                    if (sshClient.lastRx !== undefined && currentRx >= sshClient.lastRx) { rxSpeed = (currentRx - sshClient.lastRx) / 1024 / 2; txSpeed = (currentTx - sshClient.lastTx) / 1024 / 2; }
                                    sshClient.lastRx = currentRx; sshClient.lastTx = currentTx;

                                    const processLines = p.slice(6); // 进程列表从第 7 行开始
                                    const processes = processLines.map(line => {
                                        const parts = line.trim().split(/\s+/);
                                        if(parts.length >= 3) {
                                            let rss = parseInt(parts[0]); let memStr = rss > 1024 ? (rss/1024).toFixed(1) + 'M' : rss + 'K'; if (rss === 0) memStr = '0';
                                            return { mem: memStr, cpu: parts[1], cmd: parts.slice(2).join(' ') };
                                        }
                                        return null;
                                    }).filter(Boolean);
                                    
                                    // 传给前端新增 swap 字段
                                    ws.send(JSON.stringify({ type: 'MONITOR', cpu, mem, swap, rxSpeed: parseFloat(rxSpeed.toFixed(1)), txSpeed: parseFloat(txSpeed.toFixed(1)), uptime, load, processes }));
                                }
                            });
                        });
                    }, 2000);
                }).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) finish([creds.password]); else finish([]);
                }).on('error', (err) => {
                    if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH Error]:\x1b[0m ${err.message}\r\n` })); ws.close(); }
                });

                if (creds.host.includes(':')) {
                    SocksClient.createConnection({ proxy: { ipaddress: '127.0.0.1', port: 1080, type: 5 }, command: 'connect', destination: { host: creds.host, port: creds.port } }, (err, info) => {
                        if (err) {
                            if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[WARP Proxy Error]:\x1b[0m 纯 IPv6 隧道未就绪或打通失败。\r\n错误详情: ${err.message}\r\n` })); ws.close(); }
                            return;
                        }
                        creds.sock = info.socket; sshClient.connect(creds);
                    });
                } else { sshClient.connect(creds); }
            } catch (e) { ws.close(); }
        } else {
            try {
                const cmd = JSON.parse(message);
                if (cmd.type === 'TERMINAL_INPUT' && sshStream) sshStream.write(cmd.data);
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
    ws.on('close', () => { if (monitorInterval) clearInterval(monitorInterval); if (sshClient) sshClient.end(); });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 虚拟内存探针版已点火，监听端口: ${PORT}`));
