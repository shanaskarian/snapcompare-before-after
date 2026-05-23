#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix Gemini model to gemini-2.5-flash"
git push origin main
