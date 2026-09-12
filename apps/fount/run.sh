#!/usr/bin/env sh
# Launch the Fount engine.
#
#   ./run.sh          serve on port 8099 and open a browser
#   ./run.sh 9000     serve on a different port
#
# ES modules need a real HTTP origin, so opening index.html from the
# filesystem does not work — hence a server rather than a double-click.

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=${1:-8099}
URL="http://localhost:$PORT/"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 is required to serve the files but was not found." >&2
  exit 1
fi

printf '\n  Fount Engine\n\n'
printf '    Game   %s\n' "$URL"
printf '    Editor %seditor/index.html\n\n' "$URL"
printf '  Ctrl-C to stop.\n\n'

# Give the server a moment to bind before pointing a browser at it.
( sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1
  fi ) &

cd "$DIR"
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
