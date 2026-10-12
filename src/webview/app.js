// app.js - Modern Interactive Controller for AI Image Studio Webview Canvas
(function () {
  const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

  // --- State Variables ---
  let currentImageUri = '';
  let currentFileName = 'Untitled';
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let isPanningActive = false;
  let startPanX = 0;
  let startPanY = 0;
  let inpaintMode = true; // Enabled by default for easy brush masking
  let isDrawingMask = false;
  let brushSize = 30;

  // --- DOM Elements ---
  const statusIndicator = document.getElementById('status-indicator');
  const activeFileTitle = document.getElementById('active-file-title');
  const activeFileRes = document.getElementById('active-file-res');
  const btnHeaderOpen = document.getElementById('btn-header-open');
  const btnHeaderSave = document.getElementById('btn-header-save');
  const btnHeaderSnippet = document.getElementById('btn-header-snippet');
  const btnHeaderSettings = document.getElementById('btn-header-settings');

  // Sidebar Tool Buttons
  const toolRemoveBg = document.getElementById('tool-remove-bg');
  const toolUpscale2x = document.getElementById('tool-upscale-2x');
  const toolUpscale4x = document.getElementById('tool-upscale-4x');
  const toolToggleInpaint = document.getElementById('tool-toggle-inpaint');
  const toolImageToCode = document.getElementById('tool-image-to-code');
  const toolOcr = document.getElementById('tool-ocr');
  const toolCompress = document.getElementById('tool-compress');

  // Canvas Stage Elements
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const emptyState = document.getElementById('empty-state');
  const zoomContainer = document.getElementById('zoom-container');
  const imageLayersStack = document.getElementById('image-layers-stack');
  const activeImageElement = document.getElementById('active-image-element');
  const brushMaskCanvas = document.getElementById('brush-mask-canvas');
  const btnBrowseFile = document.getElementById('btn-browse-file');
  const dragOverlay = document.getElementById('drag-overlay');
  const aiScanner = document.getElementById('ai-scanner');
  const scannerText = document.getElementById('scanner-text');

  // Canvas Controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const btnPanToggle = document.getElementById('btn-pan-toggle');
  const brushControls = document.getElementById('brush-controls');
  const brushSlider = document.getElementById('brush-slider');
  const brushSizeNum = document.getElementById('brush-size-num');
  const btnClearBrush = document.getElementById('btn-clear-brush');

  // Telemetry
  const telemModel = document.getElementById('telem-model');
  const telemTime = document.getElementById('telem-time');
  const telemDim = document.getElementById('telem-dim');

  // Prompt Deck Elements
  const promptInput = document.getElementById('prompt-input');
  const selectDimension = document.getElementById('select-dimension');
  const btnTextToImage = document.getElementById('btn-text-to-image');
  const btnRunInpaint = document.getElementById('btn-run-inpaint');

  // Settings Modal Elements
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const inputRunwareKey = document.getElementById('input-runware-key');
  const btnSaveRunwareKey = document.getElementById('btn-save-runware-key');
  const statusRunwareKey = document.getElementById('status-runware-key');
  const inputLlmKey = document.getElementById('input-llm-key');
  const btnSaveLlmKey = document.getElementById('btn-save-llm-key');
  const statusLlmKey = document.getElementById('status-llm-key');

  const maskCtx = brushMaskCanvas ? brushMaskCanvas.getContext('2d') : null;

  // --- Helper: Post Message to Extension Host ---
  function postMessage(msg) {
    if (vscode) {
      vscode.postMessage(msg);
    } else {
      console.log('[Dev Webview PostMessage]:', msg);
    }
  }

  // --- Initialize App ---
  function init() {
    setupHeaderActions();
    setupToolActions();
    setupZoomAndPan();
    setupBrushMask();
    setupDragAndDrop();
    setupClipboardPaste();
    setupBackgroundModes();
    setupPromptDeck();
    setupSettingsModal();
    setupMessageListener();

    // Notify Extension Host that Webview is mounted
    postMessage({ command: 'STUDIO_READY' });
    postMessage({ command: 'webviewReady' });
  }

  // --- 1. Header Actions ---
  function setupHeaderActions() {
    if (btnHeaderOpen) {
      btnHeaderOpen.addEventListener('click', () => {
        postMessage({ command: 'REQUEST_IMAGE_LOAD' });
      });
    }

    if (btnHeaderSave) {
      btnHeaderSave.addEventListener('click', () => {
        if (!currentImageUri) {
          showNotification('Chưa có ảnh để lưu. Vui lòng mở ảnh trước!');
          return;
        }
        postMessage({
          command: 'EXPORT_IMAGE',
          payload: { imageUri: currentImageUri, defaultFileName: currentFileName }
        });
      });
    }

    if (btnHeaderSnippet) {
      btnHeaderSnippet.addEventListener('click', () => {
        if (!currentImageUri) {
          showNotification('Chưa có ảnh để chèn snippet!');
          return;
        }
        postMessage({
          command: 'INSERT_SNIPPET_REQUEST',
          payload: { imageUri: currentImageUri, altText: currentFileName }
        });
      });
    }

    if (btnHeaderSettings) {
      btnHeaderSettings.addEventListener('click', () => {
        modalSettings.style.display = 'flex';
      });
    }
  }

  // --- 2. Tool Palette Actions ---
  function setupToolActions() {
    if (toolRemoveBg) {
      toolRemoveBg.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang tách nền tự động (BiRefNet SOTA)...');
        postMessage({
          command: 'APPLY_AI_ACTION',
          payload: { action: 'removeBackground', imageUri: currentImageUri }
        });
      });
    }

    if (toolUpscale2x) {
      toolUpscale2x.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang phóng to 2x Super-Resolution...');
        postMessage({
          command: 'APPLY_AI_ACTION',
          payload: { action: 'upscale', factor: 2, imageUri: currentImageUri }
        });
      });
    }

    if (toolUpscale4x) {
      toolUpscale4x.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang phóng to 4x Ultra HD...');
        postMessage({
          command: 'APPLY_AI_ACTION',
          payload: { action: 'upscale', factor: 4, imageUri: currentImageUri }
        });
      });
    }

    if (toolToggleInpaint) {
      toolToggleInpaint.addEventListener('click', () => {
        inpaintMode = !inpaintMode;
        toolToggleInpaint.classList.toggle('active', inpaintMode);
        brushControls.style.display = inpaintMode ? 'flex' : 'none';
        brushMaskCanvas.style.pointerEvents = inpaintMode ? 'auto' : 'none';
        showNotification(inpaintMode ? 'Đã bật cọ vẽ Inpaint' : 'Đã tắt cọ vẽ Inpaint');
      });
    }

    if (toolImageToCode) {
      toolImageToCode.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang phân tích Mockup và sinh mã React/Tailwind...');
        postMessage({
          command: 'IMAGE_TO_CODE_REQUEST',
          payload: { imageUri: currentImageUri, framework: 'react-tailwind' }
        });
      });
    }

    if (toolOcr) {
      toolOcr.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang trích xuất chữ OCR sang Clipboard...');
        postMessage({
          command: 'OCR_REQUEST',
          payload: { imageUri: currentImageUri }
        });
      });
    }

    if (toolCompress) {
      toolCompress.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        showScanner('Đang nén tối ưu WebP với Sharp...');
        postMessage({
          command: 'COMPRESS_IMAGE_REQUEST',
          payload: { imageUri: currentImageUri, format: 'webp', quality: 85 }
        });
      });
    }
  }

  function ensureActiveImage() {
    if (!currentImageUri) {
      showNotification('Vui lòng chọn hoặc kéo thả một bức ảnh vào Studio trước!');
      return false;
    }
    return true;
  }

  // --- 3. Zoom & Pan Engine ---
  function setupZoomAndPan() {
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => updateZoom(zoomLevel + 0.25));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => updateZoom(zoomLevel - 0.25));
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => {
      panX = 0;
      panY = 0;
      updateZoom(1.0);
    });
    if (btnZoomFit) btnZoomFit.addEventListener('click', () => {
      panX = 0;
      panY = 0;
      updateZoom(1.0);
    });

    if (btnPanToggle) {
      btnPanToggle.addEventListener('click', () => {
        isPanningActive = !isPanningActive;
        btnPanToggle.classList.toggle('active', isPanningActive);
        canvasWrapper.style.cursor = isPanningActive ? 'grab' : 'default';
        brushMaskCanvas.style.pointerEvents = isPanningActive ? 'none' : 'auto';
      });
    }

    // Ctrl + Mouse Wheel Zoom
    canvasWrapper.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        updateZoom(zoomLevel + delta);
      }
    }, { passive: false });

    // Pan Mouse Events
    canvasWrapper.addEventListener('mousedown', (e) => {
      if (isPanningActive || e.button === 1) {
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        canvasWrapper.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        canvasWrapper.style.cursor = isPanningActive ? 'grab' : 'default';
      }
    });
  }

  function updateZoom(val) {
    zoomLevel = Math.max(0.2, Math.min(6.0, val));
    if (btnZoomReset) btnZoomReset.textContent = `${Math.round(zoomLevel * 100)}%`;
    applyTransform();
  }

  function applyTransform() {
    if (zoomContainer) {
      zoomContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
  }

  // --- 4. Interactive Brush Mask Canvas System ---
  function setupBrushMask() {
    if (brushSlider) {
      brushSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value, 10);
        if (brushSizeNum) brushSizeNum.textContent = `${brushSize}px`;
      });
    }

    if (btnClearBrush) {
      btnClearBrush.addEventListener('click', clearMaskCanvas);
    }

    if (!brushMaskCanvas) return;

    brushMaskCanvas.addEventListener('mousedown', (e) => {
      if (isPanningActive) return;
      isDrawingMask = true;
      drawBrushStroke(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDrawingMask && !isPanningActive) {
        drawBrushStroke(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isDrawingMask = false;
      if (maskCtx) maskCtx.beginPath();
    });
  }

  function drawBrushStroke(e) {
    if (!maskCtx || !brushMaskCanvas) return;
    const rect = brushMaskCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (brushMaskCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (brushMaskCanvas.height / rect.height);

    maskCtx.lineWidth = brushSize * (brushMaskCanvas.width / rect.width);
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.strokeStyle = 'rgba(244, 63, 94, 0.45)'; // Semi-transparent vibrant red
    maskCtx.fillStyle = 'rgba(244, 63, 94, 0.45)';

    maskCtx.lineTo(x, y);
    maskCtx.stroke();
    maskCtx.beginPath();
    maskCtx.arc(x, y, (brushSize * (brushMaskCanvas.width / rect.width)) / 2, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.beginPath();
    maskCtx.moveTo(x, y);
  }

  function clearMaskCanvas() {
    if (maskCtx && brushMaskCanvas) {
      maskCtx.clearRect(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
      maskCtx.beginPath();
    }
  }

  function getMaskBase64() {
    if (!brushMaskCanvas) return '';
    // Export purely binary black & white mask for diffusion pipeline
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = brushMaskCanvas.width;
    tempCanvas.height = brushMaskCanvas.height;
    const tCtx = tempCanvas.getContext('2d');

    // Fill black
    tCtx.fillStyle = '#000000';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Get alpha data from user painted brush
    const maskImgData = maskCtx.getImageData(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
    const tImgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    for (let i = 0; i < maskImgData.data.length; i += 4) {
      if (maskImgData.data[i + 3] > 20) {
        tImgData.data[i] = 255;
        tImgData.data[i + 1] = 255;
        tImgData.data[i + 2] = 255;
      }
    }
    tCtx.putImageData(tImgData, 0, 0);
    return tempCanvas.toDataURL('image/png');
  }

  // --- 5. Image Loading & Sizing ---
  function displayImage(imageSrc, title = 'image.png') {
    currentImageUri = imageSrc;
    currentFileName = title;

    activeImageElement.onload = () => {
      const width = activeImageElement.naturalWidth || 1024;
      const height = activeImageElement.naturalHeight || 1024;

      // Sync mask canvas resolution exactly with loaded image resolution
      brushMaskCanvas.width = width;
      brushMaskCanvas.height = height;
      clearMaskCanvas();

      if (activeFileTitle) activeFileTitle.textContent = title;
      if (statusIndicator) statusIndicator.classList.add('active');
      if (activeFileRes) {
        activeFileRes.textContent = `${width} × ${height} px`;
        activeFileRes.style.display = 'inline-block';
      }
      if (telemDim) telemDim.textContent = `${width} × ${height}`;

      // Show stage and hide empty state
      emptyState.style.display = 'none';
      zoomContainer.style.display = 'flex';
      hideScanner();
    };

    activeImageElement.src = imageSrc;
  }

  // --- 6. Drag & Drop and Clipboard Paste ---
  function setupDragAndDrop() {
    if (btnBrowseFile) {
      btnBrowseFile.addEventListener('click', () => {
        postMessage({ command: 'REQUEST_IMAGE_LOAD' });
      });
    }

    ['dragenter', 'dragover'].forEach(name => {
      canvasWrapper.addEventListener(name, (e) => {
        e.preventDefault();
        dragOverlay.style.display = 'flex';
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      canvasWrapper.addEventListener(name, (e) => {
        e.preventDefault();
        dragOverlay.style.display = 'none';
      });
    });

    canvasWrapper.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
          displayImage(reader.result, file.name);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
      if (document.activeElement === promptInput || document.activeElement === inputRunwareKey || document.activeElement === inputLlmKey) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              displayImage(reader.result, `Ảnh dán (${new Date().toLocaleTimeString()}).png`);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    });
  }

  // --- 7. Background Mode Switcher ---
  function setupBackgroundModes() {
    document.querySelectorAll('.bg-modes .mini-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bg-modes .mini-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.bg;
        canvasWrapper.classList.remove('checker-pattern', 'dark-pattern', 'light-pattern');
        if (mode === 'checker') canvasWrapper.classList.add('checker-pattern');
        else if (mode === 'dark') canvasWrapper.classList.add('dark-pattern');
        else if (mode === 'light') canvasWrapper.classList.add('light-pattern');
      });
    });
  }

  // --- 8. Bottom Prompt Deck & Actions ---
  function setupPromptDeck() {
    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        promptInput.value = pill.dataset.prompt;
        promptInput.focus();
      });
    });

    // Inpaint Execution Button
    if (btnRunInpaint) {
      btnRunInpaint.addEventListener('click', () => {
        if (!ensureActiveImage()) return;
        const prompt = (promptInput.value || '').trim();
        if (!prompt) {
          showNotification('Vui lòng nhập mô tả chỉnh sửa vào ô Prompt!');
          promptInput.focus();
          return;
        }
        const maskBase64 = getMaskBase64();
        showScanner('Đang thực hiện AI Inpaint & Generative Fill...');
        postMessage({
          command: 'INPAINT_REQUEST',
          payload: {
            imageUri: currentImageUri,
            maskBase64,
            prompt
          }
        });
      });
    }

    // Text-to-Image Generation Button
    if (btnTextToImage) {
      btnTextToImage.addEventListener('click', () => {
        const prompt = (promptInput.value || '').trim();
        if (!prompt) {
          showNotification('Vui lòng nhập mô tả hình ảnh cần tạo!');
          promptInput.focus();
          return;
        }
        const dimension = selectDimension ? selectDimension.value : '1024x1024';
        showScanner(`Đang sinh hình ảnh mới (${dimension})...`);
        postMessage({
          command: 'TEXT_TO_IMAGE_REQUEST',
          payload: { prompt, dimension }
        });
      });
    }
  }

  // --- 9. Settings Modal ---
  function setupSettingsModal() {
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        modalSettings.style.display = 'none';
      });
    }

    if (btnSaveRunwareKey) {
      btnSaveRunwareKey.addEventListener('click', () => {
        const key = inputRunwareKey.value.trim();
        if (key) {
          postMessage({ command: 'saveApiKey', apiKey: key });
          statusRunwareKey.textContent = '✅ Đã lưu Runware API Key vào SecretStorage!';
        }
      });
    }

    if (btnSaveLlmKey) {
      btnSaveLlmKey.addEventListener('click', () => {
        const key = inputLlmKey.value.trim();
        if (key) {
          postMessage({ command: 'saveLlmApiKey', apiKey: key, provider: 'gemini' });
          statusLlmKey.textContent = '✅ Đã lưu LLM Key vào SecretStorage!';
        }
      });
    }
  }

  // --- 10. Message Listener (Host -> Webview) ---
  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.command || msg.type) {
        case 'SET_CURRENT_IMAGE':
          if (msg.payload?.imageUri) {
            displayImage(msg.payload.imageUri, msg.payload.fileName || 'image.png');
          }
          break;

        case 'sessionUpdated':
          if (msg.session) {
            const activeNode = msg.session.nodes?.[msg.session.currentNodeId];
            if (activeNode && activeNode.outputImageUri) {
              displayImage(activeNode.outputImageUri, msg.session.title || 'image.png');
            }
          }
          break;

        case 'UPDATE_AI_PROGRESS':
          showScanner(msg.payload?.status || 'Đang xử lý...');
          break;

        case 'AI_ACTION_SUCCESS':
          hideScanner();
          if (msg.payload?.outputUri) {
            // Load resulting image path
            displayImage(msg.payload.outputUri, msg.payload.outputUri.split(/[\\/]/).pop());
          }
          if (msg.payload?.latencyMs && telemTime) {
            telemTime.textContent = `${msg.payload.latencyMs} ms`;
          }
          if (msg.payload?.model && telemModel) {
            telemModel.textContent = `Model: ${msg.payload.model}`;
          }
          break;

        case 'AI_ACTION_ERROR':
          hideScanner();
          showNotification(`❌ Lỗi AI: ${msg.payload?.error || 'Thất bại'}`);
          break;

        case 'apiKeyStatus':
          if (statusRunwareKey) {
            statusRunwareKey.textContent = msg.hasApiKey ? `Đang hoạt động (${msg.apiKeyMasked || 'Live'})` : 'Chưa thiết lập';
          }
          break;

        case 'llmKeyStatus':
          if (statusLlmKey) {
            statusLlmKey.textContent = msg.hasLlmKey ? `Đang hoạt động (${msg.llmKeyMasked || 'Live'})` : 'Chưa thiết lập';
          }
          break;
      }
    });
  }

  // --- UI Helpers ---
  function showScanner(text) {
    if (scannerText) scannerText.textContent = text;
    if (aiScanner) aiScanner.style.display = 'flex';
  }

  function hideScanner() {
    if (aiScanner) aiScanner.style.display = 'none';
  }

  function showNotification(msg) {
    postMessage({ command: 'SHOW_TOAST', payload: { text: msg } });
  }

  // Run app
  init();
})();
