#!/bin/sh
# Runs the Java game server (internal) and the Node web server (public). If either stops, the container stops.
java -Dmope.root=/app -jar server/target/mope-server.jar &
JAVA_PID=$!
node scripts/devserver.js &
NODE_PID=$!
trap 'kill $JAVA_PID $NODE_PID 2>/dev/null' TERM INT
while kill -0 $JAVA_PID 2>/dev/null && kill -0 $NODE_PID 2>/dev/null; do sleep 2; done
kill $JAVA_PID $NODE_PID 2>/dev/null
exit 1
