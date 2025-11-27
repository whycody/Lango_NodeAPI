FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g ts-node-dev

COPY firebase-key.json tsconfig.json ./
COPY src ./src

EXPOSE 3000

CMD ["ts-node-dev", "--respawn", "--transpile-only", "--poll=100", "--watch", "src", "src/server.ts"]