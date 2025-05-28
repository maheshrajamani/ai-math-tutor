// Video Generation Service for AI Math Tutor
class VideoService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrames = [];
    this.audioContext = null;
  }

  async generateExplanationVideo(problemData) {
    try {
      // Initialize canvas for video generation
      this.initializeCanvas();
      
      // Generate video frames
      const frames = await this.createAnimationFrames(problemData);
      
      // Generate audio narration
      const audioBlob = await this.generateAudio(problemData);
      
      // Combine frames into video (simplified approach)
      const videoBlob = await this.createVideoFromFrames(frames);
      
      return {
        videoUrl: URL.createObjectURL(videoBlob),
        audioUrl: URL.createObjectURL(audioBlob),
        duration: frames.length * 100, // 100ms per frame
        transcript: this.generateTranscript(problemData)
      };
      
    } catch (error) {
      console.error('Error generating video:', error);
      throw error;
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

  async generateAudio(problemData) {
    try {
      // Use Web Speech API for text-to-speech
      const speechText = this.generateSpeechText(problemData);
      return await this.textToSpeech(speechText);
    } catch (error) {
      console.warn('Audio generation failed, creating silent audio:', error);
      return this.createSilentAudio(10); // 10 second silent audio
    }
  }

  generateSpeechText(problemData) {
    let speech = `Let's solve this ${problemData.type} problem step by step. `;
    speech += `The problem is: ${problemData.problem}. `;
    
    problemData.steps.forEach((step, index) => {
      speech += `Step ${index + 1}: ${step}. `;
    });
    
    speech += `Therefore, the answer is ${problemData.solution}. `;
    speech += `This demonstrates ${problemData.explanation}`;
    
    return speech;
  }

  async textToSpeech(text) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Record the speech (simplified - in production would use MediaRecorder)
      utterance.onend = () => {
        // For now, return a placeholder audio blob
        resolve(this.createSilentAudio(utterance.text.length * 0.1));
      };

      utterance.onerror = reject;
      speechSynthesis.speak(utterance);
    });
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

  async createVideoFromFrames(frames) {
    // Simplified video creation - in production would use WebCodecs or similar
    // For now, return the frames as a data structure that can be played back
    const videoData = {
      frames: frames,
      framerate: 10,
      width: this.canvas.width,
      height: this.canvas.height
    };
    
    return new Blob([JSON.stringify(videoData)], { type: 'application/json' });
  }

  generateTranscript(problemData) {
    return this.generateSpeechText(problemData);
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.VideoService = VideoService;
}