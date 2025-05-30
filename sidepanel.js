// Side panel JavaScript for AI Math Tutor
class MathTutorSidePanel {
  constructor() {
    this.currentProblem = null;
    this.videoPlayer = null;
    this.videoService = null;
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.setupStorageListener();
    this.setupMainButtons();
    this.setupRefreshButton();
    this.setupActionButtons();
    this.initializeVideoService();
    this.loadCurrentProblem();
    
    // Poll for updates every 2 seconds to catch changes
    setInterval(() => {
      this.loadCurrentProblem();
    }, 2000);
  }

  initializeVideoService() {
    // Initialize video service if available
    if (typeof VideoService !== 'undefined') {
      this.videoService = new VideoService();
    }
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
          
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            alert('Cannot select problems on this page. Try a regular webpage.');
            return;
          } else if (tab.url.startsWith('chrome-extension://') && !isPDF && !isChromeBuiltinPDF) {
            alert('Cannot select problems on extension pages. Try a regular webpage.');
            return;
          }
          
          // For PDFs, use automatic screenshot mode since direct selection may not work reliably
          if (isPDF || isChromeBuiltinPDF) {
            this.showStatus('📄 PDF detected! Using automatic screenshot mode for best results...', 'info');
            this.initPDFAutomaticScreenshot(tab.id);
            return;
          }

          // Inject content script for non-PDF pages
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } catch (injectionError) {
            console.error('Script injection failed:', injectionError);
            alert('Script injection failed. Try refreshing the page.');
            return;
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
    
    // Listen for messages from popup windows via localStorage
    window.addEventListener('storage', async (event) => {
      console.log('🔍 Storage event detected:', { key: event.key, newValue: event.newValue, oldValue: event.oldValue });
      
      if (event.key === 'popup_message_trigger' && event.newValue) {
        console.log('📨 Received localStorage message trigger:', event.newValue);
        await this.processPopupMessage(event.newValue);
      }
    });
    
    // Backup polling method in case storage events don't work
    setInterval(() => {
      this.checkForPopupMessages();
    }, 500);
    
    // Keep the original postMessage listener as fallback
    window.addEventListener('message', async (event) => {
      console.log('📨 Side panel received postMessage from origin:', event.origin);
      console.log('📨 Message data:', event.data);
      
      if (event.data && event.data.type === 'PROCESS_MATH_PROBLEM_FROM_POPUP') {
        console.log('✅ Processing math problem from popup window via postMessage');
        console.log('Image data length:', event.data.imageData ? event.data.imageData.length : 'no image');
        
        try {
          console.log('📤 Sending to background script...');
          const response = await chrome.runtime.sendMessage({
            type: 'PROCESS_MATH_PROBLEM',
            imageData: event.data.imageData,
            selectedText: event.data.selectedText
          });
          console.log('✅ Background processing response:', response);
          this.showStatus('✅ Processing your selected math problem...', 'success');
        } catch (error) {
          console.error('❌ Error processing message from popup:', error);
          this.showStatus('Error processing selection. Please try again.', 'error');
        }
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
          <h3>✅ Solution</h3>
          <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
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
        
        <div style="margin-top: 20px; display: flex; gap: 10px; align-items: center;">
          <button class="btn btn-primary" data-action="explain">
            ▶️
          </button>
          <button class="btn btn-secondary" data-action="copy" style="padding: 8px 12px; font-size: 16px;" title="Copy">
            📋
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

  async generateVideoExplanation(solution) {
    try {
      console.log('🎬 Starting video generation...');
      
      // Show video generation progress
      this.showVideoGenerationProgress();
      
      // Create progress callback
      const progressCallback = (status, percentage) => {
        this.updateRealProgress(status, percentage);
      };
      
      // Generate the video with real progress updates
      const videoResult = await this.videoService.generateExplanationVideo(solution, progressCallback);
      
      // Wait a moment then display the video player
      setTimeout(() => {
        this.displayVideoPlayer(videoResult);
      }, 500);
      
    } catch (error) {
      console.error('Video generation failed:', error);
      this.showVideoGenerationError(error.message);
    }
  }

  showVideoGenerationProgress() {
    const content = document.getElementById('content');
    
    const progressHTML = `
      <div class="video-generation-progress" id="videoProgress">
        <div class="progress-header">
          <div class="progress-spinner"></div>
          <h3>🎬 Generating Video Explanation</h3>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div class="progress-status" id="progressStatus">Initializing video generation...</div>
      </div>
    `;
    
    content.innerHTML = this.getProblemSolutionHTML() + progressHTML;
    
    // Simulate progress updates
    this.updateVideoProgress();
  }

  updateVideoProgress() {
    // Start with initial progress only
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');
    
    if (progressBar && progressStatus) {
      progressBar.style.width = '5%';
      progressStatus.textContent = 'Starting video generation...';
    }
    
    // Store interval reference so we can stop it
    this.progressInterval = null;
  }

  stopProgressAnimation() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateRealProgress(status, percentage) {
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');
    
    if (progressBar && progressStatus) {
      progressBar.style.width = percentage + '%';
      progressStatus.textContent = status;
    }
  }

  displayVideoPlayer(videoResult) {
    const videoProgress = document.getElementById('videoProgress');
    if (videoProgress) {
      const videoPlayerHTML = this.createVideoPlayerHTML(videoResult);
      videoProgress.outerHTML = videoPlayerHTML;
      this.initializeVideoPlayer(videoResult);
    }
  }

  createVideoPlayerHTML(videoResult) {
    return `
      <div class="video-container" id="videoContainer">
        <video 
          id="videoPlayer" 
          class="video-player"
          preload="metadata"
          poster=""
          muted="false"
        >
          <source src="${videoResult.videoUrl}" type="video/webm">
          Your browser does not support the video tag.
        </video>
        
        ${videoResult.hasAudio ? `
          <audio 
            id="audioPlayer" 
            preload="metadata"
            style="display: none;"
          >
            <source src="${videoResult.audioUrl}" type="audio/mpeg">
          </audio>
        ` : ''}
        
        <div class="video-controls" id="videoControls">
          <div class="video-progress" id="videoProgress">
            <div class="video-progress-bar" id="progressBar"></div>
            <div class="video-progress-handle" id="progressHandle"></div>
          </div>
          
          <div class="control-row">
            <div class="control-left">
              <button class="video-btn" id="playPauseBtn">▶️</button>
              <button class="video-btn" id="chaptersBtn">📑</button>
              <span class="video-time" id="videoTime">0:00 / 0:00</span>
            </div>
            
            <div class="control-right">
              <select class="speed-selector" id="speedSelector">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
              <button class="video-btn" id="fullscreenBtn">⛶</button>
            </div>
          </div>
        </div>
        
        <div class="chapters-container" id="chaptersContainer">
          ${this.createChaptersHTML(videoResult.chapters)}
        </div>
      </div>
    `;
  }

  createChaptersHTML(chapters) {
    return chapters.map(chapter => `
      <div class="chapter-item" data-time="${chapter.time}">
        <span>${chapter.title}</span>
        <span class="chapter-time">${this.formatTime(chapter.time)}</span>
      </div>
    `).join('');
  }

  initializeVideoPlayer(videoResult) {
    const video = document.getElementById('videoPlayer');
    const audio = document.getElementById('audioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar = document.getElementById('progressBar');
    const progressHandle = document.getElementById('progressHandle');
    const videoTime = document.getElementById('videoTime');
    const speedSelector = document.getElementById('speedSelector');
    const chaptersBtn = document.getElementById('chaptersBtn');
    const chaptersContainer = document.getElementById('chaptersContainer');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    if (!video) return;

    // Store references
    this.videoPlayer = video;
    this.audioPlayer = audio;

    // Play/Pause functionality with audio sync
    playPauseBtn.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        if (audio) {
          audio.currentTime = video.currentTime;
          audio.play();
        }
        playPauseBtn.textContent = '⏸️';
      } else {
        video.pause();
        if (audio) audio.pause();
        playPauseBtn.textContent = '▶️';
      }
    });

    // Progress bar updates
    video.addEventListener('timeupdate', () => {
      const progress = (video.currentTime / video.duration) * 100;
      progressBar.style.width = progress + '%';
      progressHandle.style.left = progress + '%';
      
      const current = this.formatTime(video.currentTime);
      const total = this.formatTime(video.duration);
      videoTime.textContent = `${current} / ${total}`;
      
      // Update active chapter
      this.updateActiveChapter(video.currentTime, videoResult.chapters);
    });

    // Seek functionality with audio sync
    const videoProgressEl = document.getElementById('videoProgress');
    videoProgressEl.addEventListener('click', (e) => {
      const rect = videoProgressEl.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * video.duration;
      video.currentTime = newTime;
      if (audio) audio.currentTime = newTime;
    });

    // Speed control with audio sync
    speedSelector.addEventListener('change', () => {
      const speed = parseFloat(speedSelector.value);
      video.playbackRate = speed;
      if (audio) audio.playbackRate = speed;
    });

    // Chapters toggle
    chaptersBtn.addEventListener('click', () => {
      chaptersContainer.classList.toggle('visible');
    });

    // Chapter navigation with audio sync
    chaptersContainer.addEventListener('click', (e) => {
      const chapterItem = e.target.closest('.chapter-item');
      if (chapterItem) {
        const time = parseFloat(chapterItem.dataset.time);
        video.currentTime = time;
        if (audio) audio.currentTime = time;
        chaptersContainer.classList.remove('visible');
      }
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.getElementById('videoContainer').requestFullscreen();
      }
    });

    // Auto-play video and audio together
    video.play().then(() => {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {
          console.log('Audio auto-play prevented:', e);
        });
      }
      playPauseBtn.textContent = '⏸️';
    }).catch(e => {
      console.log('Video auto-play prevented:', e);
    });

    // Add audio sync on video events
    if (audio) {
      video.addEventListener('play', () => {
        audio.currentTime = video.currentTime;
        audio.play();
      });
      
      video.addEventListener('pause', () => {
        audio.pause();
      });
      
      video.addEventListener('seeked', () => {
        audio.currentTime = video.currentTime;
      });
    }
  }

  updateActiveChapter(currentTime, chapters) {
    const chapterItems = document.querySelectorAll('.chapter-item');
    chapterItems.forEach(item => {
      item.classList.remove('active');
    });

    // Find current chapter
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].time) {
        const activeItem = document.querySelector(`[data-time="${chapters[i].time}"]`);
        if (activeItem) {
          activeItem.classList.add('active');
        }
        break;
      }
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showVideoGenerationError(errorMessage) {
    const videoProgress = document.getElementById('videoProgress');
    if (videoProgress) {
      videoProgress.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #d93025;">
          <h3>❌ Video Generation Failed</h3>
          <p>${errorMessage}</p>
          <button class="btn btn-primary" onclick="location.reload()">
            🔄 Try Again
          </button>
        </div>
      `;
    }
  }

  async explainProblem() {
    if (!this.currentProblem || !this.currentProblem.solution) return;

    try {
      console.log('🔊 User requested audio explanation...');
      
      // Show audio generation progress
      this.showAudioGenerationProgress();
      
      // Generate detailed audio explanation
      const audioResult = await this.generateDetailedAudioExplanation();
      
      // Display the audio player
      this.displayAudioPlayer(audioResult);
      
    } catch (error) {
      console.error('Audio generation failed:', error);
      this.showAudioGenerationError(error.message);
    }
  }

  showAudioGenerationProgress() {
    const content = document.getElementById('content');
    
    const progressHTML = `
      <div class="video-generation-progress" id="audioProgress">
        <div class="progress-header">
          <div class="progress-spinner"></div>
          <h3>🔊 Generating Audio Explanation</h3>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div class="progress-status" id="progressStatus">Creating detailed explanation script...</div>
      </div>
    `;
    
    content.innerHTML = this.getProblemSolutionHTML() + progressHTML;
  }

  async generateDetailedAudioExplanation() {
    // Get API key
    const result = await chrome.storage.local.get(['aiApiKey']);
    const apiKey = result.aiApiKey;
    
    if (!apiKey) {
      throw new Error('OpenAI API key required for audio explanation');
    }

    // Update progress
    this.updateRealProgress('🤔 Creating detailed explanation script...', 20);

    // Create detailed explanation script
    const explanationScript = await this.createDetailedExplanationScript();
    
    // Update progress
    this.updateRealProgress('🎤 Generating high-quality audio narration...', 60);

    // Generate audio using OpenAI TTS
    const audioBlob = await this.generateOpenAIAudio(explanationScript, apiKey);
    
    // Update progress
    this.updateRealProgress('✅ Audio explanation complete!', 100);

    return {
      audioUrl: URL.createObjectURL(audioBlob),
      transcript: explanationScript,
      duration: await this.getAudioDuration(audioBlob)
    };
  }

  async createDetailedExplanationScript() {
    const problem = this.currentProblem;
    const solution = problem.solution;

    // Create a detailed script that explains the reasoning
    let script = `Hello! Let me walk you through this ${solution.type || 'math'} problem.\n\n`;

    // Add detailed explanation for each step
    solution.steps.forEach((step, index) => {
      const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
      
      script += `Step ${index + 1}: ${cleanStep}\n`;
      script += `The reason we do this step is because ${this.getStepReasoning(cleanStep, index, solution)}.\n\n`;
    });

    script += `Therefore, our final answer is: ${solution.solution}.`;

    return script;
  }

  getStepReasoning(step, index, solution) {
    const stepLower = step.toLowerCase();
    
    // Common mathematical reasoning patterns
    if (stepLower.includes('identify') || stepLower.includes('given')) {
      return 'we need to clearly understand what information we have before we can solve the problem';
    } else if (stepLower.includes('substitute') || stepLower.includes('replace')) {
      return 'substitution allows us to work with known values instead of variables';
    } else if (stepLower.includes('simplify') || stepLower.includes('combine')) {
      return 'simplifying makes the expression easier to work with and reveals the underlying structure';
    } else if (stepLower.includes('solve') || stepLower.includes('isolate')) {
      return 'we need to isolate the variable to find its value';
    } else if (stepLower.includes('multiply') || stepLower.includes('divide')) {
      return 'this operation helps us maintain equality while getting closer to our answer';
    } else if (stepLower.includes('add') || stepLower.includes('subtract')) {
      return 'this arithmetic operation follows the order of operations and moves us toward the solution';
    } else if (stepLower.includes('factor') || stepLower.includes('expand')) {
      return 'changing the form of the expression reveals patterns that make solving easier';
    } else if (stepLower.includes('apply') || stepLower.includes('use')) {
      return 'we use established mathematical rules and formulas that we know are reliable';
    } else if (stepLower.includes('check') || stepLower.includes('verify')) {
      return 'verification ensures our answer is correct and builds confidence in our solution';
    } else if (index === 0) {
      return 'this sets up our problem-solving approach by organizing the information we have';
    } else if (index === solution.steps.length - 1) {
      return 'this final step brings together all our previous work to reach the conclusion';
    } else {
      return 'this builds on our previous step and moves us closer to finding the answer';
    }
  }

  async generateOpenAIAudio(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'nova',
        response_format: 'mp3',
        speed: 0.9
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI TTS error: ${error.error?.message || 'Unknown error'}`);
    }

    return await response.blob();
  }

  async getAudioDuration(audioBlob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  displayAudioPlayer(audioResult) {
    const audioProgress = document.getElementById('audioProgress');
    if (audioProgress) {
      const audioPlayerHTML = this.createAudioPlayerHTML(audioResult);
      audioProgress.outerHTML = audioPlayerHTML;
      this.initializeAudioPlayer(audioResult);
    }
  }

  createAudioPlayerHTML(audioResult) {
    return `
      <div class="audio-container" id="audioContainer">
        <div class="audio-header">
          <h3>🔊 Audio Explanation</h3>
          <p>Listen to a detailed walkthrough with reasoning for each step</p>
        </div>
        
        <audio 
          id="audioPlayer" 
          class="audio-player"
          controls
          preload="metadata"
          style="width: 100%; margin: 20px 0;"
        >
          <source src="${audioResult.audioUrl}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        
        <div class="audio-controls">
          <button class="btn btn-secondary" id="playFromStartBtn">
            ⏮️ Play from Start
          </button>
          <button class="btn btn-secondary" id="downloadAudioBtn">
            💾 Download Audio
          </button>
        </div>
        
        <div class="transcript-container" style="margin-top: 20px;">
          <details>
            <summary style="cursor: pointer; font-weight: bold;">📝 View Transcript</summary>
            <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 6px; white-space: pre-line; line-height: 1.6;">
              ${audioResult.transcript}
            </div>
          </details>
        </div>
      </div>
    `;
  }

  initializeAudioPlayer(audioResult) {
    const audio = document.getElementById('audioPlayer');
    const playFromStartBtn = document.getElementById('playFromStartBtn');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');

    if (!audio) return;

    // Play from start functionality
    playFromStartBtn.addEventListener('click', () => {
      audio.currentTime = 0;
      audio.play();
    });

    // Download audio functionality
    downloadAudioBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = audioResult.audioUrl;
      a.download = 'math-explanation.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    // Auto-play the audio
    audio.play().catch(e => {
      console.log('Audio auto-play prevented:', e);
    });
  }

  showAudioGenerationError(errorMessage) {
    const audioProgress = document.getElementById('audioProgress');
    if (audioProgress) {
      audioProgress.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #d93025;">
          <h3>❌ Audio Generation Failed</h3>
          <p>${errorMessage}</p>
          <button class="btn btn-primary" onclick="location.reload()">
            🔄 Try Again
          </button>
        </div>
      `;
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

  async initPDFAutomaticScreenshot(tabId) {
    
    try {
      // Show processing state
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="empty-state">
          <div class="loading">
            <div class="spinner"></div>
            <h3>📄 Setting up PDF selection...</h3>
            <p>Preparing smart selection tool for PDF pages.</p>
          </div>
        </div>
      `;
      
      this.showStatus('📄 Setting up PDF selection mode...', 'info');
      
      // For PDFs, try to inject content script first for better selection
      try {
        console.log('Attempting to inject content script for PDF...');
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        console.log('Content script injected, enabling selection...');
        // Try to enable selection mode on the PDF
        const response = await chrome.tabs.sendMessage(tabId, { type: 'ENABLE_SELECTION' });
        console.log('Selection mode response:', response);
        
        // Wait a moment to see if it works
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show success state
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <h2>PDF Selection Mode Active!</h2>
            <p>Click and drag on the PDF to select the math problem area.</p>
            <p style="color: #34a853;">✅ Smart text extraction enabled for PDFs</p>
            <div style="margin-top: 20px;">
              <button class="btn btn-secondary" onclick="mathTutorPanel.initPDFScreenshotMode(${tabId})">
                📷 Use Screenshot Mode Instead
              </button>
            </div>
          </div>
        `;
        
        this.showStatus('✅ PDF selection mode ready! Click and drag on the PDF to select the problem.', 'success');
        return;
        
      } catch (selectionError) {
        console.log('PDF direct selection failed:', selectionError);
        console.log('Error details:', selectionError.message);
      }
      
      // If direct selection fails, try screenshot capture methods
      await this.tryScreenshotCapture(tabId);
      
    } catch (error) {
      console.error('PDF automatic methods failed:', error);
      
      // Show more detailed error message based on error type
      let errorMsg = 'Chrome restricts PDF operations';
      if (error.message.includes('screenshot')) {
        errorMsg = 'PDF screenshot blocked by browser';
      } else if (error.message.includes('injection')) {
        errorMsg = 'PDF script injection blocked';
      }
      
      this.showStatus(`${errorMsg}. Using manual upload mode.`, 'error');
      
      // Add delay before showing manual mode to ensure user sees the error
      setTimeout(() => {
        this.initPDFScreenshotMode(tabId);
      }, 1500);
    }
  }

  showPDFScreenshotSelection(screenshotData) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="pdf-screenshot-selector">
        <div class="screenshot-header">
          <h3>📄 Screenshot Captured!</h3>
          <p>Click on the image below to open the large selection window:</p>
        </div>
        
        <div class="screenshot-preview clickable-preview" id="screenshotPreview">
          <img src="${screenshotData}" alt="Captured Screenshot" class="screenshot-preview-image" />
          <div class="screenshot-preview-overlay">
            <div class="preview-controls">
              <div class="click-hint">🔍 Click to Open Large Selection Window</div>
            </div>
          </div>
        </div>
        
        <div class="screenshot-controls">
          <button class="btn btn-secondary" id="retakeScreenshotBtn">
            🔄 Retake Screenshot
          </button>
          <button class="btn btn-secondary" onclick="document.getElementById('imageInput').click()">
            📷 Upload Different Image
          </button>
        </div>
      </div>
    `;
    
    this.setupScreenshotSelectionMethods(screenshotData);
  }

  setupScreenshotSelectionMethods(screenshotData) {
    const screenshotPreview = document.getElementById('screenshotPreview');
    const retakeBtn = document.getElementById('retakeScreenshotBtn');
    
    // Make the entire screenshot preview clickable to open popup
    screenshotPreview.addEventListener('click', () => {
      this.openScreenshotInPopout(screenshotData);
    });
    
    // Add cursor pointer to indicate clickability
    screenshotPreview.style.cursor = 'pointer';
    
    // Retake screenshot
    retakeBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.initPDFAutomaticScreenshot(tab.id);
    });
  }

  openScreenshotInPopout(screenshotData) {
    // Generate a unique ID for this popup session
    const popupId = 'popup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create pop-out window with screenshot selector
    const popoutWindow = window.open('', popupId, 
      'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no');
    
    if (!popoutWindow) {
      alert('Pop-up blocked! Please allow pop-ups for this extension and try again.');
      return;
    }
    
    // Create the pop-out content
    popoutWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Math Tutor - Screenshot Selection</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: #f8f9fa;
              overflow: hidden;
            }
            
            .header {
              background: linear-gradient(135deg, #4285f4, #34a853);
              color: white;
              padding: 15px 20px;
              margin: -20px -20px 20px -20px;
              border-radius: 0 0 12px 12px;
              text-align: center;
            }
            
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            
            .header p {
              margin: 5px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            
            .screenshot-container {
              position: relative;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
              overflow: hidden;
              margin-bottom: 20px;
              max-height: calc(100vh - 200px);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .screenshot-canvas {
              max-width: 100%;
              max-height: 100%;
              cursor: crosshair;
              display: block;
            }
            
            .selection-overlay {
              position: absolute;
              border: 3px dashed #4285f4;
              background: rgba(66, 133, 244, 0.1);
              pointer-events: none;
              display: none;
              z-index: 10;
              box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
            }
            
            .controls {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .btn {
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              margin: 0 10px;
              transition: all 0.3s;
            }
            
            .btn-primary {
              background: linear-gradient(135deg, #4285f4, #1a73e8);
              color: white;
            }
            
            .btn-primary:hover {
              background: linear-gradient(135deg, #1a73e8, #1557b0);
              transform: translateY(-1px);
            }
            
            .btn-primary:disabled {
              opacity: 0.5;
              cursor: not-allowed;
              transform: none;
            }
            
            .btn-secondary {
              background: #f8f9fa;
              color: #5f6368;
              border: 1px solid #dadce0;
            }
            
            .btn-secondary:hover {
              background: #e8f0fe;
            }
            
            .selection-info {
              margin-top: 15px;
              padding: 10px;
              background: #e8f0fe;
              border-radius: 6px;
              color: #1976d2;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📐 Select Math Problem Area</h1>
            <p>Click and drag on the screenshot to select the problem you want to solve</p>
          </div>
          
          <div class="screenshot-container" id="screenshotContainer">
            <canvas id="screenshotCanvas" class="screenshot-canvas"></canvas>
            <div class="selection-overlay" id="selectionOverlay"></div>
          </div>
          
          <div class="controls">
            <button class="btn btn-primary" id="confirmSelectionBtn" disabled>
              ✅ Solve Selected Area
            </button>
            <button class="btn btn-secondary" id="cancelBtn">
              ❌ Cancel
            </button>
            <button class="btn btn-secondary" id="resetSelectionBtn">
              🔄 Reset Selection
            </button>
            
            <div class="selection-info" id="selectionInfo" style="display: none;">
              💡 <strong>Tip:</strong> Make sure to include the entire problem in your selection for best results!
            </div>
          </div>
          
        </body>
      </html>
    `);
    
    // Inject communication functions directly into the popup window
    const injectCommunicationFunctions = () => {
      console.log('💉 Injecting communication functions into popup window');
      
      try {
        // Define the sendToParent function directly in the popup window
        popoutWindow.sendToParent = function(data) {
          console.log('📤 Sending message to parent via localStorage (injected function)');
          
          try {
            // Store the message with a timestamp
            const message = {
              ...data,
              timestamp: Date.now(),
              popupId: popoutWindow.name // Use the window name as identifier
            };
            
            // Store in localStorage with a unique key
            const messageKey = 'popup_message_' + message.timestamp;
            popoutWindow.localStorage.setItem(messageKey, JSON.stringify(message));
            
            // Trigger a storage event by updating a trigger key
            popoutWindow.localStorage.setItem('popup_message_trigger', message.timestamp.toString());
            
            console.log('✅ Message stored in localStorage with key:', messageKey);
            return true;
          } catch (error) {
            console.error('❌ Error storing message in localStorage:', error);
            return false;
          }
        };
        
        // Define debug function
        popoutWindow.checkCommunication = function() {
          console.log('Communication check (injected):');
          console.log('sendToParent available:', typeof popoutWindow.sendToParent);
          console.log('window.name:', popoutWindow.name);
          console.log('localStorage available:', typeof popoutWindow.localStorage);
          return {
            sendToParent: typeof popoutWindow.sendToParent,
            windowName: popoutWindow.name,
            localStorage: typeof popoutWindow.localStorage
          };
        };
        
        console.log('✅ Communication functions injected successfully');
        console.log('sendToParent type:', typeof popoutWindow.sendToParent);
        
      } catch (injectionError) {
        console.error('❌ Error injecting communication functions:', injectionError);
      }
    };
    
    // Wait for document to be ready and initialize
    popoutWindow.addEventListener('DOMContentLoaded', () => {
      injectCommunicationFunctions();
      this.initializePopoutSelector(popoutWindow, screenshotData);
    });
    
    // Fallback - also try after window load
    popoutWindow.addEventListener('load', () => {
      if (!popoutWindow.document.getElementById('screenshotCanvas').hasAttribute('data-initialized')) {
        injectCommunicationFunctions();
        this.initializePopoutSelector(popoutWindow, screenshotData);
      }
    });
    
    // Immediate fallback in case events don't fire
    setTimeout(() => {
      if (popoutWindow.document.getElementById('screenshotCanvas') && 
          !popoutWindow.document.getElementById('screenshotCanvas').hasAttribute('data-initialized')) {
        injectCommunicationFunctions();
        this.initializePopoutSelector(popoutWindow, screenshotData);
      }
    }, 100);
  }

  initializePopoutSelector(popoutWindow, screenshotData) {
    console.log('🎯 Initializing pop-out selector with screenshot data:', screenshotData ? 'Present' : 'Missing');
    
    const canvas = popoutWindow.document.getElementById('screenshotCanvas');
    if (!canvas) {
      console.error('❌ Canvas not found in pop-out window');
      return;
    }
    
    // Mark as initialized
    canvas.setAttribute('data-initialized', 'true');
    
    const ctx = canvas.getContext('2d');
    const container = popoutWindow.document.getElementById('screenshotContainer');
    const overlay = popoutWindow.document.getElementById('selectionOverlay');
    const confirmBtn = popoutWindow.document.getElementById('confirmSelectionBtn');
    const cancelBtn = popoutWindow.document.getElementById('cancelBtn');
    const resetBtn = popoutWindow.document.getElementById('resetSelectionBtn');
    const selectionInfo = popoutWindow.document.getElementById('selectionInfo');
    
    let isSelecting = false;
    let startX, startY, currentSelection = null;
    
    // Load and display screenshot
    const img = new Image();
    img.onload = () => {
      console.log('✅ Image loaded successfully:', img.width, 'x', img.height);
      
      // Calculate optimal size for the pop-out window
      const maxWidth = popoutWindow.innerWidth - 40;
      const maxHeight = popoutWindow.innerHeight - 200; // Account for header and controls
      
      let displayWidth = img.width;
      let displayHeight = img.height;
      
      // Scale down if too large (maintain aspect ratio)
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      displayWidth = img.width * scale;
      displayHeight = img.height * scale;
      
      console.log('🔧 Scaling calculation:');
      console.log('Original image:', img.width, 'x', img.height);
      console.log('Max dimensions:', maxWidth, 'x', maxHeight);
      console.log('Device pixel ratio:', window.devicePixelRatio);
      console.log('Scale factor:', scale);
      console.log('Final display size:', displayWidth, 'x', displayHeight);
      
      console.log('📐 Canvas dimensions:', displayWidth, 'x', displayHeight);
      
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      // Draw screenshot
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      console.log('🎨 Image drawn to canvas');
      
      // Mark as loaded successfully
      canvas.setAttribute('data-image-loaded', 'true');
      
      // Store original dimensions for scaling calculations
      // Account for device pixel ratio - the captured screenshot is at device resolution
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      canvas.originalWidth = img.width;
      canvas.originalHeight = img.height;
      canvas.scaleX = img.width / displayWidth;
      canvas.scaleY = img.height / displayHeight;
      canvas.devicePixelRatio = devicePixelRatio;
      
      console.log('📏 Scale factors stored:');
      console.log('scaleX:', canvas.scaleX, 'scaleY:', canvas.scaleY);
      console.log('devicePixelRatio:', devicePixelRatio);
    };
    
    img.onerror = (error) => {
      console.error('❌ Failed to load image:', error);
      console.error('Screenshot data length:', screenshotData ? screenshotData.length : 'undefined');
      console.error('Screenshot data start:', screenshotData ? screenshotData.substring(0, 100) : 'undefined');
      
      // Fallback: try to show image using img element instead of canvas
      const fallbackImg = popoutWindow.document.createElement('img');
      fallbackImg.src = screenshotData;
      fallbackImg.style.maxWidth = '100%';
      fallbackImg.style.maxHeight = '100%';
      fallbackImg.style.border = '2px solid red';
      fallbackImg.style.display = 'block';
      
      container.innerHTML = '';
      container.appendChild(fallbackImg);
      container.appendChild(overlay);
      
      console.log('📷 Added fallback img element');
    };
    
    img.src = screenshotData;
    
    // Timeout to detect if image never loads
    setTimeout(() => {
      if (!canvas.hasAttribute('data-image-loaded')) {
        console.warn('⚠️ Image load timeout - trying alternative approach');
        
        // Try direct canvas approach
        const testCanvas = popoutWindow.document.createElement('canvas');
        testCanvas.width = 800;
        testCanvas.height = 600;
        testCanvas.style.border = '2px solid blue';
        testCanvas.style.maxWidth = '100%';
        testCanvas.style.maxHeight = '100%';
        
        const testCtx = testCanvas.getContext('2d');
        testCtx.fillStyle = '#f0f0f0';
        testCtx.fillRect(0, 0, 800, 600);
        testCtx.fillStyle = '#333';
        testCtx.font = '24px Arial';
        testCtx.textAlign = 'center';
        testCtx.fillText('Screenshot Loading Failed', 400, 280);
        testCtx.fillText('Screenshot data: ' + (screenshotData ? 'Present' : 'Missing'), 400, 320);
        
        container.innerHTML = '';
        container.appendChild(testCanvas);
        container.appendChild(overlay);
      }
    }, 3000);
    
    // Selection functionality
    canvas.addEventListener('mousedown', (e) => {
      isSelecting = true;
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate position relative to canvas
      startX = e.clientX - canvasRect.left;
      startY = e.clientY - canvasRect.top;
      
      // Calculate overlay position relative to container
      const overlayLeft = (e.clientX - containerRect.left);
      const overlayTop = (e.clientY - containerRect.top);
      
      console.log('🎯 Mouse down:', {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasRect: { left: canvasRect.left, top: canvasRect.top },
        containerRect: { left: containerRect.left, top: containerRect.top },
        startX: startX,
        startY: startY,
        overlayLeft: overlayLeft,
        overlayTop: overlayTop
      });
      
      overlay.style.display = 'block';
      overlay.style.left = overlayLeft + 'px';
      overlay.style.top = overlayTop + 'px';
      overlay.style.width = '0px';
      overlay.style.height = '0px';
      
      selectionInfo.style.display = 'none';
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate current position relative to canvas
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;
      
      // Calculate selection bounds relative to canvas
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      // Convert to container coordinates for overlay positioning
      const overlayLeft = left + (canvasRect.left - containerRect.left);
      const overlayTop = top + (canvasRect.top - containerRect.top);
      
      // Debug logging for alignment issues
      if (Math.random() < 0.1) { // Log occasionally to avoid spam
        console.log('📐 Overlay positioning:', {
          canvasOffset: { x: canvasRect.left - containerRect.left, y: canvasRect.top - containerRect.top },
          selectionOnCanvas: { left, top, width, height },
          overlayPosition: { left: overlayLeft, top: overlayTop }
        });
      }
      
      overlay.style.left = overlayLeft + 'px';
      overlay.style.top = overlayTop + 'px';
      overlay.style.width = width + 'px';
      overlay.style.height = height + 'px';
    });
    
    canvas.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      
      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      // Check if selection is large enough
      if (width > 30 && height > 30) {
        currentSelection = {
          x: left,
          y: top,
          width: width,
          height: height
        };
        confirmBtn.disabled = false;
        confirmBtn.textContent = `✅ Solve Selected Area (${Math.round(width)}×${Math.round(height)})`;
        selectionInfo.style.display = 'block';
      } else {
        overlay.style.display = 'none';
        confirmBtn.disabled = true;
        confirmBtn.textContent = '✅ Solve Selected Area';
        selectionInfo.style.display = 'none';
      }
    });
    
    // Confirm selection
    confirmBtn.addEventListener('click', async () => {
      if (!currentSelection) return;
      
      try {
        // Set flag to indicate solve button was clicked
        solvingInProgress = true;
        console.log('✅ Solve button clicked, setting solvingInProgress flag');
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = '🤔 Processing...';
        
        // Calculate coordinates relative to original image
        // The captured screenshot is at device resolution, so we need to account for that
        const devicePixelRatio = canvas.devicePixelRatio || 1;
        
        const cropData = {
          x: currentSelection.x * canvas.scaleX,
          y: currentSelection.y * canvas.scaleY,
          width: currentSelection.width * canvas.scaleX,
          height: currentSelection.height * canvas.scaleY
        };
        
        console.log('🔍 Cropping calculation debug:');
        console.log('Canvas size (display):', canvas.width, 'x', canvas.height);
        console.log('Original image size:', canvas.originalWidth, 'x', canvas.originalHeight);
        console.log('Device pixel ratio:', devicePixelRatio);
        console.log('Scale factors:', { scaleX: canvas.scaleX, scaleY: canvas.scaleY });
        console.log('Selection (display coords):', currentSelection);
        console.log('Crop data (original coords):', cropData);
        
        // Validate crop bounds to ensure we don't exceed image dimensions
        const safeCropData = {
          x: Math.max(0, Math.min(cropData.x, canvas.originalWidth - 1)),
          y: Math.max(0, Math.min(cropData.y, canvas.originalHeight - 1)),
          width: Math.max(1, Math.min(cropData.width, canvas.originalWidth - cropData.x)),
          height: Math.max(1, Math.min(cropData.height, canvas.originalHeight - cropData.y))
        };
        
        console.log('Safe crop data (bounds checked):', safeCropData);
        
        // Crop the screenshot (create inline function since we're in pop-out context)
        const croppedImage = await new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            canvas.width = cropData.width;
            canvas.height = cropData.height;
            
            ctx.drawImage(
              img,
              cropData.x, cropData.y, cropData.width, cropData.height,
              0, 0, cropData.width, cropData.height
            );
            
            resolve(canvas.toDataURL('image/png', 1.0));
          };
          
          img.src = screenshotData;
        });
        
        // Process the cropped area using localStorage communication
        console.log('🔗 Attempting to send message to parent...');
        console.log('🔍 Debug popup window environment:');
        console.log('window.sendToParent type:', typeof window.sendToParent);
        console.log('window.checkCommunication type:', typeof window.checkCommunication);
        console.log('window.name:', window.name);
        console.log('localStorage available:', typeof localStorage);
        
        // Call debug function if available
        if (typeof window.checkCommunication === 'function') {
          const commCheck = window.checkCommunication();
          console.log('Communication check result:', commCheck);
        }
        
        // Try localStorage method first (most reliable)
        if (typeof window.sendToParent === 'function') {
          console.log('✅ Using localStorage communication method');
          
          const success = window.sendToParent({
            type: 'PROCESS_MATH_PROBLEM_FROM_POPUP',
            imageData: croppedImage,
            selectedText: 'Math problem from screenshot selection'
          });
          
          if (success) {
            console.log('✅ Message sent via localStorage');
          } else {
            throw new Error('Failed to send message via localStorage');
          }
        }
        // Fallback: direct localStorage access (doesn't need injected function)
        else if (typeof localStorage !== 'undefined') {
          console.log('⚠️ Falling back to direct localStorage method');
          
          try {
            const message = {
              type: 'PROCESS_MATH_PROBLEM_FROM_POPUP',
              imageData: croppedImage,
              selectedText: 'Math problem from screenshot selection',
              timestamp: Date.now(),
              popupId: window.name
            };
            
            const messageKey = 'popup_message_' + message.timestamp;
            localStorage.setItem(messageKey, JSON.stringify(message));
            localStorage.setItem('popup_message_trigger', message.timestamp.toString());
            
            console.log('✅ Message sent via direct localStorage access');
          } catch (localStorageError) {
            console.error('❌ Direct localStorage access failed:', localStorageError);
            throw new Error('Failed to communicate with parent window');
          }
        }
        // Last resort: postMessage fallback
        else if (window.opener && !window.opener.closed) {
          console.log('⚠️ Falling back to postMessage method');
          
          window.opener.postMessage({
            type: 'PROCESS_MATH_PROBLEM_FROM_POPUP',
            imageData: croppedImage,
            selectedText: 'Math problem from screenshot selection'
          }, '*');
          console.log('📤 Message sent via postMessage');
        }
        else {
          console.error('❌ No communication method available');
          console.error('sendToParent available:', typeof window.sendToParent);
          console.error('localStorage available:', typeof localStorage);
          console.error('window.opener available:', !!window.opener);
          console.error('window.opener.closed:', window.opener?.closed);
          throw new Error('No communication method available. Please close this window and try again.');
        }
        
        // Show success feedback before closing
        confirmBtn.textContent = '✅ Success! Closing window...';
        confirmBtn.style.background = '#34a853';
        
        // Status update will be handled by the parent window via postMessage
        
        // Small delay to show success, then close window
        setTimeout(() => {
          popoutWindow.close();
        }, 1000);
        
      } catch (error) {
        console.error('Error processing selection:', error);
        confirmBtn.disabled = false;
        confirmBtn.textContent = '❌ Error - Try Again';
        confirmBtn.style.background = '#ea4335';
        
        // Reset button after delay
        setTimeout(() => {
          confirmBtn.textContent = '✅ Solve Selected Area';
          confirmBtn.style.background = '';
        }, 3000);
        
        // Provide more specific error message
        let errorMessage = 'Error processing selection. Please try again.';
        if (error.message) {
          if (error.message.includes('Extension context invalidated')) {
            errorMessage = 'Extension was reloaded. Please refresh this page and try again.';
          } else if (error.message.includes('chrome.runtime')) {
            errorMessage = 'Extension communication error. Please refresh the page and try again.';
          } else {
            errorMessage = `Error: ${error.message}. Please try again.`;
          }
        }
        
        alert(errorMessage);
      }
    });
    
    // Reset selection
    resetBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      currentSelection = null;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '✅ Solve Selected Area';
      selectionInfo.style.display = 'none';
    });
    
    // Cancel and close
    cancelBtn.addEventListener('click', () => {
      popoutWindow.close();
    });
    
    // Track if solve button was clicked
    let solvingInProgress = false;
    
    // Handle window close
    popoutWindow.addEventListener('beforeunload', () => {
      // Only show processing state if solve button was clicked
      if (solvingInProgress) {
        console.log('🔄 Popup window closing after solve button clicked, showing processing state...');
        const content = document.getElementById('content');
        content.innerHTML = this.getLoadingHTML();
        this.showStatus('📸 Processing your screenshot selection...', 'info');
      } else {
        console.log('🔄 Popup window closed without solving, returning to screenshot selection...');
        // Return to screenshot selection if user just closed without solving
        this.showPDFScreenshotSelection(screenshotData);
      }
    });
  }


  initializeScreenshotSelector(screenshotData) {
    const canvas = document.getElementById('screenshotCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('screenshotContainer');
    const overlay = document.getElementById('selectionOverlay');
    const confirmBtn = document.getElementById('confirmSelectionBtn');
    const retakeBtn = document.getElementById('retakeScreenshotBtn');
    
    let isSelecting = false;
    let startX, startY, currentSelection = null;
    
    // Load and display screenshot
    const img = new Image();
    img.onload = () => {
      // Size canvas to fit container while maintaining aspect ratio
      const containerWidth = container.clientWidth - 20; // Account for padding
      const aspectRatio = img.height / img.width;
      canvas.width = Math.min(containerWidth, img.width);
      canvas.height = canvas.width * aspectRatio;
      
      // Draw screenshot
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Store original image data for cropping
      canvas.originalImageData = screenshotData;
      canvas.originalWidth = img.width;
      canvas.originalHeight = img.height;
    };
    img.src = screenshotData;
    
    // Selection functionality
    canvas.addEventListener('mousedown', (e) => {
      isSelecting = true;
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      
      overlay.style.display = 'block';
      overlay.style.left = startX + 'px';
      overlay.style.top = startY + 'px';
      overlay.style.width = '0px';
      overlay.style.height = '0px';
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.width = width + 'px';
      overlay.style.height = height + 'px';
    });
    
    canvas.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      
      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      // Check if selection is large enough
      if (width > 20 && height > 20) {
        currentSelection = {
          x: left,
          y: top,
          width: width,
          height: height
        };
        confirmBtn.disabled = false;
        confirmBtn.textContent = `✅ Solve Selected Area (${Math.round(width)}x${Math.round(height)})`;
      } else {
        overlay.style.display = 'none';
        confirmBtn.disabled = true;
        confirmBtn.textContent = '✅ Solve Selected Area';
      }
    });
    
    // Confirm selection
    confirmBtn.addEventListener('click', async () => {
      if (!currentSelection) return;
      
      try {
        this.showStatus('🤔 Processing selected area...', 'info');
        
        // Calculate coordinates relative to original image
        const scaleX = canvas.originalWidth / canvas.width;
        const scaleY = canvas.originalHeight / canvas.height;
        
        const cropData = {
          x: currentSelection.x * scaleX,
          y: currentSelection.y * scaleY,
          width: currentSelection.width * scaleX,
          height: currentSelection.height * scaleY
        };
        
        // Crop the screenshot
        const croppedImage = await this.cropScreenshotImage(screenshotData, cropData);
        
        // Process the cropped area
        await chrome.runtime.sendMessage({
          type: 'PROCESS_MATH_PROBLEM',
          imageData: croppedImage,
          selectedText: 'Math problem from PDF screenshot selection'
        });
        
        this.showStatus('✅ Processing your selected math problem...', 'success');
        
      } catch (error) {
        console.error('Error processing selection:', error);
        this.showStatus('Error processing selection. Please try again.', 'error');
      }
    });
    
    // Retake screenshot
    retakeBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.initPDFAutomaticScreenshot(tab.id);
    });
  }

  async tryScreenshotCapture(tabId) {
    this.showStatus('📸 Taking screenshot of PDF...', 'info');
    console.log('Requesting full screenshot...');
    
    try {
      // Method 1: Try traditional tab capture
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const screenshotData = await chrome.runtime.sendMessage({
        type: 'CAPTURE_FULL_SCREENSHOT',
        tabId: tab.id
      });
      
      console.log('Screenshot response:', screenshotData);
      console.log('Screenshot data length:', screenshotData?.imageData?.length);
      console.log('Screenshot success:', screenshotData?.success);
      
      if (screenshotData && screenshotData.success && screenshotData.imageData) {
        // Success! Show screenshot selection interface
        this.showPDFScreenshotSelection(screenshotData.imageData);
        this.showStatus('✅ Screenshot captured! Click and drag to select the math problem area.', 'success');
        return;
      }
      
      // Method 2: Try Screen Capture API (if available)
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        console.log('Trying Screen Capture API...');
        await this.tryScreenCaptureAPI();
        return;
      }
      
      // All methods failed
      throw new Error(screenshotData?.error || 'All screenshot methods failed');
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw error;
    }
  }

  async tryScreenCaptureAPI() {
    try {
      this.showStatus('📱 Opening screen capture...', 'info');
      
      // Show instructions for screen capture
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📱</div>
          <h2>Screen Capture Mode</h2>
          <p style="margin-bottom: 20px;">For PDFs and restricted pages, screen capture is required to access the content:</p>
          
          <button 
            id="screenCaptureBtn" 
            class="btn btn-primary" 
            style="padding: 15px 30px; font-size: 16px;"
          >
            🖥️ Capture Screen
          </button>
          
          <div style="margin-top: 20px; padding: 15px; background: #e8f0fe; border-radius: 8px; color: #1976d2;">
            <strong>📋 Instructions:</strong><br>
            1. Click "Capture Screen"<br>
            2. Select the browser tab with your PDF or document<br>
            3. You'll get a large selection window to choose the problem area
          </div>
        </div>
      `;
      
      // Add event listener for screen capture
      document.getElementById('screenCaptureBtn').addEventListener('click', async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: 'screen' }
          });
          
          // Create video element to capture frame
          const video = document.createElement('video');
          video.srcObject = stream;
          video.play();
          
          video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            // Stop the stream
            stream.getTracks().forEach(track => track.stop());
            
            // Get the captured image
            const capturedImage = canvas.toDataURL('image/png');
            
            // Show screenshot selection interface
            this.showPDFScreenshotSelection(capturedImage);
            this.showStatus('✅ Screen captured! Click and drag to select the math problem area.', 'success');
          };
          
        } catch (captureError) {
          console.error('Screen capture failed:', captureError);
          this.showStatus('Screen capture cancelled or failed.', 'error');
          throw captureError;
        }
      });
      
    } catch (error) {
      console.error('Screen Capture API failed:', error);
      throw error;
    }
  }

  async cropScreenshotImage(imageData, cropData) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = cropData.width;
        canvas.height = cropData.height;
        
        ctx.drawImage(
          img,
          cropData.x, cropData.y, cropData.width, cropData.height,
          0, 0, cropData.width, cropData.height
        );
        
        resolve(canvas.toDataURL('image/png', 1.0));
      };
      
      img.src = imageData;
    });
  }

  initPDFScreenshotMode(tabId) {
    console.log('Initializing PDF screenshot mode for tab:', tabId);
    
    // Show instructions for screenshot mode
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h2>PDF Screenshot Mode</h2>
        <p style="margin-bottom: 15px; color: #ea4335;">⚠️ Chrome restricts automatic PDF operations</p>
        <p style="margin-bottom: 20px;">Please manually capture a screenshot of the math problem:</p>
        
        <div style="text-align: left; max-width: 420px; margin: 0 auto; background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4285f4;">
          <h3 style="margin-top: 0; color: #1976d2;">📸 Quick Screenshot Guide</h3>
          
          <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
            <strong>Mac:</strong> <code style="background: #e8f0fe; padding: 2px 6px; border-radius: 3px;">⌘ Cmd + Shift + 4</code><br>
            <small style="color: #666;">Then drag to select the problem area</small>
          </div>
          
          <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
            <strong>Windows:</strong> <code style="background: #e8f0fe; padding: 2px 6px; border-radius: 3px;">Win + Shift + S</code><br>
            <small style="color: #666;">Then select rectangular snip</small>
          </div>
          
          <div style="background: #e8f5e8; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 3px solid #34a853;">
            <strong>💡 Pro Tip:</strong> Capture just the math problem area for best results!
          </div>
          
          <button 
            id="pdfUploadBtn" 
            class="btn btn-primary" 
            style="width: 100%; padding: 12px; font-size: 16px; background: linear-gradient(135deg, #34a853, #137333);"
            onclick="document.getElementById('imageInput').click()"
          >
            📷 Upload Screenshot
          </button>
        </div>
        
        <div style="margin-top: 20px;">
          <button class="btn btn-secondary" onclick="mathTutorPanel.initPDFAutomaticScreenshot(${tabId})">
            🔄 Try Automatic Mode Again
          </button>
          <button class="btn btn-secondary" onclick="mathTutorPanel.newProblem()">
            ↻ Try Different Page
          </button>
        </div>
      </div>
    `;
    
    this.showStatus('📄 Manual screenshot mode ready. Capture the problem area and upload it.', 'info');
  }

  async processPopupMessage(timestamp) {
    const messageKey = 'popup_message_' + timestamp;
    const messageData = localStorage.getItem(messageKey);
    
    if (messageData) {
      try {
        const message = JSON.parse(messageData);
        console.log('📨 Parsed popup message:', message);
        
        if (message.type === 'PROCESS_MATH_PROBLEM_FROM_POPUP') {
          console.log('✅ Processing math problem from popup window via localStorage');
          console.log('Image data length:', message.imageData ? message.imageData.length : 'no image');
          
          try {
            // Immediately show processing state in the main content area
            const content = document.getElementById('content');
            content.innerHTML = this.getLoadingHTML();
            
            // Clear any existing problem data to ensure clean state
            this.currentProblem = null;
            
            // Update status
            this.showStatus('📸 Processing screenshot selection...', 'info');
            
            // Process the math problem using Chrome APIs from the side panel context
            console.log('📤 Sending to background script...');
            const response = await chrome.runtime.sendMessage({
              type: 'PROCESS_MATH_PROBLEM',
              imageData: message.imageData,
              selectedText: message.selectedText
            });
            console.log('✅ Background processing response:', response);
            
            // The solution will be displayed automatically when storage updates
            // via the existing storage listener
            this.showStatus('✅ Processing your selected math problem...', 'success');
            
            // Clean up the message from localStorage
            localStorage.removeItem(messageKey);
            localStorage.removeItem('popup_message_trigger');
            console.log('🧹 Cleaned up message from localStorage');
            
          } catch (error) {
            console.error('❌ Error processing message from popup:', error);
            this.showStatus('Error processing selection. Please try again.', 'error');
          }
        }
      } catch (parseError) {
        console.error('❌ Error parsing popup message:', parseError);
      }
    } else {
      console.log('⚠️ Message data not found for key:', messageKey);
    }
  }

  checkForPopupMessages() {
    // Check for any popup messages that might have been missed
    const trigger = localStorage.getItem('popup_message_trigger');
    if (trigger && !this.lastProcessedTrigger) {
      console.log('🔍 Found unprocessed popup message trigger via polling:', trigger);
      this.processPopupMessage(trigger);
      this.lastProcessedTrigger = trigger;
    } else if (trigger !== this.lastProcessedTrigger) {
      console.log('🔍 Found new popup message trigger via polling:', trigger);
      this.processPopupMessage(trigger);
      this.lastProcessedTrigger = trigger;
    }
  }
}

// Initialize the side panel
const mathTutorPanel = new MathTutorSidePanel();
window.mathTutorPanel = mathTutorPanel;