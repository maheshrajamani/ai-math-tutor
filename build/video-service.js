// Video Generation Service for AI Math Tutor
class VideoService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrames = [];
    this.audioContext = null;
    this.apiKey = null;
    this.frameRate = 30; // 30 FPS for smooth video
    this.videoDuration = 0;
  }
  async generateExplanationVideo(problemData, progressCallback) {
    try {
      // Get API key for TTS
      if (progressCallback) progressCallback('Initializing...', 5);
      await this.initializeApiKey();
      // Initialize canvas for video generation
      if (progressCallback) progressCallback('Setting up video canvas...', 10);
      this.initializeCanvas();
      // Generate high-quality audio first
      if (progressCallback) progressCallback('🎤 Generating professional audio narration...', 20);
      const audioData = await this.generateHighQualityAudio(problemData);
      // Generate video frames synchronized with audio
      if (progressCallback) progressCallback('🎨 Creating synchronized visual frames...', 40);
      const frames = await this.createSynchronizedFrames(problemData, audioData, progressCallback);
      // Create video and audio
      if (progressCallback) progressCallback('🎬 Finalizing video and audio...', 80);
      const videoResult = await this.createRealVideo(frames, audioData);
      if (progressCallback) progressCallback('✅ Video generation complete!', 100);
      return {
        videoUrl: URL.createObjectURL(videoResult.videoBlob),
        audioUrl: URL.createObjectURL(videoResult.audioBlob),
        hasAudio: videoResult.hasAudio,
        duration: this.videoDuration,
        transcript: audioData.transcript,
        chapters: this.generateChapters(problemData),
        type: 'video/webm'
      };
    } catch (error) {
      console.error('Error generating video:', error);
      throw error;
    }
  }
  async initializeApiKey() {
    const result = await chrome.storage.local.get(['aiApiKey']);
    this.apiKey = result.aiApiKey;
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for video generation');
    }
  }
  initializeCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.ctx = this.canvas.getContext('2d');
    // Set up canvas styling
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#333';
  }
  async createAnimationFrames(problemData) {
    const frames = [];
    const stepsPerSecond = 10; // 10 frames per second
    // Title frame
    frames.push(...this.createTitleFrames(problemData));
    // Problem presentation frames
    frames.push(...this.createProblemFrames(problemData));
    // Step-by-step solution frames
    for (let i = 0; i < problemData.steps.length; i++) {
      frames.push(...this.createStepFrames(problemData.steps[i], i + 1, problemData.steps.length));
    }
    // Final answer frames
    frames.push(...this.createAnswerFrames(problemData));
    return frames;
  }
  createTitleFrames(problemData) {
    const frames = [];
    const frameCount = 30; // 3 seconds at 10fps
    for (let i = 0; i < frameCount; i++) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Background gradient
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#4285f4');
      gradient.addColorStop(1, '#34a853');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Title text with fade-in effect
      const alpha = Math.min(i / 15, 1);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🧮 AI Math Tutor', this.canvas.width / 2, this.canvas.height / 2 - 50);
      this.ctx.font = '24px Arial';
      this.ctx.fillText(`Solving: ${problemData.type} problem`, this.canvas.width / 2, this.canvas.height / 2 + 20);
      frames.push(this.canvas.toDataURL());
    }
    return frames;
  }
  createProblemFrames(problemData) {
    const frames = [];
    const frameCount = 40; // 4 seconds
    for (let i = 0; i < frameCount; i++) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // White background
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Problem title
      this.ctx.fillStyle = '#333';
      this.ctx.font = 'bold 32px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Problem:', this.canvas.width / 2, 80);
      // Problem text with typewriter effect
      const text = problemData.problem;
      const visibleChars = Math.min(Math.floor((i / frameCount) * text.length), text.length);
      const visibleText = text.substring(0, visibleChars);
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'left';
      this.wrapText(visibleText, 50, 150, this.canvas.width - 100, 32);
      frames.push(this.canvas.toDataURL());
    }
    return frames;
  }
  createStepFrames(step, stepNumber, totalSteps) {
    const frames = [];
    const frameCount = 50; // 5 seconds per step
    for (let i = 0; i < frameCount; i++) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Background
      this.ctx.fillStyle = '#f8f9fa';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Step header
      this.ctx.fillStyle = '#4285f4';
      this.ctx.fillRect(0, 0, this.canvas.width, 80);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 28px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Step ${stepNumber} of ${totalSteps}`, this.canvas.width / 2, 50);
      // Step content with slide-in animation
      const slideProgress = Math.min(i / 20, 1);
      const xOffset = (1 - slideProgress) * 100;
      this.ctx.fillStyle = '#333';
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'left';
      this.wrapText(step, 50 + xOffset, 150, this.canvas.width - 100, 32);
      // Progress bar
      this.ctx.fillStyle = '#e0e0e0';
      this.ctx.fillRect(50, this.canvas.height - 50, this.canvas.width - 100, 10);
      this.ctx.fillStyle = '#34a853';
      const progressWidth = ((stepNumber - 1 + slideProgress) / totalSteps) * (this.canvas.width - 100);
      this.ctx.fillRect(50, this.canvas.height - 50, progressWidth, 10);
      frames.push(this.canvas.toDataURL());
    }
    return frames;
  }
  createAnswerFrames(problemData) {
    const frames = [];
    const frameCount = 40; // 4 seconds
    for (let i = 0; i < frameCount; i++) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Celebration background
      this.ctx.fillStyle = '#e8f5e8';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Answer box with bounce animation
      const bounceScale = 1 + 0.1 * Math.sin((i / 10) * Math.PI);
      const boxWidth = 400 * bounceScale;
      const boxHeight = 100 * bounceScale;
      const boxX = (this.canvas.width - boxWidth) / 2;
      const boxY = (this.canvas.height - boxHeight) / 2;
      // Answer box
      this.ctx.fillStyle = '#34a853';
      this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      // Answer text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 36px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Answer:', this.canvas.width / 2, boxY + 35);
      this.ctx.fillText(problemData.solution, this.canvas.width / 2, boxY + 75);
      // Confetti effect (simple)
      if (i > 10) {
        this.drawConfetti(i - 10);
      }
      frames.push(this.canvas.toDataURL());
    }
    return frames;
  }
  drawConfetti(frame) {
    const confettiCount = 20;
    for (let i = 0; i < confettiCount; i++) {
      const x = (i * 40 + frame * 5) % this.canvas.width;
      const y = (frame * 3 + i * 20) % this.canvas.height;
      const color = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'][i % 4];
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, 8, 8);
    }
  }
  wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        this.ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, x, currentY);
  }
  async generateHighQualityAudio(problemData) {
    try {
      // Create detailed script with timing
      const script = this.createDetailedScript(problemData);
      // Generate audio using OpenAI TTS
      const audioBlob = await this.generateOpenAIAudio(script.text);
      // Calculate audio duration and timing
      const audioDuration = await this.getAudioDuration(audioBlob);
      this.videoDuration = audioDuration;
      return {
        audioBlob: audioBlob,
        duration: audioDuration,
        script: script,
        transcript: script.text,
        segments: script.segments
      };
    } catch (error) {
      console.warn('High-quality audio generation failed, using fallback:', error);
      return await this.generateFallbackAudio(problemData);
    }
  }
  createDetailedScript(problemData) {
    const segments = [];
    let currentTime = 0;
    // Introduction (3 seconds)
    const intro = `Hello! Let's solve this ${problemData.type} problem step by step.`;
    segments.push({
      text: intro,
      startTime: currentTime,
      duration: 3,
      type: 'intro'
    });
    currentTime += 3;
    // Problem statement (4 seconds)
    const problemText = `The problem is: ${problemData.problem}`;
    segments.push({
      text: problemText,
      startTime: currentTime,
      duration: 4,
      type: 'problem'
    });
    currentTime += 4;
    // Steps (5 seconds each)
    problemData.steps.forEach((step, index) => {
      const stepText = `Step ${index + 1}: ${step}`;
      segments.push({
        text: stepText,
        startTime: currentTime,
        duration: 5,
        type: 'step',
        stepNumber: index + 1
      });
      currentTime += 5;
    });
    // Final answer (3 seconds)
    const conclusion = `Therefore, the answer is ${problemData.solution}. This demonstrates ${problemData.explanation}`;
    segments.push({
      text: conclusion,
      startTime: currentTime,
      duration: 3,
      type: 'conclusion'
    });
    currentTime += 3;
    const fullText = segments.map(s => s.text).join(' ');
    return {
      text: fullText,
      segments: segments,
      totalDuration: currentTime
    };
  }
  async generateOpenAIAudio(text) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1-hd', // High-definition model
        input: text,
        voice: 'nova', // Clear, friendly voice
        response_format: 'mp3',
        speed: 0.9 // Slightly slower for educational content
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
  async generateFallbackAudio(problemData) {
    const script = this.createDetailedScript(problemData);
    const silentAudio = this.createSilentAudio(script.totalDuration);
    return {
      audioBlob: silentAudio,
      duration: script.totalDuration,
      script: script,
      transcript: script.text,
      segments: script.segments
    };
  }
  createSilentAudio(duration) {
    // Create a silent audio blob
    const sampleRate = 44100;
    const numChannels = 1;
    const numSamples = sampleRate * duration;
    const arrayBuffer = new ArrayBuffer(numSamples * 2);
    const dataView = new DataView(arrayBuffer);
    // Silent audio (all zeros)
    for (let i = 0; i < numSamples; i++) {
      dataView.setInt16(i * 2, 0, true);
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  async createSynchronizedFrames(problemData, audioData, progressCallback) {
    const frames = [];
    const totalFrames = Math.ceil(audioData.duration * this.frameRate);
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const currentTime = frameIndex / this.frameRate;
      const currentSegment = this.getCurrentSegment(currentTime, audioData.segments);
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Draw frame based on current segment
      this.drawFrameForSegment(currentSegment, currentTime, problemData);
      // Convert canvas to data URL
      frames.push(this.canvas.toDataURL('image/jpeg', 0.8));
      // Progress indicator with callback
      if (frameIndex % Math.floor(totalFrames / 10) === 0 && progressCallback) {
        const frameProgress = Math.round((frameIndex / totalFrames) * 100);
        const overallProgress = 40 + (frameProgress * 0.3); // 40-70% range for frame generation
        progressCallback(`🎨 Creating frames... ${frameProgress}%`, overallProgress);
      }
    }
    return frames;
  }
  getCurrentSegment(time, segments) {
    return segments.find(segment => 
      time >= segment.startTime && time < segment.startTime + segment.duration
    ) || segments[0];
  }
  drawFrameForSegment(segment, currentTime, problemData) {
    switch (segment.type) {
      case 'intro':
        this.drawIntroFrame(segment, currentTime);
        break;
      case 'problem':
        this.drawProblemFrame(segment, currentTime, problemData);
        break;
      case 'step':
        this.drawStepFrame(segment, currentTime, problemData);
        break;
      case 'conclusion':
        this.drawConclusionFrame(segment, currentTime, problemData);
        break;
    }
  }
  drawIntroFrame(segment, currentTime) {
    // Background gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#4285f4');
    gradient.addColorStop(1, '#34a853');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Animated title
    const progress = (currentTime - segment.startTime) / segment.duration;
    const scale = 0.8 + 0.2 * Math.sin(progress * Math.PI * 2);
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🧮 AI Math Tutor', 0, -30);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Step-by-Step Solutions', 0, 20);
    this.ctx.restore();
  }
  drawProblemFrame(segment, currentTime, problemData) {
    // Clean white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Header bar
    this.ctx.fillStyle = '#4285f4';
    this.ctx.fillRect(0, 0, this.canvas.width, 80);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 32px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Problem', this.canvas.width / 2, 50);
    // Problem text with typewriter effect
    const progress = (currentTime - segment.startTime) / segment.duration;
    const text = problemData.problem;
    const visibleChars = Math.min(Math.floor(progress * text.length), text.length);
    const visibleText = text.substring(0, visibleChars);
    this.ctx.fillStyle = '#333';
    this.ctx.font = '28px Arial';
    this.ctx.textAlign = 'left';
    this.wrapText(visibleText, 50, 150, this.canvas.width - 100, 40);
  }
  drawStepFrame(segment, currentTime, problemData) {
    // Light background
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Step header
    this.ctx.fillStyle = '#34a853';
    this.ctx.fillRect(0, 0, this.canvas.width, 80);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Step ${segment.stepNumber} of ${problemData.steps.length}`, this.canvas.width / 2, 50);
    // Step content with fade-in animation
    const progress = (currentTime - segment.startTime) / segment.duration;
    const alpha = Math.min(progress * 2, 1);
    this.ctx.fillStyle = `rgba(51, 51, 51, ${alpha})`;
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'left';
    const stepText = problemData.steps[segment.stepNumber - 1];
    this.wrapText(stepText, 50, 150, this.canvas.width - 100, 35);
    // Progress bar
    this.drawProgressBar(segment.stepNumber, problemData.steps.length, progress);
  }
  drawConclusionFrame(segment, currentTime, problemData) {
    // Success background
    this.ctx.fillStyle = '#e8f5e8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Animated answer box
    const progress = (currentTime - segment.startTime) / segment.duration;
    const bounce = 1 + 0.1 * Math.sin(progress * Math.PI * 4);
    const boxWidth = 500;
    const boxHeight = 120;
    const boxX = (this.canvas.width - boxWidth) / 2;
    const boxY = (this.canvas.height - boxHeight) / 2;
    this.ctx.save();
    this.ctx.translate(boxX + boxWidth/2, boxY + boxHeight/2);
    this.ctx.scale(bounce, bounce);
    this.ctx.translate(-boxWidth/2, -boxHeight/2);
    // Answer box
    this.ctx.fillStyle = '#34a853';
    this.ctx.fillRect(0, 0, boxWidth, boxHeight);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Final Answer:', boxWidth/2, 30);
    this.ctx.font = 'bold 36px Arial';
    this.ctx.fillText(problemData.solution, boxWidth/2, 75);
    this.ctx.restore();
    // Celebration particles
    if (progress > 0.5) {
      this.drawCelebrationEffects(progress - 0.5);
    }
  }
  drawProgressBar(currentStep, totalSteps, stepProgress) {
    const barX = 50;
    const barY = this.canvas.height - 60;
    const barWidth = this.canvas.width - 100;
    const barHeight = 12;
    // Background
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);
    // Progress
    this.ctx.fillStyle = '#34a853';
    const progressWidth = ((currentStep - 1 + stepProgress) / totalSteps) * barWidth;
    this.ctx.fillRect(barX, barY, progressWidth, barHeight);
    // Progress text
    this.ctx.fillStyle = '#666';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${currentStep} / ${totalSteps}`, this.canvas.width / 2, barY + 35);
  }
  drawCelebrationEffects(progress) {
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * this.canvas.width;
      const y = progress * this.canvas.height + Math.random() * 100;
      const size = 4 + Math.random() * 6;
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
      this.ctx.fillStyle = colors[i % colors.length];
      this.ctx.fillRect(x, y, size, size);
    }
  }
  async createRealVideo(frames, audioData) {
    // For now, return video and audio separately to ensure they work
    // We'll combine them in the video player using HTML5 video element
    const videoBlob = await this.createVideoOnlyBlob(frames);
    return {
      videoBlob: videoBlob,
      audioBlob: audioData.audioBlob,
      hasAudio: true
    };
  }
  async createVideoOnlyBlob(frames) {
    // Create a simple video from frames using canvas and MediaRecorder
    const stream = this.canvas.captureStream(this.frameRate);
    return new Promise((resolve, reject) => {
      const chunks = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp9'
      });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        resolve(videoBlob);
      };
      mediaRecorder.onerror = reject;
      // Start recording and play frames
      mediaRecorder.start();
      this.playFramesForRecording(frames, this.videoDuration).then(() => {
        mediaRecorder.stop();
      });
    });
  }
  async playFramesForRecording(frames, duration) {
    const frameInterval = duration * 1000 / frames.length;
    for (let i = 0; i < frames.length; i++) {
      const img = new Image();
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = frames[i];
      await new Promise(resolve => setTimeout(resolve, frameInterval));
    }
  }
  generateChapters(problemData) {
    const chapters = [
      { title: "Introduction", time: 0 },
      { title: "Problem Statement", time: 3 }
    ];
    let currentTime = 7;
    problemData.steps.forEach((step, index) => {
      chapters.push({
        title: `Step ${index + 1}`,
        time: currentTime
      });
      currentTime += 5;
    });
    chapters.push({
      title: "Final Answer",
      time: currentTime
    });
    return chapters;
  }
  generateTranscript(problemData) {
    return this.generateSpeechText(problemData);
  }
}
// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.VideoService = VideoService;
}