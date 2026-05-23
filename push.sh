#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Add AI Face Analysis with botox/filler mapping"
git push origin main
