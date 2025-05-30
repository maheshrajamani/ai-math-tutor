// Content script for AI Math Tutor
class MathProblemSelector {
  constructor() {
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.selectionBox = null;
    this.overlay = null;
    this.useVisualCoords = false; // Flag to use visual box coordinates
    
    // Bind event handlers to maintain correct 'this' context
    this.boundStartSelection = this.startSelection.bind(this);
    this.boundUpdateSelection = this.updateSelection.bind(this);
    this.boundEndSelection = this.endSelection.bind(this);
    
    this.init();
  }

  init() {
    this.createStyles();
    this.setupMessageListener();
  }

  createStyles() {
    if (document.getElementById('math-tutor-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'math-tutor-styles';
    style.textContent = `
      .math-tutor-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 10000;
        cursor: crosshair;
      }
      
      .math-tutor-selection {
        position: fixed;
        border: 2px dashed #4285f4;
        background: rgba(66, 133, 244, 0.1);
        pointer-events: none;
        z-index: 10001;
        box-sizing: border-box;
      }
      
      .math-tutor-debug-dot {
        position: fixed;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 10002;
      }
      
      .math-tutor-toolbar {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-family: Arial, sans-serif;
        font-size: 14px;
      }
      
      .math-tutor-btn {
        padding: 8px 16px;
        margin: 0 5px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .math-tutor-btn-primary {
        background: #4285f4;
        color: white;
      }
      
      .math-tutor-btn-secondary {
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
    `;
    document.head.appendChild(style);
  }

  setupMessageListener() {
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'ENABLE_SELECTION') {
        this.enableSelectionMode();
        sendResponse({ success: true });
      } else if (request.type === 'ENABLE_TEST_MODE') {
        this.enableTestMode();
        sendResponse({ success: true });
      } else if (request.type === 'USE_VISUAL_COORDS') {
        this.useVisualCoords = true;
        console.log('Switched to visual coordinates mode');
        sendResponse({ success: true });
      }
    });
    
    // Also listen for window messages (fallback)
    window.addEventListener('message', (event) => {
      if (event.data.type === 'ENABLE_MATH_SELECTION') {
        this.enableSelectionMode();
      }
    });
  }

  enableTestMode() {
    console.log('Test mode enabled - click anywhere to see text extraction');
    
    // Add a click listener to test text extraction
    const testClickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Create a small test rectangle around the click point
      const testRect = {
        left: e.clientX - 50 + window.scrollX,
        top: e.clientY - 50 + window.scrollY,
        right: e.clientX + 50 + window.scrollX,
        bottom: e.clientY + 50 + window.scrollY,
        width: 100,
        height: 100
      };
      
      console.log('Test click at:', { x: e.clientX, y: e.clientY, scroll: { x: window.scrollX, y: window.scrollY } });
      console.log('Test rect:', testRect);
      
      const extractedText = this.getSelectedText(testRect);
      console.log('Extracted text at click point:', extractedText);
      
      alert(`Clicked at: ${e.clientX}, ${e.clientY}
Scroll: ${window.scrollX}, ${window.scrollY}
Extracted text: "${extractedText.substring(0, 200)}"`);
      
      // Remove the test handler after one click
      document.removeEventListener('click', testClickHandler, true);
    };
    
    // Add the test click handler
    document.addEventListener('click', testClickHandler, true);
    
    // Remove test mode after 30 seconds
    setTimeout(() => {
      document.removeEventListener('click', testClickHandler, true);
      console.log('Test mode disabled');
    }, 30000);
  }

  enableSelectionMode() {
    // Clean up any existing selection elements first
    this.cleanup();
    
    // Check if this is a PDF page and handle specially
    if (this.isPDFPage()) {
      this.createPDFOverlay();
      this.createPDFToolbar();
    } else {
      this.createOverlay();
      this.createToolbar();
    }
    
    this.isSelecting = true;
  }

  isPDFPage() {
    // Be very specific about PDF detection - only detect actual PDFs
    return document.location.href.includes('.pdf') ||
           document.querySelector('embed[type="application/pdf"]') ||
           document.querySelector('object[type="application/pdf"]') ||
           document.contentType === 'application/pdf' ||
           // Chrome's built-in PDF viewer (very specific)
           (window.location.href.startsWith('chrome-extension://') && 
            window.location.href.includes('.pdf') &&
            document.querySelector('pdf-viewer')) ||
           // Check document type
           document.documentElement.getAttribute('data-content-type') === 'application/pdf';
  }

  createPDFOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'math-tutor-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.zIndex = '999999';
    this.overlay.style.pointerEvents = 'auto';
    
    // Use capture phase to intercept PDF viewer events
    this.overlay.addEventListener('mousedown', this.boundStartSelection, true);
    this.overlay.addEventListener('mousemove', this.boundUpdateSelection, true);
    this.overlay.addEventListener('mouseup', this.boundEndSelection, true);
    
    // Prevent PDF viewer from handling events
    this.overlay.addEventListener('dragstart', (e) => e.preventDefault());
    this.overlay.addEventListener('selectstart', (e) => e.preventDefault());
    this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());
    
    document.body.appendChild(this.overlay);
  }

  createPDFToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'math-tutor-toolbar';
    toolbar.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; color: #1976d2;">📄 PDF Mode</div>
      <div style="margin-bottom: 8px; color: #666; font-size: 11px;">Click and drag to select problem area</div>
      <div style="margin-bottom: 8px; color: #34a853; font-size: 10px;">✓ Smart text extraction + screenshot</div>
      <div style="margin-bottom: 10px; color: #666; font-size: 10px;">Works best with text-based PDFs</div>
      <button class="math-tutor-btn math-tutor-btn-secondary" onclick="mathTutorSelector.cancelSelection()">
        Cancel
      </button>
    `;
    
    // Position toolbar for better PDF visibility
    toolbar.style.top = '10px';
    toolbar.style.right = '10px';
    toolbar.style.maxWidth = '220px';
    toolbar.style.fontSize = '12px';
    
    document.body.appendChild(toolbar);
    this.toolbar = toolbar;
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'math-tutor-overlay';
    
    // Use capture phase to get events before they're affected by positioning
    this.overlay.addEventListener('mousedown', this.boundStartSelection, true);
    this.overlay.addEventListener('mousemove', this.boundUpdateSelection, true);
    this.overlay.addEventListener('mouseup', this.boundEndSelection, true);
    
    // Prevent default behaviors that might interfere
    this.overlay.addEventListener('dragstart', (e) => e.preventDefault());
    this.overlay.addEventListener('selectstart', (e) => e.preventDefault());
    
    document.body.appendChild(this.overlay);
  }

  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'math-tutor-toolbar';
    toolbar.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold;">📐 Select Math Problem</div>
      <div style="margin-bottom: 10px; color: #666;">Click and drag to select the problem area</div>
      <button class="math-tutor-btn math-tutor-btn-secondary" onclick="mathTutorSelector.cancelSelection()">
        Cancel
      </button>
    `;
    
    document.body.appendChild(toolbar);
    this.toolbar = toolbar;
  }

  startSelection(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Store both viewport and document coordinates
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startScrollX = window.scrollX;
    this.startScrollY = window.scrollY;
    
    console.log('Selection started at:', { 
      viewport: { x: this.startX, y: this.startY }, 
      scroll: { x: this.startScrollX, y: this.startScrollY },
      document: { x: this.startX + this.startScrollX, y: this.startY + this.startScrollY },
      pageX: e.pageX,
      pageY: e.pageY,
      target: e.target.className
    });
    
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'math-tutor-selection';
    // Use position: fixed for precise viewport positioning
    this.selectionBox.style.position = 'fixed';
    this.selectionBox.style.left = this.startX + 'px';
    this.selectionBox.style.top = this.startY + 'px';
    this.selectionBox.style.width = '0px';
    this.selectionBox.style.height = '0px';
    
    document.body.appendChild(this.selectionBox);
    
    // Add a small visual indicator at the exact start point
    this.addDebugDot(this.startX, this.startY, 'red');
  }

  updateSelection(e) {
    if (!this.selectionBox) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);
    
    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
  }

  async endSelection(e) {
    if (!this.selectionBox) return;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    console.log('Selection ended at:', { 
      viewport: { x: endX, y: endY }, 
      scroll: { x: window.scrollX, y: window.scrollY }
    });
    
    // Calculate selection coordinates using both methods for comparison
    const startDocX = this.startX + this.startScrollX;
    const startDocY = this.startY + this.startScrollY; 
    const endDocX = endX + window.scrollX;
    const endDocY = endY + window.scrollY;
    
    const calculatedRect = {
      left: Math.min(startDocX, endDocX) - window.scrollX,
      top: Math.min(startDocY, endDocY) - window.scrollY,
      right: Math.max(startDocX, endDocX) - window.scrollX,
      bottom: Math.max(startDocY, endDocY) - window.scrollY,
      width: Math.abs(endDocX - startDocX),
      height: Math.abs(endDocY - startDocY)
    };
    
    // Also get visual box coordinates
    const boxRect = this.selectionBox.getBoundingClientRect();
    const visualRect = {
      left: boxRect.left,
      top: boxRect.top,
      right: boxRect.right,
      bottom: boxRect.bottom,
      width: boxRect.width,
      height: boxRect.height
    };
    
    console.log('Calculated coordinates:', calculatedRect);
    console.log('Visual box coordinates:', visualRect);
    
    // Use visual coordinates if they seem reasonable, otherwise use calculated
    const viewportRect = (visualRect.width > 0 && visualRect.height > 0) ? visualRect : calculatedRect;
    
    console.log('Using coordinates for capture:', viewportRect);
    
    // Add debug dot at end point
    this.addDebugDot(endX, endY, 'blue');
    
    // Check for minimum selection size to avoid accidental tiny selections
    if (viewportRect.width < 10 || viewportRect.height < 10) {
      console.log('Selection too small, ignoring');
      this.cleanup();
      return;
    }
    
    // Clean up UI elements immediately to prevent further mouse interactions
    this.cleanup();
    
    // Use the visual coordinates for capture (async operation)
    await this.captureSelection(viewportRect);
  }

  async captureSelection(rect) {
    try {
      console.log('Capturing selection (viewport coords):', rect);
      console.log('Page scroll:', { x: window.scrollX, y: window.scrollY });
      
      // Show a temporary highlight of what's being processed
      this.showProcessingHighlight(rect);
      
      // Convert to document coordinates for text extraction
      const documentRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
        bottom: rect.bottom + window.scrollY,
        width: rect.width,
        height: rect.height
      };
      
      console.log('Document rect for text extraction:', documentRect);
      
      // Test what's at the center of the selection (viewport coordinates)
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtCenter = document.elementFromPoint(centerX, centerY);
      console.log('Element at selection center:', elementAtCenter?.textContent?.substring(0, 100));
      
      // Get text content from the selected area using document coordinates
      const selectedText = this.getSelectedText(documentRect);
      console.log('Selected text:', selectedText);
      
      // Try to capture screenshot using Chrome API
      let imageData = null;
      
      try {
        // Request full screenshot from background script
        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_FULL_SCREENSHOT'
        });
        
        if (response && response.imageData) {
          // Use original rect (viewport coordinates) for cropping screenshot
          imageData = await this.cropScreenshot(response.imageData, rect);
          console.log('Screenshot captured and cropped successfully');
        }
      } catch (screenshotError) {
        console.warn('Screenshot capture failed, proceeding with text only:', screenshotError);
      }
      
      // If we have no text and no image, show error
      if (!selectedText && !imageData) {
        throw new Error('No content detected in selected area');
      }
      
      // Send to background script for processing
      await chrome.runtime.sendMessage({
        type: 'PROCESS_MATH_PROBLEM',
        imageData: imageData,
        selectedText: selectedText
      });
      
      // Small delay to ensure background processing starts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Open side panel
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      
    } catch (error) {
      console.error('Error capturing selection:', error);
      
      // Show more specific error message
      const errorMsg = error.message || 'Unknown error occurred';
      alert(`Error capturing the selected area: ${errorMsg}\n\nTips:\n- Try selecting text-based math problems\n- Ensure the selection contains visible content\n- Refresh the page and try again`);
    }
  }

  getSelectedText(rect) {
    try {
      // Check if this is a PDF and try PDF-specific extraction first
      if (this.isPDFPage()) {
        const pdfText = this.extractPDFText(rect);
        if (pdfText) {
          console.log('Extracted PDF text:', pdfText);
          return pdfText;
        }
      }
      
      // Method 1: Get all text content that intersects with selection
      let allText = '';
      const textNodes = this.getAllTextInRect(rect);
      
      for (const textInfo of textNodes) {
        allText += textInfo.text + ' ';
      }
      
      // Method 2: Clean and format the text
      let cleanText = this.cleanAndFormatText(allText);
      
      // Method 3: Try to get selected text if user has made a selection
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = this.cleanAndFormatText(selection.toString());
        cleanText = selectedText + ' ' + cleanText;
      }
      
      console.log('Extracted text:', cleanText);
      return cleanText.trim();
      
    } catch (error) {
      console.error('Error extracting text:', error);
      return '';
    }
  }

  extractPDFText(rect) {
    try {
      // Method 1: Try to access Chrome's PDF viewer text layer
      const textLayer = document.querySelector('.textLayer') || 
                       document.querySelector('#textLayer') ||
                       document.querySelector('[class*="text"]');
      
      if (textLayer) {
        console.log('Found PDF text layer:', textLayer);
        return this.extractTextFromPDFLayer(textLayer, rect);
      }
      
      // Method 2: Try to access PDF.js text content
      if (window.PDFViewerApplication && window.PDFViewerApplication.pdfViewer) {
        console.log('Found PDF.js viewer');
        return this.extractTextFromPDFJS(rect);
      }
      
      // Method 3: Look for any selectable text within the area
      const pdfText = this.extractSelectableTextInRect(rect);
      if (pdfText) {
        return pdfText;
      }
      
      console.log('No PDF text extraction method worked, falling back to screenshot');
      return '';
      
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return '';
    }
  }

  extractTextFromPDFLayer(textLayer, rect) {
    try {
      const textElements = textLayer.querySelectorAll('span, div');
      let extractedText = '';
      
      for (const element of textElements) {
        const elementRect = element.getBoundingClientRect();
        
        // Check if element intersects with selection
        if (this.rectsIntersect(rect, elementRect)) {
          extractedText += element.textContent + ' ';
        }
      }
      
      return this.cleanAndFormatText(extractedText);
    } catch (error) {
      console.error('Error extracting from PDF text layer:', error);
      return '';
    }
  }

  extractTextFromPDFJS(rect) {
    try {
      // Access PDF.js internal text content
      const viewer = window.PDFViewerApplication.pdfViewer;
      const currentPage = viewer.currentPageNumber;
      const pageView = viewer.getPageView(currentPage - 1);
      
      if (pageView && pageView.textLayer) {
        const textLayer = pageView.textLayer.textLayerDiv;
        return this.extractTextFromPDFLayer(textLayer, rect);
      }
      
      return '';
    } catch (error) {
      console.error('Error accessing PDF.js text:', error);
      return '';
    }
  }

  extractSelectableTextInRect(rect) {
    try {
      // Create a temporary range to select text in the area
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Try to select text programmatically within the rect bounds
      const startPoint = document.elementFromPoint(rect.left, rect.top);
      const endPoint = document.elementFromPoint(rect.right, rect.bottom);
      
      if (startPoint && endPoint) {
        try {
          range.setStart(startPoint, 0);
          range.setEnd(endPoint, endPoint.childNodes.length || 0);
          
          selection.removeAllRanges();
          selection.addRange(range);
          
          const selectedText = selection.toString();
          selection.removeAllRanges(); // Clean up
          
          if (selectedText.trim()) {
            return this.cleanAndFormatText(selectedText);
          }
        } catch (rangeError) {
          console.log('Range selection failed, trying alternative method');
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error with selectable text extraction:', error);
      return '';
    }
  }

  rectsIntersect(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
  }

  getAllTextInRect(rect) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const nodeRect = range.getBoundingClientRect();
        
        // Convert viewport coordinates to document coordinates for comparison
        const documentNodeRect = {
          left: nodeRect.left + window.scrollX,
          top: nodeRect.top + window.scrollY,
          right: nodeRect.right + window.scrollX,
          bottom: nodeRect.bottom + window.scrollY,
          width: nodeRect.width,
          height: nodeRect.height
        };
        
        // Check if text node intersects with selection (both in document coordinates)
        if (this.rectsIntersect(rect, documentNodeRect)) {
          textNodes.push({
            text: node.textContent,
            rect: documentNodeRect,
            viewportRect: nodeRect // Keep original for debugging
          });
        }
      }
    }
    
    // Sort by vertical position (top to bottom), then horizontal (left to right)
    textNodes.sort((a, b) => {
      const verticalDiff = a.rect.top - b.rect.top;
      if (Math.abs(verticalDiff) > 10) { // Different lines
        return verticalDiff;
      }
      return a.rect.left - b.rect.left; // Same line, sort by horizontal position
    });
    
    console.log('Found text nodes:', textNodes.map(n => ({ 
      text: n.text.substring(0, 50), 
      documentRect: n.rect,
      viewportRect: n.viewportRect 
    })));
    
    return textNodes;
  }

  cleanAndFormatText(text) {
    if (!text) return '';
    
    // Normalize whitespace and clean up
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Handle common math symbols and format multiple choice
    cleaned = cleaned
      // Fix pi symbol representations (more comprehensive)
      .replace(/π/g, 'π')
      .replace(/pi/gi, 'π')
      .replace(/PI/g, 'π')
      .replace(/∏/g, 'π') // Sometimes misread
      .replace(/TT/g, 'π') // Sometimes OCR reads π as TT
      .replace(/3\.14/g, 'π') // Replace decimal approximation
      // Fix other math symbols
      .replace(/×/g, '×')
      .replace(/÷/g, '÷')
      .replace(/²/g, '²')
      .replace(/³/g, '³')
      .replace(/√/g, '√')
      .replace(/°/g, '°')
      // Handle cases where π might be missing but implied
      .replace(/(\d+)\s*([A-E][\)\.])/g, '$1π $2') // Add π if missing before options
      .replace(/(\d+)\s+(A[\)\.]|B[\)\.]|C[\)\.]|D[\)\.]|E[\)\.])/g, '$1π $2')
      // Format multiple choice options better
      .replace(/([A-E])\)\s*/g, '\nOption $1: ')
      .replace(/([A-E])\.?\s*([^A-E\n]+)/g, '\nOption $1: $2')
      // Handle numbered options
      .replace(/(\d+)\)\s*/g, '\nOption $1: ')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    // If it looks like multiple choice, format it properly
    if (this.hasMultipleChoiceOptions(cleaned)) {
      cleaned = this.formatMultipleChoice(cleaned);
    }
    
    return cleaned;
  }

  hasMultipleChoiceOptions(text) {
    // Check for multiple choice patterns
    const patterns = [
      /[A-E]\)/g,
      /[A-E]\./g,
      /\b[A-E]\s*[:]/g,
      /Option\s*[A-E]/gi,
      /\d+\)/g
    ];
    
    return patterns.some(pattern => {
      const matches = text.match(pattern);
      return matches && matches.length >= 2; // At least 2 options
    });
  }

  formatMultipleChoice(text) {
    // Extract question and options
    const lines = text.split('\n').filter(line => line.trim());
    let question = '';
    let options = [];
    
    for (const line of lines) {
      if (line.includes('Option') || /^[A-E][\)\.:]/.test(line)) {
        options.push(line.trim());
      } else if (line.trim() && !question) {
        question = line.trim();
      }
    }
    
    // If no clear separation, try to extract from the full text
    if (!options.length) {
      const optionMatches = text.match(/([A-E][\)\.:]?\s*[^A-E\n]+)/g);
      if (optionMatches && optionMatches.length >= 2) {
        options = optionMatches.map(opt => `Option ${opt.trim()}`);
        // Remove options from question
        let questionText = text;
        for (const opt of optionMatches) {
          questionText = questionText.replace(opt, '');
        }
        question = questionText.trim();
      }
    }
    
    if (options.length >= 2) {
      return question + '\n\nAnswer choices:\n' + options.join('\n');
    }
    
    return text;
  }

  rectsIntersect(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
  }

  isMathContent(text) {
    // Check if text contains mathematical symbols or patterns
    const mathPatterns = [
      /[+\-*/=()]/,           // Basic math operators
      /\b\d+\s*[+\-*/=]\s*\d+/, // Simple equations
      /\b[xyz]\b/i,           // Variables
      /\b(sin|cos|tan|log|ln)\b/i, // Functions
      /[∑∫√π°]/,              // Math symbols
      /\b(solve|find|calculate|what is)\b/i // Math keywords
    ];
    
    return mathPatterns.some(pattern => pattern.test(text));
  }

  async cropScreenshot(fullScreenDataUrl, rect) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        
        img.onload = () => {
          try {
            // Create canvas for cropping
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to selection size
            canvas.width = Math.max(1, Math.round(rect.width));
            canvas.height = Math.max(1, Math.round(rect.height));
            
            // Account for device pixel ratio
            const devicePixelRatio = window.devicePixelRatio || 1;
            
            // Calculate source coordinates (where to crop from the full screenshot)
            // rect is already in viewport coordinates, so no scroll adjustment needed
            const sourceX = rect.left * devicePixelRatio;
            const sourceY = rect.top * devicePixelRatio;
            const sourceWidth = rect.width * devicePixelRatio;
            const sourceHeight = rect.height * devicePixelRatio;
            
            console.log('Cropping:', {
              source: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
              dest: { width: canvas.width, height: canvas.height },
              devicePixelRatio: devicePixelRatio
            });
            
            // Draw the cropped portion
            ctx.drawImage(
              img,
              sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle
              0, 0, canvas.width, canvas.height             // Destination rectangle
            );
            
            // Convert to data URL
            const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
            resolve(croppedDataUrl);
            
          } catch (cropError) {
            console.error('Error cropping image:', cropError);
            // If cropping fails, return the original image with a note
            resolve(fullScreenDataUrl);
          }
        };
        
        img.onerror = (error) => {
          console.error('Error loading image for cropping:', error);
          resolve(fullScreenDataUrl); // Fallback to full image
        };
        
        img.src = fullScreenDataUrl;
        
      } catch (error) {
        console.error('Error in cropScreenshot:', error);
        resolve(fullScreenDataUrl); // Fallback to full image
      }
    });
  }

  cancelSelection() {
    this.cleanup();
  }

  showProcessingHighlight(rect) {
    // Create a temporary highlight to show what's being processed
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(34, 169, 83, 0.3);
      border: 3px solid #22a953;
      z-index: 10002;
      pointer-events: none;
      animation: pulse 0.5s ease-in-out;
    `;
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 0; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.05); }
        100% { opacity: 0.7; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(highlight);
    
    // Remove after 2 seconds
    setTimeout(() => {
      if (highlight.parentNode) {
        highlight.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 2000);
  }

  addDebugDot(x, y, color) {
    const dot = document.createElement('div');
    dot.className = 'math-tutor-debug-dot';
    dot.style.left = (x - 3) + 'px'; // Center the 6px dot
    dot.style.top = (y - 3) + 'px';
    dot.style.backgroundColor = color;
    document.body.appendChild(dot);
    
    // Store reference for cleanup
    if (!this.debugDots) this.debugDots = [];
    this.debugDots.push(dot);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (dot.parentNode) {
        dot.remove();
      }
    }, 3000);
  }

  cleanup() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    
    // Clean up debug dots
    if (this.debugDots) {
      this.debugDots.forEach(dot => {
        if (dot.parentNode) {
          dot.remove();
        }
      });
      this.debugDots = [];
    }
    
    // Also clean up any orphaned selection elements that might exist
    const orphanedSelections = document.querySelectorAll('.math-tutor-selection');
    const orphanedOverlays = document.querySelectorAll('.math-tutor-overlay');
    const orphanedToolbars = document.querySelectorAll('.math-tutor-toolbar');
    const orphanedDots = document.querySelectorAll('.math-tutor-debug-dot');
    
    orphanedSelections.forEach(el => el.remove());
    orphanedOverlays.forEach(el => el.remove());
    orphanedToolbars.forEach(el => el.remove());
    orphanedDots.forEach(el => el.remove());
    
    // Remove any document-level event listeners to prevent further interactions
    document.removeEventListener('mousemove', this.boundUpdateSelection, true);
    document.removeEventListener('mouseup', this.boundEndSelection, true);
    
    this.isSelecting = false;
  }
}

// Initialize the selector
const mathTutorSelector = new MathProblemSelector();
window.mathTutorSelector = mathTutorSelector;