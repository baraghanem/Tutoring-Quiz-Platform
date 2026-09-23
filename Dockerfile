FROM node:20-slim

WORKDIR /app

# Install native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Seed the database at build time
RUN npm run seed

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
