# 🧮 AI Math Tutor Chrome Extension

An intelligent Chrome extension that helps you solve math problems with AI-powered step-by-step solutions. Works universally with Google Docs, PDFs, websites, and any visual content.

## 🚀 Quick Installation

### 1. Download & Extract
- Download `ai-math-tutor-v0.1.0.zip`
- Extract to a folder on your computer

### 2. Install in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked" and select the extracted folder
4. The extension icon should appear in your toolbar

### 3. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Add credits to your account ($5-10 is plenty for hundreds of problems)

### 4. Configure Extension
1. Click the extension icon in Chrome
2. Click the ⚙️ Settings button
3. Enter your OpenAI API key
4. Click "Save API Key"
5. Test the connection to verify it works

## 📖 How to Use

### Universal Workflow (Works Everywhere!):
1. **Open any content** - website, PDF, Google Doc, Word document, etc.
2. **Click the extension icon** to open the AI Math Tutor panel
3. **Click** **📐 Select Math Problem**
4. **The extension automatically**:
   - ✅ **Tries direct selection** (click and drag) if possible
   - 📸 **Falls back to screen capture** if direct selection doesn't work
5. **Select the problem area** and get instant AI-powered solutions!

### Supported Content Types:
- **📄 PDFs** - Automatic text extraction + screenshot capture
- **📋 Google Docs/Sheets/Slides** - Screen capture with selection interface  
- **💼 Office 365 Documents** - Screen capture with selection interface
- **🌐 Regular Websites** - Direct selection with click and drag
- **🖥️ Desktop Applications** - Screen capture mode
- **📱 Any Visual Content** - Universal screen capture support

## ✨ Features

- **📐 Universal Problem Selection**: Works on any website, document, or application
- **🔍 Smart Detection**: Automatically tries direct selection, falls back to screen capture when needed
- **🤖 AI-Powered Solutions**: Get step-by-step solutions using OpenAI's GPT models
- **🎯 Smart Model Selection**: Automatically chooses the best AI model based on problem type
- **📋 Multiple Choice Support**: Handles both multiple choice and open-ended questions
- **📄 Document Support**: Works seamlessly with PDFs, Google Docs, Office 365, and more
- **📸 Screen Capture**: Built-in screen capture for restricted content and applications
- **⚙️ Customizable Settings**: Choose your preferred AI model and behavior

## 🎯 Key Advantages

### ✅ **Works Everywhere**
No more guessing which mode to use - the extension automatically handles any content type.

### ✅ **One-Click Operation** 
Simply click **📐 Select Math Problem** and the extension does the rest.

### ✅ **Intelligent Fallback**
- Tries direct selection first (faster, more accurate)
- Automatically falls back to screen capture when needed
- No manual mode switching required

### ✅ **Zero Configuration**
Works out of the box with Google Docs, PDFs, Office documents, and regular websites.

## 🔒 Security & Privacy

- **Your API key stays local**: Never shared with anyone except OpenAI
- **No data collection**: We don't store or track your math problems
- **Local processing**: All selection and image processing happens in your browser
- **OpenAI only**: Your problems are only sent to OpenAI's secure servers

## 💰 Cost Information

**Problem Solving (approximate costs based on tokens used):**
- **GPT-4o-mini**: ~$0.0001 per problem (very affordable)
- **GPT-4o**: ~$0.001 per problem (for complex diagrams)
- **GPT-4 Vision**: ~$0.001 per problem (image analysis)

**Audio Explanation (optional):**
- **OpenAI TTS**: ~$0.0075 per explanation (~500 characters average)

**Total per problem:**
- **Text-only**: $0.0001 (GPT-4o-mini)
- **With images**: $0.001 (GPT-4o) 
- **With audio**: +$0.0075 (TTS narration)

**$5 credit**: Handles 6,000+ problems with audio or 50,000+ text-only problems

*Note: Costs are approximate and vary based on problem complexity and token usage*

## ❓ Troubleshooting

**"Check your OpenAI API key"**
- Verify your API key is entered correctly in Settings
- Check that your OpenAI account has sufficient credits
- Test the connection in Settings

**Selection not working**
- The extension automatically falls back to screen capture if direct selection fails
- If screen capture doesn't appear, try refreshing the page and clicking Select Problem again
- Check browser console (F12 → Console) for any error messages

**No solution appears**
- Check that the side panel opened automatically
- Verify your internet connection
- Ensure you completed the selection process (clicked "Solve Selected Area")

## 🛡️ Package Information

**Version**: 0.1.0  
**Package**: ai-math-tutor-v0.1.0.zip  
**Release Date**: May 29, 2025  
**Compatibility**: Chrome (Manifest V3), Edge, Brave, and other Chromium browsers

## 🔐 Security Checksum

**Package Checksum**: `6133fbe0bd1e1e55f4f7e6227be5afd0ad4c5a06e2a1853cae34c8cb899e6f41`

Verify the integrity of your download by checking this SHA-256 hash.

## 📞 Support

If you encounter issues:
1. Check the browser console for error messages (F12 → Console)
2. Verify your OpenAI API key and credits
3. Try refreshing the page and trying again
4. See INSTALL.md for detailed setup instructions
5. Check RELEASE-NOTES-v0.1.0.md for technical details

## 📁 Package Contents

- **ai-math-tutor-v0.1.0/** - Complete extension folder (load this in Chrome)
- **ai-math-tutor-v0.1.0.zip** - Compressed version for easy sharing
- **INSTALL.md** - Detailed installation guide
- **RELEASE-NOTES-v0.1.0.md** - Technical improvements and features
- **README.md** - This file

---

**AI Math Tutor v0.1.0** - Your universal math problem solving companion! 🧮✨

**Note**: This extension requires an OpenAI API key with credits. The extension creator is not responsible for OpenAI usage costs.