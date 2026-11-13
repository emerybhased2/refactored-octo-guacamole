#!/usr/bin/env bash
cd "$(dirname "$0")"
for n in server web; do
  f=.run/$n.pid
  if [ -f "$f" ]; then pid=$(cat "$f"); if kill -0 "$pid" 2>/dev/null; then kill "$pid"; for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.3; done; kill -0 "$pid" 2>/dev/null && kill -9 "$pid"; echo "stopped $n ($pid)"; fi; rm -f "$f"; fi
done
