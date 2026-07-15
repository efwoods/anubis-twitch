FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bot.js oauth-server.js oauth-url.js ./

ENV NODE_ENV=production
ENV OAUTH_PORT=9070
ENV OAUTH_REDIRECT_URI=http://localhost:9070
ENV ENV_PATH=/app/.env

EXPOSE 9070

CMD ["node", "bot.js"]
