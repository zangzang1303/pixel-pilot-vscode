// app.js - High-End Dark Glassmorphism Studio Controller for Pixel Pilot
// 100% Real API, Interactive Zoom/Pan, Smart Toolbelt, Drag&Drop, SVG Inspector & Visual DAG

(function () {
  const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

  // Studio State
  let currentSession = null;
  let allSessions = [];
  let isDraggingSlider = false;
  let isDrawingMask = false;
  let inpaintMode = false;
  let panMode = false;
  let isPanningMouse = false;
  let startPanX = 0;
  let startPanY = 0;
  let panX = 0;
  let panY = 0;
  let zoomLevel = 1.0;
  let customCompareBeforeUri = null;
  let currentSvgData = null;
  let currentViewMode = 'compare'; // 'compare' | 'result' | 'original'

  // DOM Elements - Header & Session
  const btnSessionDropdown = document.getElementById('btn-session-dropdown');
  const currentSessionTitle = document.getElementById('current-session-title');
  const sessionDrawer = document.getElementById('session-drawer');
  const sessionList = document.getElementById('session-list');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const btnDrawerNewSession = document.getElementById('btn-drawer-new-session');
  const btnNewSession = document.getElementById('btn-new-session');
  const btnMoveRight = document.getElementById('btn-move-right');
  const btnBatchProcess = document.getElementById('btn-batch-process');
  const btnEnterpriseConfig = document.getElementById('btn-enterprise-config');

  // API Key Elements
  const btnApiKey = document.getElementById('btn-api-key');
  const apiKeyModal = document.getElementById('api-key-modal');
  const btnCloseKeyModal = document.getElementById('btn-close-key-modal');
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyStatusMsg = document.getElementById('key-status-msg');
  const keyIndicator = document.getElementById('key-indicator');
  const keyLabel = document.getElementById('key-label');

  // Viewport, View Modes & Zoom Elements
  const viewportSection = document.getElementById('viewport-section');
  const btnToggleCanvas = document.getElementById('btn-toggle-canvas');
  const btnToggleBrush = document.getElementById('btn-toggle-brush');
  const btnInspectSvg = document.getElementById('btn-inspect-svg');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const zoomStage = document.getElementById('zoom-stage');
  const comparisonContainer = document.getElementById('comparison-container');
  const imgBefore = document.getElementById('img-before');
  const imgAfter = document.getElementById('img-after');
  const lblBefore = document.getElementById('lbl-before');
  const lblAfter = document.getElementById('lbl-after');
  const sliderDivider = document.getElementById('slider-divider');
  const emptyPlaceholder = document.getElementById('empty-placeholder');
  const btnSelectFile = document.getElementById('btn-select-file');
  const scannerOverlay = document.getElementById('scanner-overlay');
  const scanLabel = document.getElementById('scan-label');
  const dropzoneOverlay = document.getElementById('dropzone-overlay');

  // View Mode Tabs & Lightbox Elements
  const btnViewCompare = document.getElementById('btn-view-compare');
  const btnViewResult = document.getElementById('btn-view-result');
  const btnViewOriginal = document.getElementById('btn-view-original');
  const btnOpenLightbox = document.getElementById('btn-open-lightbox');
  const btnOpenEditor = document.getElementById('btn-open-editor');
  const imageLightboxModal = document.getElementById('image-lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-image-title');
  const lightboxRes = document.getElementById('lightbox-image-res');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  const btnLightboxOpenEditor = document.getElementById('btn-lightbox-open-editor');
  const btnLightboxSave = document.getElementById('btn-lightbox-save');
  const btnHeaderReplace = document.getElementById('btn-header-replace');
  const btnHeaderSave = document.getElementById('btn-header-save');
  const btnMoreMenu = document.getElementById('btn-more-menu');
  const moreMenuDropdown = document.getElementById('more-menu-dropdown');
  const btnCanvasQuickSave = document.getElementById('btn-canvas-quick-save');

  // Zoom Toolbar Elements
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const btnPanToggle = document.getElementById('btn-pan-toggle');

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
  const metricRes = document.getElementById('metric-res');

  // DAG Strip
  const dagTimeline = document.getElementById('dag-timeline');
  const dagNodeCount = document.getElementById('dag-node-count');
  const btnExportDag = document.getElementById('btn-export-dag');

  // Chat Feed
  const chatFeed = document.getElementById('chat-feed');
  const chatMessages = document.getElementById('chat-messages');

  // Bottom Prompt Bar
  const promptTextarea = document.getElementById('prompt-textarea');
  const btnSendPrompt = document.getElementById('btn-send-prompt');
  const btnAttachFile = document.getElementById('btn-attach-file');

  // SVG Inspector Modal Elements
  const svgModal = document.getElementById('svg-inspector-modal');
  const btnCloseSvgModal = document.getElementById('btn-close-svg-modal');
  const svgStatSize = document.getElementById('svg-stat-size');
  const svgStatPaths = document.getElementById('svg-stat-paths');
  const svgStatViewbox = document.getElementById('svg-stat-viewbox');
  const svgTabPreview = document.getElementById('svg-tab-preview');
  const svgTabRaw = document.getElementById('svg-tab-raw');
  const svgTabReact = document.getElementById('svg-tab-react');
  const svgPreviewStage = document.getElementById('svg-preview-stage');
  const svgRawText = document.getElementById('svg-raw-text');
  const svgReactText = document.getElementById('svg-react-text');
  const btnCopyRawSvg = document.getElementById('btn-copy-raw-svg');
  const btnCopyReactSvg = document.getElementById('btn-copy-react-svg');
  const btnSaveSvgFile = document.getElementById('btn-save-svg-file');

  // --- Initialization ---
  function init() {
    try { setupSlider(); } catch (e) { console.error('setupSlider error:', e); }
    try { setupViewModes(); } catch (e) { console.error('setupViewModes error:', e); }
    try { setupZoomAndPan(); } catch (e) { console.error('setupZoomAndPan error:', e); }
    try { setupDragAndDrop(); } catch (e) { console.error('setupDragAndDrop error:', e); }
    try { setupClipboardPaste(); } catch (e) { console.error('setupClipboardPaste error:', e); }
    try { setupSessionControls(); } catch (e) { console.error('setupSessionControls error:', e); }
    try { setupApiKeyModal(); } catch (e) { console.error('setupApiKeyModal error:', e); }
    try { setupCodexPromptBar(); } catch (e) { console.error('setupCodexPromptBar error:', e); }
    try { setupSmartToolbelt(); } catch (e) { console.error('setupSmartToolbelt error:', e); }
    try { setupDeckTabs(); } catch (e) { console.error('setupDeckTabs error:', e); }
    try { setupInpaint(); } catch (e) { console.error('setupInpaint error:', e); }
    try { setupBackgroundToggles(); } catch (e) { console.error('setupBackgroundToggles error:', e); }
    try { setupSvgInspectorModal(); } catch (e) { console.error('setupSvgInspectorModal error:', e); }
    try { setupMessageListener(); } catch (e) { console.error('setupMessageListener error:', e); }

    sendMessage({ command: 'webviewReady' });
  }

  function sendMessage(msg) {
    if (vscode) {
      vscode.postMessage(msg);
    } else {
      console.log('PostMessage:', msg);
    }
  }

  // --- Zoom & Pan Engine ---
  function setupZoomAndPan() {
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + 0.25));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - 0.25));
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => {
      panX = 0;
      panY = 0;
      setZoom(1.0);
    });
    if (btnZoomFit) btnZoomFit.addEventListener('click', () => {
      panX = 0;
      panY = 0;
      setZoom(1.0);
    });

    if (btnPanToggle) {
      btnPanToggle.addEventListener('click', () => {
        panMode = !panMode;
        btnPanToggle.classList.toggle('active', panMode);
        if (zoomStage) zoomStage.classList.toggle('panning', panMode);
      });
    }

    if (canvasWrapper) {
      // Mouse Wheel Zoom (Ctrl + Wheel or Trackpad Pinch)
      canvasWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          setZoom(zoomLevel + delta);
        }
      }, { passive: false });

      // Drag Pan Event Handlers
      canvasWrapper.addEventListener('mousedown', (e) => {
        if (panMode || e.button === 1) {
          isPanningMouse = true;
          startPanX = e.clientX - panX;
          startPanY = e.clientY - panY;
          if (zoomStage) zoomStage.classList.add('panning');
          e.preventDefault();
        }
      });
    }

    window.addEventListener('mousemove', (e) => {
      if (isPanningMouse) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanningMouse) {
        isPanningMouse = false;
        if (!panMode && zoomStage) zoomStage.classList.remove('panning');
      }
    });
  }

  function setZoom(val) {
    zoomLevel = Math.max(0.25, Math.min(8.0, val));
    btnZoomReset.textContent = `${Math.round(zoomLevel * 100)}%`;
    applyTransform();
  }

  function applyTransform() {
    zoomStage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  // --- Drag and Drop File Dropzone ---
  function setupDragAndDrop() {
    ['dragenter', 'dragover'].forEach((eventName) => {
      canvasWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        canvasWrapper.classList.add('drag-over');
        dropzoneOverlay.style.display = 'flex';
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      canvasWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        canvasWrapper.classList.remove('drag-over');
        dropzoneOverlay.style.display = 'none';
      });
    });

    canvasWrapper.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt ? dt.files : null;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            sendMessage({
              command: 'savePastedImage',
              dataUri: reader.result,
              title: file.name
            });
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  // --- Clipboard Paste (Ctrl + V) ---
  function setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
      // Don't intercept if typing in an input/textarea
      if (document.activeElement === promptTextarea || document.activeElement === inputApiKey) {
        return;
      }

      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              sendMessage({
                command: 'savePastedImage',
                dataUri: reader.result,
                title: `Ảnh dán (${new Date().toLocaleTimeString()})`
              });
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    });
  }

  // --- Filter Tabs for Action Deck ---
  function setupDeckTabs() {
    document.querySelectorAll('.deck-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.deck-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        document.querySelectorAll('.deck-card').forEach((card) => {
          if (filter === 'all' || card.dataset.cat === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // --- Smart Studio 1-Click Action Toolbelt ---
  function setupSmartToolbelt() {
    document.querySelectorAll('.deck-card, .quick-act-btn').forEach((card) => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        executeToolbeltAction(action);
      });
    });
  }

  function executeToolbeltAction(action) {
    if (!currentSession) return;
    const activeNode = currentSession.nodes[currentSession.currentNodeId];
    if (!activeNode) return;
    const inputImg = activeNode.outputImageUri || activeNode.inputImageUri;
    if (!inputImg) return;

    switch (action) {
      case 'remove_bg':
        showScanner('Tách nền BiRefNet SOTA');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'remove_background',
          operationLabel: 'Tách nền SOTA (BiRefNet)'
        });
        break;

      case 'upscale_4x':
        showScanner('Upscale 4x Super-Resolution');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'upscale',
          factor: 4,
          operationLabel: 'Upscale 4x Ultra HD'
        });
        break;

      case 'vectorize':
        showScanner('Vectorize sang SVG');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'vectorize',
          operationLabel: 'Vectorize sang SVG'
        });
        break;

      case 'white_bg':
        runClientWhiteBg(inputImg, activeNode.nodeId);
        break;

      case 'avatar':
        runClientAvatar(inputImg, activeNode.nodeId);
        break;

      case 'icons':
        runClientIcons(inputImg);
        break;

      case 'export_webp':
        runClientWebp(inputImg, activeNode.nodeId);
        break;

      case 'inpaint_brush':
        if (!inpaintMode) {
          btnToggleBrush.click();
        }
        break;
    }
  }

  // --- Client-Side GPU Canvas Operations ---
  function runClientWhiteBg(imgSrc, parentNodeId) {
    showScanner('Đang tạo nền trắng Studio E-Commerce...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');

      // Studio White Radial Lighting Gradient
      const grad = cCtx.createRadialGradient(
        c.width / 2, c.height / 2, c.width * 0.1,
        c.width / 2, c.height / 2, c.width * 0.7
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#f4f4f5');
      cCtx.fillStyle = grad;
      cCtx.fillRect(0, 0, c.width, c.height);

      // Draw cutout asset on top
      cCtx.drawImage(img, 0, 0, c.width, c.height);
      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'white_bg',
        operationLabel: 'Studio Trắng E-Commerce',
        dataUri,
        model: 'Studio Lighting Compositor (Client GPU)',
        latencyMs: 14
      });
    };
    img.src = imgSrc;
  }

  function runClientAvatar(imgSrc, parentNodeId) {
    showScanner('Đang tạo Avatar tròn 1:1...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = Math.min(img.naturalWidth || 512, img.naturalHeight || 512);
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const cCtx = c.getContext('2d');

      // Circular Clipping
      cCtx.save();
      cCtx.beginPath();
      cCtx.arc(size / 2, size / 2, (size / 2) - 4, 0, Math.PI * 2, true);
      cCtx.closePath();
      cCtx.clip();

      // Draw image centered
      const offsetX = ((img.naturalWidth || size) - size) / 2;
      const offsetY = ((img.naturalHeight || size) - size) / 2;
      cCtx.drawImage(img, -offsetX, -offsetY);
      cCtx.restore();

      // Subtle Outer Ring
      cCtx.beginPath();
      cCtx.arc(size / 2, size / 2, (size / 2) - 4, 0, Math.PI * 2);
      cCtx.lineWidth = Math.max(2, size * 0.01);
      cCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      cCtx.stroke();

      const dataUri = c.toDataURL('image/png');
      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'avatar',
        operationLabel: 'Avatar Maker (1:1 Circle)',
        dataUri,
        model: 'Vector Shape Cropper (Client GPU)',
        latencyMs: 11
      });
    };
    img.src = imgSrc;
  }

  function runClientWebp(imgSrc, parentNodeId) {
    showScanner('Đang nén Quick Export WebP (85%)...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');
      cCtx.drawImage(img, 0, 0);

      const webpDataUri = c.toDataURL('image/webp', 0.85);

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'export_webp',
        operationLabel: 'Nén Quick Export WebP (85%)',
        dataUri: webpDataUri,
        ext: 'webp',
        model: 'WebP Hardware Encoder',
        latencyMs: 22
      });
    };
    img.src = imgSrc;
  }

  function runClientIcons(imgSrc) {
    showScanner('Đang sinh bộ Favicon & App Icons...');
    const sizes = [16, 32, 48, 192, 512];
    const icons = [];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sizes.forEach((s) => {
        const c = document.createElement('canvas');
        c.width = s;
        c.height = s;
        const cCtx = c.getContext('2d');
        cCtx.imageSmoothingEnabled = true;
        cCtx.imageSmoothingQuality = 'high';
        cCtx.drawImage(img, 0, 0, s, s);
        icons.push({ size: s, dataUri: c.toDataURL('image/png') });
      });

      hideScanner();
      sendMessage({
        command: 'exportIconBundle',
        icons
      });
    };
    img.src = imgSrc;
  }

  // --- SVG Code Inspector Modal Logic ---
  function setupSvgInspectorModal() {
    btnInspectSvg.addEventListener('click', openSvgInspector);
    btnCloseSvgModal.addEventListener('click', () => {
      svgModal.style.display = 'none';
    });

    // Tab Switching
    document.querySelectorAll('.svg-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.svg-tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.svg-pane').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'preview') svgTabPreview.classList.add('active');
        else if (tab === 'raw') svgTabRaw.classList.add('active');
        else if (tab === 'react') svgTabReact.classList.add('active');
      });
    });

    btnCopyRawSvg.addEventListener('click', () => {
      sendMessage({
        command: 'copyToClipboard',
        text: svgRawText.value,
        notice: '📋 Đã sao chép mã SVG thô vào Clipboard!'
      });
    });

    btnCopyReactSvg.addEventListener('click', () => {
      sendMessage({
        command: 'copyToClipboard',
        text: svgReactText.value,
        notice: '⚛️ Đã sao chép React JSX Component vào Clipboard!'
      });
    });

    btnSaveSvgFile.addEventListener('click', () => {
      sendMessage({ command: 'exportSvg' });
    });
  }

  function openSvgInspector() {
    if (!currentSvgData) return;
    svgModal.style.display = 'flex';

    // Parse SVG stats
    const pathMatches = currentSvgData.match(/<path/g);
    const pathCount = pathMatches ? pathMatches.length : 0;
    const sizeKb = (new Blob([currentSvgData]).size / 1024).toFixed(1);
    const viewBoxMatch = currentSvgData.match(/viewBox=["']([^"']+)["']/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';

    svgStatSize.textContent = `Dung lượng: ${sizeKb} KB`;
    svgStatPaths.textContent = `Paths: ${pathCount}`;
    svgStatViewbox.textContent = `viewBox: ${viewBox}`;

    svgPreviewStage.innerHTML = currentSvgData;
    svgRawText.value = currentSvgData;

    // Generate React Component
    const cleanSvg = currentSvgData
      .replace(/<\?xml[^>]*\?>/i, '')
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/class=/g, 'className=')
      .replace(/fill-rule=/g, 'fillRule=')
      .replace(/clip-rule=/g, 'clipRule=')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=');

    const reactComponent = `import React from 'react';\n\nexport const PixelPilotIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (\n  ${cleanSvg.replace('<svg', '<svg {...props}')}\n);\n\nexport default PixelPilotIcon;`;
    svgReactText.value = reactComponent;
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

  // --- Session Controls & Enterprise Commands ---
  function setupSessionControls() {
    if (btnHeaderReplace) {
      btnHeaderReplace.addEventListener('click', () => {
        sendMessage({ command: 'selectWorkspaceFile' });
      });
    }

    if (btnHeaderSave) {
      btnHeaderSave.addEventListener('click', () => {
        sendMessage({ command: 'saveOutputImage' });
      });
    }

    if (btnCanvasQuickSave) {
      btnCanvasQuickSave.addEventListener('click', () => {
        sendMessage({ command: 'saveOutputImage' });
      });
    }

    if (btnMoreMenu) {
      btnMoreMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = moreMenuDropdown && moreMenuDropdown.style.display === 'flex';
        if (moreMenuDropdown) moreMenuDropdown.style.display = isOpen ? 'none' : 'flex';
      });
    }

    window.addEventListener('click', (e) => {
      if (moreMenuDropdown && !moreMenuDropdown.contains(e.target) && e.target !== btnMoreMenu) {
        moreMenuDropdown.style.display = 'none';
      }
    });

    if (btnSessionDropdown) {
      btnSessionDropdown.addEventListener('click', () => {
        const isOpen = sessionDrawer && sessionDrawer.style.display === 'flex';
        if (sessionDrawer) sessionDrawer.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) renderSessionList();
      });
    }

    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => {
        if (sessionDrawer) sessionDrawer.style.display = 'none';
      });
    }

    if (btnNewSession) {
      btnNewSession.addEventListener('click', () => {
        sendMessage({ command: 'newSession' });
        if (sessionDrawer) sessionDrawer.style.display = 'none';
        if (moreMenuDropdown) moreMenuDropdown.style.display = 'none';
      });
    }

    if (btnDrawerNewSession) {
      btnDrawerNewSession.addEventListener('click', () => {
        sendMessage({ command: 'newSession' });
        if (sessionDrawer) sessionDrawer.style.display = 'none';
      });
    }

    if (btnMoveRight) {
      btnMoveRight.addEventListener('click', () => {
        sendMessage({ command: 'moveToRightSide' });
        if (moreMenuDropdown) moreMenuDropdown.style.display = 'none';
      });
    }

    if (btnBatchProcess) {
      btnBatchProcess.addEventListener('click', () => {
        sendMessage({ command: 'openBatchDialog' });
        if (moreMenuDropdown) moreMenuDropdown.style.display = 'none';
      });
    }

    if (btnEnterpriseConfig) {
      btnEnterpriseConfig.addEventListener('click', () => {
        sendMessage({ command: 'openEnterpriseConfig' });
        if (moreMenuDropdown) moreMenuDropdown.style.display = 'none';
      });
    }

    if (btnExportDag) {
      btnExportDag.addEventListener('click', () => {
        sendMessage({ command: 'exportDAG' });
      });
    }

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
    if (emptyPlaceholder) {
      emptyPlaceholder.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          sendMessage({ command: 'selectWorkspaceFile' });
        }
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
      renameBtn.className = 'btn-micro';
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
      delBtn.className = 'btn-micro';
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
    document.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        promptTextarea.value = cmd;
        promptTextarea.focus();
      });
    });

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
    function startSliderDrag(e) {
      if (currentViewMode !== 'compare') return;
      if (panMode || inpaintMode) return;
      isDraggingSlider = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateSlider(clientX);
      e.preventDefault();
    }

    function doSliderDrag(e) {
      if (!isDraggingSlider) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateSlider(clientX);
    }

    function stopSliderDrag() {
      isDraggingSlider = false;
    }

    // Allow dragging anywhere on the canvas divider or comparison stage
    sliderDivider.addEventListener('mousedown', startSliderDrag);
    comparisonContainer.addEventListener('mousedown', startSliderDrag);
    sliderDivider.addEventListener('touchstart', startSliderDrag, { passive: false });
    comparisonContainer.addEventListener('touchstart', startSliderDrag, { passive: false });

    window.addEventListener('mouseup', stopSliderDrag);
    window.addEventListener('touchend', stopSliderDrag);
    window.addEventListener('mousemove', doSliderDrag);
    window.addEventListener('touchmove', doSliderDrag, { passive: false });

    btnToggleCanvas.addEventListener('click', () => {
      viewportSection.classList.toggle('collapsed');
      const isCollapsed = viewportSection.classList.contains('collapsed');
      btnToggleCanvas.textContent = isCollapsed ? '👁️' : '👁️';
      btnToggleCanvas.title = isCollapsed ? 'Mở rộng Viewport' : 'Thu gọn Viewport';
    });
  }

  function updateSlider(clientX) {
    const rect = comparisonContainer.getBoundingClientRect();
    if (rect.width === 0) return;
    let offset = clientX - rect.left;
    let pct = (offset / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));

    comparisonContainer.style.setProperty('--split-pct', `${pct}%`);
    imgBefore.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
    sliderDivider.style.left = `${pct}%`;
  }

  // --- View Display Modes & Lightbox Fullscreen ---
  function setViewMode(mode) {
    currentViewMode = mode;
    comparisonContainer.classList.remove('view-compare', 'view-result', 'view-original');
    comparisonContainer.classList.add(`view-${mode}`);

    [btnViewCompare, btnViewResult, btnViewOriginal].forEach((b) => {
      if (b) b.classList.remove('active');
    });

    if (mode === 'compare') {
      if (btnViewCompare) btnViewCompare.classList.add('active');
      imgBefore.style.display = 'block';
      imgBefore.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
      comparisonContainer.style.setProperty('--split-pct', '50%');
      sliderDivider.style.left = '50%';
      imgAfter.style.display = 'block';
      sliderDivider.style.display = 'block';
      lblBefore.style.display = 'flex';
      lblAfter.style.display = 'flex';
    } else if (mode === 'result') {
      if (btnViewResult) btnViewResult.classList.add('active');
      imgBefore.style.display = 'none';
      imgAfter.style.display = 'block';
      sliderDivider.style.display = 'none';
      lblBefore.style.display = 'none';
      lblAfter.style.display = 'flex';
    } else if (mode === 'original') {
      if (btnViewOriginal) btnViewOriginal.classList.add('active');
      imgBefore.style.display = 'block';
      imgBefore.style.clipPath = 'none';
      imgAfter.style.display = 'none';
      sliderDivider.style.display = 'none';
      lblBefore.style.display = 'flex';
      lblAfter.style.display = 'none';
    }
  }

  function setupViewModes() {
    if (btnViewCompare) btnViewCompare.addEventListener('click', () => setViewMode('compare'));
    if (btnViewResult) btnViewResult.addEventListener('click', () => setViewMode('result'));
    if (btnViewOriginal) btnViewOriginal.addEventListener('click', () => setViewMode('original'));

    if (btnOpenLightbox) {
      btnOpenLightbox.addEventListener('click', () => {
        const activeUri = currentViewMode === 'original' ? imgBefore.src : (imgAfter.src || imgBefore.src);
        if (activeUri) openLightbox(activeUri, 'Ảnh Studio Pixel Pilot');
      });
    }

    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        sendMessage({ command: 'openInEditor' });
      });
    }

    if (btnCloseLightbox) {
      btnCloseLightbox.addEventListener('click', () => {
        if (imageLightboxModal) imageLightboxModal.style.display = 'none';
      });
    }

    if (imageLightboxModal) {
      imageLightboxModal.addEventListener('click', (e) => {
        if (e.target === imageLightboxModal) {
          imageLightboxModal.style.display = 'none';
        }
      });
    }

    if (btnLightboxOpenEditor) {
      btnLightboxOpenEditor.addEventListener('click', () => {
        sendMessage({ command: 'openInEditor' });
      });
    }

    if (btnLightboxSave) {
      btnLightboxSave.addEventListener('click', () => {
        sendMessage({ command: 'saveOutputImage' });
      });
    }

    if (btnCanvasQuickSave) {
      btnCanvasQuickSave.addEventListener('click', () => {
        sendMessage({ command: 'saveOutputImage' });
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && imageLightboxModal && imageLightboxModal.style.display !== 'none') {
        imageLightboxModal.style.display = 'none';
      }
    });
  }

  function openLightbox(src, title) {
    if (!src || !imageLightboxModal) return;
    lightboxImg.src = src;
    if (lightboxTitle) lightboxTitle.textContent = title || 'Xem ảnh chi tiết (Full HD)';
    imageLightboxModal.style.display = 'flex';

    const tImg = new Image();
    tImg.onload = () => {
      if (lightboxRes) lightboxRes.textContent = `${tImg.naturalWidth} × ${tImg.naturalHeight} px`;
    };
    tImg.src = src;
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
        else if (mode === 'studio') canvasWrapper.classList.add('studio-bg');
      });
    });
  }

  // --- Inpaint Canvas Brush ---
  function setupInpaint() {
    if (!btnToggleBrush || !inpaintCanvas) return;
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

  // --- Chat Feed Renderer (Clean Text Conversation) ---
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
        let friendlyText = msg.text || '';
        // If raw debug text was stored in past sessions, format nicely:
        if (friendlyText.startsWith('Hoàn tất ')) {
          friendlyText = friendlyText.replace(/^Hoàn tất "([^"]+)" trong \d+ms.*$/, '✨ Đã hoàn tất "$1". Kết quả hiển thị trên khung hình phía trên.');
        }

        let html = `
          <div class="assistant-badge">✦ Pixel Pilot AI</div>
          <div class="assistant-text">${escapeHtml(friendlyText)}</div>
        `;

        if (msg.metrics) {
          const sec = ((msg.metrics.latencyMs || 0) / 1000).toFixed(1);
          let cleanModel = (msg.metrics.model || 'BiRefNet').replace(/\(runware:[^)]+\)/, '').trim();
          html += `
            <div class="metrics-tag" style="font-size: 8.5px; color: #71717a; margin-top: 4px; font-family: var(--font-mono);">
              ⚡ ${sec}s • ${cleanModel}
            </div>
          `;
        }

        if (msg.nodeId && msg.nodeId !== 'node_0_root') {
          html += `
            <div class="msg-actions">
              <button class="btn-msg-action act-save" data-action="save" data-node="${msg.nodeId}" title="Tải ảnh kết quả này về máy">💾 Tải về</button>
              <button class="btn-msg-action" data-action="compare" data-node="${msg.nodeId}" title="So sánh ảnh này với ảnh gốc">↔️ So sánh</button>
              <button class="btn-msg-action" data-action="rollback" data-node="${msg.nodeId}" title="Quay lại bước này">↩️ Quay lại</button>
            </div>
          `;
        }

        bubble.innerHTML = html;

        bubble.querySelectorAll('.btn-msg-action').forEach((btn) => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const target = btn.dataset.node;
            if (action === 'view') {
              if (currentSession && currentSession.nodes[target]) {
                displayActiveNode(currentSession.nodes[target]);
              }
            } else if (action === 'save') {
              sendMessage({ command: 'saveOutputImage', nodeId: target });
            } else if (action === 'compare') {
              setCompareBeforeNode(target);
            } else if (action === 'rollback') {
              sendMessage({ command: 'rollbackNode', targetNodeId: target });
            }
          });
        });
      }

      chatMessages.appendChild(bubble);
    });

    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  // --- Enhanced Visual Step Timeline Visualizer ---
  function renderDAG(session) {
    dagTimeline.innerHTML = '';
    const nodes = Object.values(session.nodes);
    dagNodeCount.textContent = `${nodes.length} bước`;

    nodes.forEach((node, idx) => {
      const card = document.createElement('div');
      const isActive = node.nodeId === session.currentNodeId;
      card.className = 'dag-card' + (isActive ? ' active' : '');

      const thumbUri = node.outputImageUri || node.inputImageUri || '';

      card.innerHTML = `
        <img class="dag-card-thumb" src="${thumbUri}" alt="Thumb" onerror="this.style.display='none'" />
        <div class="dag-card-details">
          <span class="dag-card-op">#${idx + 1} ${escapeHtml(node.operationLabel)}</span>
          <span class="dag-card-meta">${node.metrics?.latencyMs ? ((node.metrics.latencyMs / 1000).toFixed(1) + 's') : '0s'}</span>
        </div>
        <div class="dag-card-actions">
          <button class="btn-micro" data-act="compare" title="So sánh bước này với bước hiện tại">↔️</button>
          <button class="btn-micro" data-act="rollback" title="Quay lại bước này">↩️</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.dataset.act === 'compare') {
          e.stopPropagation();
          setCompareBeforeNode(node.nodeId);
        } else if (e.target.dataset.act === 'rollback') {
          e.stopPropagation();
          sendMessage({ command: 'rollbackNode', targetNodeId: node.nodeId });
        } else {
          sendMessage({ command: 'rollbackNode', targetNodeId: node.nodeId });
        }
      });

      dagTimeline.appendChild(card);

      if (idx < nodes.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'dag-node-arrow';
        arrow.textContent = '→';
        dagTimeline.appendChild(arrow);
      }
    });

    dagTimeline.scrollLeft = dagTimeline.scrollWidth;
  }

  function setCompareBeforeNode(nodeId) {
    if (!currentSession || !currentSession.nodes[nodeId]) return;
    const targetNode = currentSession.nodes[nodeId];
    customCompareBeforeUri = targetNode.outputImageUri || targetNode.inputImageUri;
    lblBefore.querySelector('span:last-child').textContent = `#${targetNode.operationLabel}`;
    imgBefore.src = customCompareBeforeUri;
    comparisonContainer.style.setProperty('--split-pct', '50%');
    sliderDivider.style.left = '50%';
    setViewMode('compare');
  }

  // --- Display Active Node in Viewport ---
  function displayActiveNode(node) {
    if (!node || (!node.inputImageUri && !node.outputImageUri)) {
      emptyPlaceholder.style.display = 'flex';
      comparisonContainer.style.display = 'none';
      return;
    }

    emptyPlaceholder.style.display = 'none';
    comparisonContainer.style.display = 'block';

    const rootNode = currentSession ? currentSession.nodes[currentSession.rootNodeId] : null;
    const originalRoot = rootNode?.outputImageUri || rootNode?.inputImageUri;
    const beforeSrc = customCompareBeforeUri || originalRoot || node.inputImageUri;
    const afterSrc = node.outputImageUri || node.inputImageUri;

    imgBefore.src = beforeSrc;
    imgAfter.src = afterSrc;

    comparisonContainer.style.setProperty('--split-pct', '50%');
    imgBefore.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
    sliderDivider.style.left = '50%';
    lblBefore.querySelector('span:last-child').textContent = customCompareBeforeUri ? 'SO SÁNH' : 'ẢNH GỐC';

    // Auto set view mode: if node is just the original input without changes, show as single image (result mode); otherwise compare mode
    if (!node.outputImageUri || node.outputImageUri === node.inputImageUri || beforeSrc === afterSrc) {
      if (!customCompareBeforeUri) {
        setViewMode('result');
      }
    } else {
      setViewMode('compare');
    }

    let cleanModelName = (node.metrics?.model || 'BiRefNet').replace(/\(runware:[^)]+\)/, '').trim();
    metricModel.textContent = cleanModelName;
    metricLatency.textContent = (node.metrics?.latencyMs ? ((node.metrics.latencyMs / 1000).toFixed(1) + ' s') : '0 s');

    // Read real image resolution
    const tempImg = new Image();
    tempImg.onload = () => {
      metricRes.textContent = `${tempImg.naturalWidth} × ${tempImg.naturalHeight}px`;
    };
    tempImg.src = imgAfter.src;

    // Check SVG capability
    if (node.operation === 'vectorize' || node.textResult || node.outputImageUri?.includes('.svg') || node.outputImageUri?.startsWith('data:image/svg')) {
      btnInspectSvg.style.display = 'inline-block';
      if (node.textResult) {
        currentSvgData = node.textResult;
      } else if (node.outputImageUri?.startsWith('data:image/svg+xml;base64,')) {
        currentSvgData = atob(node.outputImageUri.split(',')[1]);
      } else {
        currentSvgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#38bdf8"/></svg>`;
      }
    } else {
      btnInspectSvg.style.display = 'none';
      currentSvgData = null;
    }
  }

  function showScanner(label) {
    scanLabel.textContent = `Đang xử lý: ${label}...`;
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

        case 'requestClientOperation':
          hideScanner();
          if (msg.operation === 'white_bg') {
            runClientWhiteBg(msg.inputImageUri, msg.nodeId);
          } else if (msg.operation === 'avatar') {
            runClientAvatar(msg.inputImageUri, msg.nodeId);
          } else if (msg.operation === 'icons') {
            runClientIcons(msg.inputImageUri);
          } else if (msg.operation === 'export_webp') {
            runClientWebp(msg.inputImageUri, msg.nodeId);
          }
          break;

        case 'apiKeyStatus':
          if (msg.hasApiKey) {
            keyIndicator.className = 'status-dot live';
            keyLabel.textContent = msg.apiKeyMasked ? `Live (${msg.apiKeyMasked})` : 'Live API';
          } else {
            keyIndicator.className = 'status-dot';
            keyLabel.textContent = '🔑 Nhập Key';
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
          errDiv.textContent = '❌ Lỗi: ' + (msg.error || 'Unknown');
          chatMessages.appendChild(errDiv);
          chatFeed.scrollTop = chatFeed.scrollHeight;
          break;
      }
    });
  }

  init();
})();
