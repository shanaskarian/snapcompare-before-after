#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix Gemini model 404 and camera re-attach after preview"
git push origin main
