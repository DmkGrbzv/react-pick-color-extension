FROM node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752
ARG REVISION=local
LABEL org.opencontainers.image.source="https://github.com/DmkGrbzv/react-pick-color-extension" \
      org.opencontainers.image.revision=$REVISION
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY src ./src
COPY docker/healthcheck.js ./docker/healthcheck.js
ENV NODE_ENV=production
USER node
EXPOSE 3001
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=6 CMD ["node", "docker/healthcheck.js"]
CMD ["node", "src/server.js"]
