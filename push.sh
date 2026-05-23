#!/bin/bash
cd "$(dirname "$0")"
git add -A
git commit -m "Full UI redesign: match landing page identity + fix camera"
git push origin main
