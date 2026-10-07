FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund || npm install --only=production --no-audit --no-fund

# Copy source code and knowledge data
COPY src/ ./src/
COPY data/ ./data/
COPY serviceAccount.json* ./

ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/server.js"]
