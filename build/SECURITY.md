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
