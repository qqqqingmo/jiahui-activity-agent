FROM node:20.19.5-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.server.json vite.config.ts ./
COPY server ./server
COPY shared ./shared
COPY src ./src
RUN npm run build

FROM node:20.19.5-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    JIAHUI_DEPLOYMENT_MODE=integrated \
    JOB_DATA_DIR=/data/jobs

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server/templates ./server/templates

RUN mkdir -p /data/jobs && chown -R node:node /data
USER node

VOLUME ["/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist-server/server/index.js"]
