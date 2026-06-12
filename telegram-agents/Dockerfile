FROM node:20-alpine

WORKDIR /app

# Once bagimliliklar (katman onbellegi icin)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Uygulama dosyalari
COPY . .

# .env dosyasi imaja KONULMAZ; degiskenler host panelinden verilir
CMD ["node", "bot.js"]
