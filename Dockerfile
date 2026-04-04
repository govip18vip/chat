# 仅用于 Railway：跑 server.js，避免 Nixpacks 对 Next 的双重 npm ci + node_modules/.cache 挂载导致 EBUSY
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Railway 会注入 PORT；server.js 已读取 process.env.PORT
CMD ["node", "server.js"]
