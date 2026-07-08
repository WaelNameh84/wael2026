#!/bin/bash
set -e

echo "======================================="
echo "  رفع تعديلات AttendX إلى GitHub"
echo "  https://github.com/WaelNameh84/wael2026"
echo "======================================="

cd /home/runner/workspace

git config user.email "wael@attendx.com"
git config user.name "Wael"

git add -A

git commit -m "${1:-Update}"

git branch -M main

GIT_TERMINAL_PROMPT=0 git push origin main --force

echo ""
echo "✅ تم الرفع بنجاح إلى:"
echo "   https://github.com/WaelNameh84/wael2026"
