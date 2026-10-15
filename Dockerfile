FROM node:24-alpine
WORKDIR /app
COPY package.json README.md ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
ENV NODE_ENV=production
ENV PORT=8080
# The server binds 127.0.0.1 by default; inside a container it must listen on all interfaces.
ENV HOST=0.0.0.0
ENV SRP_DATA_FILE=/data/state.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
# Demo tokens are disabled when NODE_ENV=production. Pass SRP_TOKENS="token:role:subject,...".
CMD ["node", "apps/api/src/server.ts"]
