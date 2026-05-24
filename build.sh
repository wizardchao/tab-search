#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
ZIP_NAME="tab-search.zip"

echo "Building Tab Search extension..."

# Clean dist
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy extension files
cp "$SCRIPT_DIR/manifest.json" "$DIST_DIR/"
cp "$SCRIPT_DIR/popup.html" "$DIST_DIR/"
cp "$SCRIPT_DIR/popup.css" "$DIST_DIR/"
cp "$SCRIPT_DIR/popup.js" "$DIST_DIR/"
cp "$SCRIPT_DIR/background.js" "$DIST_DIR/"
cp "$SCRIPT_DIR/content.js" "$DIST_DIR/"
cp "$SCRIPT_DIR/options.html" "$DIST_DIR/"
cp "$SCRIPT_DIR/options.js" "$DIST_DIR/"
cp -r "$SCRIPT_DIR/icons" "$DIST_DIR/"

# Create zip
cd "$DIST_DIR"
zip -r "$SCRIPT_DIR/$ZIP_NAME" . -x ".*"

echo ""
echo "Done!"
echo "  Unpacked extension: $DIST_DIR/"
echo "  Packed zip:         $SCRIPT_DIR/$ZIP_NAME"
echo ""
echo "To install:"
echo "  1. Open chrome://extensions"
echo "  2. Enable Developer Mode"
echo "  3. Click 'Load unpacked' and select: $DIST_DIR/"
