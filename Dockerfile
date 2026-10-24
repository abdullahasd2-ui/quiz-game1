# syntax=docker/dockerfile:1

# The web bundle is platform-independent, so it is built on the builder's native
# architecture even when the image targets another one (arm64 Mac -> amd64 server).
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
RUN apk add --no-cache zip
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build
# The mobile app's OTA bundle: the same game screens built for the app, zipped for its updater
# (served by apps/server/src/api/public/app-update.ts).
COPY apps/mobile apps/mobile
RUN npm run bundle -w @quiz/mobile \
 && mkdir ota && cp apps/mobile/dist/ota.json ota/ \
 && cd apps/mobile/dist && zip -qrX /app/ota/bundle.zip .

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# The server runs its TypeScript through tsx, a devDependency of @quiz/server, so dev deps stay.
RUN npm ci -w @quiz/server -w @quiz/shared && npm cache clean --force
COPY tsconfig.base.json ./
# Legacy question bank, read by src/scripts/seed-legacy.ts.
COPY index.html ./
# Question-bank proposals, read by src/scripts/load-bank.ts.
COPY bank bank
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY --from=web /app/apps/web/dist apps/web/dist
COPY --from=web /app/ota apps/mobile/ota
# Owned by node so a fresh named volume mounted here is writable.
RUN mkdir -p /data/uploads && chown node:node /data/uploads

ENV NODE_ENV=production
ENV UPLOAD_DIR=/data/uploads
WORKDIR /app/apps/server
USER node
EXPOSE 3000
CMD ["sh", "-c", "node --import tsx src/scripts/migrate.ts && exec node --import tsx src/index.ts"]
