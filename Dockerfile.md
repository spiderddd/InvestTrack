
# ==========================================
# 🏗️ Stage 1: Builder (Build Frontend)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Install Dependencies
# We need python/make/g++ because sqlite3 sometimes needs to compile from source
RUN apk add --no-cache python3 make g++
COPY package*.json ./
# Install ALL dependencies (including devDependencies for Vite build)
RUN npm ci

# 2. Build Frontend
COPY . .
RUN npm run build

# ==========================================
# 🚀 Stage 2: Production (Runtime)
# ==========================================
FROM node:20-alpine
WORKDIR /app

# 1. Setup Environment
ENV NODE_ENV=production
ENV PORT=3001

# 2. Install Production Dependencies Only
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production

# 3. Copy Backend Source Code
COPY server.js ./
COPY server ./server

# 4. Copy Built Frontend Assets from Builder Stage
COPY --from=builder /app/dist ./dist

# 5. Setup Data Directory for SQLite
RUN mkdir -p data
VOLUME ["/app/data"]

# 6. Start Server
EXPOSE 3001
CMD ["node", "server.js"]
