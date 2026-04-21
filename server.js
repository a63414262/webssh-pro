const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { SocksClient } = require('socks');
const crypto = require('crypto'); 

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ================= 【云端保险箱与面板鉴权配置】 =================
const PANEL_USER = (process.env.PANEL_USER || '').trim();
// 【核心修复】：强力清洗环境变量！剃掉空格、换行、多余的符号，并强制转为小写
const PANEL_PASS_HASH = (process.env.PANEL_PASS_HASH || '').split(/\s+/)[0].trim().toLowerCase();

const NODES_FILE = '/usr/src/app/nodes.json'; 
const COMMANDS_FILE = '/usr/src/app/commands.json'; 

// ================= 【JIT 军事级加解密引擎 (密钥不落地)】 =================
const encryptData = (data, dynamicKey) => {
    if (!dynamicKey) return JSON.stringify(data); 
    try {
        const iv = crypto.randomBytes(16); 
        const cipher = crypto.createCipheriv('aes-256-gcm', dynamicKey, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex'); 
        return JSON.stringify({ iv: iv.toString('hex'), encryptedData: encrypted, authTag: authTag });
    } catch(e) { return "[]"; }
};

const decryptData = (text, dynamicKey) => {
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (parsed.iv && parsed.encryptedData && parsed.authTag) {
            if (!dynamicKey) return []; 
            const decipher = crypto.createDecipheriv('aes-256-gcm', dynamicKey, Buffer.from(parsed.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
            let decrypted = decipher.update(parsed.encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        }
        return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; } 
};

const getSavedNodes = (key) => { try { if (fs.existsSync(NODES_FILE)) return decryptData(fs.readFileSync(NODES_FILE, 'utf8'), key); } catch(e){} return []; };
const saveNodesData = (nodes, key) => { fs.writeFileSync(NODES_FILE, encryptData(nodes, key), 'utf8'); };
const getSavedCommands = (key) => { try { if (fs.existsSync(COMMANDS_FILE)) return decryptData(fs.readFileSync(COMMANDS_FILE, 'utf8'), key); } catch(e){} return []; };
const saveCommandsData = (cmds, key) => { fs.writeFileSync(COMMANDS_FILE, encryptData(cmds, key), 'utf8'); };

// ================= 【WARP IPv6 自动点火】 =================
const setupAutoWarp = () => {
    const confPath = '/usr/src/app/warp.conf';
    if (!fs.existsSync(confPath)) {
        console.log('\x1b[33m[Auto-WARP]\x1b[0m 未检测到配置，正在全自动申请 IPv6 节点...');
        try {
            execSync('wgcf register --accept-tos', { stdio: 'ignore' }); execSync('wgcf generate', { stdio: 'ignore' });
            let conf = fs.readFileSync('wgcf-profile.conf', 'utf8'); conf += '\n[Socks5]\nBindAddress = 127.0.0.1:1080\n';
            fs.writeFileSync(confPath, conf); console.log('\x1b[32m[Auto-WARP]\x1b[0m 申请成功！');
        } catch (e) { console.error('\x1b[31m[Auto-WARP Error]\x1b[0m 自动申请失败:', e.message); }
    }
    if (fs.existsSync(confPath)) { exec('wireproxy -c ' + confPath + ' -d', (err) => { if (err) console.error('[WARP Tunnel Error]', err); }); }
};
setupAutoWarp();

// ================= 【Web 级 Fail2Ban 防爆破拦截器】 =================
const ipBlocklist = new Map(); 
const ipAttempts = new Map();  
const MAX_ATTEMPTS = 5;        
const BLOCK_TIME = 24 * 60 * 60 * 1000; 

wss.on('connection', (ws, req) => {
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress;

    if (ipBlocklist.has(clientIp)) {
        if (Date.now() < ipBlocklist.get(clientIp)) {
            ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[1;41;37m [ 绝对防御 ] \x1b[0m\x1b[31m IP (${clientIp}) 因爆破已被物理隔离 24 小时！\x1b[0m\r\n` }));
            return ws.close();
        } else { ipBlocklist.delete(clientIp); ipAttempts.delete(clientIp); }
    }

    ws.isAuthenticated = (!PANEL_USER && !PANEL_PASS_HASH);

    let sshClient = new Client(); let sshStream = null; let sftpSession = null; let monitorInterval = null;

    const sendDirTree = (sftp, targetPath = '/root') => {
        sftp.readdir(targetPath, (err, list) => {
            if (!err) {
                const files = list.filter(item => item.filename !== '.' && item.filename !== '..').map(item => ({ name: item.filename, isDir: item.longname.startsWith('d'), size: item.attrs.size })).sort((a, b) => b.isDir - a.isDir);
                ws.send(JSON.stringify({ type: 'SFTP_TREE', path: targetPath, files }));
            }
        });
    };

    ws.on('message', (message) => {
        try {
            const cmd = JSON.parse(message);

            // ================= 【零知识面板鉴权 (带极强容错)】 =================
            if (cmd.type === 'PANEL_LOGIN') {
                const inputHash = cmd.pass ? crypto.createHash('sha256').update(cmd.pass).digest('hex').toLowerCase() : '';
                
                // 逻辑校验：如果环境变量是空的，则放行无痕模式；否则必须精准匹配
                const isMatch = (PANEL_USER === '' && PANEL_PASS_HASH === '') || (cmd.user === PANEL_USER && inputHash === PANEL_PASS_HASH);

                if (isMatch) {
                    ws.isAuthenticated = true; ipAttempts.delete(clientIp); 
                    // JIT 内存分配 AES 密钥 (如果是无密码访客模式，密钥为 null)
                    ws.aesKey = cmd.pass ? crypto.createHash('sha256').update(cmd.pass).digest() : null;
                    ws.send(JSON.stringify({ type: 'LOGIN_SUCCESS', nodes: getSavedNodes(ws.aesKey), commands: getSavedCommands(ws.aesKey) }));
                } else {
                    if (cmd.user !== '' || cmd.pass !== '') {
                        let attempts = (ipAttempts.get(clientIp) || 0) + 1; ipAttempts.set(clientIp, attempts);
                        if (attempts >= MAX_ATTEMPTS) { ipBlocklist.set(clientIp, Date.now() + BLOCK_TIME); }
                    }
                    ws.send(JSON.stringify({ type: 'LOGIN_FAIL', msg: '面板用户名或密码错误！' }));
                }
                return;
            }

            // ================= 【云端双保险箱操作 (需权限)】 =================
            if (cmd.type === 'GET_NODES' || cmd.type === 'SAVE_NODE' || cmd.type === 'DELETE_SAVED_NODE' || cmd.type === 'GET_COMMANDS' || cmd.type === 'SAVE_COMMAND' || cmd.type === 'DELETE_COMMAND') {
                if (!ws.isAuthenticated) return;
                
                if (cmd.type === 'GET_NODES') ws.send(JSON.stringify({ type: 'SAVED_NODES_LIST', nodes: getSavedNodes(ws.aesKey) }));
                else if (cmd.type === 'SAVE_NODE') {
                    const nodes = getSavedNodes(ws.aesKey); const idx = nodes.findIndex(n => n.host === cmd.node.host && n.port === cmd.node.port && n.user === cmd.node.user);
                    if (idx >= 0) nodes[idx] = cmd.node; else nodes.push(cmd.node);
                    saveNodesData(nodes, ws.aesKey); ws.send(JSON.stringify({ type: 'SAVED_NODES_LIST', nodes: getSavedNodes(ws.aesKey) }));
                }
                else if (cmd.type === 'DELETE_SAVED_NODE') {
                    let nodes = getSavedNodes(ws.aesKey); nodes = nodes.filter(n => n.id !== cmd.id);
                    saveNodesData(nodes, ws.aesKey); ws.send(JSON.stringify({ type: 'SAVED_NODES_LIST', nodes: getSavedNodes(ws.aesKey) }));
                }
                else if (cmd.type === 'GET_COMMANDS') ws.send(JSON.stringify({ type: 'SAVED_COMMANDS_LIST', commands: getSavedCommands(ws.aesKey) }));
                else if (cmd.type === 'SAVE_COMMAND') {
                    const cmds = getSavedCommands(ws.aesKey); const idx = cmds.findIndex(c => c.id === cmd.command.id);
                    if (idx >= 0) cmds[idx] = cmd.command; else cmds.push(cmd.command);
                    saveCommandsData(cmds, ws.aesKey); ws.send(JSON.stringify({ type: 'SAVED_COMMANDS_LIST', commands: getSavedCommands(ws.aesKey) }));
                }
                else if (cmd.type === 'DELETE_COMMAND') {
                    let cmds = getSavedCommands(ws.aesKey); cmds = cmds.filter(c => c.id !== cmd.id);
                    saveCommandsData(cmds, ws.aesKey); ws.send(JSON.stringify({ type: 'SAVED_COMMANDS_LIST', commands: getSavedCommands(ws.aesKey) }));
                }
                return;
            }

            // ================= 【无痕 SSH 直连通道 (无需面板鉴权)】 =================
            if (cmd.host) {
                if (sshStream) return;
                const creds = cmd; creds.tryKeyboard = true; creds.readyTimeout = 20000;

                sshClient.on('ready', () => {
                    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) return ws.close(); sshStream = stream;
                        ws.send(JSON.stringify({ type: 'TERMINAL', data: '\r\n\x1b[32m[System]\x1b[0m 🚀 OS 核心启动，终端连接成功。您可以直接将文件拖拽至此窗口进行秒传。\r\n\r\n' }));
                        stream.on('data', (d) => ws.send(JSON.stringify({ type: 'TERMINAL', data: d.toString('utf8') }))); stream.on('close', () => ws.close());
                    });
                    sshClient.sftp((err, sftp) => { if (!err) { sftpSession = sftp; sendDirTree(sftpSession, '/root'); } });
                    sshClient.lastRx = undefined; sshClient.lastTx = undefined;

                    monitorInterval = setInterval(() => {
                        const mCmd = `sh -c "export LC_ALL=C; top -bn1 | grep -i -m1 'Cpu(s)' | awk '{print \\$2+\\$4}'; free | awk '/Mem:/{m=\\$3/\\$2*100.0} /Swap:/{s=(\\$2>0?\\$3/\\$2*100.0:0)} END{print m; print s+0}'; cat /proc/net/dev | awk 'NR>2{rx+=\\$2; tx+=\\$10} END{print rx, tx}'; cat /proc/uptime | awk '{print \\$1}'; cat /proc/loadavg | awk '{print \\$1,\\$2,\\$3}'; ps -eo rss,pcpu,comm --sort=-%cpu | head -n 6"`;
                        sshClient.exec(mCmd, (e, exStream) => {
                            if (e) return; let out = ''; exStream.on('data', (d) => out += d.toString());
                            exStream.on('close', () => {
                                const p = out.trim().split('\n');
                                if (p.length >= 6) {
                                    const cpu = parseFloat(p[0]) || 0; const mem = parseFloat(p[1]) || 0; const swap = parseFloat(p[2]) || 0;
                                    const netParts = p[3].split(/\s+/); const currentRx = parseFloat(netParts[0]) || 0; const currentTx = parseFloat(netParts[1]) || 0;
                                    const uptime = parseFloat(p[4]) || 0; const load = p[5] || '0.00 0.00 0.00';
                                    let rxSpeed = 0, txSpeed = 0; if (sshClient.lastRx !== undefined && currentRx >= sshClient.lastRx) { rxSpeed = (currentRx - sshClient.lastRx) / 1024 / 2; txSpeed = (currentTx - sshClient.lastTx) / 1024 / 2; }
                                    sshClient.lastRx = currentRx; sshClient.lastTx = currentTx;
                                    const processes = p.slice(6).map(line => {
                                        const parts = line.trim().split(/\s+/);
                                        if(parts.length >= 3) { let rss = parseInt(parts[0]); let memStr = rss > 1024 ? (rss/1024).toFixed(1) + 'M' : rss + 'K'; if (rss === 0) memStr = '0'; return { mem: memStr, cpu: parts[1], cmd: parts.slice(2).join(' ') }; } return null;
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
                            if (attempts >= MAX_ATTEMPTS) { ipBlocklist.set(clientIp, Date.now() + BLOCK_TIME); ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[1;41;37m [ 警报 ] \x1b[0m\x1b[31m IP 因爆破已被物理隔离！\x1b[0m\r\n` })); } 
                            else ws.send(JSON.stringify({ type: 'TERMINAL', data: `\r\n\x1b[31m[SSH 鉴权失败]:\x1b[0m 密码或私钥错误！\r\n` }));
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
            }
            
            // ================= 【终端广播与全盘漫游文件流】 =================
            if (cmd.type === 'TERMINAL_INPUT' && sshStream) sshStream.write(cmd.data);
            else if (cmd.type === 'UNZIP' && sshClient) {
                const ext = cmd.path.toLowerCase(); let execCmd = '';
                if (ext.endsWith('.zip')) execCmd = `unzip -o "${cmd.path}" -d "${cmd.dir}"`; else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) execCmd = `tar -xzf "${cmd.path}" -C "${cmd.dir}"`;
                if (execCmd) { sshClient.exec(execCmd, (err, stream) => { if (err) return ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[31m[System] 解压失败: ${err.message}\x1b[0m\r\n` })); stream.on('close', () => { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📦 文件解压完成！\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); }); }); }
            }
            else if (cmd.type === 'DOWNLOAD_FILE' && sftpSession) { sftpSession.readFile(cmd.path, (err, data) => { if (!err) ws.send(JSON.stringify({ type: 'DOWNLOAD_READY', filename: cmd.path.split('/').pop(), data: data.toString('base64') })); }); }
            else if (cmd.type === 'UPLOAD_FILE' && sftpSession) { const buffer = Buffer.from(cmd.data, 'base64'); sftpSession.writeFile(cmd.path, buffer, (err) => { if (!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🚀 秒传成功：保存至 ${cmd.path} \x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); }
            else if (cmd.type === 'GET_PROCESS_LIST' && sshClient) { sshClient.exec(`export LC_ALL=C; ps -eo pid,user,rss,pcpu,comm,args --sort=-%cpu | head -n 101`, (e, stream) => { if (e) return; let out = ''; stream.on('data', d => out += d.toString()); stream.on('close', () => { const list = out.trim().split('\n').slice(1).map(line => { const parts = line.trim().split(/\s+/); if (parts.length < 6) return null; let rss = parseInt(parts[2]); let memStr = rss > 1024 ? (rss/1024).toFixed(1) + 'M' : rss + 'K'; if (rss === 0) memStr = '0'; return { pid: parts[0], user: parts[1], mem: memStr, cpu: parts[3], name: parts[4], cmdline: parts.slice(5).join(' ') }; }).filter(Boolean); ws.send(JSON.stringify({ type: 'FULL_PROCESS_LIST', list })); }); }); }
            else if (cmd.type === 'READ_FILE' && sftpSession) { sftpSession.readFile(cmd.path, 'utf8', (err, data) => { ws.send(JSON.stringify({ type: 'FILE_CONTENT', filename: cmd.path.split('/').pop(), path: cmd.path, content: err ? `// 读取失败: ${err.message}` : data })); }); }
            else if (cmd.type === 'WRITE_FILE' && sftpSession) { sftpSession.writeFile(cmd.path, cmd.content, 'utf8', (err) => { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: err ? `\r\n\x1b[31m[System] 保存失败: ${err.message}\x1b[0m\r\n` : `\r\n\x1b[32m[System] 📝 文件 ${cmd.path} 成功保存！\x1b[0m\r\n` })); if(!err) sendDirTree(sftpSession, cmd.dir); }); }
            else if (cmd.type === 'CREATE_FILE' && sftpSession) { sftpSession.writeFile(cmd.path, '', 'utf8', (err) => { if (!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📄 创建文件: ${cmd.path}\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); }
            else if (cmd.type === 'CREATE_DIR' && sftpSession) { sftpSession.mkdir(cmd.path, (err) => { if (!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 📁 创建文件夹: ${cmd.path}\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); }
            else if (cmd.type === 'DELETE_NODE' && sftpSession) { if (cmd.isDir) { sftpSession.rmdir(cmd.path, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 删除文件夹: ${cmd.path}\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); } else { sftpSession.unlink(cmd.path, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] 🗑️ 删除文件: ${cmd.path}\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); } }
            else if (cmd.type === 'RENAME_NODE' && sftpSession) { sftpSession.rename(cmd.oldPath, cmd.newPath, (err) => { if(!err) { ws.send(JSON.stringify({ type: 'SYSTEM_MSG', data: `\r\n\x1b[32m[System] ✏️ 重命名成功\x1b[0m\r\n` })); sendDirTree(sftpSession, cmd.dir); } }); }
            else if (cmd.type === 'REFRESH_DIR' && sftpSession) sendDirTree(sftpSession, cmd.path || '/root');
            
        } catch(e) {}
    });

    ws.on('close', () => { 
        if (monitorInterval) clearInterval(monitorInterval);
        if (sshClient) sshClient.end(); 
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`[Running] WebOS 终极容错鉴权版已点火，监听端口: ${PORT}`));
