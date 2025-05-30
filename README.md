# 🧮 AI Math Tutor Chrome Extension

An intelligent Chrome extension that helps you solve math problems with AI-powered step-by-step solutions.

## ✨ Features

- **📐 Select Math Problems**: Click and drag to select any math problem from web pages
- **📷 Upload Screenshots**: Upload images of math problems from textbooks, PDFs, or screenshots  
- **🤖 AI-Powered Solutions**: Get step-by-step solutions using OpenAI's GPT models
- **🎯 Smart Model Selection**: Automatically chooses the best AI model based on problem type
- **📋 Multiple Choice Support**: Handles both multiple choice and open-ended questions
- **📄 PDF Support**: Native PDF selection with smart text extraction and screenshot capture
- **⚙️ Customizable Settings**: Choose your preferred AI model and behavior

## 🚀 Quick Setup

### 1. Install the Extension
1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the extension folder

### 2. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Add credits to your account ($5-10 is plenty for hundreds of problems)

### 3. Configure the Extension
1. Click the extension icon in Chrome
2. Click the ⚙️ Settings button
3. Enter your OpenAI API key
4. Click "Save API Key"
5. Test the connection to verify it works

## 📖 How to Use

### For Web Pages:
1. Click the extension icon to open the AI Math Tutor panel
2. Click **📐 Select Math Problem**
3. Click and drag to select the math problem on the page
4. Get instant AI-powered solutions!

### For PDFs:
1. Open any PDF file in Chrome
2. Click the extension icon to open the AI Math Tutor panel
3. Click **📐 Select Math Problem** 
4. Click and drag to select the problem area in the PDF
5. The extension will extract text and capture a screenshot automatically
6. Get step-by-step solutions optimized for PDF content!

### For Images and Screenshots:
1. Open the AI Math Tutor panel
2. Click **📷 Upload Screenshot**
3. Upload an image of the math problem
4. Get step-by-step solutions with explanations!

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

- **OpenAI GPT-4 Vision** (Recommended) - Excellent for math + image processing
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
- **Auto mode**: Smartly chooses the most cost-effective model

## 🛠️ Settings

- **Auto** (recommended): Smart model selection based on problem type
- **GPT-4o-mini**: Fast and very cost-effective for most math problems
- **GPT-4o**: Best for problems with complex diagrams and images
- **GPT-4 Vision**: Alternative vision model for image-based problems
- **GPT-4**: Standard text-only model

## 🔒 Privacy & Security

- **Your API key stays local**: Never shared or transmitted to anyone except OpenAI
- **No data collection**: We don't store or track your math problems
- **Local processing**: All selection and image processing happens in your browser
- **OpenAI only**: Your problems are only sent to OpenAI's secure servers

## ❓ Troubleshooting

**"Check your OpenAI API key"**
- Verify your API key is entered correctly in Settings
- Check that your OpenAI account has sufficient credits
- Test the connection in Settings

**Selection not working**
- Try refreshing the page and selecting again
- For PDFs, use the Upload Screenshot feature instead
- Ensure you're selecting text-based content

**No solution appears**
- Check that the side panel opened automatically
- Verify your internet connection
- Try uploading a screenshot if selection fails

## 🤝 Support

If you encounter issues:
1. Check the browser console for error messages (F12 → Console)
2. Verify your OpenAI API key and credits
3. Try refreshing the page and trying again

---

**Note**: This extension requires an OpenAI API key with credits. The extension creator is not responsible for OpenAI usage costs.