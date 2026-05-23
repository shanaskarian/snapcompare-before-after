#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Add MediaPipe face landmarks + secure server-side API key"
git push origin main
