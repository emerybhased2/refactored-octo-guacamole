#!/usr/bin/env bash
# Build all components, validate databases, run all tests.
set -euo pipefail
cd "$(dirname "$0")"
step() { printf '\n== %s\n' "$*"; }
command -v java >/dev/null || { echo "Java 17+ required"; exit 1; }
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
step "Validate historical databases"; node scripts/validate-data.js
step "Build server"
if command -v gradle >/dev/null && [ -z "${MOPE_USE_MAVEN:-}" ]; then (cd server && gradle --no-daemon -q shadowJar); JAR=server/build/libs/mope-server.jar
elif command -v mvn >/dev/null; then (cd server && mvn -q -B package); JAR=server/target/mope-server.jar
else echo "Need gradle or mvn"; exit 1; fi
mkdir -p server/target; [ "$JAR" = "server/target/mope-server.jar" ] || cp "$JAR" server/target/mope-server.jar
step "Server tests"; java -Dmope.root="$PWD" -cp server/target/mope-server.jar mope.SelfTest
step "Client/unit tests"; node tests/unit.js
step "Integration tests"; node tests/integration.js
echo; echo "BUILD OK"
