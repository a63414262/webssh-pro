
# 🚀 WebSSH Pro | Master OS 集群终极堡垒机

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-8.0.0%20Ultimate-green.svg)
![Security](https://img.shields.io/badge/security-Zero--Knowledge%20%7C%20AES--256-red.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

**WebSSH Pro** 是一个基于 Node.js 的全栈 Serverless 跨平台 WebSSH 客户端与服务器集群管理面板。
它打破了传统 Web 终端的极限，将你的浏览器彻底改造为一个强大的**迷你云端操作系统**与**零信任安全堡垒机**。

内置全局哈希鉴权、内存级 JIT AES-256 加密保险箱、云端弹药库（常用命令库）、全自动 WARP IPv6 穿透、带白名单的 Fail2Ban 绝对防御、全盘漫游云盘、黑洞拖拽秒传与上帝广播模式。专为极客与批量管理多台 VPS 打造的终极运维神器。

📺 **作者 YouTube 频道**: [小K分享](https://www.youtube.com/@%E5%B0%8FK%E5%88%86%E4%BA%AB)

---

## ✨ 核心黑科技 (Features)

### 🔐 零知识绝对领域 (Zero-Knowledge Security)
- **哈希鉴权隔离**：环境变量中**绝对不存储明文密码**，仅存储密码的 SHA-256 哈希值，即使平台 0day 漏洞导致配置泄露，黑客也无法逆向出真实密码。
- **JIT 内存级加密**：输入的面板密码将在 WebSocket 内存中动态转化为 32 字节 AES-256-GCM 密钥。你的节点凭证与常用命令落地存储时全部为极高强度的密文，断开连接密钥即刻销毁 (GC)，实现真正的“拔网线即物理隔离”。
- **内置离线 Hash 工具**：登录界面自带纯前端的 Hash 生成器，不走网络，本地计算，告别繁琐的命令行操作。
- **双模运行 (Admin / Guest)**：不输入密码默认进入「无痕访客体验模式」，所有凭证阅后即焚，不留任何痕迹；登录后解锁「云端保险箱」，享受极客专属存储。

### ⚡ 云端双保险箱与上帝广播 (Cloud Arsenal & God Mode)
- **节点保险箱 (带自定义别名)**：密码与私钥高强度加密存储至云端，支持**双击重命名节点别名**，一键秒连。
- **弹药库保险箱 (常用命令)**：新增编辑器/常用命令双选项卡。可将冗长的环境配置脚本加密保存至云端，点击 `▶ 运行` 瞬间触发。
- **上帝广播模式 (Multi-Execution)**：顶部专属全局命令框，敲击一次回车，命令将同步分发执行到所有已连接的在线集群节点，实现降维打击般的批量管理。

### 🛡️ 内存级 Fail2Ban 防爆破 (Active Defense)
- **前置拦截**：安全防线前置到 Web 路由层。同一公网 IP 连续 5 次 SSH 或面板鉴权失败，直接打入内存黑洞，物理封禁 24 小时。
- **站长免死金牌 (IP Whitelist)**：支持配置专属 IP 白名单，彻底告别被自己系统误杀的尴尬。

### 📁 全盘漫游与黑洞秒传 (Advanced SFTP)
- **全盘动态下钻**：突破 `/root` 限制，支持双击文件夹无缝下钻，支持退回根目录 `/`，实现真正的 Linux 全盘漫游。
- **黑洞拖拽秒传**：摒弃传统 Zmodem (rz/sz) 断流的烦恼，**直接将本地文件拖入黑色的 Terminal 窗口**，文件瞬间转化为 Base64 流直穿 SFTP 极速写入当前所处目录。
- **云端秒解压**：右键/悬停支持一键 **⏬ 本地下载**，以及对 `.zip / .tar.gz` 的 **📦 云端服务器原地爆破解压**。
- **Ace Editor 云编**：双击文件拉取代码，支持数十种语法高亮，`Ctrl+S` 热键劫持直连物理机覆盖保存。

### 🌐 WARP IPv6 穿透 & 电竞级态势感知
- **零配置点火**：容器启动即全自动向 Cloudflare 申请 WARP 节点，并建立底层的 SOCKS5 隐形隧道，完美拯救各类无 IPv6 网络的纯净 Serverless 容器（如 ClawCloud）！
- **三擎表盘 & 进程调度**：实时独立监控 CPU、RAM 与 **SWAP (虚拟内存)**。支持纯前端无缝排序的 Top 100 进程实时快照，数据每 2 秒极致刷新。

---

## 🛠️ 技术栈 (Tech Stack)

- **Backend**: Express, ws (WebSocket), ssh2 (纯 JS 协议栈), crypto (原生密码学模块)
- **Frontend**: 原生 JS/CSS, xterm.js, ECharts, Ace Editor
- **Environment**: Node.js 18+, wgcf (WARP 全自动注册), wireproxy (轻量级 WireGuard 引擎)

---

## 🚀 极速部署 (Docker / Serverless)

本项目已完美适配 ClawCloud、Sealos、Koyeb 等 Serverless 容器平台，一键起飞。

### 1. 镜像地址
推荐直接使用 GitHub Container Registry 提供的最新镜像：
```text
ghcr.io/a63414262/webssh-pro:latest
````

### 2\. 容器基础配置要求 northflank免费配额即可

  - **CPU**: 0.1 Core
  - **内存 (Memory)**: ⚠️ 256MB
  - **暴露端口 (Port)**: `8080` (开启公网访问)

### 3\. 配置环境变量 (Environment Variables) ⚠️

为了极致的安全，本系统**不接受明文密码**。
部署时，你可以直接访问未配置密码的面板，点击登录框下方的 **“🔧 算不出 Hash？点我一键生成”** 获取你专属的 Hash 值。

在northflank平台Environment variables
选择env填入以下环境变量：

```text
TZ="Asia/Shanghai"
NODE_ENV="production"
PORT="8080"
PANEL_USER="admin"
PANEL_PASS_HASH="密码哈希"
PANEL_IP_WHITELIST="你自己的ip"
GITHUB_CLIENT_ID="填你的"
GITHUB_CLIENT_SECRET="填你的"
GITHUB_ALLOWED_USERS="你的github用户名"    
```

*(注：如果不填写 `PANEL_USER` 和 `PANEL_PASS_HASH`，系统将默认永久锁定为「无痕访客体验模式」)*

⚙️ 终极使用指南 (如何启用 GitHub 登录？)

要启用 GitHub 一键登录，你需要在云端环境里补充 3 个环境变量：

    GITHUB_CLIENT_ID

    GITHUB_CLIENT_SECRET

    GITHUB_ALLOWED_USERS

⚠️ 极其重要提示：

    如果使用了 GitHub 登录，你的节点保险箱数据将基于 GITHUB_CLIENT_SECRET 进行加密。
    这意味着，如果你之前用“普通密码登录”存了节点，现在换成“GitHub登录”，你会看到保险箱是空的（因为加密钥匙变了，这是正常的物理隔离！）。反之亦然。建议以后统一使用 GitHub 登录来管理你的节点。

🔧 获取 Client ID 和 Secret 的方法：

    登录你的 GitHub 账号，访问：Developer Settings -> OAuth Apps

    点击右上角的 New OAuth App

    填写信息：

        Application name: WebSSH Pro (随便填)

        Homepage URL: https://你的northflank域名.com (必须填你实际部署的面板域名)

        Authorization callback URL: https://你的northflank域名.com/auth/github/callback (结尾一定是 /auth/github/callback)

    注册成功后，你会得到一个 Client ID。

    点击页面上的 Generate a new client secret，你会得到一串长长的 Client Secret。

把它们配到环境变量里，再将你的 GitHub 用户名 填进 GITHUB_ALLOWED_USERS，重启容器。
回到网页，点击那个霸气的 🐱 使用 GitHub 授权登录 按钮，感受终极极客的爽快吧！
-----

## 🤝 参与贡献 (Contributing)

如果你喜欢这个充满极客精神的项目，欢迎提交 Pull Request，或者给个 ⭐ **Star** 支持一下！

## 📄 开源协议 (License)

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 开源。

```
```
