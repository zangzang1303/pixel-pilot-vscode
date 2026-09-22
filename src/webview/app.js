// app.js - Codex-Style AI Studio Webview Controller for Pixel Pilot (100% Real API)

(function () {
  const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

  // State
  let currentSession = null;
  let allSessions = [];
  let isDraggingSlider = false;
  let isDrawingMask = false;
  let inpaintMode = false;

  // DOM Elements - Header & Session
  const btnSessionDropdown = document.getElementById('btn-session-dropdown');
  const currentSessionTitle = document.getElementById('current-session-title');
  const sessionDrawer = document.getElementById('session-drawer');
  const sessionList = document.getElementById('session-list');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const btnDrawerNewSession = document.getElementById('btn-drawer-new-session');
  const btnNewSession = document.getElementById('btn-new-session');
  const btnMoveRight = document.getElementById('btn-move-right');

  // API Key Elements
  const btnApiKey = document.getElementById('btn-api-key');
  const apiKeyModal = document.getElementById('api-key-modal');
  const btnCloseKeyModal = document.getElementById('btn-close-key-modal');
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyStatusMsg = document.getElementById('key-status-msg');
  const keyIndicator = document.getElementById('key-indicator');
  const keyLabel = document.getElementById('key-label');

  // DOM Elements - Viewport & Slider
  const viewportSection = document.getElementById('viewport-section');
  const btnToggleCanvas = document.getElementById('btn-toggle-canvas');
  const btnToggleBrush = document.getElementById('btn-toggle-brush');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const comparisonContainer = document.getElementById('comparison-container');
  const imgBefore = document.getElementById('img-before');
  const imgAfter = document.getElementById('img-after');
  const beforeClipContainer = document.getElementById('before-clip-container');
  const sliderDivider = document.getElementById('slider-divider');
  const emptyPlaceholder = document.getElementById('empty-placeholder');
  const btnSelectFile = document.getElementById('btn-select-file');
  const scannerOverlay = document.getElementById('scanner-overlay');
  const scanLabel = document.getElementById('scan-label');

  // Inpaint Canvas
  const inpaintCanvas = document.getElementById('inpaint-canvas');
  const inpaintToolbar = document.getElementById('inpaint-toolbar');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeVal = document.getElementById('brush-size-val');
  const btnClearMask = document.getElementById('btn-clear-mask');
  let ctx = inpaintCanvas ? inpaintCanvas.getContext('2d') : null;

  // Metrics
  const metricModel = document.getElementById('metric-model');
  const metricLatency = document.getElementById('metric-latency');
  const metricCost = document.getElementById('metric-cost');

  // DAG Strip
  const dagTimeline = document.getElementById('dag-timeline');
  const dagNodeCount = document.getElementById('dag-node-count');

  // Chat Feed
  const chatFeed = document.getElementById('chat-feed');
  const chatMessages = document.getElementById('chat-messages');

  // Bottom Prompt Bar
  const promptTextarea = document.getElementById('prompt-textarea');
  const btnSendPrompt = document.getElementById('btn-send-prompt');
  const btnAttachFile = document.getElementById('btn-attach-file');

  // Initialization
  function init() {
    setupSlider();
    setupSessionControls();
    setupApiKeyModal();
    setupCodexPromptBar();
    setupInpaint();
    setupBackgroundToggles();
    setupMessageListener();

    sendMessage({ command: 'webviewReady' });
  }

  function sendMessage(msg) {
    if (vscode) {
      vscode.postMessage(msg);
    } else {
      console.log('PostMessage:', msg);
    }
  }

  // --- API Key Modal Logic ---
  function setupApiKeyModal() {
    btnApiKey.addEventListener('click', () => {
      apiKeyModal.style.display = 'flex';
      inputApiKey.focus();
    });

    btnCloseKeyModal.addEventListener('click', () => {
      apiKeyModal.style.display = 'none';
    });

    btnSaveKey.addEventListener('click', () => {
      const key = inputApiKey.value.trim();
      if (!key) {
        keyStatusMsg.style.color = '#ef4444';
        keyStatusMsg.textContent = 'Vui lòng dán Runware API Key hợp lệ!';
        return;
      }
      sendMessage({ command: 'saveApiKey', apiKey: key });
      keyStatusMsg.style.color = '#10b981';
      keyStatusMsg.textContent = 'Đang lưu Runware API Key...';
      setTimeout(() => {
        apiKeyModal.style.display = 'none';
      }, 1000);
    });

    inputApiKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnSaveKey.click();
      }
    });
  }

  // --- Session Drawer & Switcher ---
  function setupSessionControls() {
    btnSessionDropdown.addEventListener('click', () => {
      const isOpen = sessionDrawer.style.display === 'flex';
      sessionDrawer.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) renderSessionList();
    });

    btnCloseDrawer.addEventListener('click', () => {
      sessionDrawer.style.display = 'none';
    });

    btnNewSession.addEventListener('click', () => {
      sendMessage({ command: 'newSession' });
      sessionDrawer.style.display = 'none';
    });

    btnDrawerNewSession.addEventListener('click', () => {
      sendMessage({ command: 'newSession' });
      sessionDrawer.style.display = 'none';
    });

    // Move to Right Sidebar
    btnMoveRight.addEventListener('click', () => {
      sendMessage({ command: 'moveToRightSide' });
    });

    // Select Workspace File
    if (btnSelectFile) {
      btnSelectFile.addEventListener('click', () => {
        sendMessage({ command: 'selectWorkspaceFile' });
      });
    }
    if (btnAttachFile) {
      btnAttachFile.addEventListener('click', () => {
        sendMessage({ command: 'selectWorkspaceFile' });
      });
    }
  }

  function renderSessionList() {
    sessionList.innerHTML = '';
    allSessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (currentSession && s.sessionId === currentSession.sessionId ? ' active' : '');

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="session-item-title">${escapeHtml(s.title || 'Phiên làm việc')}</div>
        <div class="session-item-meta">${s.nodeCount || 1} nodes • ${new Date(s.updatedAt).toLocaleTimeString()}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'session-item-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn-tiny';
      renameBtn.textContent = '✏️';
      renameBtn.title = 'Đổi tên phiên';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newTitle = prompt('Nhập tên mới cho Session:', s.title);
        if (newTitle) {
          sendMessage({ command: 'renameSession', sessionId: s.sessionId, title: newTitle });
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-tiny';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Xóa phiên';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Xóa phiên "${s.title}"?`)) {
          sendMessage({ command: 'deleteSession', sessionId: s.sessionId });
        }
      });

      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        sendMessage({ command: 'switchSession', sessionId: s.sessionId });
        sessionDrawer.style.display = 'none';
      });

      sessionList.appendChild(item);
    });
  }

  // --- Codex Prompt Bar & Slash Chips ---
  function setupCodexPromptBar() {
    // Slash chips
    document.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        promptTextarea.value = cmd;
        promptTextarea.focus();
      });
    });

    // Auto-resize textarea & Enter to send
    promptTextarea.addEventListener('input', () => {
      promptTextarea.style.height = 'auto';
      promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 80) + 'px';
    });

    promptTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitCurrentPrompt();
      }
    });

    btnSendPrompt.addEventListener('click', () => {
      submitCurrentPrompt();
    });
  }

  function submitCurrentPrompt() {
    const text = promptTextarea.value.trim();
    if (!text) return;

    const mask = inpaintMode ? getMaskDataUri() : '';

    showScanner(text);
    sendMessage({
      command: 'submitPrompt',
      promptText: text,
      mask
    });

    promptTextarea.value = '';
    promptTextarea.style.height = 'auto';
  }

  // --- Viewport & Before/After Slider ---
  function setupSlider() {
    sliderDivider.addEventListener('mousedown', (e) => {
      isDraggingSlider = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => (isDraggingSlider = false));
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingSlider) return;
      updateSlider(e.clientX);
    });

    // Touch
    sliderDivider.addEventListener('touchstart', () => (isDraggingSlider = true));
    window.addEventListener('touchend', () => (isDraggingSlider = false));
    window.addEventListener('touchmove', (e) => {
      if (isDraggingSlider && e.touches[0]) updateSlider(e.touches[0].clientX);
    });

    // Collapse Viewport Button
    btnToggleCanvas.addEventListener('click', () => {
      viewportSection.classList.toggle('collapsed');
      const isCollapsed = viewportSection.classList.contains('collapsed');
      btnToggleCanvas.textContent = isCollapsed ? '👁️ Mở rộng' : '👁️ Thu gọn';
    });
  }

  function updateSlider(clientX) {
    const rect = comparisonContainer.getBoundingClientRect();
    if (rect.width === 0) return;
    let offset = clientX - rect.left;
    let pct = (offset / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));

    beforeClipContainer.style.width = pct + '%';
    sliderDivider.style.left = pct + '%';
  }

  // --- Background Toggles ---
  function setupBackgroundToggles() {
    document.querySelectorAll('.bg-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bg-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.bg;
        canvasWrapper.className = 'canvas-wrapper';
        if (mode === 'checker') canvasWrapper.classList.add('checker-bg');
        else if (mode === 'dark') canvasWrapper.classList.add('dark-bg');
        else if (mode === 'light') canvasWrapper.classList.add('light-bg');
      });
    });
  }

  // --- Inpaint Canvas Brush ---
  function setupInpaint() {
    btnToggleBrush.addEventListener('click', () => {
      inpaintMode = !inpaintMode;
      inpaintCanvas.style.display = inpaintMode ? 'block' : 'none';
      inpaintToolbar.style.display = inpaintMode ? 'flex' : 'none';
      btnToggleBrush.classList.toggle('active', inpaintMode);

      if (inpaintMode) {
        const rect = comparisonContainer.getBoundingClientRect();
        inpaintCanvas.width = rect.width;
        inpaintCanvas.height = rect.height;
      }
    });

    brushSizeInput.addEventListener('input', () => {
      brushSizeVal.textContent = brushSizeInput.value + 'px';
    });

    btnClearMask.addEventListener('click', () => {
      if (ctx) ctx.clearRect(0, 0, inpaintCanvas.width, inpaintCanvas.height);
    });

    inpaintCanvas.addEventListener('mousedown', (e) => {
      isDrawingMask = true;
      drawBrush(e);
    });
    window.addEventListener('mouseup', () => (isDrawingMask = false));
    inpaintCanvas.addEventListener('mousemove', (e) => {
      if (isDrawingMask) drawBrush(e);
    });
  }

  function drawBrush(e) {
    if (!ctx) return;
    const rect = inpaintCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = parseInt(brushSizeInput.value, 10);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function getMaskDataUri() {
    return inpaintCanvas ? inpaintCanvas.toDataURL('image/png') : '';
  }

  // --- Chat Feed Renderer ---
  function renderChatMessages(messages) {
    chatMessages.innerHTML = '';
    (messages || []).forEach((msg) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.sender}`;

      if (msg.sender === 'user') {
        bubble.textContent = msg.text;
      } else if (msg.sender === 'system') {
        bubble.textContent = msg.text;
      } else {
        // Assistant Message
        let html = `<div>${escapeHtml(msg.text)}</div>`;

        if (msg.metrics) {
          html += `
            <div class="metrics-tag" style="font-size: 8px; color: var(--accent-cyan); margin-top: 2px;">
              ⚡ ${msg.metrics.latencyMs}ms • ${msg.metrics.model}
            </div>
          `;
        }

        // Action Buttons on Result
        if (msg.nodeId && msg.nodeId !== 'node_0_root') {
          html += `
            <div class="msg-actions">
              <button class="btn-msg-action" data-action="save" data-node="${msg.nodeId}">💾 Lưu file</button>
              <button class="btn-msg-action" data-action="copy" data-node="${msg.nodeId}">📋 Copy ảnh</button>
              <button class="btn-msg-action" data-action="rollback" data-node="${msg.nodeId}">↩️ Rollback</button>
            </div>
          `;
        }

        bubble.innerHTML = html;

        // Attach action handlers
        bubble.querySelectorAll('.btn-msg-action').forEach((btn) => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const targetNode = btn.dataset.node;
            if (action === 'save') sendMessage({ command: 'saveOutputImage' });
            else if (action === 'copy') sendMessage({ command: 'copyToClipboard' });
            else if (action === 'rollback') sendMessage({ command: 'rollbackNode', targetNodeId: targetNode });
          });
        });
      }

      chatMessages.appendChild(bubble);
    });

    // Scroll chat to bottom
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  // --- DAG History Visualizer ---
  function renderDAG(session) {
    dagTimeline.innerHTML = '';
    const nodes = Object.values(session.nodes);
    dagNodeCount.textContent = `${nodes.length} nodes`;

    nodes.forEach((node, idx) => {
      const pill = document.createElement('div');
      pill.className = 'dag-node-pill' + (node.nodeId === session.currentNodeId ? ' active' : '');
      pill.innerHTML = `<span>${getIcon(node.operation)}</span> <span>${escapeHtml(node.operationLabel)}</span>`;

      pill.addEventListener('click', () => {
        sendMessage({ command: 'rollbackNode', targetNodeId: node.nodeId });
      });

      dagTimeline.appendChild(pill);

      if (idx < nodes.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'dag-node-arrow';
        arrow.textContent = '→';
        dagTimeline.appendChild(arrow);
      }
    });

    dagTimeline.scrollLeft = dagTimeline.scrollWidth;
  }

  function getIcon(op) {
    switch (op) {
      case 'original': return '🖼️';
      case 'remove_background': return '✂️';
      case 'upscale': return '⚡';
      case 'vectorize': return '📐';
      case 'inpaint': return '🎨';
      case 'mask': return '🎭';
      case 'canny': return '〰️';
      case 'lineart': return '✍️';
      case 'caption': return '💬';
      case 'extend': return '🖼️';
      default: return '✨';
    }
  }

  // --- Display Node in Slider ---
  function displayActiveNode(node) {
    emptyPlaceholder.style.display = 'none';

    imgBefore.src = node.inputImageUri;
    imgAfter.src = node.outputImageUri || node.inputImageUri;

    beforeClipContainer.style.width = '50%';
    sliderDivider.style.left = '50%';

    metricModel.textContent = node.metrics.model || 'Runware BiRefNet';
    metricLatency.textContent = (node.metrics.latencyMs || 0) + ' ms';
    metricCost.textContent = '$' + (node.metrics.costUsd || 0);
  }

  function showScanner(label) {
    scanLabel.textContent = `Đang gọi Runware API thật: ${label}...`;
    scannerOverlay.style.display = 'flex';
  }

  function hideScanner() {
    scannerOverlay.style.display = 'none';
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Extension Message Receiver ---
  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.type) {
        case 'sessionUpdated':
          hideScanner();
          currentSession = msg.session;
          if (msg.sessionsList) allSessions = msg.sessionsList;

          currentSessionTitle.textContent = currentSession.title || 'Phiên làm việc';
          renderDAG(currentSession);
          renderChatMessages(currentSession.messages);

          const activeNode = currentSession.nodes[currentSession.currentNodeId];
          if (activeNode) displayActiveNode(activeNode);
          break;

        case 'apiKeyStatus':
          if (msg.hasApiKey) {
            keyIndicator.className = 'indicator live';
            keyLabel.textContent = '🔑 Live API (' + msg.apiKeyMasked + ')';
          } else {
            keyIndicator.className = 'indicator';
            keyLabel.textContent = '🔑 Nhập API Key';
          }
          break;

        case 'apiKeyMissing':
          hideScanner();
          apiKeyModal.style.display = 'flex';
          keyStatusMsg.style.color = '#f59e0b';
          keyStatusMsg.textContent = '⚠️ Cần nhập Runware API Key để gửi request thật!';
          inputApiKey.focus();
          break;

        case 'operationCompleted':
          hideScanner();
          break;

        case 'operationFailed':
          hideScanner();
          const errDiv = document.createElement('div');
          errDiv.className = 'chat-bubble system';
          errDiv.style.color = '#f87171';
          errDiv.style.background = 'rgba(239, 68, 68, 0.15)';
          errDiv.style.border = '1px solid #ef4444';
          errDiv.textContent = '❌ Lỗi từ Runware API: ' + (msg.error || 'Unknown');
          chatMessages.appendChild(errDiv);
          chatFeed.scrollTop = chatFeed.scrollHeight;
          break;
      }
    });
  }

  init();
})();
