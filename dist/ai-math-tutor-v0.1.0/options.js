// Options page for AI Math Tutor
console.log('Options page loaded');

document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM loaded, initializing options page');
  
  const statusDisplay = document.getElementById('statusDisplay');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const clearBtn = document.getElementById('clearBtn');
  const testStorageBtn = document.getElementById('testStorageBtn');
  const testExtensionBtn = document.getElementById('testExtensionBtn');
  const diagnosticResults = document.getElementById('diagnosticResults');

  // Initial status check
  await checkExtensionStatus();
  await loadSavedSettings();

  // Event listeners
  saveBtn.addEventListener('click', saveSettings);
  testBtn.addEventListener('click', testConnection);
  clearBtn.addEventListener('click', clearSettings);
  testStorageBtn.addEventListener('click', testStorage);
  testExtensionBtn.addEventListener('click', testExtensionContext);

  async function checkExtensionStatus() {
    try {
      if (typeof chrome === 'undefined') {
        showStatus('❌ Chrome APIs not available', 'error');
        return;
      }

      if (!chrome.storage) {
        showStatus('❌ Storage API not available', 'error');
        return;
      }

      if (!chrome.runtime) {
        showStatus('❌ Runtime API not available', 'error');
        return;
      }

      showStatus('✅ Extension context working correctly', 'success');
    } catch (error) {
      showStatus(`❌ Extension error: ${error.message}`, 'error');
    }
  }

  async function loadSavedSettings() {
    try {
      console.log('Loading saved settings...');
      const result = await chrome.storage.local.get(['aiApiKey', 'aiProvider', 'useVision']);
      console.log('Loaded settings:', result);
      
      if (result.aiApiKey) {
        apiKeyInput.value = result.apiApiKey;
        showStatus('✅ API Key loaded from storage', 'success');
      } else {
        showStatus('ℹ️ No saved API key found', 'info');
      }
      
      if (result.aiProvider) {
        document.getElementById('provider').value = result.aiProvider;
      }
      
      if (result.useVision) {
        document.getElementById('useVision').value = result.useVision;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus(`❌ Error loading settings: ${error.message}`, 'error');
    }
  }

  async function saveSettings() {
    try {
      console.log('Save button clicked');
      
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiKey) {
        showStatus('❌ Please enter an API key', 'error');
        return;
      }

      if (!apiKey.startsWith('sk-')) {
        showStatus('❌ Invalid API key format (should start with sk-)', 'error');
        return;
      }

      showStatus('💾 Saving API key...', 'info');
      
      const settings = {
        aiApiKey: apiKey,
        aiProvider: document.getElementById('provider').value,
        useVision: document.getElementById('useVision').value,
        savedAt: new Date().toISOString()
      };

      console.log('Saving settings:', settings);
      
      await chrome.storage.local.set(settings);
      console.log('Settings saved successfully');

      // Verify save
      const verification = await chrome.storage.local.get(['aiApiKey']);
      console.log('Verification result:', verification);
      
      if (verification.aiApiKey === apiKey) {
        showStatus('✅ API Key saved successfully!', 'success');
        
        // Update save button
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✅ Saved!';
        saveBtn.style.background = '#34a853';
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = '';
        }, 3000);

        // Send to background script
        try {
          await chrome.runtime.sendMessage({
            type: 'SET_API_KEY',
            apiKey: apiKey,
            provider: settings.aiProvider
          });
          console.log('Message sent to background script');
        } catch (msgError) {
          console.warn('Could not send message to background:', msgError);
        }

      } else {
        showStatus('❌ API Key was not saved correctly', 'error');
      }

    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(`❌ Error saving: ${error.message}`, 'error');
    }
  }

  async function testConnection() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('❌ Please enter an API key first', 'error');
      return;
    }

    showStatus('🔍 Testing API connection...', 'info');

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showStatus('✅ API connection successful!', 'success');
      } else {
        const error = await response.json();
        showStatus(`❌ API Error: ${error.error?.message || 'Invalid API key'}`, 'error');
      }

    } catch (error) {
      showStatus(`❌ Connection failed: ${error.message}`, 'error');
    }
  }

  async function clearSettings() {
    if (confirm('Clear all settings? This cannot be undone.')) {
      try {
        await chrome.storage.local.clear();
        apiKeyInput.value = '';
        showStatus('✅ All settings cleared', 'success');
      } catch (error) {
        showStatus(`❌ Error clearing settings: ${error.message}`, 'error');
      }
    }
  }

  async function testStorage() {
    diagnosticResults.innerHTML = 'Testing storage...\n';
    
    try {
      // Test write
      await chrome.storage.local.set({testKey: 'testValue123'});
      diagnosticResults.innerHTML += '✅ Storage write: SUCCESS\n';
      
      // Test read
      const result = await chrome.storage.local.get(['testKey']);
      if (result.testKey === 'testValue123') {
        diagnosticResults.innerHTML += '✅ Storage read: SUCCESS\n';
      } else {
        diagnosticResults.innerHTML += '❌ Storage read: FAILED\n';
      }
      
      // Clean up
      await chrome.storage.local.remove(['testKey']);
      diagnosticResults.innerHTML += '✅ Storage cleanup: SUCCESS\n';
      
    } catch (error) {
      diagnosticResults.innerHTML += `❌ Storage test error: ${error.message}\n`;
    }
  }

  function testExtensionContext() {
    diagnosticResults.innerHTML = 'Testing extension context...\n';
    
    diagnosticResults.innerHTML += `Chrome object: ${typeof chrome}\n`;
    diagnosticResults.innerHTML += `Storage API: ${chrome.storage ? 'AVAILABLE' : 'NOT AVAILABLE'}\n`;
    diagnosticResults.innerHTML += `Runtime API: ${chrome.runtime ? 'AVAILABLE' : 'NOT AVAILABLE'}\n`;
    diagnosticResults.innerHTML += `Extension ID: ${chrome.runtime ? chrome.runtime.id : 'N/A'}\n`;
    diagnosticResults.innerHTML += `URL: ${window.location.href}\n`;
    diagnosticResults.innerHTML += `Origin: ${window.location.origin}\n`;
  }

  function showStatus(message, type) {
    statusDisplay.textContent = message;
    statusDisplay.className = `status status-${type}`;
    console.log(`Status: ${message}`);
  }
});