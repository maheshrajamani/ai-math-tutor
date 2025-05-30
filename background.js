// Import configuration and AI service
importScripts('config.js', 'ai-service.js');

// Background service worker for AI Math Tutor
class MathTutorBackground {
  constructor() {
    this.aiService = new AIService();
    this.captureInProgress = false; // Prevent concurrent captures
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
            case 'SET_AI_CONFIG':
              await this.setAIConfig(request.provider, request.model, request.apiKey);
              sendResponse({ success: true });
              break;
            case 'SET_API_KEY': // Keep for backward compatibility
              await this.setApiKey(request.apiKey, request.provider);
              sendResponse({ success: true });
              break;
            case 'CAPTURE_FULL_SCREENSHOT':
              // Handle both content script (with sender.tab) and side panel (with request.tabId)
              let screenshotTabId = sender.tab?.id || request.tabId;
              if (!screenshotTabId) {
                // Fallback: get current active tab
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                screenshotTabId = activeTab.id;
              }
              const screenshot = await this.captureFullScreenshot(screenshotTabId);
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
      if (['PROCESS_MATH_PROBLEM', 'OPEN_SIDE_PANEL', 'EXPLAIN_PROBLEM', 'SET_AI_CONFIG', 'SET_API_KEY', 'CAPTURE_FULL_SCREENSHOT'].includes(request.type)) {
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
      return await this.getFallbackSolution(imageData, selectedText);
    }
  }

  async getFallbackSolution(imageData, selectedText) {
    // Fallback solution when AI service is not available
    console.error('CRITICAL: AI API completely failed - this should not happen with correct setup');
    console.error('Fallback received text:', selectedText?.substring(0, 200));
    
    // Get current provider to show appropriate error messages
    const settings = await chrome.storage.local.get(['aiProvider']);
    const provider = settings.aiProvider || 'openai';
    
    console.error('Current provider:', provider);
    console.error('This means either:');
    if (provider === 'google') {
      console.error('1. Google Gemini API key is invalid/missing');
      console.error('2. Google AI Studio API is down');
      console.error('3. Network connectivity issue');
      console.error('4. API quota exceeded');
    } else {
      console.error('1. OpenAI API key is invalid/missing');
      console.error('2. OpenAI API is down');
      console.error('3. Network connectivity issue');
      console.error('4. Insufficient API credits');
    }
    
    // Provider-specific error messages
    let steps, explanation;
    if (provider === 'google') {
      steps = [
        '🔑 Check your Gemini API key in Settings',
        '🌐 Verify your Google AI Studio access',
        '📡 Check your internet connection',
        '🔄 Try refreshing the page and selecting again'
      ];
      explanation = 'The Google Gemini AI service failed to process this problem. Please check your API key and try again.';
    } else {
      steps = [
        '🔑 Check your OpenAI API key in Settings',
        '💳 Verify you have sufficient API credits',
        '🌐 Check your internet connection',
        '🔄 Try refreshing the page and selecting again'
      ];
      explanation = 'The OpenAI service failed to process this problem. This extension requires a valid OpenAI API key with sufficient credits to solve math problems.';
    }
    
    return {
      type: 'error',
      problem: selectedText || 'Mathematical problem from image',
      solution: '⚠️ AI Service Unavailable',
      steps: steps,
      explanation: explanation,
      usedVision: false,
      isError: true
    };
  }

  async setAIConfig(provider, model, apiKey) {
    const config = {
      aiProvider: provider,
      aiModel: model
    };
    
    if (provider === 'openai' && apiKey) {
      config.aiApiKey = apiKey;
    }
    
    await chrome.storage.local.set(config);
  }

  async setApiKey(apiKey, provider = 'openai') {
    await chrome.storage.local.set({
      aiApiKey: apiKey,
      aiProvider: provider
    });
  }

  async captureFullScreenshot(tabId) {
    // Prevent concurrent screenshot captures
    if (this.captureInProgress) {
      console.log('Screenshot capture already in progress, waiting...');
      // Wait for current capture to complete
      while (this.captureInProgress) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // If still in progress after 5 seconds, proceed anyway
      let waitTime = 0;
      while (this.captureInProgress && waitTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
    }
    
    this.captureInProgress = true;
    
    try {
      console.log('Capturing full screenshot for tab:', tabId);
      
      // Get tab info to check if it's accessible
      const tab = await chrome.tabs.get(tabId);
      console.log('Tab URL:', tab.url, 'Status:', tab.status);
      
      // Check if this is a restricted URL
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        throw new Error('Cannot capture screenshots of browser internal pages');
      }
      
      // Get the current window to ensure proper sizing
      const window = await chrome.windows.get(tab.windowId);
      console.log('Current window size:', window.width, 'x', window.height);
      
      // First ensure the tab is active and focused
      await chrome.tabs.update(tabId, { active: true });
      
      // Ensure the window is focused and maximized for consistent capture
      await chrome.windows.update(tab.windowId, { 
        focused: true,
        state: 'normal' // Ensure it's not minimized
      });
      
      // Wait for tab to be fully loaded and stable
      if (tab.status !== 'complete') {
        console.log('Waiting for tab to complete loading...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Additional wait to ensure page is fully rendered and stable
      console.log('Waiting for page to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Re-check tab status to ensure it's still ready
      const updatedTab = await chrome.tabs.get(tabId);
      console.log('Updated tab status:', updatedTab.status);
      
      // Force a page refresh of layout to ensure everything is rendered
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Force a reflow to ensure everything is rendered
            document.body.offsetHeight;
            // Log current scroll position to verify it's preserved
            console.log('Taking screenshot at scroll position:', { x: window.scrollX, y: window.scrollY });
            // Note: Removed scroll to top to preserve user's current scroll position
          }
        });
        console.log('Page layout refreshed');
      } catch (scriptError) {
        console.log('Could not refresh page layout (might be restricted page):', scriptError.message);
      }
      
      // Get viewport dimensions for validation
      let viewportDimensions = null;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            return {
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio || 1,
              scrollX: window.scrollX,
              scrollY: window.scrollY
            };
          }
        });
        viewportDimensions = results[0].result;
        console.log('Viewport dimensions:', viewportDimensions);
      } catch (scriptError) {
        console.log('Could not get viewport dimensions:', scriptError.message);
      }
      
      // Try to capture the visible tab with retry logic
      console.log('Attempting to capture visible tab...');
      let retryCount = 0;
      const maxRetries = 5; // Increased retries
      let dataUrl;
      
      while (retryCount < maxRetries) {
        try {
          // Add a small delay before each capture attempt
          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          dataUrl = await chrome.tabs.captureVisibleTab(updatedTab.windowId, {
            format: 'png',
            quality: 100
          });
          
          // Basic validation - just check if we got data
          if (dataUrl && dataUrl.length > 5000) {
            console.log('Screenshot captured successfully on attempt', retryCount + 1, 'Data size:', dataUrl.length);
            break;
          } else {
            throw new Error('Captured image appears to be invalid or too small');
          }
        } catch (captureError) {
          retryCount++;
          console.log(`Capture attempt ${retryCount} failed:`, captureError.message);
          
          if (retryCount < maxRetries) {
            console.log(`Retrying in 400ms... (${retryCount}/${maxRetries})`);
            // Longer delay between retries
            await new Promise(resolve => setTimeout(resolve, 400));
          } else {
            throw captureError;
          }
        }
      }
      
      console.log('Full screenshot captured successfully, size:', dataUrl.length);
      
      return {
        imageData: dataUrl,
        success: true
      };
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      return { 
        imageData: null, 
        error: error.message,
        success: false 
      };
    } finally {
      // Always clear the capture flag
      this.captureInProgress = false;
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