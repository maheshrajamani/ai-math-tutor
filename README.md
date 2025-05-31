# 🧮 AI Math Tutor Chrome Extension

An intelligent Chrome extension that helps you solve math problems with AI-powered step-by-step solutions.

## ✨ Features

- **📐 Universal Problem Selection**: Works on any website, document, or application
- **🔍 Smart Detection**: Automatically tries direct selection, falls back to screen capture when needed
- **🤖 AI-Powered Solutions**: Get step-by-step solutions using multiple AI providers (Google Gemini Free + OpenAI)
- **🎯 Smart Model Selection**: Automatically chooses the best AI model based on problem type
- **📋 Multiple Choice Support**: Handles both multiple choice and open-ended questions
- **📄 Document Support**: Works seamlessly with PDFs, Google Docs, Office 365, and more
- **📸 Screen Capture**: Built-in screen capture for restricted content and applications
- **🔊 Audio Explanations**: Text-to-speech narration of solutions (Google TTS + OpenAI TTS)
- **📱 Side Panel Interface**: Clean, persistent panel that stays open while working
- **⚙️ Customizable Settings**: Choose your preferred AI model and behavior
- **🆓 Free Option Available**: Use Google Gemini with generous free tier limits

## 🚀 Quick Setup

### 1. Download and Install the Extension

#### Download from GitHub:
1. Go to the [AI Math Tutor repository](https://github.com/maheshrajamani/ai-math-tutor)
2. Click the green **"Code"** button
3. Select **"Download ZIP"**
4. Extract the ZIP file to a folder on your computer

#### Install in Chrome:
1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the extracted folder containing the extension files
5. The AI Math Tutor extension should now appear in your extensions list

### 2. Choose Your AI Provider

#### Option A: Google Gemini (Free) 🆓
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account  
3. Click "Create API Key" and copy it
4. The free tier includes generous usage limits!

#### Option B: OpenAI (Paid)
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Add credits to your account ($5-10 is plenty for hundreds of problems)

### 3. Configure the Extension
1. Click the extension icon in Chrome
2. Click the ⚙️ Settings button
3. Choose your AI Provider:
   - **Google Gemini**: Select "Google" and enter your API key
   - **OpenAI**: Select "OpenAI" and enter your API key
4. Choose your preferred model (or leave on "Auto")
5. Click "Save Settings" and "Test Connection" to verify

## 📖 How to Use

### Universal Workflow (Works Everywhere!):
1. **Open any content** - website, PDF, Google Doc, Word document, etc.
2. **Click the extension icon** to open the AI Math Tutor panel
3. **Click** **📐 Select Math Problem**
4. The extension will automatically:
   - ✅ **Try direct selection** (click and drag) if possible
   - 📸 **Fall back to screen capture** if direct selection doesn't work
5. **Select the problem area** and get instant AI-powered solutions!

### Supported Content Types:
- **📄 PDFs** - Automatic text extraction + screenshot capture
- **📋 Google Docs/Sheets/Slides** - Screen capture with selection interface  
- **💼 Office 365 Documents** - Screen capture with selection interface
- **🌐 Regular Websites** - Direct selection with click and drag
- **🖥️ Desktop Applications** - Screen capture mode
- **📱 Any Visual Content** - Universal screen capture support

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

## 🛠️ Development

### File Structure

```
ai-tutor/
├── manifest.json          # Extension configuration
├── popup.html/js          # Extension popup interface  
├── sidepanel.html/js      # Solution display panel
├── content.js/css         # Page interaction scripts
├── background.js          # Background service worker
├── settings.html/js       # Configuration page
├── ai-service.js          # AI integration service
├── video-service.js       # Video generation service
├── config.js              # Configuration constants
└── icons/                 # Extension icons
```

### Key Components

- **Content Script**: Handles page selection and screenshot capture
- **Background Script**: Manages AI API calls and data processing  
- **Side Panel**: Displays solutions and explanations
- **AI Service**: Integrates with OpenAI GPT-4 Vision API
- **Video Service**: Generates animated explanation videos

### API Integration

The extension supports multiple AI providers:

- **Google Gemini** (Free) - Free tier with generous limits, excellent vision and reasoning
  - Gemini 2.0 Flash: Latest model with best performance and reasoning ⭐
  - Gemini 1.5 Flash: Fast and efficient for most problems
  - Gemini 1.5 Pro: Advanced reasoning for complex problems  
  - Gemini 1.0 Pro: Text-only for simple problems
  - **Audio**: Free Google Text-to-Speech for explanations 🔊
- **OpenAI GPT-4 Vision** (Paid) - Excellent for math + image processing
  - GPT-4o: Best for complex problems with images
  - GPT-4o Mini: Fast and cost-effective
  - GPT-4 Vision: Good for image analysis
  - GPT-4: Text-only, high quality
  - **Audio**: OpenAI Text-to-Speech for explanations 🔊
- **Claude** (Coming Soon) - Strong reasoning capabilities

### Customization

Edit `config.js` to modify:
- AI model parameters
- Prompt templates
- Video generation settings
- Default preferences

## 📝 Usage Examples

### Algebra Problems
- Linear equations: `2x + 5 = 13`
- Quadratic equations: `x² - 4x + 3 = 0`
- Systems of equations

### Geometry Problems  
- Triangle calculations
- Circle area/circumference
- Angle measurements
- Coordinate geometry

### Calculus Problems
- Derivatives and integrals
- Limit calculations
- Optimization problems

### Word Problems
- Rate and distance
- Percentage calculations
- Statistics and probability

## ⚙️ Configuration

### AI Provider Settings
- **API Key**: Your OpenAI API key
- **Model**: GPT-4 Vision (recommended)
- **Temperature**: 0.1 (for accurate math)

### Video Settings
- **Enable Videos**: Toggle animated explanations
- **Voice Speed**: Adjust narration speed
- **Quality**: Video resolution and framerate

### General Settings
- **Target Level**: Elementary, Middle School, High School, College
- **Show Steps**: Always display step-by-step solutions
- **Auto-Save**: Save solutions automatically

## 🔒 Privacy & Security

- **Local Storage**: All data is stored locally in your browser
- **API Keys**: Encrypted and never shared with third parties
- **No Tracking**: No user analytics or data collection
- **Secure Communication**: All API calls use HTTPS encryption

## 💰 Cost Information

### Google Gemini (Free Tier) 🆓
- **All models**: FREE with generous daily limits
- **Gemini 1.5 Flash**: Up to 15 RPM (requests per minute)
- **Gemini 1.5 Pro**: Up to 2 RPM
- **Perfect for students**: No payment required!
- **Verify current limits**: [Check official pricing](https://ai.google.dev/gemini-api/docs/pricing)

### OpenAI (Paid Usage)
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

## 🛠️ Settings

### AI Provider Options
- **Google Gemini** (Free): Choose from 2.0 Flash, 1.5 Flash, 1.5 Pro, or 1.0 Pro models
- **OpenAI** (Paid): Choose from GPT-4o, GPT-4o Mini, GPT-4 Vision, or GPT-4

### Model Selection
- **Auto** (recommended): Smart model selection based on problem type and content
- **Manual**: Choose specific models for consistent behavior
- **Vision Support**: Automatically uses vision-capable models when images are present

## 🔒 Privacy & Security

- **Your API key stays local**: Never shared or transmitted to anyone except your chosen AI provider
- **No data collection**: We don't store or track your math problems
- **Local processing**: All selection and image processing happens in your browser
- **Secure transmission**: Your problems are only sent to your chosen provider's secure servers (Google AI or OpenAI)
- **Optional authentication**: Use Google sign-in or API keys based on your preference

## ❓ Troubleshooting

**"Check your API key" or authentication errors**
- **For Google Gemini**: Verify your API key from Google AI Studio is entered correctly
- **For OpenAI**: Verify your API key is entered correctly and has sufficient credits
- Test the connection in Settings to verify your setup

**"Rate limit exceeded"**
- **Google Gemini**: Free tier has rate limits (15 RPM for Flash, 2 RPM for Pro)
- **OpenAI**: Check your usage limits and billing settings
- Wait a moment before trying again

**Selection not working**
- The extension automatically falls back to screen capture if direct selection fails
- If screen capture doesn't appear, try refreshing the page and clicking Select Problem again
- Check browser console (F12 → Console) for any error messages

**No solution appears**
- Check that the side panel opened automatically
- Verify your internet connection
- Ensure you completed the selection process (clicked "Solve Selected Area")

## 🤝 Support

If you encounter issues:
1. Check the browser console for error messages (F12 → Console)
2. Verify your OpenAI API key and credits
3. Try refreshing the page and trying again

---

**Note**: This extension requires an OpenAI API key with credits. The extension creator is not responsible for OpenAI usage costs.