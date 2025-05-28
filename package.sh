#!/bin/bash

# AI Math Tutor Extension - Packaging Script
# This script creates a safe distribution package without API keys

echo "🧮 AI Math Tutor - Creating Distribution Package"
echo "================================================"

# Create distribution directory
DIST_DIR="ai-math-tutor-extension"
rm -rf "$DIST_DIR"
mkdir "$DIST_DIR"

echo "📁 Creating clean package directory..."

# Copy essential files (excluding sensitive data)
cp manifest.json "$DIST_DIR/"
cp *.html "$DIST_DIR/"
cp *.js "$DIST_DIR/"
cp *.css "$DIST_DIR/"
cp README.md "$DIST_DIR/"

# Copy icons directory if it exists
if [ -d "icons" ]; then
    cp -r icons "$DIST_DIR/"
fi

echo "🔍 Checking for API keys in files..."

# Check for actual API keys (not just format references)
if grep -r "sk-[A-Za-z0-9]\{48\}" "$DIST_DIR/" 2>/dev/null; then
    echo "⚠️  WARNING: Actual API key found in files!"
    echo "Please review and remove before sharing."
    exit 1
fi

# Check for any hardcoded keys longer than 20 characters that might be real
if grep -rE "sk-[A-Za-z0-9]{20,}" "$DIST_DIR/" 2>/dev/null; then
    echo "⚠️  WARNING: Potential real API key found!"
    echo "Please review and remove before sharing."
    exit 1
fi

echo "✅ No API keys found in package"

# Create a zip file
ZIP_NAME="ai-math-tutor-extension.zip"
rm -f "$ZIP_NAME"

echo "📦 Creating zip package..."
cd "$DIST_DIR"
zip -r "../$ZIP_NAME" . > /dev/null
cd ..

echo "🎉 Package created successfully!"
echo ""
echo "📋 Package Contents:"
echo "  📁 Directory: $DIST_DIR/"
echo "  📦 Zip file: $ZIP_NAME"
echo ""
echo "🔒 Security Check: ✅ No API keys included"
echo ""
echo "📤 Ready to share with friends!"
echo ""
echo "🔗 Share these files:"
echo "  1. Send the ZIP file: $ZIP_NAME"
echo "  2. Include setup instructions from README.md"
echo "  3. Remind them to get their own OpenAI API key"
echo ""
echo "⚠️  Important: Each user needs their own OpenAI API key!"