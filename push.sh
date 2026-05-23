#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix injection points with MediaPipe face detection, add eye/nose/lip outlines"
git push origin main
