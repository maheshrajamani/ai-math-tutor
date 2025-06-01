// Side panel JavaScript for AI Math Tutor
class MathTutorSidePanel {
  constructor() {
    this.currentProblem = null;
    this.videoPlayer = null;
    this.videoService = null;
    this.chatSession = {
      messages: [],
      questionCount: 0,
      maxQuestions: 5,
      context: null
    };
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.setupStorageListener();
    this.setupMainButtons();
    this.setupRefreshButton();
    this.setupActionButtons();
    this.setupChatHandlers();
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
          
          // Always try direct selection first - let it fail gracefully if needed
          this.showStatus('🔍 Trying direct selection...', 'info');
          
          try {
            // Try to inject content script
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Small delay to ensure script is loaded before enabling selection
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to enable selection mode
            await chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_SELECTION' });
            this.showStatus('✅ Direct selection enabled! Click and drag to select a math problem.', 'success');
            
          } catch (error) {
            console.log('Direct selection failed, falling back to screen capture:', error.message);
            this.showStatus('📸 Direct selection not available - using screen capture mode...', 'info');
            // Automatic fallback to screen capture for any failures
            this.initAutomaticScreenshot(tab.id);
          }
          
        } catch (error) {
          console.error('Error enabling selection:', error);
          this.showStatus('Error enabling selection mode. Try refreshing the page.', 'error');
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
          case 'discuss':
            this.openChatWindow();
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
          <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px; flex-wrap: wrap;">
            <span style="color: #34a853; font-size: 12px;">● Completed</span>
            <span style="color: #666; font-size: 11px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
              ${this.getModelDisplayName(problem.solution.modelUsed)}
            </span>
            ${problem.audioModel ? `<span style="color: #666; font-size: 11px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
              ${problem.audioModel}
            </span>` : ''}
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
        
        <div style="margin-top: 20px; display: flex; gap: 20px; align-items: center; justify-content: center;">
          <button class="btn btn-primary solution-action-btn" data-action="explain" title="Audio Explanation" style="width: 48px; height: 48px; padding: 0; font-size: 20px; border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative;">
            🔊
          </button>
          <button class="btn btn-primary solution-action-btn" data-action="discuss" title="Chat" style="background: linear-gradient(135deg, #34a853, #137333); width: 48px; height: 48px; padding: 0; font-size: 20px; border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative;">
            💬
          </button>
          <button class="btn btn-secondary solution-action-btn" data-action="copy" title="Copy" style="width: 48px; height: 48px; padding: 0; font-size: 20px; border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative;">
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
    // Get provider and authentication info
    const result = await chrome.storage.local.get([
      'aiProvider', 'aiApiKey', 'geminiApiKey', 'googleAuthToken'
    ]);
    
    const provider = result.aiProvider || 'openai';
    
    // Check authentication based on provider
    if (provider === 'openai' && !result.aiApiKey) {
      throw new Error('OpenAI API key required for audio explanation');
    } else if (provider === 'google' && !result.geminiApiKey && !result.googleAuthToken) {
      throw new Error('Google authentication required for audio explanation');
    }

    // Update progress
    this.updateRealProgress('🤔 Creating detailed explanation script...', 20);

    // Create detailed explanation script and get model info
    const scriptResult = await this.createDetailedExplanationScript();
    const explanationScript = scriptResult.script;
    const transcriptModelUsed = scriptResult.modelUsed;
    
    // Update progress - both providers now use Browser TTS
    this.updateRealProgress('🎤 Setting up Browser Speech Synthesis...', 60);

    // Generate audio using Browser TTS (same for both providers)
    let audioResult;
    if (provider === 'google') {
      audioResult = await this.generateGoogleAudio(explanationScript, result.geminiApiKey, result.googleAuthToken);
    } else {
      // Use Browser TTS for OpenAI as well (no cost, works great)
      audioResult = await this.generateBrowserTTSAudio(explanationScript);
    }
    
    // Update progress
    this.updateRealProgress('✅ Audio explanation complete!', 100);

    return {
      audioUrl: audioResult.audioUrl,
      audioBlob: audioResult.audioBlob,
      transcript: explanationScript,
      duration: audioResult.duration || (audioResult.audioBlob ? await this.getAudioDuration(audioResult.audioBlob) : 0),
      provider: provider,
      audioModel: audioResult.audioModel || this.getAudioModelName(provider),
      textModel: transcriptModelUsed || 'AI Model', // Include the model that generated the transcript
      isBrowserTTS: audioResult.isBrowserTTS || false, // Pass through Browser TTS flag
      speechText: audioResult.speechText, // Pass through speech text for Browser TTS
      selectedVoice: audioResult.selectedVoice // Pass through selected voice
    };
  }

  async createDetailedExplanationScript() {
    const problem = this.currentProblem;
    const solution = problem.solution;

    // Get provider info and transcript model preference
    const result = await chrome.storage.local.get(['aiProvider', 'aiApiKey', 'geminiApiKey', 'transcriptModel']);
    const provider = result.aiProvider || 'openai';
    const transcriptModel = result.transcriptModel || 'auto';

    // Prepare clean steps for AI processing
    const cleanSteps = solution.steps.map((step, index) => {
      const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
      return `Step ${index + 1}: ${cleanStep}`;
    }).join('\n');

    // Create prompt for script generation
    const prompt = `You are a friendly math tutor creating a spoken explanation. Given this math problem and its solution steps, write ONLY the words that should be spoken aloud - no music cues, no sound effects, no production notes.

Problem: ${problem.selectedText || 'Math problem from image'}
Solution Steps:
${cleanSteps}

Final Answer: ${solution.solution}

Write a spoken explanation that:
- Starts with a friendly greeting
- Explains each step clearly and WHY we do it
- Uses natural, conversational language like a patient tutor
- Ends with the final answer
- Contains ONLY spoken words (no music, sound effects, or production notes)

Make it educational and easy to understand for a ${await this.getDifficultyLevel()} student.

Example format:
"Hi there! Let's solve this math problem together. First, we need to..."

DO NOT include any music cues, sound effects, or production elements. Just the spoken words.`;

    try {
      // Determine which model to use based on user preference
      let scriptResult;
      if (provider === 'google') {
        scriptResult = await this.generateScriptWithGemini(prompt, result.geminiApiKey, transcriptModel);
      } else {
        scriptResult = await this.generateScriptWithOpenAI(prompt, result.aiApiKey, transcriptModel);
      }
      
      return {
        script: scriptResult.script || this.createFallbackScript(solution),
        modelUsed: scriptResult.modelUsed || '🤖 AI Model'
      };
    } catch (error) {
      console.warn('AI script generation failed, using fallback:', error.message);
      return {
        script: this.createFallbackScript(solution),
        modelUsed: '🤖 Fallback Script'
      };
    }
  }

  async getDifficultyLevel() {
    try {
      const result = await chrome.storage.local.get(['difficulty']);
      const difficulty = result.difficulty || 'middle';
      
      // Convert setting to descriptive text
      const difficultyMap = {
        'elementary': 'elementary school',
        'middle': 'middle school', 
        'high': 'high school',
        'college': 'college'
      };
      
      return difficultyMap[difficulty] || 'middle school';
    } catch (error) {
      return 'middle school'; // Fallback
    }
  }

  async generateScriptWithGemini(prompt, apiKey, transcriptModel = 'auto') {
    // Determine which Gemini model to use
    let modelName, modelDescription;
    
    if (transcriptModel === 'auto') {
      // Auto - use 1.5 Flash for reliability
      modelName = 'gemini-1.5-flash';
      modelDescription = 'Gemini 1.5 Flash (auto)';
    } else {
      // Use the specific model selected by user
      modelName = transcriptModel;
      
      // Get friendly name for display
      const modelMap = {
        'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
        'gemini-2.0-flash-exp': 'Gemini 2.0 Flash', 
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-1.0-pro': 'Gemini 1.0 Pro'
      };
      
      modelDescription = modelMap[modelName] || modelName;
    }
    
    console.log(`🤖 Generating script with ${modelDescription}...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini script generation failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      script: result.candidates[0]?.content?.parts[0]?.text,
      modelUsed: `🤖 ${modelDescription}`
    };
  }

  async generateScriptWithOpenAI(prompt, apiKey, transcriptModel = 'auto') {
    // Determine which OpenAI model to use
    let modelName, modelDescription;
    
    if (transcriptModel === 'auto') {
      // Auto - use 3.5-turbo for cost efficiency
      modelName = 'gpt-3.5-turbo';
      modelDescription = 'GPT-3.5-turbo (auto)';
    } else {
      // Use the specific model selected by user
      modelName = transcriptModel;
      
      // Get friendly name for display
      const modelMap = {
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o Mini',
        'gpt-3.5-turbo': 'GPT-3.5-turbo'
      };
      
      modelDescription = modelMap[modelName] || modelName;
    }
    
    console.log(`🤖 Generating script with ${modelDescription}...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI script generation failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      script: result.choices[0]?.message?.content,
      modelUsed: `🤖 ${modelDescription}`
    };
  }

  createFallbackScript(solution) {
    console.log('📝 Using fallback script generation...');
    
    // Simple fallback without hardcoded reasoning
    let script = `Hello! Let me walk you through this ${solution.type || 'math'} problem step by step.\n\n`;

    solution.steps.forEach((step, index) => {
      const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+:\s*/i, '');
      script += `Step ${index + 1}: ${cleanStep}\n\n`;
    });

    script += `And that gives us our final answer: ${solution.solution}.`;
    return script;
  }

  // Legacy function - now unused but kept for compatibility
  getStepReasoning(step, index, solution) {
    return 'this step moves us closer to the solution';
  }

  async generateGoogleAudio(text, geminiApiKey, googleAuthToken) {
    console.log('Setting up Browser Speech Synthesis for Google provider...');
    console.log('Text to speak:', text.substring(0, 100) + '...');
    
    // Use browser's Speech Synthesis API to generate actual audio
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech Synthesis not supported in this browser'));
        return;
      }

      // Wait for voices to load
      const waitForVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          generateAudio(voices);
        } else {
          speechSynthesis.onvoiceschanged = () => {
            const loadedVoices = speechSynthesis.getVoices();
            generateAudio(loadedVoices);
          };
          // Fallback timeout
          setTimeout(() => {
            const fallbackVoices = speechSynthesis.getVoices();
            generateAudio(fallbackVoices);
          }, 1000);
        }
      };

      const generateAudio = async (voices) => {
        try {
          console.log('🎤 Recording speech synthesis to audio file...');
          
          // Create utterance
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          utterance.lang = 'en-US';
          
          // Select a good voice
          const preferredVoice = voices.find(voice => 
            voice.lang.includes('en') && (
              voice.name.toLowerCase().includes('karen') ||
              voice.name.toLowerCase().includes('samantha') ||
              voice.name.toLowerCase().includes('female')
            )
          ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log('✅ Selected voice:', preferredVoice.name);
          }

          // Don't actually record or play speech during generation
          // Just prepare the configuration for later use
          console.log('✅ Returning Browser TTS configuration (no auto-play)');
          resolve({
            audioUrl: null, // No file, will use speech synthesis directly
            audioBlob: null,
            duration: Math.max(3, text.length / 12),
            audioModel: '🔊 Browser TTS',
            isBrowserTTS: true, // Flag to use speech synthesis controls
            speechText: text,
            transcript: text,
            selectedVoice: preferredVoice // Store the selected voice
          });
        } catch (error) {
          reject(error);
        }
      };

      waitForVoices();
    });
  }


  async generateBrowserTTSAudio(text) {
    console.log('Setting up Browser Speech Synthesis...');
    console.log('Text to speak:', text.substring(0, 100) + '...');
    
    // Use browser's Speech Synthesis API (same logic as Google but simpler)
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech Synthesis not supported in this browser'));
        return;
      }

      // Wait for voices to load
      const waitForVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          generateAudio(voices);
        } else {
          speechSynthesis.onvoiceschanged = () => {
            const loadedVoices = speechSynthesis.getVoices();
            generateAudio(loadedVoices);
          };
          // Fallback timeout
          setTimeout(() => {
            const fallbackVoices = speechSynthesis.getVoices();
            generateAudio(fallbackVoices);
          }, 1000);
        }
      };

      const generateAudio = async (voices) => {
        try {
          // Find a good quality voice
          const preferredVoice = voices.find(voice => 
            voice.lang.includes('en') && (
              voice.name.toLowerCase().includes('karen') ||
              voice.name.toLowerCase().includes('samantha') ||
              voice.name.toLowerCase().includes('female')
            )
          ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
          
          console.log('✅ Returning Browser TTS configuration (no auto-play)');
          
          resolve({
            audioUrl: null, // No file, will use speech synthesis directly
            audioBlob: null,
            duration: Math.max(3, text.length / 12),
            audioModel: '🔊 Browser TTS',
            isBrowserTTS: true, // Flag to use speech synthesis controls
            speechText: text,
            transcript: text,
            selectedVoice: preferredVoice // Store the selected voice
          });
        } catch (error) {
          console.error('❌ Browser TTS setup failed:', error);
          reject(error);
        }
      };

      waitForVoices();
    });
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

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl: audioUrl,
      audioBlob: audioBlob,
      duration: await this.getAudioDuration(audioBlob)
    };
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
    console.log('🎵 Displaying audio player for:', audioResult.audioModel);
    console.log('🎵 Audio result:', audioResult);
    console.log('🎵 Is Browser TTS:', audioResult.isBrowserTTS);
    
    // Store audio model info in current problem (but don't reload the page)
    if (this.currentProblem) {
      this.currentProblem.audioModel = audioResult.audioModel || this.getAudioModelName(audioResult.provider);
      
      // Update storage with audio model info
      chrome.storage.local.set({ currentProblem: this.currentProblem });
      
      // Don't call loadCurrentProblem() here as it reloads the entire page
    }
    
    const audioProgress = document.getElementById('audioProgress');
    if (audioProgress) {
      console.log('🎵 Found audioProgress element, replacing with audio player');
      const audioPlayerHTML = this.createAudioPlayerHTML(audioResult);
      console.log('🎵 Audio player HTML created');
      audioProgress.outerHTML = audioPlayerHTML;
      console.log('🎵 Progress UI replaced with audio player');
      
      // Initialize the audio player controls
      this.initializeAudioPlayer(audioResult);
      console.log('🎵 Audio player initialized successfully');
    } else {
      console.error('❌ audioProgress element not found - cannot replace progress UI');
    }
  }

  createAudioPlayerHTML(audioResult) {
    const audioModelName = audioResult.audioModel || this.getAudioModelName(audioResult.provider);
    const textModelName = this.getModelDisplayName(audioResult.textModel);
    
    return `
      <div class="audio-container" id="audioContainer">
        <div class="audio-header">
          <h3>🔊 Audio Explanation</h3>
          <p>Listen to a detailed walkthrough with reasoning for each step</p>
          <div style="margin-top: 5px; display: flex; gap: 8px; flex-wrap: wrap;">
            <span style="color: #666; font-size: 11px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
              ${textModelName}
            </span>
            <span style="color: #666; font-size: 11px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
              ${audioModelName}
            </span>
          </div>
        </div>
        
        ${audioResult.isBrowserTTS ? `
          <div style="background: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin: 20px 0; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <p style="margin: 0 0 15px 0; color: #666;">Browser Speech Synthesis</p>
              <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="speakBtn" class="btn btn-primary" style="font-size: 14px; padding: 10px 20px;">
                  ▶️ Play
                </button>
                <button id="pauseBtn" class="btn btn-secondary" style="font-size: 14px; padding: 10px 20px; display: none;">
                  ⏸️ Pause
                </button>
                <button id="resumeBtn" class="btn btn-secondary" style="font-size: 14px; padding: 10px 20px; display: none;">
                  ▶️ Resume
                </button>
                <button id="stopBtn" class="btn btn-secondary" style="font-size: 14px; padding: 10px 20px; display: none;">
                  ⏹️ Stop
                </button>
              </div>
              <div id="speechStatus" style="margin-top: 10px; font-size: 12px; color: #666;">
                Ready to play
              </div>
            </div>
            <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
              Uses your browser's speech synthesis
            </p>
          </div>
        ` : `
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
        `}
        
        <div class="audio-controls">
          <button class="btn btn-secondary" id="playFromStartBtn">
            ⏮️ Play from Start
          </button>
          <button class="btn btn-secondary" id="downloadAudioBtn">
            💾 ${audioResult.isBrowserTTS ? 'Download Transcript' : 'Download Audio'}
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
    if (audioResult.isBrowserTTS) {
      // Use simple browser TTS controls
      this.initializeSimpleBrowserTTS(audioResult);
    } else {
      // Use regular audio player for real audio files
      this.initializeRegularAudioPlayer(audioResult);
    }
  }

  initializeSimpleBrowserTTS(audioResult) {
    console.log('Initializing Browser TTS controls with play/pause/stop');
    
    const speakBtn = document.getElementById('speakBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const speechStatus = document.getElementById('speechStatus');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');
    
    let currentUtterance = null;
    
    // Helper function to update UI state
    const updateControls = (state) => {
      const hideAll = () => {
        speakBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
      };
      
      hideAll();
      
      switch (state) {
        case 'ready':
          speakBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Ready to play';
          break;
        case 'playing':
          pauseBtn.style.display = 'inline-block';
          stopBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Playing audio explanation...';
          break;
        case 'paused':
          resumeBtn.style.display = 'inline-block';
          stopBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Paused';
          break;
        case 'stopped':
          speakBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Stopped - Click Play to restart';
          break;
        case 'error':
          speakBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Error - Click to try again';
          break;
        default:
          // Fallback to ready state for any unknown state
          speakBtn.style.display = 'inline-block';
          if (speechStatus) speechStatus.textContent = 'Ready to play';
          break;
      }
    };
    
    // Play button
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        console.log('🔊 Play button clicked');
        
        // Cancel any existing speech
        speechSynthesis.cancel();
        
        // Create utterance
        currentUtterance = new SpeechSynthesisUtterance(audioResult.speechText || audioResult.transcript);
        currentUtterance.rate = 0.9;
        currentUtterance.pitch = 1.0;
        currentUtterance.volume = 1.0;
        currentUtterance.lang = 'en-US';
        
        // Use the pre-selected voice or find a good one
        const preferredVoice = audioResult.selectedVoice || (() => {
          const voices = speechSynthesis.getVoices();
          return voices.find(voice => 
            voice.lang.includes('en') && (
              voice.name.toLowerCase().includes('karen') ||
              voice.name.toLowerCase().includes('samantha') ||
              voice.name.toLowerCase().includes('female')
            )
          ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
        })();
        
        if (preferredVoice) {
          currentUtterance.voice = preferredVoice;
          console.log('Selected voice:', preferredVoice.name);
        }
        
        // Event handlers
        currentUtterance.onstart = () => {
          console.log('✅ Speech started');
          updateControls('playing');
        };
        
        currentUtterance.onend = () => {
          console.log('✅ Speech completed');
          // Only update to ready if we weren't manually stopped
          if (currentUtterance) {
            updateControls('ready');
            currentUtterance = null;
          }
        };
        
        currentUtterance.onerror = (e) => {
          console.error('❌ Speech failed:', e.error);
          updateControls('error');
          currentUtterance = null;
        };
        
        currentUtterance.onpause = () => {
          console.log('⏸️ Speech paused');
          updateControls('paused');
        };
        
        currentUtterance.onresume = () => {
          console.log('▶️ Speech resumed');
          updateControls('playing');
        };
        
        // Start speech
        speechSynthesis.speak(currentUtterance);
        console.log('Speech synthesis started');
      });
    }
    
    // Pause button
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        console.log('⏸️ Pause button clicked');
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
          speechSynthesis.pause();
        }
      });
    }
    
    // Resume button
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        console.log('▶️ Resume button clicked');
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      });
    }
    
    // Stop button
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        console.log('⏹️ Stop button clicked');
        currentUtterance = null; // Clear this first to prevent onend from overriding our state
        speechSynthesis.cancel();
        updateControls('stopped');
      });
    }
    
    // Initialize UI
    updateControls('ready');
    
    // Download transcript for Browser TTS
    if (downloadAudioBtn) {
      downloadAudioBtn.addEventListener('click', () => {
        console.log('📥 Download transcript for Browser TTS');
        const transcript = audioResult.transcript || 'Audio explanation transcript';
        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'math-explanation-transcript.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('✅ Transcript downloaded');
      });
    }
  }

  // This method is no longer used - keeping for compatibility
  initializeBrowserTTSControls(audioResult) {
    console.log('Browser TTS is deprecated - using simple TTS instead');
    this.initializeSimpleBrowserTTS(audioResult);
  }


  initializeRegularAudioPlayer(audioResult) {
    const audio = document.getElementById('audioPlayer');
    const playFromStartBtn = document.getElementById('playFromStartBtn');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');

    if (!audio) return;

    // Play from start functionality
    if (playFromStartBtn) {
      playFromStartBtn.addEventListener('click', () => {
        audio.currentTime = 0;
        audio.play();
      });
    }

    // Download audio functionality
    if (downloadAudioBtn) {
      downloadAudioBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = audioResult.audioUrl;
        const filename = audioResult.audioModel.includes('Google') ? 
          'math-explanation-google.mp3' : 'math-explanation-openai.mp3';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }

    // Auto-play for real audio files (OpenAI TTS only)
    if (audioResult.audioUrl) {
      audio.play().catch(e => {
        console.log('Audio auto-play prevented:', e);
      });
    }
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

  async initAutomaticScreenshot(tabId) {
    
    try {
      // Show processing state
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="empty-state">
          <div class="loading">
            <div class="spinner"></div>
            <h3>📸 Setting up screen capture...</h3>
            <p>Preparing automatic screenshot capture mode.</p>
          </div>
        </div>
      `;
      
      this.showStatus('📸 Setting up screen capture mode...', 'info');
      
      // Go directly to screenshot capture since direct selection already failed
      console.log('🔍 Attempting automatic screenshot capture...');
      await this.tryScreenshotCapture(tabId);
      console.log('✅ Automatic screenshot capture completed successfully');
      
    } catch (error) {
      console.error('Automatic screenshot capture failed:', error);
      console.log('Falling back to manual screen capture mode...');
      
      // Show screen capture mode regardless of the error
      this.showStatus('📸 Automatic capture failed - using manual screen capture mode...', 'info');
      
      // Add a small delay before showing manual mode
      setTimeout(() => {
        this.tryScreenCaptureAPI();
      }, 500);
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
      this.initAutomaticScreenshot(tab.id);
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
      this.initAutomaticScreenshot(tab.id);
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
        console.log('✅ Screenshot captured successfully, showing selection interface...');
        this.showPDFScreenshotSelection(screenshotData.imageData);
        this.showStatus('✅ Screenshot captured! Click and drag to select the math problem area.', 'success');
        return;
      } else {
        console.log('❌ Screenshot capture failed or returned invalid data:', screenshotData);
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
          <h2>Smart Capture Mode</h2>
          <p style="margin-bottom: 20px;">For PDFs, Google Docs, and other restricted content, screen capture provides reliable access:</p>
          
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
            2. Select the browser tab with your content<br>
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
            style="width: 100%; padding: 12px; font-size: 16px; background: linear-gradient(135deg, #ea4335, #d93025);"
            onclick="alert('Upload feature removed. Use screen capture instead by clicking the 📐 Select Problem button.')"
          >
            🚫 Upload Removed - Use Screen Capture
          </button>
        </div>
        
        <div style="margin-top: 20px;">
          <button class="btn btn-secondary" onclick="mathTutorPanel.initAutomaticScreenshot(${tabId})">
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

  getModelDisplayName(modelUsed) {
    // Map model names to display names with appropriate icons
    const modelMap = {
      // OpenAI Models
      'GPT-4o': '🚀 GPT-4o',
      'GPT-4V Vision': '👁️ GPT-4V Vision',
      'GPT-4o-mini': '⚡ GPT-4o-mini',
      'GPT-4': '📝 GPT-4',
      'gpt-4o': '🚀 GPT-4o',
      'gpt-4o-mini': '⚡ GPT-4o-mini',
      'gpt-4-vision-preview': '👁️ GPT-4V Vision',
      'gpt-4': '📝 GPT-4',
      
      // Google Gemini Models
      'gemini-2.5-flash-preview-05-20': '🌟 Gemini 2.5 Flash',
      'gemini-2.0-flash-exp': '⭐ Gemini 2.0 Flash',
      'gemini-1.5-flash': '💎 Gemini 1.5 Flash',
      'gemini-1.5-pro': '🧠 Gemini 1.5 Pro',
      'gemini-1.0-pro': '🤖 Gemini 1.0 Pro',
      'Gemini 2.5 Flash': '🌟 Gemini 2.5 Flash',
      'Gemini 2.0 Flash': '⭐ Gemini 2.0 Flash',
      'Gemini 1.5 Flash': '💎 Gemini 1.5 Flash',
      'Gemini 1.5 Pro': '🧠 Gemini 1.5 Pro',
      'Gemini 1.0 Pro': '🤖 Gemini 1.0 Pro',
      
      // Claude Models (future)
      'claude-3-opus': '🧭 Claude 3 Opus',
      'claude-3-sonnet': '📚 Claude 3 Sonnet',
      'claude-3-haiku': '🎋 Claude 3 Haiku'
    };
    
    // Return mapped name or fallback to the actual model name with a generic icon
    return modelMap[modelUsed] || `🤖 ${modelUsed || 'AI Model'}`;
  }

  getAudioModelName(provider) {
    // Return the audio model name based on provider - both now use Browser TTS
    if (provider === 'google') {
      return '🔊 Browser TTS'; // Using browser Speech Synthesis API
    } else if (provider === 'openai') {
      return '🔊 Browser TTS'; // Using browser Speech Synthesis API (no cost)
    } else {
      return '🔊 TTS';
    }
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Chat functionality
  setupChatHandlers() {
    // Chat close button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'chatClose' || e.target.id === 'chatOverlay') {
        this.closeChatWindow();
      }
    });

    // Chat send button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'chatSend') {
        this.sendChatMessage();
      }
    });

    // Chat input Enter key
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });

    // Auto-resize chat input
    document.addEventListener('input', (e) => {
      if (e.target.id === 'chatInput') {
        this.autoResizeChatInput(e.target);
      }
    });
  }

  openChatWindow() {
    if (!this.currentProblem || !this.currentProblem.solution) {
      alert('Please solve a problem first before discussing it.');
      return;
    }

    // Get current problem identifier
    const currentProblemId = this.getCurrentProblemId();
    
    // Reset chat session only if this is a different problem
    if (this.chatSession.currentProblemId !== currentProblemId) {
      this.resetChatSession();
      this.chatSession.currentProblemId = currentProblemId;
    }
    
    // Set up chat context
    this.chatSession.context = {
      problem: this.currentProblem.selectedText || this.currentProblem.problem || 'Math problem',
      solution: this.currentProblem.solution.solution || 'Solution provided',
      steps: this.currentProblem.solution.steps || [],
      explanation: this.currentProblem.solution.explanation || ''
    };

    // Restore chat history if any, or initialize new chat
    if (this.chatSession.messages.length === 0) {
      // New chat session - add solution summary and welcome message
      this.addSolutionSummary();
      this.addChatMessage('bot', `Hi! I'm here to help you understand this math problem. What would you like to know?`);
    } else {
      // Existing chat - restore history (which includes solution summary)
      this.restoreChatHistory();
    }

    // Update chat window header with model info
    this.updateChatHeader();

    // Show chat window
    document.getElementById('chatOverlay').style.display = 'block';
    document.getElementById('chatWindow').style.display = 'flex';
    document.getElementById('chatInput').focus();
    
    this.updateChatCounter();
  }

  closeChatWindow() {
    document.getElementById('chatOverlay').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'none';
  }

  resetChatSession() {
    this.chatSession.messages = [];
    this.chatSession.questionCount = 0;
    this.chatSession.currentProblemId = null;
    document.getElementById('chatMessages').innerHTML = '';
  }

  getCurrentProblemId() {
    // Create a unique identifier for the current problem based on its content
    const problemText = this.currentProblem.selectedText || this.currentProblem.problem || '';
    const solutionText = this.currentProblem.solution?.solution || '';
    return btoa(problemText + solutionText).substring(0, 20); // Base64 encode and truncate
  }

  restoreChatHistory() {
    // Clear the chat display first
    document.getElementById('chatMessages').innerHTML = '';
    
    // Always show solution summary first
    this.addSolutionSummary();
    
    // Re-display all messages from session
    this.chatSession.messages.forEach(msg => {
      this.displayChatMessage(msg.sender, msg.message);
    });
    
    // Update input state based on question count
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    
    if (this.chatSession.questionCount >= this.chatSession.maxQuestions) {
      input.disabled = true;
      sendBtn.disabled = true;
    } else {
      input.disabled = false;
      sendBtn.disabled = false;
    }
  }

  displayChatMessage(sender, message) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = `chat-avatar ${sender}`;
    avatar.textContent = sender === 'user' ? 'U' : 'AI';
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = message;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addSolutionSummary() {
    const messagesContainer = document.getElementById('chatMessages');
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'solution-summary';
    
    const solution = this.currentProblem.solution;
    const problem = this.currentProblem.selectedText || this.currentProblem.problem || 'Math problem';
    
    summaryDiv.innerHTML = `
      <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="font-weight: 600; color: #1976d2; margin-bottom: 12px; font-size: 14px;">📝 Problem & Solution</div>
        
        <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 500; color: #333; margin-bottom: 8px; font-size: 13px;">Problem:</div>
          <div style="color: #666; font-size: 13px; line-height: 1.4;">${problem}</div>
        </div>
        
        <div style="background: #e8f5e8; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #137333; margin-bottom: 8px; font-size: 13px;">✅ Answer:</div>
          <div style="color: #137333; font-weight: 500; font-size: 14px;">${solution.solution}</div>
        </div>
        
        ${solution.steps && solution.steps.length > 0 ? `
          <div style="background: white; border-radius: 8px; padding: 12px;">
            <div style="font-weight: 500; color: #333; margin-bottom: 10px; font-size: 13px;">🔢 Steps:</div>
            ${solution.steps.map((step, index) => `
              <div style="margin-bottom: 6px; display: flex; align-items: flex-start; gap: 8px;">
                <span style="background: #4285f4; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-top: 1px;">${index + 1}</span>
                <span style="color: #666; font-size: 13px; line-height: 1.4;">${step}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    messagesContainer.appendChild(summaryDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addChatMessage(sender, message) {
    // Display the message
    this.displayChatMessage(sender, message);
    
    // Store in session
    this.chatSession.messages.push({ sender, message, timestamp: Date.now() });
  }

  async sendChatMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    const message = input.value.trim();
    
    if (!message || this.chatSession.questionCount >= this.chatSession.maxQuestions) {
      return;
    }

    // Add user message
    this.addChatMessage('user', message);
    this.chatSession.questionCount++;
    
    // Clear input and disable send button
    input.value = '';
    sendBtn.disabled = true;
    this.autoResizeChatInput(input);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      // Get AI response
      const response = await this.getChatResponse(message);
      
      // Remove typing indicator and add response
      this.hideTypingIndicator();
      this.addChatMessage('bot', response);
      
    } catch (error) {
      console.error('Chat error:', error);
      this.hideTypingIndicator();
      this.addChatMessage('bot', 'Sorry, I encountered an error. Please try again.');
    }
    
    // Re-enable send button
    sendBtn.disabled = false;
    this.updateChatCounter();
    
    // Check if max questions reached
    if (this.chatSession.questionCount >= this.chatSession.maxQuestions) {
      setTimeout(() => {
        this.addChatMessage('bot', 'You\'ve reached the maximum number of questions for this session. Feel free to start a new problem to discuss more!');
        document.getElementById('chatInput').disabled = true;
        document.getElementById('chatSend').disabled = true;
      }, 1000);
    }
  }

  async getChatResponse(userMessage) {
    // Create chat prompt with problem context
    const contextPrompt = `You are helping a student understand a math problem. Here's the context:

Problem: ${this.chatSession.context.problem}

Solution: ${this.chatSession.context.solution}

Steps: ${this.chatSession.context.steps.join('; ')}

Explanation: ${this.chatSession.context.explanation}

Previous conversation:
${this.chatSession.messages.slice(-4).map(m => `${m.sender}: ${m.message}`).join('\n')}

Student's question: ${userMessage}

Please provide a helpful, educational response that helps the student understand the problem better. Keep your response concise (2-3 sentences) and focused on the student's specific question.`;

    // Get AI service settings
    const result = await chrome.storage.local.get([
      'aiProvider', 'aiApiKey', 'geminiApiKey', 'googleAuthToken'
    ]);
    
    const provider = result.aiProvider || 'openai';
    
    // Use the same AI service as the main problem solving
    if (provider === 'openai') {
      return await this.getChatResponseOpenAI(contextPrompt, result.aiApiKey);
    } else if (provider === 'google') {
      return await this.getChatResponseGemini(contextPrompt, result.geminiApiKey, result.googleAuthToken);
    } else {
      throw new Error('Unsupported AI provider for chat');
    }
  }

  async getChatResponseOpenAI(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful math tutor. Provide clear, concise explanations that help students understand math concepts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async getChatResponseGemini(prompt, apiKey, authToken) {
    const model = 'gemini-1.5-flash';
    let url;
    let headers = { 'Content-Type': 'application/json' };
    
    if (apiKey) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    } else if (authToken) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      throw new Error('No valid authentication for Gemini');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'chat-message bot';
    
    typingDiv.innerHTML = `
      <div class="chat-avatar bot">AI</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  updateChatCounter() {
    const remaining = this.chatSession.maxQuestions - this.chatSession.questionCount;
    document.getElementById('chatCounter').textContent = `Questions remaining: ${remaining}`;
  }

  updateChatHeader() {
    const chatTitle = document.getElementById('chatTitle') || document.querySelector('.chat-title');
    if (chatTitle) {
      const modelUsed = this.currentProblem.solution?.modelUsed || 'AI Model';
      chatTitle.innerHTML = `💬 Discuss Problem <span style="font-size: 12px; font-weight: 400; opacity: 0.8; margin-left: 8px;">${modelUsed}</span>`;
    }
  }

  autoResizeChatInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
}

// Initialize the side panel
const mathTutorPanel = new MathTutorSidePanel();
window.mathTutorPanel = mathTutorPanel;