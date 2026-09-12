#!/usr/bin/env sh
# SuperClaude installer.
#
#   ./install.sh                 install the starter set
#   ./install.sh --all           install everything
#   ./install.sh --list          show what's available
#   ./install.sh writing-assistant fount-gamedev
#   ./install.sh --uninstall --all
#
# Thin wrapper over tools/install.py so there's one obvious entry point.
# Every flag is passed straight through.

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 is required but was not found on your PATH." >&2
  echo "Install it from https://www.python.org/downloads/ and run this again." >&2
  exit 1
fi

# No arguments is the common case for someone who just cloned the repo and
# wants the thing to work, so default to the starter set rather than usage.
if [ "$#" -eq 0 ]; then
  exec "$PY" "$DIR/tools/install.py" --starter
fi

exec "$PY" "$DIR/tools/install.py" "$@"
