#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix mirrored text in face guide overlay for selfie camera"
git push origin main
