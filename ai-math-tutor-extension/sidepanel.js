// Side panel JavaScript for AI Math Tutor
class MathTutorSidePanel {
  constructor() {
    this.currentProblem = null;
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.setupStorageListener();
    this.setupMainButtons();
    this.setupRefreshButton();
    this.setupActionButtons();
    this.loadCurrentProblem();
    
    // Poll for updates every 2 seconds to catch changes
    setInterval(() => {
      this.loadCurrentProblem();
    }, 2000);
  }

  setupMainButtons() {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Select Problem button
    const selectProblemBtn = document.getElementById('selectProblemBtn');
    if (selectProblemBtn) {
      selectProblemBtn.addEventListener('click', async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          
          // Check for PDF files first
          const isPDF = tab.url.endsWith('.pdf') || 
                       tab.url.includes('.pdf') || 
                       tab.title.includes('.pdf') ||
                       (tab.url.startsWith('chrome-extension://') && tab.url.includes('.pdf'));
          
          // Check if this is Chrome's built-in PDF viewer
          const isChromeBuiltinPDF = tab.url.startsWith('chrome-extension://') && 
                                    (tab.url.includes('mhjfbmdgcfjbbpaeojofohoefgiehjai') || 
                                     tab.url.includes('.pdf'));
          
          if (isChromeBuiltinPDF) {
            alert('📄 PDF detected! PDFs cannot be selected directly in Chrome.\n\nPlease:\n1. Take a snapshot (Cmd+Shift+4 on Mac, Ctrl+Shift+S on Windows)\n2. Use "📷 Upload Screenshot" button instead');
            return;
          } else if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            alert('Cannot select problems on this page. Try a regular webpage.');
            return;
          } else if (tab.url.startsWith('chrome-extension://')) {
            alert('Cannot select problems on extension pages. Try a regular webpage.');
            return;
          }
          
          // Inject content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } catch (injectionError) {
            if (isPDF) {
              alert('📄 PDF detected! Take a snapshot and use "📷 Upload Screenshot" button instead.');
              return;
            } else {
              alert('Script injection failed. Try refreshing the page.');
              return;
            }
          }
          
          // Enable selection mode
          await chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_SELECTION' });
          this.showStatus('Selection mode enabled! Click and drag to select a math problem.', 'success');
          
        } catch (error) {
          console.error('Error enabling selection:', error);
          this.showStatus('Error enabling selection mode. Try refreshing the page.', 'error');
        }
      });
    }

    // Upload Image button
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageInput = document.getElementById('imageInput');
    
    if (uploadImageBtn && imageInput) {
      uploadImageBtn.addEventListener('click', () => {
        imageInput.click();
      });

      imageInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          this.showStatus('Please select an image file.', 'error');
          return;
        }

        try {
          this.showStatus('Processing image...', 'info');
          
          const reader = new FileReader();
          reader.onload = async (e) => {
            const imageData = e.target.result;
            
            try {
              // Send to background script for processing
              await chrome.runtime.sendMessage({
                type: 'PROCESS_MATH_PROBLEM',
                imageData: imageData,
                selectedText: `Math problem from uploaded image: ${file.name}`
              });
              
              this.showStatus('Image uploaded! Processing...', 'success');
              
            } catch (error) {
              console.error('Error processing uploaded image:', error);
              this.showStatus('Error processing image. Please try again.', 'error');
            }
          };
          
          reader.onerror = () => {
            this.showStatus('Error reading image file.', 'error');
          };
          
          reader.readAsDataURL(file);
          
        } catch (error) {
          console.error('Error handling image upload:', error);
          this.showStatus('Error uploading image.', 'error');
        }
      });
    }
  }

  setupRefreshButton() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('Manual refresh clicked');
        this.forceReloadProblem();
      });
    }

    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
      debugBtn.addEventListener('click', async () => {
        console.log('Debug button clicked');
        const result = await chrome.storage.local.get(['currentProblem']);
        console.log('RAW Storage contents:', result);
        console.log('Current problem in memory:', this.currentProblem);
        
        // Show image in a new window for debugging
        if (result.currentProblem?.imageData) {
          const imageWindow = window.open();
          imageWindow.document.write(`
            <h3>Captured Image Debug</h3>
            <p>Selected Text: ${result.currentProblem.selectedText}</p>
            <img src="${result.currentProblem.imageData}" style="border: 2px solid red; max-width: 100%;">
          `);
        }
        
        alert(`Storage Debug:
Storage selectedText: "${result.currentProblem?.selectedText || 'none'}"
Storage status: "${result.currentProblem?.status || 'none'}"
Storage timestamp: ${result.currentProblem?.timestamp || 'none'}
Has Image: ${!!result.currentProblem?.imageData}

Memory selectedText: "${this.currentProblem?.selectedText || 'none'}"
Memory status: "${this.currentProblem?.status || 'none'}"
Memory timestamp: ${this.currentProblem?.timestamp || 'none'}`);
      });
    }

    const testSelectionBtn = document.getElementById('testSelectionBtn');
    if (testSelectionBtn) {
      testSelectionBtn.addEventListener('click', async () => {
        // Send message to content script to enable test mode
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_TEST_MODE' });
        alert('Test mode enabled! Click anywhere on the page to see what text would be extracted at that point.');
      });
    }

    const fixSelectionBtn = document.getElementById('fixSelectionBtn');
    if (fixSelectionBtn) {
      fixSelectionBtn.addEventListener('click', async () => {
        // Send message to content script to switch to visual box mode
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'USE_VISUAL_COORDS' });
        alert('Selection coordinate fix enabled! The next selection will use the visual selection box coordinates instead of calculated coordinates.');
      });
    }
  }

  setupActionButtons() {
    // Use event delegation for dynamically generated buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action]')) {
        const action = e.target.getAttribute('data-action');
        console.log('Action button clicked:', action);
        
        switch (action) {
          case 'explain':
            this.explainProblem();
            break;
          case 'copy':
            this.copyToClipboard();
            break;
          case 'new-problem':
            this.newProblem();
            break;
          case 'retry':
            this.retryProblem();
            break;
          case 'start-walkthrough':
            this.startWalkthrough();
            break;
          case 'reset-walkthrough':
            this.resetWalkthrough();
            break;
          default:
            console.warn('Unknown action:', action);
        }
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'PROBLEM_SOLVED') {
        console.log('Received PROBLEM_SOLVED message:', request.solution);
        // Force reload from storage instead of just updating
        this.forceReloadProblem();
      }
    });
  }

  setupStorageListener() {
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.currentProblem) {
        console.log('Storage changed, reloading problem');
        this.loadCurrentProblem();
      }
    });
  }

  async loadCurrentProblem() {
    try {
      const result = await chrome.storage.local.get(['currentProblem']);
      if (result.currentProblem) {
        // Check if this is a new problem (different timestamp or content)
        const isNewProblem = !this.currentProblem || 
                           this.currentProblem.timestamp !== result.currentProblem.timestamp ||
                           this.currentProblem.selectedText !== result.currentProblem.selectedText;
        
        if (isNewProblem) {
          console.log('New problem detected:', {
            oldTimestamp: this.currentProblem?.timestamp,
            newTimestamp: result.currentProblem.timestamp,
            oldText: this.currentProblem?.selectedText,
            newText: result.currentProblem.selectedText
          });
          this.currentProblem = result.currentProblem;
          this.displayProblem();
          
          // Show notification for new problem
          this.showNewProblemIndicator();
        } else if (this.currentProblem.status !== result.currentProblem.status) {
          // Status changed (processing -> solved)
          console.log('Problem status changed:', this.currentProblem.status, '->', result.currentProblem.status);
          this.currentProblem = result.currentProblem;
          this.displayProblem();
        }
      }
    } catch (error) {
      console.error('Error loading current problem:', error);
    }
  }

  async forceReloadProblem() {
    try {
      console.log('Force reloading problem from storage');
      const result = await chrome.storage.local.get(['currentProblem']);
      if (result.currentProblem) {
        console.log('Loaded problem from storage:', result.currentProblem);
        this.currentProblem = result.currentProblem;
        this.displayProblem();
      }
    } catch (error) {
      console.error('Error force reloading problem:', error);
    }
  }

  displayProblem() {
    if (!this.currentProblem) {
      console.log('No current problem to display');
      return;
    }

    console.log('Displaying problem:', {
      status: this.currentProblem.status,
      selectedText: this.currentProblem.selectedText,
      timestamp: this.currentProblem.timestamp,
      hasSolution: !!this.currentProblem.solution
    });

    const content = document.getElementById('content');
    
    if (this.currentProblem.status === 'processing') {
      content.innerHTML = this.getLoadingHTML();
    } else if (this.currentProblem.status === 'solved') {
      content.innerHTML = this.getProblemSolutionHTML();
    } else if (this.currentProblem.status === 'error') {
      content.innerHTML = this.getErrorHTML();
    }
  }

  getLoadingHTML() {
    return `
      <div class="loading">
        <div class="spinner"></div>
        <h3>🤔 Analyzing your math problem...</h3>
        <p>I'm using AI to understand and solve the problem. This may take a few moments.</p>
      </div>
    `;
  }

  getProblemSolutionHTML() {
    const problem = this.currentProblem;
    return `
      <div class="problem-container">
        <h3>📝 Problem</h3>
        ${problem.imageData ? `<img src="${problem.imageData}" alt="Math Problem" class="problem-image">` : ''}
        ${problem.selectedText ? `<div class="problem-text">${problem.selectedText}</div>` : ''}
      </div>
      
      <div class="solution-container">
        <div class="solution-header">
          <h3>✅ AI Analysis</h3>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span style="color: #34a853; font-size: 12px;">● Completed</span>
            <span style="color: #666; font-size: 11px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
              ${problem.solution.modelUsed === 'GPT-4o' ? '🚀 GPT-4o' :
                (problem.solution.modelUsed === 'GPT-4V Vision' ? '👁️ GPT-4V Vision' : 
                 (problem.solution.modelUsed === 'GPT-4o-mini' ? '⚡ GPT-4o-mini' : 
                  problem.solution.modelUsed === 'GPT-4' ? '📝 GPT-4' : '📝 Text Model'))}
            </span>
          </div>
        </div>
        
        <div class="steps-container">
          <h4>📋 Step-by-step analysis:</h4>
          ${problem.solution.steps.map((step, index) => {
            // Remove existing numbering from step text if present
            const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
            return `
              <div class="step">
                <span class="step-number">${index + 1}</span>
                ${cleanStep}
              </div>
            `;
          }).join('')}
          <div style="margin-top: 15px; padding: 10px; background: #e8f0fe; border-radius: 6px; font-size: 13px; color: #1565c0;">
            💡 <strong>Note:</strong> Follow the steps above to find your final answer. Always double-check your calculations and verify the answer matches the available options.
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <button class="btn btn-primary" data-action="explain">
            🎥 Watch Explanation Video
          </button>
          <button class="btn btn-secondary" data-action="copy">
            📋 Copy Solution
          </button>
          <button class="btn btn-secondary" data-action="new-problem">
            🔄 New Problem
          </button>
        </div>
      </div>
    `;
  }

  getErrorHTML() {
    return `
      <div class="problem-container" style="border-left: 4px solid #ea4335;">
        <h3 style="color: #ea4335;">❌ Error</h3>
        <p>I encountered an error while solving this problem:</p>
        <div class="problem-text" style="background: #fce8e6; border-left-color: #ea4335;">
          ${this.currentProblem.error}
        </div>
        <button class="btn btn-primary" data-action="retry">
          🔄 Try Again
        </button>
        <button class="btn btn-secondary" data-action="new-problem">
          📐 Select New Problem
        </button>
      </div>
    `;
  }

  displaySolution(solution) {
    // Update current problem with solution
    this.currentProblem.solution = solution;
    this.currentProblem.status = 'solved';
    this.displayProblem();
    
    // Update document title
    document.title = '✅ AI Math Tutor - Solved!';
  }

  async explainProblem() {
    if (!this.currentProblem) return;

    // Show explanation loading state
    const content = document.getElementById('content');
    const explanationHTML = `
      <div class="explanation-container">
        <h3>🎥 Generating explanation video...</h3>
        <div class="loading">
          <div class="spinner"></div>
          <p>Creating an animated explanation with audio. This may take a minute...</p>
        </div>
      </div>
    `;
    
    content.innerHTML = this.getProblemSolutionHTML() + explanationHTML;

    try {
      // Create an animated step-by-step walkthrough instead of video
      const explanationVideo = `
        <div class="explanation-container">
          <h3>🎬 Animated Step-by-step Walkthrough</h3>
          <div class="walkthrough-container" id="walkthroughContainer">
            <div class="walkthrough-controls" style="margin-bottom: 15px; text-align: center;">
              <button data-action="start-walkthrough" class="btn btn-primary" style="margin-right: 10px;">
                ▶️ Start Walkthrough
              </button>
              <button data-action="reset-walkthrough" class="btn btn-secondary">
                🔄 Reset
              </button>
            </div>
            <div class="walkthrough-content" id="walkthroughContent" style="min-height: 200px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4285f4;">
              <p style="text-align: center; color: #666;">Click "Start Walkthrough" to see each step animated</p>
            </div>
          </div>
          
          <div style="margin-top: 20px;"><strong>📋 Complete Solution:</strong></div>
          <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #34a853;">
            ${this.currentProblem.solution.steps.map((step, index) => {
              const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
              return `<p><strong>Step ${index + 1}:</strong> ${cleanStep}</p>`;
            }).join('')}
            <p style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #dadce0;"><strong>Key Concept:</strong> ${this.currentProblem.solution.explanation}</p>
          </div>
        </div>
      `;
      
      content.innerHTML = this.getProblemSolutionHTML() + explanationVideo;
      
    } catch (error) {
      console.error('Error generating explanation:', error);
      const errorHTML = `
        <div class="explanation-container" style="background: #fce8e6; border-color: #ea4335;">
          <h3 style="color: #ea4335;">❌ Error generating explanation</h3>
          <p>Sorry, I couldn't generate the explanation video. Please try again.</p>
        </div>
      `;
      content.innerHTML = this.getProblemSolutionHTML() + errorHTML;
    }
  }

  async copyToClipboard() {
    if (!this.currentProblem || !this.currentProblem.solution) return;

    const solution = this.currentProblem.solution;
    const text = `Problem: ${this.currentProblem.selectedText || 'Math problem from image'}

Solution: ${solution.solution}

Steps:
${solution.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Explanation: ${solution.explanation}`;

    try {
      await navigator.clipboard.writeText(text);
      
      // Show success feedback
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = '✅ Copied!';
      button.style.background = '#34a853';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
      }, 2000);
      
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }

  async newProblem() {
    try {
      // Clear current problem
      await chrome.storage.local.remove(['currentProblem']);
      this.currentProblem = null;
      
      // Show activating state
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📐</div>
          <h2>Activating selection mode...</h2>
          <p>Click and drag on the page to select a new math problem.</p>
        </div>
      `;
      
      // Get current active tab and enable selection mode
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can access the tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h2>Cannot select on this page</h2>
            <p>Navigate to a regular webpage and try again.</p>
          </div>
        `;
        return;
      }
      
      // Inject content script and enable selection
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_SELECTION' });
      
      // Update to ready state
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📐</div>
          <h2>Selection mode active!</h2>
          <p>Click and drag on the page to select a new math problem.</p>
        </div>
      `;
      
    } catch (error) {
      console.error('Error activating new problem selection:', error);
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <h2>Error activating selection</h2>
          <p>Please try refreshing the page and clicking the extension icon to select a new problem.</p>
        </div>
      `;
    }
  }

  async retryProblem() {
    if (!this.currentProblem) return;
    
    // Reset status and retry
    this.currentProblem.status = 'processing';
    this.displayProblem();
    
    // Send retry message to background
    chrome.runtime.sendMessage({
      type: 'PROCESS_MATH_PROBLEM',
      imageData: this.currentProblem.imageData,
      selectedText: this.currentProblem.selectedText
    });
  }

  showNewProblemIndicator() {
    // Flash the header to indicate new problem
    const header = document.querySelector('.header');
    if (header) {
      header.style.transition = 'background-color 0.3s';
      header.style.backgroundColor = '#34a853';
      
      setTimeout(() => {
        header.style.backgroundColor = '';
      }, 1000);
    }
    
    // Update document title
    document.title = '🔄 AI Math Tutor - Processing...';
  }

  async startWalkthrough() {
    console.log('Starting walkthrough...');
    
    if (!this.currentProblem || !this.currentProblem.solution) {
      console.error('No current problem or solution available');
      return;
    }
    
    const content = document.getElementById('walkthroughContent');
    if (!content) {
      console.error('Walkthrough content element not found');
      return;
    }
    
    const steps = this.currentProblem.solution.steps;
    console.log('Steps to walk through:', steps.length);
    
    content.innerHTML = '<p style="text-align: center; color: #4285f4;">🎬 Starting walkthrough...</p>';
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (let i = 0; i < steps.length; i++) {
      const cleanStep = steps[i].replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
      
      // Animate each step appearing
      content.innerHTML = `
        <div style="opacity: 0; transition: opacity 0.5s ease-in;">
          <h4 style="color: #4285f4; margin-bottom: 10px;">Step ${i + 1} of ${steps.length}</h4>
          <p style="font-size: 16px; line-height: 1.6;">${cleanStep}</p>
          ${i === steps.length - 1 ? 
            `<p style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 6px; color: #137333;"><strong>✅ Solution Complete!</strong></p>` : 
            `<p style="margin-top: 15px; color: #666; text-align: center;">Next step in 3 seconds...</p>`
          }
        </div>
      `;
      
      // Fade in the step
      setTimeout(() => {
        const stepContent = content.querySelector('div');
        if (stepContent) {
          stepContent.style.opacity = '1';
        }
      }, 100);
      
      // Wait before next step (except for last step)
      if (i < steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  resetWalkthrough() {
    console.log('Resetting walkthrough...');
    const content = document.getElementById('walkthroughContent');
    if (content) {
      content.innerHTML = '<p style="text-align: center; color: #666;">Click "Start Walkthrough" to see each step animated</p>';
    } else {
      console.error('Walkthrough content element not found for reset');
    }
  }

  showStatus(message, type = 'info', duration = 5000) {
    // Create or update status message in the side panel
    let statusElement = document.getElementById('statusMessage');
    
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'statusMessage';
      statusElement.style.cssText = `
        position: sticky;
        top: 0;
        z-index: 1000;
        padding: 12px 20px;
        margin: -20px -20px 20px -20px;
        border-radius: 0 0 8px 8px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        transition: all 0.3s ease;
      `;
      
      // Insert after header
      const header = document.querySelector('.header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(statusElement, header.nextSibling);
      } else {
        document.body.insertBefore(statusElement, document.body.firstChild);
      }
    }
    
    // Set colors based on type
    const colors = {
      success: { bg: '#e8f5e8', color: '#137333', border: '#34a853' },
      error: { bg: '#fce8e6', color: '#d93025', border: '#ea4335' },
      info: { bg: '#e8f0fe', color: '#1a73e8', border: '#4285f4' }
    };
    
    const colorScheme = colors[type] || colors.info;
    statusElement.style.backgroundColor = colorScheme.bg;
    statusElement.style.color = colorScheme.color;
    statusElement.style.borderLeft = `4px solid ${colorScheme.border}`;
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (statusElement) {
          statusElement.style.opacity = '0';
          setTimeout(() => {
            if (statusElement) {
              statusElement.style.display = 'none';
            }
          }, 300);
        }
      }, duration);
    }
  }
}

// Initialize the side panel
const mathTutorPanel = new MathTutorSidePanel();
window.mathTutorPanel = mathTutorPanel;