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
        this.forceReloadProblem();
      });
    }
    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
      debugBtn.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['currentProblem']);
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
        // Force reload from storage instead of just updating
        this.forceReloadProblem();
      }
    });
  }
  setupStorageListener() {
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.currentProblem) {
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
      const result = await chrome.storage.local.get(['currentProblem']);
      if (result.currentProblem) {
        this.currentProblem = result.currentProblem;
        this.displayProblem();
      }
    } catch (error) {
      console.error('Error force reloading problem:', error);
    }
  }
  displayProblem() {
    if (!this.currentProblem) {
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
        });
      }
      playPauseBtn.textContent = '⏸️';
    }).catch(e => {
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
    let script = `Hello! Let me walk you through this ${solution.type || 'math'} problem step by step, explaining not just what to do, but why we do each step.\n\n`;
    script += `Here's how we approach this systematically:\n\n`;
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
        model: 'tts-1-hd',
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