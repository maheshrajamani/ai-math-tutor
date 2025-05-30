document.addEventListener('DOMContentLoaded', function() {
  const openSidePanelBtn = document.getElementById('openSidePanel');
  const status = document.getElementById('status');

  function showStatus(message, type = 'success', duration = 3000) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, duration);
  }

  openSidePanelBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    } catch (error) {
      showStatus('Error opening side panel', 'error');
      console.error('Error:', error);
    }
  });
});