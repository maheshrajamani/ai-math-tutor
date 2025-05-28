// Import configuration and AI service
importScripts('config.js', 'ai-service.js');

// Background service worker for AI Math Tutor
class MathTutorBackground {
  constructor() {
    this.aiService = new AIService();
    this.setupMessageHandlers();
    this.setupActionHandler();
  }

  setupActionHandler() {
    // Set the side panel to open when the extension icon is clicked
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        console.log('Side panel behavior set successfully');
      })
      .catch((error) => {
        console.error('Error setting side panel behavior:', error);
        
        // Fallback: Handle extension icon clicks manually
        chrome.action.onClicked.addListener(async (tab) => {
          console.log('Extension icon clicked (fallback), opening side panel for tab:', tab.id);
          try {
            await this.openSidePanel(tab.id);
          } catch (error) {
            console.error('Error opening side panel from action click:', error);
          }
        });
      });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Background received message:', request.type, 'from:', sender.tab ? 'content script' : 'popup');
      
      // Handle async operations properly
      const handleAsync = async () => {
        try {
          switch (request.type) {
            case 'PROCESS_MATH_PROBLEM':
              // Handle both content script (with tab) and popup (without tab) sources
              const tabId = sender.tab?.id || request.tabId;
              if (tabId) {
                await this.processMathProblem(request.imageData, request.selectedText, tabId);
              } else {
                // For popup uploads, get current active tab
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await this.processMathProblem(request.imageData, request.selectedText, activeTab.id);
              }
              sendResponse({ success: true });
              break;
            case 'OPEN_SIDE_PANEL':
              const sidePanelTabId = sender.tab?.id || request.tabId;
              if (sidePanelTabId) {
                await this.openSidePanel(sidePanelTabId);
              } else {
                // For popup, get current active tab
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await this.openSidePanel(activeTab.id);
              }
              sendResponse({ success: true });
              break;
            case 'EXPLAIN_PROBLEM':
              const result = await this.explainProblem(request.problemData);
              sendResponse(result);
              break;
            case 'SET_API_KEY':
              await this.setApiKey(request.apiKey, request.provider);
              sendResponse({ success: true });
              break;
            case 'CAPTURE_FULL_SCREENSHOT':
              const screenshot = await this.captureFullScreenshot(sender.tab.id);
              sendResponse(screenshot);
              break;
            default:
              sendResponse({ error: 'Unknown message type' });
          }
        } catch (error) {
          console.error('Error handling message:', error);
          sendResponse({ error: error.message });
        }
      };

      // For async operations, we need to return true and call sendResponse later
      if (['PROCESS_MATH_PROBLEM', 'OPEN_SIDE_PANEL', 'EXPLAIN_PROBLEM', 'SET_API_KEY', 'CAPTURE_FULL_SCREENSHOT'].includes(request.type)) {
        handleAsync();
        return true; // Keep message channel open for async response
      }
    });
  }

  async processMathProblem(imageData, selectedText, tabId) {
    try {
      const timestamp = Date.now();
      
      // Store the problem data with initial timestamp
      const initialProblem = {
        imageData: imageData,
        selectedText: selectedText,
        timestamp: timestamp,
        status: 'processing'
      };
      
      await chrome.storage.local.set({
        currentProblem: initialProblem
      });

      // Send to AI for processing
      const solution = await this.sendToAI(imageData, selectedText);
      
      // Store the solution with SAME timestamp
      const solvedProblem = {
        imageData: imageData,
        selectedText: selectedText,
        solution: solution,
        timestamp: timestamp, // Keep the same timestamp!
        status: 'solved'
      };
      
      await chrome.storage.local.set({
        currentProblem: solvedProblem
      });

      // Notify side panel to update
      chrome.runtime.sendMessage({
        type: 'PROBLEM_SOLVED',
        solution: solution
      });

    } catch (error) {
      console.error('Error processing math problem:', error);
      
      // Get the original timestamp if it exists
      const existing = await chrome.storage.local.get(['currentProblem']);
      const timestamp = existing.currentProblem?.timestamp || Date.now();
      
      await chrome.storage.local.set({
        currentProblem: {
          imageData: imageData,
          selectedText: selectedText,
          error: error.message,
          timestamp: timestamp,
          status: 'error'
        }
      });
    }
  }

  async sendToAI(imageData, selectedText) {
    try {
      console.log('Sending to AI:', {
        hasImage: !!imageData,
        imageSize: imageData ? imageData.length : 0,
        selectedText: selectedText
      });
      
      // Use the AI service to solve the problem
      const result = await this.aiService.solveMathProblem(imageData, selectedText);
      console.log('AI service returned:', result);
      return result;
    } catch (error) {
      // Fallback to mock response if AI service fails
      console.error('AI service failed, using fallback:', error);
      console.error('Error details:', error.message, error.stack);
      return this.getFallbackSolution(imageData, selectedText);
    }
  }

  getFallbackSolution(imageData, selectedText) {
    // Fallback solution when AI service is not available
    console.error('CRITICAL: AI API completely failed - this should not happen with correct setup');
    console.error('Fallback received text:', selectedText?.substring(0, 200));
    console.error('This means either:');
    console.error('1. OpenAI API key is invalid/missing');
    console.error('2. OpenAI API is down');
    console.error('3. Network connectivity issue');
    console.error('4. Insufficient API credits');
    
    return {
      type: 'error',
      problem: selectedText || 'Mathematical problem from image',
      solution: '⚠️ AI Service Unavailable',
      steps: [
        '🔑 Check your OpenAI API key in Settings',
        '💳 Verify you have sufficient API credits',
        '🌐 Check your internet connection',
        '🔄 Try refreshing the page and selecting again'
      ],
      explanation: 'The AI service failed to process this problem. This extension requires a valid OpenAI API key with sufficient credits to solve math problems.',
      usedVision: false,
      isError: true
    };
  }

  async setApiKey(apiKey, provider = 'openai') {
    await chrome.storage.local.set({
      aiApiKey: apiKey,
      aiProvider: provider
    });
  }

  async captureFullScreenshot(tabId) {
    try {
      console.log('Capturing full screenshot');
      
      // Capture the full visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });
      
      console.log('Full screenshot captured successfully');
      
      return {
        imageData: dataUrl
      };
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return { imageData: null, error: error.message };
    }
  }

  async openSidePanel(tabId) {
    try {
      // First, ensure the side panel is set for this tab
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: true,
        path: 'sidepanel.html'
      });
      
      // Then open it
      await chrome.sidePanel.open({ tabId: tabId });
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
  }

  async explainProblem(problemData) {
    // This would integrate with video generation service
    // For now, return a placeholder
    return {
      videoUrl: 'placeholder_video.mp4',
      audioUrl: 'placeholder_audio.mp3',
      transcript: 'This is where the step-by-step explanation would be provided...'
    };
  }
}

// Initialize background service
new MathTutorBackground();