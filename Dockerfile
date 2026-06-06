FROM node:24-alpine
WORKDIR /app
COPY package.json README.md ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "apps/api/src/server.ts"]
