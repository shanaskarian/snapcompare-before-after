#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Restyle face tracker, increase before-photo overlay to 25%"
git push origin main
