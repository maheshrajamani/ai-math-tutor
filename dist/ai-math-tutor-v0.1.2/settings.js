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
        'aiProvider', 'aiApiKey', 'videoEnabled', 'voiceSpeed', 
        'difficulty', 'showSteps'
      ]);

      // Populate form fields
      document.getElementById('provider').value = settings.aiProvider || 'openai';
      document.getElementById('apiKey').value = settings.aiApiKey || '';
      document.getElementById('videoEnabled').value = settings.videoEnabled !== false ? 'true' : 'false';
      document.getElementById('voiceSpeed').value = settings.voiceSpeed || '1.0';
      document.getElementById('difficulty').value = settings.difficulty || 'middle';
      document.getElementById('showSteps').value = settings.showSteps !== false ? 'true' : 'false';

      // Update API status
      this.updateApiStatus(settings.aiApiKey ? 'connected' : 'disconnected');

    } catch (error) {
      console.error('Error loading settings:', error);
      this.showAlert('Error loading settings', 'error');
    }
  }

  setupEventListeners() {
    document.getElementById('provider').addEventListener('change', (e) => {
      this.updateProviderInfo(e.target.value);
    });

    // Auto-save on certain field changes
    ['provider', 'videoEnabled', 'voiceSpeed', 'difficulty', 'showSteps'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        this.autoSave();
      });
    });
  }

  updateProviderInfo(provider) {
    const infoDiv = document.querySelector('.provider-info');
    
    if (provider === 'openai') {
      infoDiv.innerHTML = `
        <strong>OpenAI Pricing:</strong> ~$0.01-0.03 per math problem solved (depending on complexity)
        <br><strong>Features:</strong> Excellent at solving algebra, calculus, geometry with image support
      `;
    } else if (provider === 'claude') {
      infoDiv.innerHTML = `
        <strong>Claude:</strong> Coming soon - excellent reasoning capabilities
        <br><strong>Features:</strong> Strong mathematical reasoning, detailed explanations
      `;
    }
  }

  async autoSave() {
    // Auto-save non-sensitive settings
    const settings = {
      aiProvider: document.getElementById('provider').value,
      videoEnabled: document.getElementById('videoEnabled').value === 'true',
      voiceSpeed: parseFloat(document.getElementById('voiceSpeed').value),
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
}

// Global functions called by HTML
async function saveSettings() {
  try {
    console.log('Saving settings...'); // Debug log
    
    const settings = {
      aiProvider: document.getElementById('provider').value,
      aiApiKey: document.getElementById('apiKey').value,
      videoEnabled: document.getElementById('videoEnabled').value === 'true',
      voiceSpeed: parseFloat(document.getElementById('voiceSpeed').value),
      difficulty: document.getElementById('difficulty').value,
      showSteps: document.getElementById('showSteps').value === 'true'
    };

    console.log('Settings to save:', settings); // Debug log

    // Check if chrome.storage is available
    if (!chrome.storage) {
      throw new Error('Chrome storage API not available');
    }

    await chrome.storage.local.set(settings);
    console.log('Settings saved to storage'); // Debug log
    
    // Verify the key was actually saved by reading it back
    const verification = await chrome.storage.local.get(['aiApiKey']);
    console.log('Verification - API Key in storage:', verification.aiApiKey ? 'EXISTS' : 'NOT FOUND');
    
    if (!verification.aiApiKey) {
      throw new Error('API Key was not saved properly');
    }
    
    // Send API key to background script
    try {
      chrome.runtime.sendMessage({
        type: 'SET_API_KEY',
        apiKey: settings.aiApiKey,
        provider: settings.aiProvider
      });
      console.log('Message sent to background script'); // Debug log
    } catch (msgError) {
      console.warn('Could not send message to background:', msgError);
    }

    // Show success message and update button temporarily
    settingsManager.showAlert('API Key and settings saved successfully! ✅', 'success');
    settingsManager.updateApiStatus(settings.aiApiKey ? 'connected' : 'disconnected');
    
    // Show browser notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiM0Mjg1ZjQiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Im05IDEyIDIgMiA0LTQiLz4KPC9zdmc+Cjwvc3ZnPgo=',
        title: 'AI Math Tutor',
        message: 'API Key saved successfully! Extension is ready to solve math problems.'
      });
    }
    
    // Also update the save button to show confirmation
    const saveButton = document.querySelector('button[onclick="saveSettings()"]');
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
  const apiKey = document.getElementById('apiKey').value;
  const provider = document.getElementById('provider').value;
  
  if (!apiKey) {
    settingsManager.showAlert('Please enter an API key first', 'error');
    return;
  }

  settingsManager.updateApiStatus('testing');

  try {
    // Test the API connection
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      settingsManager.updateApiStatus('connected');
      settingsManager.showAlert('API connection successful!', 'success');
    } else {
      const error = await response.json();
      settingsManager.updateApiStatus('error', error.error?.message || 'Invalid API key');
      settingsManager.showAlert(`Connection failed: ${error.error?.message || 'Invalid API key'}`, 'error');
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