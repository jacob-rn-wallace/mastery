#!/bin/bash
cd "$(dirname "$0")"

if [ ! -f user/questions.js ]; then
  echo "Error: user/questions.js not found."
  echo "Copy the template first: cp user/questions.template.js user/questions.js"
  exit 1
fi

python3 -m http.server 8000 &
PYTHON_PID=$!

node server.js $PYTHON_PID &
NODE_PID=$!

sleep 1
open http://localhost:8000

echo "Mastery is running at http://localhost:8000 — use the shutdown button in the app to stop."

wait $PYTHON_PID $NODE_PID
