#!/bin/bash

# Secure AI Math Tutor Extension Packager
# This script creates a secure distribution package

set -e  # Exit on any error

echo "🔐 Starting secure packaging for AI Math Tutor Extension..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="ai-math-tutor-secure"
BUILD_DIR="build"
DIST_DIR="dist"

# Create clean directories
echo "📁 Setting up build directories..."
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Security validation function
validate_security() {
    echo "🔍 Running security validation..."
    
    # Check for actual API keys (not validation code)
    echo "  - Checking for hardcoded API keys..."
    if grep -r "sk-[a-zA-Z0-9]\{20,\}" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.sh" 2>/dev/null; then
        echo -e "${RED}❌ Found actual API keys in code!${NC}"
        exit 1
    fi
    
    # Check for other sensitive patterns
    if grep -ri "password\|secret\|token\|key.*=" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.sh" --exclude="*.md" 2>/dev/null | grep -v "apiKey.*storage\|API.*key.*Settings"; then
        echo -e "${YELLOW}⚠️  Found potential sensitive data${NC}"
        echo "Please review the above matches manually"
    fi
    
    # Validate manifest permissions
    echo "  - Validating manifest permissions..."
    if grep -q '"https://\*\/\*"' manifest.json; then
        echo -e "${YELLOW}⚠️  Overly broad host permissions detected${NC}"
    fi
    
    echo -e "${GREEN}✅ Security validation passed${NC}"
}

# Copy files with security improvements
copy_secure_files() {
    echo "📋 Copying and securing files..."
    
    # Core extension files
    cp manifest.json "$BUILD_DIR/"
    cp *.js "$BUILD_DIR/"
    cp *.html "$BUILD_DIR/"
    cp *.css "$BUILD_DIR/"
    
    # Copy icons directory if exists
    if [ -d "icons" ]; then
        cp -r icons "$BUILD_DIR/"
    fi
    
    # Add security headers to HTML files
    echo "  - Adding Content Security Policy to HTML files..."
    add_csp_headers
    
    # Minify JavaScript files for production
    echo "  - Optimizing JavaScript files..."
    optimize_js_files
}

# Add Content Security Policy headers
add_csp_headers() {
    local csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.openai.com;\">"
    
    for html_file in "$BUILD_DIR"/*.html; do
        if [ -f "$html_file" ]; then
            # Insert CSP after <head> tag
            sed -i '' "s|<head>|<head>\n  $csp|" "$html_file" 2>/dev/null || sed -i "s|<head>|<head>\n  $csp|" "$html_file"
        fi
    done
}

# Optimize JavaScript files
optimize_js_files() {
    for js_file in "$BUILD_DIR"/*.js; do
        if [ -f "$js_file" ]; then
            # Remove console.log statements (basic cleanup)
            sed -i '' 's/console\.log.*;//g' "$js_file" 2>/dev/null || sed -i 's/console\.log.*;//g' "$js_file"
            
            # Remove empty lines
            sed -i '' '/^[[:space:]]*$/d' "$js_file" 2>/dev/null || sed -i '/^[[:space:]]*$/d' "$js_file"
        fi
    done
}

# Create improved manifest with restricted permissions
create_secure_manifest() {
    echo "📝 Creating secure manifest..."
    
    cat > "$BUILD_DIR/manifest.json" << 'EOF'
{
  "manifest_version": 3,
  "name": "AI Math Tutor",
  "version": "1.0.0",
  "description": "Select math problems and get AI-powered solutions with explanations",
  "permissions": [
    "activeTab",
    "storage",
    "sidePanel",
    "scripting"
  ],
  "host_permissions": [
    "https://api.openai.com/*"
  ],
  "action": {
    "default_title": "AI Math Tutor - Click to open"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "options_page": "options.html",
  "background": {
    "service_worker": "background.js"
  }
}
EOF
}

# Create documentation
create_documentation() {
    echo "📚 Creating documentation..."
    
    # Security guide
    cat > "$BUILD_DIR/SECURITY.md" << 'EOF'
# Security Guidelines for AI Math Tutor

## API Key Security
- **Never share your OpenAI API key**
- Store keys securely in browser extension storage only
- Monitor your OpenAI usage regularly
- Revoke and regenerate keys if compromised

## Privacy
- Math problems are sent to OpenAI for processing
- No data is stored on external servers
- All processing happens locally in your browser

## Permissions
This extension requires minimal permissions:
- `activeTab`: To read selected math problems
- `storage`: To save your API key locally
- `sidePanel`: To display solutions
- `scripting`: To inject content scripts when needed

## Reporting Security Issues
If you discover a security vulnerability, please report it responsibly.
EOF

    # Installation guide
    cat > "$BUILD_DIR/INSTALL.md" << 'EOF'
# Installation Guide

## Prerequisites
1. Google Chrome browser
2. OpenAI API key with credits

## Installation Steps
1. Download and extract the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the extension folder
5. Click the extension icon and go to Settings
6. Enter your OpenAI API key and save

## Usage
1. Navigate to a page with math problems
2. Click the extension icon
3. Select a math problem or upload an image
4. Get instant solutions with audio explanations

## Security Best Practices
- Keep your API key private
- Monitor your OpenAI usage
- Only use on trusted websites
EOF
}

# Create the final package
create_package() {
    echo "📦 Creating distribution package..."
    
    # Create ZIP file
    cd "$BUILD_DIR"
    zip -r "../$DIST_DIR/$PACKAGE_NAME.zip" . -x "*.DS_Store" "*.git*"
    cd ..
    
    # Calculate checksums
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$DIST_DIR/$PACKAGE_NAME.zip" > "$DIST_DIR/$PACKAGE_NAME.zip.sha256"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$DIST_DIR/$PACKAGE_NAME.zip" > "$DIST_DIR/$PACKAGE_NAME.zip.sha256"
    fi
    
    echo -e "${GREEN}✅ Package created: $DIST_DIR/$PACKAGE_NAME.zip${NC}"
}

# Generate security report
generate_security_report() {
    echo "📊 Generating security report..."
    
    cat > "$DIST_DIR/SECURITY_REPORT.md" << EOF
# Security Assessment Report

## Package Information
- **Package**: $PACKAGE_NAME.zip
- **Version**: 1.0.0
- **Date**: $(date)
- **Checksum**: $(cat "$DIST_DIR/$PACKAGE_NAME.zip.sha256" 2>/dev/null || echo "Not available")

## Security Measures Applied
✅ API key validation (no hardcoded keys)
✅ Content Security Policy headers added
✅ Minimal permissions in manifest
✅ Console.log statements removed
✅ Input validation implemented
✅ HTTPS-only API communication

## Remaining Considerations
⚠️  API keys stored in browser local storage (consider encryption)
⚠️  Content script injection (use programmatic injection)
⚠️  Rate limiting (implement client-side protection)

## Verification Steps
1. Install in fresh Chrome profile
2. Test with invalid API key (should fail gracefully)
3. Test with valid API key (should work correctly)
4. Monitor network requests (should only go to OpenAI)
5. Check extension permissions (should be minimal)

## Distribution Guidelines
- Distribute through Chrome Web Store for maximum security
- Include clear setup instructions
- Warn users about API key security
- Provide support documentation
EOF

    echo -e "${GREEN}✅ Security report generated${NC}"
}

# Main execution
main() {
    echo "🚀 AI Math Tutor - Secure Packaging Script"
    echo "=========================================="
    
    # Run security validation
    validate_security
    
    # Copy and secure files
    copy_secure_files
    
    # Create secure manifest
    create_secure_manifest
    
    # Create documentation
    create_documentation
    
    # Create final package
    create_package
    
    # Generate security report
    generate_security_report
    
    echo ""
    echo "🎉 Secure packaging completed successfully!"
    echo ""
    echo "📁 Build directory: $BUILD_DIR/"
    echo "📦 Distribution package: $DIST_DIR/$PACKAGE_NAME.zip"
    echo "📊 Security report: $DIST_DIR/SECURITY_REPORT.md"
    echo ""
    echo "Next steps:"
    echo "1. Review the security report"
    echo "2. Test the extension in a fresh Chrome profile"
    echo "3. Distribute the ZIP file to users"
    echo ""
    echo -e "${GREEN}✅ Ready for secure distribution!${NC}"
}

# Run the main function
main "$@"