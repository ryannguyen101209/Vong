# For any host that takes a container (Fly.io, Railway, a plain VPS).
# Render and similar can use render.yaml instead and skip this entirely.
FROM node:22-slim

# better-sqlite3 is a native module and is compiled during npm install.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
# Mount a volume at /data so listings and photos survive a redeploy.
ENV DATABASE_FILE=/data/vong.db
ENV UPLOADS_DIR=/data/uploads

EXPOSE 4000
CMD ["npm", "start"]
