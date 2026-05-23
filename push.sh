#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix after-photo flow, add ghost overlay, lock capture until face matches"
git push origin main
