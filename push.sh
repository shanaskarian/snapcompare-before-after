#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Add live face mesh overlay on camera + fix injection point positioning"
git push origin main
