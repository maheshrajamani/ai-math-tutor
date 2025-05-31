// Configuration for AI Math Tutor
const CONFIG = {
  // OpenAI Configuration (recommended for math problems)
  OPENAI: {
    API_URL: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-4-vision-preview', // For handling images + text
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.1 // Lower temperature for more accurate math solutions
  },

  // Alternative: Claude Configuration  
  CLAUDE: {
    API_URL: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-3-sonnet-20240229',
    MAX_TOKENS: 1000
  },

  // Google Gemini Configuration
  GEMINI: {
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    AUTH_URL: 'https://oauth2.googleapis.com/token',
    SCOPES: ['https://www.googleapis.com/auth/cloud-platform'],
    MODELS: {
      'gemini-2.5-flash-preview-05-20': {
        name: 'Gemini 2.5 Flash',
        description: 'Latest preview model - use for very complex problems',
        supportsVision: true,
        recommended: true
      },
      'gemini-2.0-flash-exp': {
        name: 'Gemini 2.0 Flash',
        description: 'High performance model - best for most problems',
        supportsVision: true
      },
      'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient for most math problems',
        supportsVision: true
      },
      'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        description: 'Advanced reasoning for complex problems',
        supportsVision: true
      },
      'gemini-1.0-pro': {
        name: 'Gemini 1.0 Pro',
        description: 'Text-only model for simple problems',
        supportsVision: false
      }
    }
  },

  // Google Text-to-Speech Configuration
  GOOGLE_TTS: {
    API_URL: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    VOICES: {
      'en-US-Neural2-A': {
        name: 'US English Female (Neural)',
        languageCode: 'en-US',
        gender: 'FEMALE',
        recommended: true
      },
      'en-US-Neural2-C': {
        name: 'US English Male (Neural)',
        languageCode: 'en-US', 
        gender: 'MALE'
      },
      'en-US-Standard-A': {
        name: 'US English Female (Standard)',
        languageCode: 'en-US',
        gender: 'FEMALE'
      },
      'en-US-Standard-B': {
        name: 'US English Male (Standard)',
        languageCode: 'en-US',
        gender: 'MALE'
      }
    },
    AUDIO_CONFIG: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0
    }
  },

  // Text-to-Speech Configuration
  TTS: {
    OPENAI: {
      API_URL: 'https://api.openai.com/v1/audio/speech',
      VOICES: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      MODEL: 'tts-1',
      DEFAULT_VOICE: 'nova',
      FORMAT: 'mp3'
    },
    GOOGLE: {
      // Uses GOOGLE_TTS config above
      DEFAULT_VOICE: 'en-US-Neural2-A'
    }
  },

  // For video generation (placeholder - would use services like D-ID, Synthesia, etc.)
  VIDEO_GENERATION: {
    PROVIDER: 'custom', // 'dideo', 'synthesia', 'custom'
    API_URL: 'https://api.example.com/generate-video'
  },

  // Prompts for different math problem types
  PROMPTS: {
    SOLVE_PROBLEM: `You are an expert math tutor. Analyze this math problem and provide:
1. The final answer
2. Step-by-step solution
3. Brief explanation of the concept used

Format your response as JSON:
{
  "type": "algebra|geometry|calculus|arithmetic|other",
  "problem": "description of the problem",
  "solution": "final answer",
  "steps": ["step 1", "step 2", "step 3"],
  "explanation": "brief explanation of concepts"
}

If there's an image, carefully analyze any diagrams, equations, or mathematical notation shown.`,

    EXPLAIN_VIDEO: `Create a script for a step-by-step video explanation of this math problem. 
Include:
- Clear narration for each step
- Visual cues for animations
- Time stamps for key moments
- Emphasis on important concepts

The explanation should be suitable for students and easy to follow.`
  }
};

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}