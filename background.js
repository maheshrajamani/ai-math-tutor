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
            case 'SET_API_KEY':
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
            // Scroll to top to ensure consistent capture
            window.scrollTo(0, 0);
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
          
          // Enhanced validation
          if (dataUrl && dataUrl.length > 5000) { // Increased minimum size
            // Quick image dimension check by creating an image
            const validImage = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                console.log('Captured image dimensions:', img.width, 'x', img.height);
                
                // Validate dimensions are reasonable
                if (viewportDimensions) {
                  const expectedWidth = viewportDimensions.viewportWidth * viewportDimensions.devicePixelRatio;
                  const expectedHeight = viewportDimensions.viewportHeight * viewportDimensions.devicePixelRatio;
                  const widthRatio = img.width / expectedWidth;
                  const heightRatio = img.height / expectedHeight;
                  
                  console.log('Expected dimensions:', expectedWidth, 'x', expectedHeight);
                  console.log('Size ratios:', { width: widthRatio, height: heightRatio });
                  
                  // Allow some tolerance but ensure we got a reasonable capture
                  if (widthRatio > 0.8 && heightRatio > 0.8 && widthRatio < 1.2 && heightRatio < 1.2) {
                    resolve(true);
                  } else {
                    console.log('Image dimensions don\'t match expected viewport size');
                    resolve(false);
                  }
                } else {
                  // If we can't check dimensions, just ensure it's a reasonable size
                  resolve(img.width > 300 && img.height > 300);
                }
              };
              img.onerror = () => resolve(false);
              img.src = dataUrl;
            });
            
            if (validImage) {
              console.log('Screenshot captured and validated successfully on attempt', retryCount + 1);
              break;
            } else {
              throw new Error('Captured image dimensions don\'t match expected viewport');
            }
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