FROM node:18-alpine

# 创建应用目录
WORKDIR /usr/src/app

# 拷贝 package.json 并安装依赖
COPY package*.json ./
RUN npm install --production

# 拷贝所有源代码 (包括 server.js 和 public 目录)
COPY . .

# 暴露 8080 端口
EXPOSE 8080

# 启动引擎
CMD [ "node", "server.js" ]
