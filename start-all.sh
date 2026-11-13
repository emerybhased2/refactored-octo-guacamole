#!/usr/bin/env bash
# Build (if needed), validate, then start game server (ws :8081) and client dev server (http :8080).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .run database
java -version >/dev/null 2>&1 || { echo "Java 17+ required"; exit 1; }
[ "$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -1)" -ge 17 ] || { echo "Java 17+ required"; exit 1; }
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
node scripts/validate-data.js | tail -1
if [ ! -f server/target/mope-server.jar ] || [ -n "$(find server/src server/pom.xml -newer server/target/mope-server.jar -print -quit)" ]; then
  echo "Building server..."; (cd server && if command -v gradle >/dev/null && [ -z "${MOPE_USE_MAVEN:-}" ]; then gradle --no-daemon -q shadowJar && mkdir -p target && cp build/libs/mope-server.jar target/; else mvn -q -B package; fi)
fi
for f in .run/server.pid .run/web.pid; do [ -f "$f" ] && kill -0 "$(cat $f)" 2>/dev/null && { echo "Already running (use ./stop-all.sh)"; exit 1; }; done
nohup java -Dmope.root="$PWD" -jar server/target/mope-server.jar > .run/server.log 2>&1 & echo $! > .run/server.pid
nohup node scripts/devserver.js > .run/web.log 2>&1 & echo $! > .run/web.pid
for i in $(seq 1 50); do grep -q listening .run/server.log 2>/dev/null && break; sleep 0.2; done
echo "Game server : ws://localhost:${MOPE_PORT:-8081}   (log: .run/server.log)"
echo "Client      : http://localhost:${MOPE_WEB_PORT:-8080}/?dev=1   (version selector + FPS/ping overlay)"
