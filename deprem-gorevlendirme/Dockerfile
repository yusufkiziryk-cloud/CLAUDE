# Şanlıurfa İl Sağlık Müdürlüğü — Deprem Görevlendirme Sistemi
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# standalone çıktı + çalışma zamanında gereken dosyalar
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/schema.sql ./schema.sql
COPY --from=builder /app/fonts ./fonts
COPY --from=builder /app/scripts ./scripts
# seed betiği için tam bağımlılıklar (better-sqlite3 + bcryptjs)
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=deps /app/node_modules/prebuild-install ./node_modules/prebuild-install

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000
CMD ["node", "server.js"]
