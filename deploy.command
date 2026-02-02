#!/bin/bash

# Go to the directory this script lives in
cd "$(dirname "$0")"

echo "🚀 Starting deploy..."

echo "📦 Building Vite project..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deploy."
  read -p "Press Enter to exit"
  exit 1
fi

echo "📝 Committing changes..."
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"

echo "⬆️ Pushing to GitHub..."
git push origin main
if [ $? -ne 0 ]; then
  echo "❌ Git push failed."
  read -p "Press Enter to exit"
  exit 1
fi

echo "✅ Deploy complete!"
echo "🌍 GitHub Pages will update shortly."

read -p "Press Enter to close"
