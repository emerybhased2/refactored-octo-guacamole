# Production image: Java game server (ws, internal :8081) + Node web server (public $PORT, serves the client and proxies /ws).
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY server/pom.xml server/pom.xml
RUN cd server && mvn -q -B dependency:go-offline
COPY server/src server/src
RUN cd server && mvn -q -B package -DskipTests && cp target/mope-server.jar /mope-server.jar

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /mope-server.jar server/target/mope-server.jar
COPY client client
COPY data data
COPY assets assets
COPY versions versions
COPY scripts/devserver.js scripts/devserver.js
COPY docker/start.sh start.sh
RUN mkdir -p database && chmod +x start.sh
# NEVER set MOPE_DEV in production: it enables the dev-only cheat messages (dev-coins, dev-disaster).
ENV MOPE_PORT=8081 PORT=8080 MOPE_DB=/app/database/mope.db
EXPOSE 8080
CMD ["./start.sh"]
