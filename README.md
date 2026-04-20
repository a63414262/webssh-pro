看到你的截图了！在某些特定的编辑器或旧版网页里，Markdown 的多级列表和加粗符号如果没有严格的空行，确实容易渲染成纯文本。

而且更重要的是，**我们这个项目现在已经进化成了真正的“终极完全体”**（加入了全自动 WARP IPv6 穿透、三引擎表盘、实时心跳进程表），原来的介绍早就配不上它现在的强大了！

我为你重新编写了一份**排版绝对标准、且包含所有最新黑科技特性**的 GitHub README 模板。这次采用了最严谨的 GitHub Flavored Markdown 语法，保证在任何地方都能完美渲染。

直接复制以下全部代码，替换掉你仓库里的 `README.md`：

-----

````markdown
# 🚀 WebSSH Pro | Master OS 集群终极版

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-4.0.0%20Ultimate-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

**WebSSH Pro** 是一个基于 Node.js 的全栈 Serverless WebSSH 客户端与服务器集群管理面板。采用前后端一体化 (All-in-One) 架构，极简部署，瞬间点火。

它不仅仅是一个 Web 终端，更是一个运行在浏览器里的**迷你云端操作系统**。内置全自动 WARP IPv6 穿透引擎、SFTP 资源管理、实时态势感知与进程调度，彻底颠覆传统的服务器管理体验。

📺 **作者 YouTube 频道**: [小K分享](https://www.youtube.com/@%E5%B0%8FK%E5%88%86%E4%BA%AB)

---

## ✨ 核心黑科技 (Features)

### 🌐 全自动 WARP IPv6 智能穿透 (独家)
- **零配置**：容器启动即自动向 Cloudflare 申请免费的 WARP IPv6 节点，并建立底层的 SOCKS5 隐形隧道 (`wireproxy`)。
- **智能劫持**：只需在登录框输入纯 IPv6 地址，系统自动识别并劫持流量穿越 WARP 隧道。完美拯救各类平台无 IPv6 网络的纯净小鸡！

### 📊 电竞级实时态势感知 (Live Dashboard)
- **三擎表盘**：基于 ECharts 驱动的实时 CPU、RAM、**SWAP (虚拟内存)** 独立监控环。
- **四宫格探针**：精准显示系统运行时间 (Uptime)、系统负载 (Load)、以及精确到 KB/s 的入站/出站实时网速。
- **心跳轮询机制**：数据每 2 秒极致刷新，多节点切换时数据状态完美隔离与记忆。

### ⚙️ 动态进程调度器 (Task Manager)
- 仿 FinalShell 的精美进程表格，右下角常驻 Top 5 资源消耗进程。
- **全屏实时快照**：一键展开 Top 100 进程详情（PID、用户、内存、CPU、完整命令行）。
- **纯前端排序引擎**：点击表头即可实现 CPU / 内存的无缝升降序切换。

### 💻 满血版 Web 终端与资源管理 (Terminal & SFTP)
- 基于 `xterm.js`，支持自适应窗口缩放，完美支持 ANSI 颜色与标准 Linux 快捷键。
- **左侧可视化目录树**：支持文件/文件夹的增删改查 (CRUD)。
- **Ace Editor 云端编辑**：双击文件瞬间拉取代码流，支持数十种语法高亮，`Ctrl+S` 热键劫持直达远端物理机保存。

---

## 🛠️ 技术栈 (Tech Stack)

- **Backend**: Express, ws (WebSocket), ssh2 (纯 JS 协议栈), socks (代理劫持)
- **Frontend**: 原生 JS/CSS, xterm.js, ECharts, Ace Editor
- **Environment**: wgcf (WARP 自动注册), wireproxy (轻量级用户态 WireGuard)

---

## 🚀 极速部署 (Docker / 云原生容器部署)

本项目已完美适配 ClawCloud、Sealos 等 Serverless 容器平台。

### 1. 镜像地址
推荐直接使用 GitHub Container Registry 提供的最新自动构建镜像：
```text
ghcr.io/a63414262/webssh-pro:latest
````

### 2\. 容器基础配置要求

  - **CPU**: 0.2 Core \~ 0.5 Core
  - **内存 (Memory)**: ⚠️ 至少 `512MB` (用于承载底层的 ssh2 加密运算与 wgcf 隧道，低于此值可能导致 OOM 重启)
  - **暴露端口 (Port)**: `8080` (必须开启公网访问)

### 3\. 环境变量 (Environment Variables)

在部署时，只需添加以下最基础的环境变量，系统将自动完成时区校准和引擎优化：

```text
TZ=Asia/Shanghai
NODE_ENV=production
PORT=8080
```

*(注：系统会在容器启动时全自动注册并拉起 WARP 隧道，无需手动配置任何私钥！)*

-----

## 🔒 安全与隐私声明 (Security)

1.  **无状态架构 (Stateless)**：本项目出于极客便携性与安全性考虑，不依赖任何外部数据库（MySQL/Redis）。所有节点状态与连接凭证（密码/私钥）仅存在于你当前浏览器的内存中。
2.  **阅后即焚**：一旦刷新网页或关闭浏览器，所有连接信息瞬间销毁，后端绝不落地存储任何用户敏感数据。
3.  建议在生产环境中，务必为你的访问域名开启 HTTPS (SSL) 加密，以保护 WebSocket 隧道的传输安全。

-----

## 🤝 参与贡献 (Contributing)

发现 Bug 或者有更酷的极客想法？欢迎提交 Pull Request 或发起 Issue！
如果这个项目帮助到了你，请给一个 ⭐ **Star** 支持一下！

## 📄 开源协议 (License)

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 开源。

```

***

