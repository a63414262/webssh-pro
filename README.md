````markdown
**WebSSH Master OS** 是一个基于 Node.js 的全栈 Serverless WebSSH 客户端与服务器集群管理面板。采用前后端一体化 (All-in-One) 架构，极简部署，瞬间点火。

它不仅仅是一个终端工具，更是一个运行在浏览器里的**迷你云端操作系统**。通过特殊的“暗影监控通道”和“多路复用状态机”，彻底颠覆传统的 WebSSH 体验。

---

## ✨ 核心特性 (Features)

- **🌐 节点集群多路复用 (Cluster Multiplexing)**
  - 单页面同时保持多个 VPS 的独立 WebSocket 会话。
  - 节点无缝切换，数据绝对隔离，终端历史输出与状态完美保留。
- **📊 电竞级实时态势感知 (Advanced Dashboard)**
  - 基于 ECharts 驱动的动态双环形仪表盘 (CPU / RAM)。
  - 实时滚动的网络流量 (Network Traffic) 折线图。
  - “暗影监控通道”：监控数据独立路由，绝不污染终端标准输出。
- **💻 满血版 Web 终端 (Terminal Engine)**
  - 基于 `xterm.js`，支持自适应窗口缩放 (FitAddon)。
  - 完美支持 ANSI 颜色代码与标准 Linux 快捷键。
  - 智能处理 `keyboard-interactive` 现代 Linux 强制交互认证。
- **📁 可视化资源管理 (SFTP File Manager)**
  - 左侧目录树实时渲染，支持文件夹/文件高亮区分。
  - **全能 CRUD**：支持新建文件/文件夹、一键重命名、安全防误删确认。
- **📝 云端极速代码编辑 (Cloud Code Editor)**
  - 内置轻量且强大的 **Ace Editor** 引擎（彻底解决 Monaco Editor 的跨域 Web Worker 死机问题）。
  - 双击文件瞬间拉取远端代码流，支持智能语法高亮 (Shell, JS, Python, YAML 等)。
  - `Ctrl + S` 热键劫持，一键将代码覆盖保存至远端物理机。

---

## 📸 界面预览 (Screenshots)

*(建议在此处替换为你在项目中实际运行的截图链接)*

> **极客暗黑主题**：左侧集群与文件树，中部终端与代码流，右侧性能态势感知，三维一体！
>
> `<img src="docs/screenshot1.png" width="800">`

---

## 🛠️ 技术栈 (Tech Stack)

### Backend (引擎层)
- **Express**: 轻量级 Web 路由。
- **ws**: 高性能 WebSocket 隧道传输。
- **ssh2**: 纯 JavaScript 实现的 SSH2 客户端协议（同时接管 Shell 与 SFTP 子系统）。

### Frontend (展现层)
- **原生 JS/HTML/CSS**: 零构建工具，通过 CSS Grid 实现复杂桌面级布局。
- **xterm.js**: 终端渲染核心。
- **ECharts**: 监控数据可视化渲染。
- **Ace Editor**: 代码编辑器内核。

---

## 🚀 极速部署 (Installation & Usage)

啊，原来你用的是这个图形化的 **App Launchpad (应用启动台)**！这是典型的基于 Kubernetes 的云原生容器部署界面（类似于 Sealos 的逻辑）。

在这个界面部署超级爽，完全不需要敲命令，只要把我们之前推送到 GitHub 的镜像地址填进去就行了。

请对着你的屏幕，按照下面这 **5 步“填空题”** 依次填写：

### 📝 第 1 步：Application Name (应用名称)
* 随便起个名字，但**只能用小写字母和减号**。
* 建议填写：`webssh-pro`

### 🐳 第 2 步：Image (镜像配置)
这是最核心的一步，告诉平台去哪里拉取你的代码：
* 单选框选择：**🔘 Public** (因为我们之前在 GitHub Packages 里把它设为公开了)。
* **Image Name (镜像名称)** 填入你完整的 GitHub 镜像地址：
  ```text
  ghcr.io/a63414262/webssh-pro:latest
  ```

### ⚙️ 第 3 步：Usage (资源配置)
往下滚动（虽然截图中没完全展示，但下面肯定有拉杆或者输入框填 CPU 和内存）：
* 选择 **🔘 Fixed** (固定资源，防止按量计费超标)。
* **CPU**：拉到 `0.2 Core` 或者 `0.5 Core` 即可（Node.js 不吃 CPU）。
* **Memory (内存)**：⚠️ **必须要给到 `512 MB`**（或者 0.5 GB）。绝对不要给 128MB，否则应用在启动瞬间就会因为内存不足被系统强杀。

### 🌐 第 4 步：Network / Ports (网络与端口)
继续往下滚，一定会有一个填写端口的地方：
* **Container Port (容器端口)**：填入 **`8080`**。
* **Public Access / Ingress (外网访问)**：找到这个开关，**把它打开！** 平台会自动分配一个带 `https://` 的公网域名给你，这就是你以后访问面板的网址。

### 🌍 第 5 步：Environment Variables (环境变量)
在环境变量设置区，把咱们刚才说好的“三剑客”配置填进去：
```text
TZ=Asia/Shanghai
NODE_ENV=production
PORT=8080
```

---

### 🚀 发射！
全部填完后，点击右上角那个黑色的 **[Deploy Application]** 按钮。

系统会自动开始拉取你的 `ghcr.io` 镜像并启动。稍微等个几十秒，等状态变成绿色的 `Running`，直接点击它提供给你的外网链接。

你亲手打磨的“集群终极版 Web OS”，就正式在全球公网上线了！享受这极客般的成就感吧！

-----

## ⚠️ 云原生部署避坑指南 (Claw Cloud / Sealos 等专用)

如果你使用容器化 Serverless 平台部署，请务必注意以下“坑位”：

1.  **内存刺客 (OOMKilled)**: `npm install` 在安装 `ssh2` 原生模块时有一定内存开销。**对策**：部署时 Memory 配额必须设定在 `512MB` 以上，否则会导致容器反复重启 (CrashLoopBackOff)。
2.  **端口幽灵 (Error 111)**: 报 `Connection Refused: 111` 意味着网关找不到服务。**对策**：本项目的 `server.js` 已经硬编码监听 `0.0.0.0`，请确保你云平台的 Network 容器映射端口填的是 `8080`。
3.  **安全通道 (WSS)**: 如果你的云原生网关启用了 HTTPS，请放心，前端内置了智能协议降级与升级逻辑 (`ws://` 自动切换为 `wss://`)。

-----

## 📂 仓库结构 (Project Structure)

```plaintext
webssh-master-os/
├── package.json         # 依赖配置清单
├── server.js            # 后端核心引擎 (处理 WS 路由、SSH 握手、SFTP 读写、系统探针)
└── public/              # 前端 UI 目录
     └── index.html      # 前端 OS 桌面面板 (包含状态机、终端、图表与编辑器逻辑)
```

-----

## 🔒 安全性建议

1.  当前 Web 端与后端的 WebSocket 连接如果在非 HTTPS 环境下是明文传输的。**生产环境请务必通过 Nginx 反向代理配置 SSL 证书**。
2.  本项目出于极客便携性目的，所有状态存储在前端内存中（页面刷新即清空）。私钥与密码数据不会在后端落地存储。
3.  高精监控探针默认每 2 秒向目标服务器下发一次拉取指令，如果连接的节点超过 10 台，建议在 `server.js` 中适当调大 `setInterval` 的时间以减轻网络开销。

-----

## 🤝 参与贡献 (Contributing)

欢迎提交 Pull Request 或发起 Issue 来讨论新功能。

  - [x] 多路复用集群
  - [x] SFTP 增删改查
  - [x] Ace 跨域代码编辑
  - [ ] 计划中: 终端多色彩自定义主题
  - [ ] 计划中: 拖拽式本地文件上传

-----

## 📄 开源协议 (License)

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 开源。享受代码的乐趣吧！

```

---

**后续建议：**
你可以在 GitHub 仓库里建一个 `docs` 文件夹，把你之前发给我的那几张酷炫的截图传上去，然后把 Markdown 里 `<img src="docs/screenshot1.png" width="800">` 的路径替换成真实的图片路径，这样别人一进你的 GitHub 仓库，就会被那张高级的界面图震撼到！
```
