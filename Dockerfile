FROM node:18-alpine

WORKDIR /usr/src/app

# 安装基础工具并下载 wireproxy (轻量级用户态 WireGuard 客户端)
RUN apk add --no-cache wget curl tar \
    && wget https://github.com/octeep/wireproxy/releases/download/v1.0.7/wireproxy_linux_amd64.tar.gz \
    && tar -xzf wireproxy_linux_amd64.tar.gz \
    && mv wireproxy /usr/local/bin/ \
    && rm wireproxy_linux_amd64.tar.gz

# 安装应用依赖 (包括 socks 模块)
COPY package*.json ./
RUN npm install --production

# 拷贝所有源代码
COPY . .

# 暴露 8080 端口
EXPOSE 8080

# 启动核心引擎
CMD [ "node", "server.js" ]
