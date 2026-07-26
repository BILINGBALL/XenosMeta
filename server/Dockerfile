# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma/ ./prisma/

RUN npm ci

COPY src/ ./src/

RUN npm run build

# ---- Runtime Stage ----
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production TMPDIR=/tmp

# Install LibreOffice for office document-to-PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer-nogui \
    libreoffice-calc-nogui \
    libreoffice-impress-nogui \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/prisma/ ./prisma/

EXPOSE 3001

CMD ["node", "-r", "tsconfig-paths/register", "dist/app.js"]
