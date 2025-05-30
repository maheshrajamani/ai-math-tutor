// AI Service for Math Problem Solving
class AIService {
  constructor() {
    this.apiKey = null;
    this.provider = 'openai'; // Default provider
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.rateLimitReset = 0;
  }

  async initialize() {
    // Get API key and settings from Chrome storage
    const result = await chrome.storage.local.get(['aiApiKey', 'aiProvider', 'useVision']);
    this.apiKey = result.aiApiKey;
    this.provider = result.aiProvider || 'openai';
    this.useVision = result.useVision || 'auto';
  }

  async solveMathProblem(imageData, selectedText) {
    await this.initialize();

    if (!this.apiKey) {
      throw new Error('API key not configured. Please set your OpenAI API key in the extension settings.');
    }

    // Child Safety: Pre-filter content before sending to AI
    const contentCheck = this.isContentAppropriate(selectedText, imageData);
    if (!contentCheck.isAppropriate) {
      console.log('🛡️ Child Safety Filter: Content blocked -', contentCheck.reason);
      return {
        type: 'safe_response',
        problem: 'Non-mathematical content detected',
        solution: 'I am not aware of what you are asking',
        steps: ['This extension only helps with math problems'],
        explanation: 'Please select a mathematical problem to solve.',
        usedVision: false,
        isError: false,
        filtered: true,
        reason: contentCheck.reason
      };
    }
    console.log('✅ Child Safety Filter: Content approved -', contentCheck.reason);

    // Basic rate limiting (2 seconds between requests)
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < 2000) {
      const waitTime = 2000 - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();

    try {
      switch (this.provider) {
        case 'openai':
          return await this.solveWithOpenAI(imageData, selectedText);
        case 'claude':
          return await this.solveWithClaude(imageData, selectedText);
        default:
          throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      
      throw error;
    }
  }

  async solveWithOpenAI(imageData, selectedText) {
    const modelChoice = this.decideModel(imageData, selectedText);
    
    switch (modelChoice) {
      case 'vision':
        return await this.solveWithVision(imageData, selectedText);
      case 'gpt4o':
        return await this.solveWithGPT4o(imageData, selectedText);
      case 'mini':
        return await this.solveWithMini(selectedText);
      case 'text':
      default:
        return await this.solveTextOnly(selectedText);
    }
  }

  decideModel(imageData, selectedText) {
    switch (this.useVision) {
      case 'vision':
        return 'vision';
      case 'gpt4o':
        return 'gpt4o';
      case 'text':
        // For uploaded images, override text setting to use vision
        if (imageData && selectedText && selectedText.includes('uploaded image:')) {
          return 'gpt4o';
        }
        return 'text';
      case 'mini':
        // For uploaded images, override mini setting to use vision
        if (imageData && selectedText && selectedText.includes('uploaded image:')) {
          return 'gpt4o';
        }
        return 'mini';
      case 'auto':
      default:
        // Smart auto selection
        if (!imageData) {
          return 'mini';
        }
        
        // Check if this is an uploaded image (which always needs vision)
        const isUploadedImage = selectedText && selectedText.includes('uploaded image:');
        
        if (isUploadedImage) {
          return 'gpt4o'; // Use GPT-4o for uploaded images
        }
        
        // Check if text extraction seems complete
        const hasGoodText = selectedText && 
                           selectedText.length > 30 && 
                           selectedText.includes('?') &&
                           selectedText.split(' ').length > 8;
        
        if (hasGoodText) {
          return 'mini';
        } else {
          return 'vision';
        }
    }
  }

  async solveWithVision(imageData, selectedText) {
    const messages = [
      {
        role: "system",
        content: `You are a math tutor with vision capabilities designed for children. Focus on mathematical problems and educational content.

CHILD-FRIENDLY GUIDELINES:
- Use age-appropriate language suitable for students
- If the content is not a math problem, please respond: "I am not aware of what you are asking"
- Maintain educational focus and avoid inappropriate content

CRITICAL INSTRUCTIONS:
- For geometry problems (circles, triangles, etc.), pay careful attention to π symbols and geometric formulas
- Circle area = πr² (where r is radius, and radius = diameter ÷ 2)
- Look at the image for any π symbols that might not be in the text
- If you see numerical options like "8, 16, 64, 128, 256" for a circle area problem, these likely have π units

For multiple choice questions:
- Look at the image for diagrams, graphs, or visual elements, especially π symbols
- Work through the problem step by step to get the numerical answer FIRST
- AFTER calculating, look at ALL the given options (A, B, C, D, E) carefully
- Find which option matches your calculated answer EXACTLY
- Format solution as "The answer is [LETTER]: [CALCULATED_VALUE]" 
- CRITICAL: The value after the colon must be your calculated answer, which should match one of the given options
- Double-check that your selected option letter corresponds to the value you calculated
- If your calculation gives x=22 and option D=22, then write "The answer is D: 22"

For non-multiple choice:
- Provide the numerical or algebraic answer

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY valid JSON, no markdown code blocks or extra text
- For multiple choice: solution field must be "The answer is [LETTER]: [CALCULATED_VALUE]" 
- Steps should be clean sentences without numbering (numbering will be added automatically)
- USE HUMAN-READABLE MATH SYMBOLS: √ instead of sqrt(), ² ³ instead of ^2 ^3, π instead of pi, × instead of *, ÷ instead of /, ± instead of +/-, ≤ ≥ instead of <= >=, ≠ instead of !=, ∞ instead of infinity, use ½ ¼ ¾ or "3/4" instead of frac{3}{4}

Response format:
{
  "problem": "the question text",
  "solution": "final answer with letter choice if multiple choice",
  "steps": ["step without number", "another step without number"],
  "explanation": "brief concept explanation",
  "type": "multiple_choice" or "open_ended"
}`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: selectedText ? 
              `I've selected this math problem. The extracted text is: "${selectedText}". 

IMPORTANT: Please also analyze the image carefully for:
- Any π symbols that might be missing from the text
- Mathematical notation that wasn't captured in text extraction
- Diagrams, graphs, or visual elements
- Multiple choice options with proper mathematical symbols

If this is a geometry problem about circles, triangles, etc., make sure to look for π symbols in the image even if they're not in the extracted text.` :
              "Please solve this math problem from the image. Look for the question, any diagrams, mathematical symbols (especially π), and multiple choice options if present."
          },
          {
            type: "image_url",
            image_url: {
              url: imageData,
              detail: "high"
            }
          }
        ]
      }
    ];

    const response = await fetch(CONFIG.OPENAI.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview', // Use vision model
        messages: messages,
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle rate limiting specifically
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      
      // Handle other API errors
      const errorMessage = error.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI Vision API error: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent);
      result.usedVision = true; // Mark that vision model was used
      result.modelUsed = 'GPT-4V Vision';
      return result;
    } catch (e) {
      console.error('Failed to parse JSON from GPT-4V response:', e);
      console.error('Original content:', content);
      // If not JSON, create a structured response
      const result = this.parseUnstructuredResponse(content, selectedText || 'Math problem from image');
      result.usedVision = true;
      result.modelUsed = 'GPT-4V Vision';
      return result;
    }
  }

  async solveWithGPT4o(imageData, selectedText) {
    console.log('Making API call to GPT-4o');
    
    const messages = [
      {
        role: "system",
        content: `You are a math tutor with vision capabilities using GPT-4o designed for children. Focus on mathematical problems and educational content.

CHILD-FRIENDLY GUIDELINES:
- Use age-appropriate language suitable for students
- If the content is not a math problem, please respond: "I am not aware of what you are asking"
- Maintain educational focus and avoid inappropriate content

MOST IMPORTANT RULE: NEVER change your mathematically correct answer to force it to match a multiple choice option. Trust your calculations.

CRITICAL INSTRUCTIONS:
- For geometry problems (circles, triangles, etc.), pay careful attention to π symbols and geometric formulas
- Circle area = πr² (where r is radius, and radius = diameter ÷ 2)
- Look at the image for any π symbols that might not be in the text
- If you see numerical options like "8, 16, 64, 128, 256" for a circle area problem, these likely have π units

For multiple choice questions:
- Look at the image for diagrams, graphs, or visual elements, especially π symbols
- Work through the problem step by step to get the numerical answer FIRST
- AFTER calculating, look at ALL the given options (A, B, C, D, E) carefully
- Find which option matches your calculated answer EXACTLY
- Format solution as "The answer is [LETTER]: [CALCULATED_VALUE]" 
- CRITICAL: The value after the colon must be your calculated answer, which should match one of the given options
- Double-check that your selected option letter corresponds to the value you calculated
- If your calculation gives x=22 and option D=22, then write "The answer is D: 22"

For non-multiple choice:
- Provide the numerical or algebraic answer

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY valid JSON, no markdown code blocks or extra text
- For multiple choice: solution field must be "The answer is [LETTER]: [CALCULATED_VALUE]" 
- Steps should be clean sentences without numbering (numbering will be added automatically)
- USE HUMAN-READABLE MATH SYMBOLS: √ instead of sqrt(), ² ³ instead of ^2 ^3, π instead of pi, × instead of *, ÷ instead of /, ± instead of +/-, ≤ ≥ instead of <= >=, ≠ instead of !=, ∞ instead of infinity, use ½ ¼ ¾ or "3/4" instead of frac{3}{4}

Response format:
{
  "problem": "the question text",
  "solution": "final answer with letter choice if multiple choice",
  "steps": ["step without number", "another step without number"],
  "explanation": "brief concept explanation",
  "type": "multiple_choice" or "open_ended"
}`
      },
      {
        role: "user",
        content: imageData ? [
          {
            type: "text",
            text: selectedText ? 
              `I've selected this math problem. The extracted text is: "${selectedText}". 

IMPORTANT: Please also analyze the image carefully for:
- Any π symbols that might be missing from the text
- Mathematical notation that wasn't captured in text extraction
- Diagrams or graphs that provide crucial information

Please solve this step by step.` :
              `I've selected this math problem from the image. Please analyze the image carefully and solve the problem step by step.`
          },
          {
            type: "image_url",
            image_url: {
              url: imageData,
              detail: "high"
            }
          }
        ] : [
          {
            type: "text",
            text: `Solve this math problem: ${selectedText}`
          }
        ]
      }
    ];

    const response = await fetch(CONFIG.OPENAI.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      // Handle rate limiting specifically
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      
      const errorText = await response.text();
      console.error('GPT-4o API Error:', errorText);
      throw new Error(`GPT-4o API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('=== RAW GPT-4o RESPONSE ===');
    console.log(content);
    console.log('=== END RAW RESPONSE ===');

    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('=== CLEANED CONTENT ===');
      console.log(cleanContent);
      console.log('=== END CLEANED ===');
      
      const result = JSON.parse(cleanContent);
      
      console.log('=== PARSED RESULT ===');
      console.log('Solution:', result.solution);
      console.log('Steps:', result.steps);
      console.log('=== END PARSED ===');
      
      result.usedVision = true; // Mark that vision model was used
      result.modelUsed = 'GPT-4o';
      return result;
    } catch (e) {
      console.error('Failed to parse JSON from GPT-4o response:', e);
      console.error('Original content:', content);
      // If not JSON, create a structured response
      const result = this.parseUnstructuredResponse(content, selectedText || 'Math problem from image');
      result.usedVision = true;
      result.modelUsed = 'GPT-4o';
      return result;
    }
  }

  async solveWithMini(selectedText) {
    const response = await fetch(CONFIG.OPENAI.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "system",
            content: `You are an expert math tutor designed for children. Focus on mathematical problems and educational content.

CHILD-FRIENDLY GUIDELINES:
- Use age-appropriate language suitable for students
- If the content is not a math problem, please respond: "I am not aware of what you are asking"
- Maintain educational focus and avoid inappropriate content

Solve the given math problem step by step with high accuracy.

CRITICAL INSTRUCTIONS for geometry problems:
- Circle area = πr² (where r is radius, and radius = diameter ÷ 2)
- For problems about circles, triangles, etc., pay attention to π symbols and units
- Double-check your calculations before giving the final answer

For multiple choice questions:
- Identify the correct answer choice (A, B, C, D, or E)
- Show your work step by step
- Format solution as "The answer is C: 64π" or similar
- Verify your math matches one of the given options

For non-multiple choice:
- Provide the exact numerical or algebraic answer

Always format your response as JSON with these exact fields:
- problem: the question text
- solution: the final answer (include letter choice if multiple choice)
- steps: array of solution steps (use human-readable math symbols: √ ² ³ π × ÷ ± ≤ ≥ ≠ ∞ and fractions like ½ ¾ instead of LaTeX)
- explanation: brief explanation of the mathematical concept
- type: "multiple_choice" or "open_ended"`
          },
          {
            role: "user",
            content: `Solve this math problem: ${selectedText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = { error: { message: await response.text() } };
      }
      
      // Handle specific error types
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${errorDetails.error?.message || 'Invalid request format'}`);
      } else if (response.status === 403) {
        throw new Error('Access denied. Your API key may not have permission for this model.');
      } else {
        throw new Error(`OpenAI API error (${response.status}): ${errorDetails.error?.message || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent);
      result.usedVision = false;
      result.modelUsed = 'GPT-4o-mini';
      return result;
    } catch (e) {
      console.error('Failed to parse JSON from GPT-4o-mini response:', e);
      console.error('Original content:', content);
      const result = this.parseUnstructuredResponse(content, selectedText);
      result.usedVision = false;
      result.modelUsed = 'GPT-4o-mini';
      return result;
    }
  }

  async solveTextOnly(selectedText) {
    console.log('Making text-only API call to GPT-4');
    
    const response = await fetch(CONFIG.OPENAI.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4', // Use regular GPT-4 for text-only
        messages: [
          {
            role: "system",
            content: `You are a math tutor designed for children. Focus on mathematical problems and educational content.

CHILD-FRIENDLY GUIDELINES:
- Use age-appropriate language suitable for students
- If the content is not a math problem, please respond: "I am not aware of what you are asking"
- Maintain educational focus and avoid inappropriate content

Solve the given math problem step by step. 

For multiple choice questions:
- Identify the correct answer choice (A, B, C, D, or E)
- Show your work to arrive at that choice
- Format solution as "The answer is C: [value]" or similar

For non-multiple choice:
- Provide the numerical or algebraic answer

Always format your response as JSON with these exact fields:
- problem: the question text
- solution: the final answer (include letter choice if multiple choice)
- steps: array of solution steps (use human-readable math symbols: √ ² ³ π × ÷ ± ≤ ≥ ≠ ∞ and fractions like ½ ¾ instead of LaTeX)
- explanation: brief explanation of the mathematical concept
- type: "multiple_choice" or "open_ended"`
          },
          {
            role: "user",
            content: `Solve this math problem: ${selectedText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent);
      result.usedVision = false;
      result.modelUsed = 'GPT-4';
      return result;
    } catch (e) {
      console.error('Failed to parse JSON from GPT-4 response:', e);
      console.error('Original content:', content);
      const result = this.parseUnstructuredResponse(content, selectedText);
      result.usedVision = false;
      result.modelUsed = 'GPT-4';
      return result;
    }
  }

  async solveWithClaude(imageData, selectedText) {
    // Claude implementation would go here
    // For now, return a placeholder
    throw new Error('Claude integration not yet implemented. Please use OpenAI for now.');
  }

  parseUnstructuredResponse(content, originalText) {
    // Parse unstructured AI response into our expected format
    const lines = content.split('\n').filter(line => line.trim());
    
    let solution = 'Answer not clearly identified';
    let steps = [];
    let explanation = '';
    
    // Try to extract solution
    for (const line of lines) {
      if (line.toLowerCase().includes('answer') || line.toLowerCase().includes('solution')) {
        solution = line.replace(/^[^:]*:?\s*/, '').trim();
        break;
      }
    }
    
    // Try to extract steps
    let stepSection = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('step') || stepSection) {
        stepSection = true;
        if (line.trim() && !line.toLowerCase().includes('step-by-step')) {
          steps.push(line.replace(/^\d+\.?\s*/, '').trim());
        }
      }
    }
    
    // Use remaining content as explanation
    explanation = content.substring(0, 200) + '...';
    
    return {
      type: this.detectProblemType(originalText),
      problem: originalText || 'Math problem from image',
      solution: solution,
      steps: steps.length > 0 ? steps : ['Solution provided by AI', 'Please refer to the explanation above'],
      explanation: explanation
    };
  }

  detectProblemType(text) {
    if (!text) return 'general';
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('x') && (lowerText.includes('=') || lowerText.includes('solve'))) {
      return 'algebra';
    } else if (lowerText.includes('triangle') || lowerText.includes('circle') || lowerText.includes('angle')) {
      return 'geometry';
    } else if (lowerText.includes('derivative') || lowerText.includes('integral') || lowerText.includes('limit')) {
      return 'calculus';
    } else if (/\d+\s*[+\-*/]\s*\d+/.test(lowerText)) {
      return 'arithmetic';
    }
    
    return 'general';
  }

  async generateExplanationVideo(problemData) {
    // This would integrate with video generation services
    // For now, return a mock response
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      videoScript: this.generateVideoScript(problemData),
      audioScript: this.generateAudioScript(problemData),
      visualCues: this.generateVisualCues(problemData)
    };
  }

  generateVideoScript(problemData) {
    return `
[0:00] Welcome! Let's solve this ${problemData.type} problem step by step.
[0:05] The problem is: ${problemData.problem}
${problemData.steps.map((step, index) => 
  `[0:${10 + index * 15}] Step ${index + 1}: ${step}`
).join('\n')}
[0:${10 + problemData.steps.length * 15}] Therefore, the answer is: ${problemData.solution}
[0:${20 + problemData.steps.length * 15}] This demonstrates ${problemData.explanation}
    `.trim();
  }

  generateAudioScript(problemData) {
    return `
Let's work through this ${problemData.type} problem together.

${problemData.steps.map((step, index) => 
  `In step ${index + 1}, we ${step.toLowerCase()}.`
).join(' ')}

This gives us our final answer of ${problemData.solution}.

${problemData.explanation}
    `.trim();
  }

  generateVisualCues(problemData) {
    return problemData.steps.map((step, index) => ({
      timestamp: 10 + index * 15,
      action: 'highlight',
      content: step,
      animation: 'fadeIn'
    }));
  }

  // Child Safety Content Filter - checks content BEFORE sending to AI
  isContentAppropriate(selectedText, imageData) {
    // Special handling for image-only content (screenshots)
    if (imageData && (!selectedText || selectedText.trim().length === 0 || 
        selectedText.includes('Math problem from') || selectedText.includes('uploaded image:'))) {
      // For image-only content, we allow it but add extra logging
      console.log('🖼️ Image-only content detected - proceeding with enhanced AI filtering');
      return { 
        isAppropriate: true, 
        reason: 'Image content - relying on AI safety prompts for filtering' 
      };
    }

    if (!selectedText || selectedText.trim().length === 0) {
      return { isAppropriate: false, reason: 'No text content to analyze' };
    }

    const text = selectedText.toLowerCase().trim();

    // Keywords that indicate mathematical content
    const mathKeywords = [
      // Numbers and basic math
      'calculate', 'solve', 'find', 'equation', 'expression', 'formula',
      'add', 'subtract', 'multiply', 'divide', 'sum', 'difference', 'product', 'quotient',
      'equals', 'equal', '=', '+', '-', '×', '÷', '*', '/', '^', '²', '³',
      
      // Mathematical concepts
      'algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'probability',
      'function', 'variable', 'coefficient', 'constant', 'slope', 'intercept',
      'derivative', 'integral', 'limit', 'matrix', 'vector', 'polynomial',
      
      // Geometric terms
      'angle', 'triangle', 'circle', 'square', 'rectangle', 'polygon', 'radius', 'diameter',
      'perimeter', 'area', 'volume', 'circumference', 'hypotenuse', 'parallel', 'perpendicular',
      
      // Units and measurements
      'meter', 'centimeter', 'inch', 'foot', 'yard', 'gram', 'kilogram', 'liter',
      'degree', 'radian', 'percent', '%', 'ratio', 'proportion',
      
      // Mathematical symbols and concepts
      'π', 'pi', 'sqrt', 'square root', 'log', 'logarithm', 'sin', 'cos', 'tan',
      'prime', 'factor', 'multiple', 'fraction', 'decimal', 'integer', 'rational'
    ];

    // Check for mathematical indicators
    const hasNumbers = /\d/.test(text);
    const hasMathSymbols = /[=+\-×÷*/^²³√π%]/.test(text);
    const hasMathKeywords = mathKeywords.some(keyword => text.includes(keyword));
    const hasQuestionMark = text.includes('?');

    // Strong indicators of math content
    if (hasMathSymbols || (hasNumbers && hasMathKeywords)) {
      return { isAppropriate: true, reason: 'Contains mathematical symbols or math keywords with numbers' };
    }

    // Check for mathematical expressions (even without keywords)
    const mathPatterns = [
      /\d+\s*[+\-×÷*/^=]\s*\d+/,  // Basic arithmetic expressions
      /[a-z]\s*[=+\-×÷*/^]\s*\d+/i, // Variable equations
      /\d+\s*[a-z]/i,              // Coefficients with variables
      /\([^)]*\)\s*[+\-×÷*/^]/,    // Expressions with parentheses
      /\d+\s*°/,                   // Angle measurements
      /\d+\s*(cm|mm|m|ft|in|kg|g|l|ml)/i, // Units
    ];

    if (mathPatterns.some(pattern => pattern.test(text))) {
      return { isAppropriate: true, reason: 'Contains mathematical expressions or patterns' };
    }

    // Content that's clearly educational math (even without symbols)
    const mathPhrases = [
      'word problem', 'math problem', 'solve for', 'what is', 'how many', 'how much',
      'find the value', 'calculate the', 'determine the', 'compute the',
      'if x =', 'when x =', 'given that', 'let x be'
    ];

    if (mathPhrases.some(phrase => text.includes(phrase)) && hasNumbers) {
      return { isAppropriate: true, reason: 'Contains math problem phrases with numbers' };
    }

    // Final check: if it's a question with numbers, it might be math
    if (hasQuestionMark && hasNumbers && text.split(' ').length < 50) {
      return { isAppropriate: true, reason: 'Short question with numbers (likely math)' };
    }

    // If none of the math indicators are found, reject the content
    return { 
      isAppropriate: false, 
      reason: 'No mathematical content detected - missing numbers, math symbols, or math keywords' 
    };
  }
}

// Export for use in background script
if (typeof window !== 'undefined') {
  window.AIService = AIService;
}