FROM node:22-alpine
WORKDIR /app
COPY . .
RUN mkdir -p /app/runtime && chown -R node:node /app/runtime
USER node
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node","server/main.mjs"]
