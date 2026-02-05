#!/bin/bash
set -e

echo "Initializing Git repository..."
git init

echo "Adding files..."
git add .

echo "Committing..."
# Check if there are changes to commit
if git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "No changes to commit."
else
    git commit -m "Initial commit: Agent Market Data"
fi

echo "Setting branch to main..."
git branch -M main

echo "Configuring remote..."
if git remote | grep -q origin; then
    git remote set-url origin https://github.com/shangxiuyu/eden-agents.git
else
    git remote add origin https://github.com/shangxiuyu/eden-agents.git
fi

echo "Pushing to GitHub..."
git push -u origin main

echo "Done!"
