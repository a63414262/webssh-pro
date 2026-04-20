


# 🚀 WebSSH Pro | Master OS 集群终极版

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-5.0.0%20Ultimate-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

**WebSSH Pro** 是一个基于 Node.js 的全栈 Serverless WebSSH 客户端与服务器集群管理面板。它打破了传统 Web 终端的极限，将你的浏览器变成一个强大的**迷你云端操作系统**。

内置全自动 WARP IPv6 穿透、Fail2Ban 防爆破、SFTP 云盘化管理、黑洞拖拽秒传、上帝广播模式与电竞级实时态势感知。专为极客与批量管理多台 VPS 打造的终极运维神器。

📺 **作者 YouTube 频道**: [小K分享](https://www.youtube.com/@%E5%B0%8FK%E5%88%86%E4%BA%AB)

---

## ✨ 核心黑科技 (Features)

### 🛡️ 内存级 Fail2Ban 防爆破 (绝对防御)
- **前置拦截**：将安全防线前置到 Web 路由层。当识别到同一公网 IP 连续输错 5 次 SSH 密码/私钥，系统会直接将其打入内存黑洞，物理封禁 24 小时。
- **无损防御**：被封禁的 IP 发起的任何 WebSocket 请求会在第一步被瞬间掐断 (Drop)，绝不消耗底层服务器的 SSH 握手资源。

### 🌐 全自动 WARP IPv6 智能穿透
- **零配置点火**：容器启动即全自动向 Cloudflare 申请免费的 WARP 节点，并建立底层的 SOCKS5 隐形隧道 (`wireproxy`)。
- **智能劫持**：登录纯 IPv6 小鸡时（如 Scaleway / Hax），系统自动识别冒号并劫持流量穿越 WARP 隧道，完美拯救各类无 IPv6 网络的纯净 Serverless 容器！

### ⚡ 上帝广播与黑洞秒传 (Terminal Evolution)
- **上帝广播模式 (Multi-Execution)**：顶部专属全局命令框，敲击一次回车，命令将同步分发到所有已连接的集群节点，批量管理神器。
- **黑洞拖拽秒传**：摒弃传统 Zmodem (rz/sz) 断流的烦恼，**直接将本地文件拖入黑色的 Terminal 窗口**，文件瞬间转化为 Base64 流直穿 SFTP 写入 `/root`，享受秒传快感。

### 📁 可视化云盘引擎 (Advanced SFTP Manager)
- **Ace Editor 云端直编**：双击文件瞬间拉取远端代码，支持数十种语法高亮，`Ctrl+S` 热键劫持直连物理机保存。
- **云盘化操作**：鼠标悬停文件，支持一键 **⏬ 本地下载**，以及对 `.zip / .tar.gz` 文件的 **📦 云端服务器秒解压**。

### 📊 电竞级实时态势感知 (Live Dashboard)
- **三擎表盘**：实时独立监控 CPU、物理内存 (RAM)、与 **虚拟内存 (SWAP)**，OOM 危机一目了然。
- **硬核数据盘**：精准显示系统运行时间 (Uptime)、系统负载 (Load)、以及分离的入站 (RX) / 出站 (TX) 实时网速。
- **心跳调度器 (Task Manager)**：右下角常驻 Top 5 活跃进程。一键展开全屏快照，支持纯前端无缝排序 CPU/内存，数据每 2 秒极致刷新。

---

## 🛠️ 技术栈 (Tech Stack)

- **Backend**: Express, ws (WebSocket), ssh2 (纯 JS 协议栈), socks (代理劫持)
- **Frontend**: 原生 JS/CSS, xterm.js, ECharts, Ace Editor
- **Environment**: Node.js 18, wgcf (WARP 全自动注册), wireproxy (用户态 WireGuard 引擎)

---

## 🚀 极速部署 (Docker / Serverless)

本项目已完美适配 ClawCloud、Sealos 等 Serverless 容器平台，一键起飞。

### 1. 镜像地址
使用 GitHub Container Registry 提供的最新自动构建镜像：
```text
ghcr.io/a63414262/webssh-pro:latest
````

### 2\. 容器基础配置要求

  - **CPU**: 0.2 Core \~ 0.5 Core
  - **内存 (Memory)**: ⚠️ 至少需分配 `512MB` (低于此值可能导致 Node.js 内存溢出或 WARP 隧道断流)
  - **暴露端口 (Port)**: `8080` (开启公网访问)

### 3\. 环境变量 (Environment Variables)

只需添加以下三个基础变量，系统即可自动完成时区校准和 WARP 引擎初始化：

```text
TZ=Asia/Shanghai
NODE_ENV=production
PORT=8080
```

-----

## 🔒 隐私与安全声明 (Privacy & Security)

1.  **绝对无状态 (Stateless)**：本系统不依赖任何数据库（MySQL/Redis）。所有节点连接凭证仅存在于浏览器的临时内存中。
2.  **阅后即焚**：一旦刷新网页或关闭浏览器，所有连接与状态信息瞬间彻底销毁，后端不落地任何敏感数据。
3.  **建议**：在生产环境中，请务必绑定域名并开启 HTTPS (SSL) 加密，以保护 WebSocket 数据隧道的传输安全。

-----

## 🤝 参与贡献 (Contributing)

如果你喜欢这个充满极客精神的项目，欢迎提交 Pull Request，或者给个 ⭐ **Star** 支持一下！

## 📄 开源协议 (License)

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 开源。

```
```
