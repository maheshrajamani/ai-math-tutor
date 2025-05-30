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