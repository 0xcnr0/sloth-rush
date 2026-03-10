FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc || true
CMD ["node", "dist/index.js"]
