FROM node:18-alpine

WORKDIR /usr/src/app

# 安装基础工具，并下载 wireproxy (隧道) 和 wgcf (全自动 WARP 注册器)
RUN apk add --no-cache wget curl tar \
    && wget https://github.com/octeep/wireproxy/releases/download/v1.0.7/wireproxy_linux_amd64.tar.gz \
    && tar -xzf wireproxy_linux_amd64.tar.gz \
    && mv wireproxy /usr/local/bin/ \
    && rm wireproxy_linux_amd64.tar.gz \
    && wget https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64 -O /usr/local/bin/wgcf \
    && chmod +x /usr/local/bin/wgcf

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 拷贝所有代码
COPY . .

EXPOSE 8080

# 点火
CMD [ "node", "server.js" ]
