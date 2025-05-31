// Settings page JavaScript
class SettingsManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'aiProvider', 'aiApiKey', 'aiModel', 'googleAuthToken', 'googleUserInfo', 'geminiApiKey',
        'voiceSpeed', 'transcriptModel', 'difficulty', 'showSteps'
      ]);

      // Populate form fields
      const provider = settings.aiProvider || 'openai';
      document.getElementById('provider').value = provider;
      document.getElementById('apiKey').value = settings.aiApiKey || '';
      document.getElementById('model').value = settings.aiModel || 'auto';
      const voiceSpeedRaw = settings.voiceSpeed;
      const voiceSpeedValue = voiceSpeedRaw ? voiceSpeedRaw.toString() : '1.0';
      const voiceSpeedElement = document.getElementById('voiceSpeed');
      
      voiceSpeedElement.value = voiceSpeedValue;
      
      // Fallback manual selection if needed
      if (voiceSpeedElement.value !== voiceSpeedValue) {
        for (let i = 0; i < voiceSpeedElement.options.length; i++) {
          if (voiceSpeedElement.options[i].value === voiceSpeedValue) {
            voiceSpeedElement.selectedIndex = i;
            break;
          }
        }
      }
      document.getElementById('transcriptModel').value = settings.transcriptModel || 'auto';
      document.getElementById('difficulty').value = settings.difficulty || 'middle';
      document.getElementById('showSteps').value = settings.showSteps !== false ? 'true' : 'false';

      // Update provider-specific UI
      this.updateProviderConfig(provider);
      this.updateProviderInfo(provider); // Add this line!
      this.updateModelOptions(provider, settings.aiModel);
      this.updateTranscriptModelOptions(provider, settings.transcriptModel);
      
      // Check Google auth status and show API key section if needed
      if (provider === 'google') {
        console.log('Google provider selected, checking auth...'); // Debug
        console.log('Has googleAuthToken:', !!settings.googleAuthToken); // Debug
        console.log('Has geminiApiKey:', !!settings.geminiApiKey); // Debug
        
        if (settings.googleAuthToken && settings.googleUserInfo) {
          // OAuth authentication
          this.updateGoogleAuthStatus(true, settings.googleUserInfo);
          this.updateApiStatus('connected');
        } else if (settings.geminiApiKey) {
          // API key authentication
          this.showGeminiAPIKeyFallback();
          this.updateGoogleAuthStatus(true, { email: 'API Key User', name: 'Gemini API' });
          this.updateApiStatus('connected');
          
          // Populate the API key field after it's created
          setTimeout(() => {
            const apiKeyInput = document.getElementById('geminiApiKey');
            if (apiKeyInput) {
              apiKeyInput.value = settings.geminiApiKey;
              console.log('Populated Gemini API key field'); // Debug
            }
          }, 100);
        } else {
          // No authentication - show fallback
          this.showGeminiAPIKeyFallback();
          this.updateApiStatus('disconnected');
        }
      } else if (provider === 'openai' && settings.aiApiKey) {
        this.updateApiStatus('connected');
      } else {
        this.updateApiStatus('disconnected');
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      this.showAlert('Error loading settings', 'error');
    }
  }

  setupEventListeners() {
    document.getElementById('provider').addEventListener('change', (e) => {
      const provider = e.target.value;
      this.updateProviderConfig(provider);
      this.updateProviderInfo(provider);
      this.updateModelOptions(provider);
      this.updateTranscriptModelOptions(provider);
      this.autoSave();
    });

    document.getElementById('model').addEventListener('change', () => {
      this.autoSave();
    });

    // Google auth buttons
    document.getElementById('googleSignIn').addEventListener('click', () => {
      this.authenticateWithGoogle();
    });

    document.getElementById('googleSignOut').addEventListener('click', () => {
      this.signOutGoogle();
    });

    // Main action buttons
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      saveSettings();
    });

    document.getElementById('testConnectionBtn').addEventListener('click', () => {
      testConnection();
    });

    document.getElementById('resetSettingsBtn').addEventListener('click', () => {
      resetSettings();
    });

    // Auto-save on certain field changes
    ['provider', 'model', 'voiceSpeed', 'transcriptModel', 'difficulty', 'showSteps'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        this.autoSave();
      });
    });
  }

  updateProviderConfig(provider) {
    // Show/hide provider-specific configuration
    const openaiConfig = document.getElementById('openaiConfig');
    const googleConfig = document.getElementById('googleConfig');
    
    openaiConfig.style.display = provider === 'openai' ? 'block' : 'none';
    googleConfig.style.display = provider === 'google' ? 'block' : 'none';
  }

  updateProviderInfo(provider) {
    const infoDiv = document.getElementById('providerInfo');
    
    if (provider === 'openai') {
      infoDiv.innerHTML = `
        <strong>OpenAI Pricing:</strong> ~$0.01-0.03 per math problem solved (depending on complexity)
        <br><strong>Features:</strong> Excellent at solving algebra, calculus, geometry with image support
        <br><strong>Audio:</strong> Includes Browser Text-to-Speech for explanations 🔊
      `;
    } else if (provider === 'google') {
      infoDiv.innerHTML = `
        <strong>Google Gemini:</strong> Advanced AI models with generous limits
        <br><strong>Latest:</strong> Gemini 2.5 Flash - use for very complex problems ⭐
        <br><strong>Features:</strong> Advanced reasoning, vision support, multimodal capabilities
        <br><strong>Audio:</strong> Includes Browser Text-to-Speech for explanations 🔊
        <br><strong>Requirements:</strong> API key from Google AI Studio
      `;
    } else if (provider === 'claude') {
      infoDiv.innerHTML = `
        <strong>Claude:</strong> Coming soon - excellent reasoning capabilities
        <br><strong>Features:</strong> Strong mathematical reasoning, detailed explanations
      `;
    }
  }

  updateModelOptions(provider, selectedModel = 'auto') {
    const modelSelect = document.getElementById('model');
    const modelHelp = document.getElementById('modelHelp');
    
    // Clear existing options
    modelSelect.innerHTML = '';
    
    if (provider === 'openai') {
      const openaiModels = [
        { value: 'auto', name: 'Auto (Smart Selection)', description: 'Automatically chooses the best model' },
        { value: 'gpt-4o', name: 'GPT-4o', description: 'Best for complex problems with images' },
        { value: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
        { value: 'gpt-4-vision-preview', name: 'GPT-4 Vision', description: 'Good for image analysis' },
        { value: 'gpt-4', name: 'GPT-4', description: 'Text-only, high quality' }
      ];
      
      openaiModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.name;
        if (model.value === selectedModel) option.selected = true;
        modelSelect.appendChild(option);
      });
      
      modelHelp.textContent = 'Choose the OpenAI model to use for solving math problems';
      
    } else if (provider === 'google') {
      const geminiModels = [
        { value: 'auto', name: 'Auto (Smart Selection)', description: 'Automatically chooses the best model' },
        { value: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash ⭐', description: 'Latest preview - use for very complex problems' },
        { value: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'High performance - best for most problems' },
        { value: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient for most problems' },
        { value: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning for complex problems' },
        { value: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Text-only for simple problems' }
      ];
      
      geminiModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.name;
        if (model.value === selectedModel) option.selected = true;
        modelSelect.appendChild(option);
      });
      
      modelHelp.textContent = 'Choose the Google Gemini model to use for solving math problems';
      
    } else {
      // Default/Claude
      const option = document.createElement('option');
      option.value = 'auto';
      option.textContent = 'Auto (Smart Selection)';
      option.selected = true;
      modelSelect.appendChild(option);
      
      modelHelp.textContent = 'Model selection will be available when this provider is implemented';
    }
  }

  updateTranscriptModelOptions(provider, selectedModel = 'auto') {
    const transcriptSelect = document.getElementById('transcriptModel');
    const transcriptHelp = document.getElementById('transcriptModelHelp');
    
    // Clear existing options
    transcriptSelect.innerHTML = '';
    
    // Add auto option
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto (Based on Main Provider)';
    autoOption.selected = selectedModel === 'auto';
    transcriptSelect.appendChild(autoOption);
    
    if (provider === 'openai') {
      const openaiModels = [
        { value: 'gpt-4o', name: 'GPT-4o', description: 'High quality, slower' },
        { value: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Balanced quality and speed' },
        { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical' }
      ];
      
      openaiModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = `${model.name} - ${model.description}`;
        if (model.value === selectedModel) option.selected = true;
        transcriptSelect.appendChild(option);
      });
      
      transcriptHelp.textContent = 'Choose OpenAI model for generating audio explanation scripts';
      
    } else if (provider === 'google') {
      const geminiModels = [
        { value: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash ⭐', description: 'Latest model - may have rate limits' },
        { value: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'High performance, stable' },
        { value: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and reliable' },
        { value: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning' },
        { value: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Basic, text-only' }
      ];
      
      geminiModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = `${model.name} - ${model.description}`;
        if (model.value === selectedModel) option.selected = true;
        transcriptSelect.appendChild(option);
      });
      
      transcriptHelp.textContent = 'Choose Gemini model for generating audio explanation scripts. 2.5 Flash may have rate limits.';
      
    } else {
      transcriptHelp.textContent = 'Audio script model selection will be available when this provider is implemented';
    }
  }

  async autoSave() {
    // Auto-save non-sensitive settings
    const voiceSpeedValue = parseFloat(document.getElementById('voiceSpeed').value);
    
    const settings = {
      aiProvider: document.getElementById('provider').value,
      aiModel: document.getElementById('model').value,
      voiceSpeed: voiceSpeedValue,
      transcriptModel: document.getElementById('transcriptModel').value,
      difficulty: document.getElementById('difficulty').value,
      showSteps: document.getElementById('showSteps').value === 'true'
    };

    await chrome.storage.local.set(settings);
  }

  updateApiStatus(status, message = '') {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    indicator.className = `status-indicator status-${status}`;
    
    switch (status) {
      case 'connected':
        statusText.textContent = 'Connected ✓';
        break;
      case 'disconnected':
        statusText.textContent = 'Not connected';
        break;
      case 'testing':
        statusText.textContent = 'Testing connection...';
        break;
      case 'error':
        statusText.textContent = `Error: ${message}`;
        break;
    }
  }

  showAlert(message, type = 'success') {
    const alertsDiv = document.getElementById('alerts');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertsDiv.appendChild(alertDiv);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }

  async authenticateWithGoogle() {
    try {
      this.showAlert('Google OAuth is not configured for this extension', 'error');
      this.showAlert('For production use, you would need to set up OAuth 2.0 credentials', 'error');
      
      // Show the API key fallback immediately since OAuth needs proper setup
      this.showGeminiAPIKeyFallback();
      
    } catch (error) {
      console.error('Google authentication failed:', error);
      this.showAlert(`Google authentication failed: ${error.message}`, 'error');
      
      // Show manual API key entry as fallback
      this.showGeminiAPIKeyFallback();
    }
  }

  showGeminiAPIKeyFallback() {
    const googleConfig = document.getElementById('googleConfig');
    
    // Check if fallback already exists
    if (googleConfig.querySelector('#geminiApiKey')) {
      return; // Already shown
    }
    
    // Create the fallback section with proper DOM elements
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.cssText = 'margin-top: 15px; padding: 15px; background: #f0f7ff; border-radius: 6px; border: 1px solid #1976d2;';
    
    const title = document.createElement('strong');
    title.textContent = '🔑 Use Gemini API Key';
    
    const contentDiv = document.createElement('div');
    contentDiv.style.marginTop = '10px';
    
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.id = 'geminiApiKey';
    apiKeyInput.placeholder = 'Enter your Gemini API key';
    apiKeyInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; box-sizing: border-box;';
    
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary';
    saveButton.textContent = 'Save Gemini API Key';
    saveButton.id = 'saveGeminiButton';
    
    // Add click event listener properly
    saveButton.addEventListener('click', () => {
      console.log('Save button clicked!'); // Debug
      this.saveGeminiApiKey();
    });
    
    const helpDiv = document.createElement('div');
    helpDiv.className = 'help-text';
    helpDiv.innerHTML = `
      <strong>Get your API key:</strong><br>
      1. Go to <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a><br>
      2. Sign in with your Google account<br>
      3. Click "Create API Key" and copy it<br>
      4. Paste it above and click Save<br>
      <em>✨ Includes generous usage limits!</em>
    `;
    
    // Assemble the elements
    contentDiv.appendChild(apiKeyInput);
    contentDiv.appendChild(saveButton);
    contentDiv.appendChild(helpDiv);
    
    fallbackDiv.appendChild(title);
    fallbackDiv.appendChild(contentDiv);
    
    googleConfig.appendChild(fallbackDiv);
    
    console.log('Gemini API key fallback section created with proper event listener'); // Debug
  }

  async saveGeminiApiKey() {
    console.log('saveGeminiApiKey called'); // Debug
    
    const apiKeyInput = document.getElementById('geminiApiKey');
    if (!apiKeyInput) {
      console.error('geminiApiKey input not found');
      alert('Error: Could not find API key input field');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    console.log('API key length:', apiKey.length); // Debug
    
    if (!apiKey) {
      this.showAlert('Please enter a Gemini API key', 'error');
      alert('Please enter a Gemini API key'); // Fallback alert
      return;
    }
    
    try {
      console.log('Saving to chrome storage...'); // Debug
      
      await chrome.storage.local.set({
        geminiApiKey: apiKey,
        googleUserInfo: { email: 'API Key User', name: 'Gemini API' }
      });
      
      console.log('Saved to storage successfully'); // Debug
      
      this.updateGoogleAuthStatus(true, { email: 'API Key User', name: 'Gemini API' });
      this.updateApiStatus('connected');
      
      // Show multiple types of notifications to ensure something works
      console.log('Showing alerts...'); // Debug
      
      // 1. Page alert
      this.showAlert('Gemini API key saved successfully! ✅', 'success');
      
      // 2. Simple browser alert as fallback
      alert('✅ Gemini API key saved successfully!');
      
      // 3. Browser notification (if supported)
      if (chrome.notifications) {
        console.log('Creating browser notification...'); // Debug
        try {
          await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiM0Mjg1ZjQiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Im05IDEyIDIgMiA0LTQiLz4KPC9zdmc+Cjwvc3ZnPgo=',
            title: 'AI Math Tutor',
            message: 'Gemini API key saved successfully! Extension is ready to solve math problems with Google AI.'
          });
          console.log('Browser notification created successfully'); // Debug
        } catch (notifError) {
          console.warn('Browser notification failed:', notifError);
        }
      } else {
        console.warn('chrome.notifications not available');
      }
      
      // 4. Update the save button temporarily to show success
      const saveButton = document.getElementById('saveGeminiButton');
      if (saveButton) {
        console.log('Updating save button...'); // Debug
        const originalText = saveButton.textContent;
        saveButton.textContent = '✅ Saved!';
        saveButton.style.background = '#34a853';
        saveButton.style.color = 'white';
        
        setTimeout(() => {
          saveButton.textContent = originalText;
          saveButton.style.background = '';
          saveButton.style.color = '';
        }, 3000);
      } else {
        console.warn('Save button not found - looking for #saveGeminiButton');
      }
      
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showAlert(`Error saving API key: ${error.message}`, 'error');
      alert(`Error saving API key: ${error.message}`); // Fallback alert
    }
  }

  async signOutGoogle() {
    try {
      // Clear stored auth data
      await chrome.storage.local.remove(['googleAuthToken', 'googleUserInfo', 'geminiApiKey']);
      
      // Clear Chrome identity cache
      try {
        await chrome.identity.clearAllCachedAuthTokens();
      } catch (e) {
        console.log('Could not clear cached tokens:', e);
      }
      
      this.updateGoogleAuthStatus(false);
      this.updateApiStatus('disconnected');
      this.showAlert('Signed out successfully', 'success');
      
      // Remove any fallback API key input
      const googleConfig = document.getElementById('googleConfig');
      const fallbackDiv = googleConfig.querySelector('div[style*="background: #f0f7ff"]');
      if (fallbackDiv) fallbackDiv.remove();
      
    } catch (error) {
      console.error('Error signing out:', error);
      this.showAlert(`Error signing out: ${error.message}`, 'error');
    }
  }

  updateGoogleAuthStatus(isAuthenticated, userInfo = null) {
    const authSection = document.getElementById('googleAuthSection');
    const statusSection = document.getElementById('googleAuthStatus');
    const userEmailSpan = document.getElementById('googleUserEmail');
    
    if (isAuthenticated && userInfo) {
      authSection.style.display = 'none';
      statusSection.style.display = 'block';
      userEmailSpan.textContent = `Connected as: ${userInfo.email || userInfo.name}`;
    } else {
      authSection.style.display = 'block';
      statusSection.style.display = 'none';
    }
  }
}

// Global functions called by HTML
async function saveSettings() {
  try {
    const provider = document.getElementById('provider').value;
    const voiceSpeedElement = document.getElementById('voiceSpeed');
    const voiceSpeedValue = parseFloat(voiceSpeedElement.value);
    
    const settings = {
      aiProvider: provider,
      aiModel: document.getElementById('model').value,
      voiceSpeed: voiceSpeedValue,
      transcriptModel: document.getElementById('transcriptModel').value,
      difficulty: document.getElementById('difficulty').value,
      showSteps: document.getElementById('showSteps').value === 'true'
    };

    // Add provider-specific settings
    if (provider === 'openai') {
      settings.aiApiKey = document.getElementById('apiKey').value;
    }

    await chrome.storage.local.set(settings);
    
    // Verify the settings were saved based on provider
    const verification = await chrome.storage.local.get(['aiProvider', 'aiApiKey', 'googleAuthToken', 'geminiApiKey']);
    
    if (provider === 'openai' && !verification.aiApiKey) {
      throw new Error('OpenAI API Key was not saved properly');
    } else if (provider === 'google' && !verification.googleAuthToken && !verification.geminiApiKey) {
      throw new Error('Google authentication not completed. Please enter a Gemini API key or sign in with Google.');
    }
    
    // Send API key to background script
    try {
      chrome.runtime.sendMessage({
        type: 'SET_AI_CONFIG',
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey
      });
      console.log('Message sent to background script'); // Debug log
    } catch (msgError) {
      console.warn('Could not send message to background:', msgError);
    }

    // Show success message
    const isConnected = (provider === 'openai' && settings.aiApiKey) || 
                       (provider === 'google' && (verification.googleAuthToken || verification.geminiApiKey));
    
    settingsManager.showAlert('Settings saved successfully! ✅', 'success');
    settingsManager.updateApiStatus(isConnected ? 'connected' : 'disconnected');
    
    // Also update the save button to show confirmation
    const saveButton = document.getElementById('saveSettingsBtn');
    if (saveButton) {
      const originalText = saveButton.textContent;
      saveButton.textContent = '✅ Saved!';
      saveButton.style.background = '#34a853';
      saveButton.style.color = 'white';
      
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.style.background = '';
        saveButton.style.color = '';
      }, 3000);
    }

  } catch (error) {
    console.error('Error saving settings:', error);
    settingsManager.showAlert(`Error saving settings: ${error.message}`, 'error');
  }
}

async function testConnection() {
  const provider = document.getElementById('provider').value;
  
  settingsManager.updateApiStatus('testing');

  try {
    if (provider === 'openai') {
      const apiKey = document.getElementById('apiKey').value;
      
      if (!apiKey) {
        settingsManager.showAlert('Please enter an OpenAI API key first', 'error');
        settingsManager.updateApiStatus('disconnected');
        return;
      }

      // Test OpenAI API connection
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        settingsManager.updateApiStatus('connected');
        settingsManager.showAlert('OpenAI API connection successful!', 'success');
      } else {
        const error = await response.json();
        settingsManager.updateApiStatus('error', error.error?.message || 'Invalid API key');
        settingsManager.showAlert(`OpenAI connection failed: ${error.error?.message || 'Invalid API key'}`, 'error');
      }
      
    } else if (provider === 'google') {
      // Check if user is authenticated with Google
      const storage = await chrome.storage.local.get(['googleAuthToken', 'geminiApiKey']);
      
      if (storage.googleAuthToken) {
        // Test with OAuth token
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${storage.googleAuthToken}`
          }
        });
        
        if (response.ok) {
          settingsManager.updateApiStatus('connected');
          settingsManager.showAlert('Google authentication is valid!', 'success');
        } else {
          settingsManager.updateApiStatus('error', 'Google token expired');
          settingsManager.showAlert('Google authentication expired. Please sign in again.', 'error');
        }
      } else if (storage.geminiApiKey) {
        // Test with Gemini API key
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + storage.geminiApiKey);
        
        if (response.ok) {
          settingsManager.updateApiStatus('connected');
          settingsManager.showAlert('Gemini API key is valid!', 'success');
        } else {
          settingsManager.updateApiStatus('error', 'Invalid Gemini API key');
          settingsManager.showAlert('Gemini API key is invalid. Please check your key.', 'error');
        }
      } else {
        settingsManager.updateApiStatus('disconnected');
        settingsManager.showAlert('Please authenticate with Google or enter a Gemini API key first', 'error');
      }
    } else {
      settingsManager.updateApiStatus('disconnected');
      settingsManager.showAlert('Provider not yet implemented', 'error');
    }

  } catch (error) {
    settingsManager.updateApiStatus('error', 'Network error');
    settingsManager.showAlert('Connection test failed: Network error', 'error');
  }
}

async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    await chrome.storage.local.clear();
    location.reload();
  }
}

// Initialize settings manager
const settingsManager = new SettingsManager();