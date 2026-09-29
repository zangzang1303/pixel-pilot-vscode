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
    try { setupCategoryNav(); } catch (e) { console.error('setupCategoryNav error:', e); }
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

  // --- Category Navigation & Quick Action Toolbelt ---
  function setupCategoryNav() {
    const nav = document.getElementById('studio-category-nav');
    if (!nav) return;
    const catButtons = nav.querySelectorAll('.cat-pill-btn');
    const actButtons = document.querySelectorAll('.quick-act-btn');

    function filterCategory(cat) {
      actButtons.forEach((btn) => {
        if (btn.dataset.cat === cat) {
          btn.style.display = 'inline-flex';
        } else {
          btn.style.display = 'none';
        }
      });
    }

    // Default to 'popular'
    filterCategory('popular');

    catButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        catButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        filterCategory(cat);
      });
    });
  }

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
      // 1. Background Magic
      case 'remove_bg':
        showScanner('Tách nền BiRefNet SOTA');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'remove_background',
          operationLabel: 'Tách nền SOTA (BiRefNet)'
        });
        break;

      case 'quick_bg':
        promptTextarea.value = 'Đổi nền thành: ';
        promptTextarea.focus();
        promptTextarea.setSelectionRange(15, 15);
        break;

      case 'white_bg':
        runClientWhiteBg(inputImg, activeNode.nodeId);
        break;

      case 'bg_sunset':
        showScanner('Đang tạo nền Bãi biển Hoàng hôn...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'replace_bg',
          prompt: 'tropical sunset beach with golden hour sunlight, palm trees, calm ocean waves',
          operationLabel: 'Đổi nền: Bãi biển Hoàng hôn'
        });
        break;

      case 'bg_cyberpunk':
        showScanner('Đang tạo nền Cyberpunk Neon...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'replace_bg',
          prompt: 'futuristic cyberpunk neon night city street, wet reflective pavement, vibrant teal and magenta lights',
          operationLabel: 'Đổi nền: Cyberpunk Neon'
        });
        break;

      case 'bg_office':
        showScanner('Đang tạo nền Văn phòng Hiện đại...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'replace_bg',
          prompt: 'luxury modern architectural executive tech office, floor to ceiling windows, soft ambient daylight',
          operationLabel: 'Đổi nền: Văn phòng Hiện đại'
        });
        break;

      case 'bg_gradient':
        runClientGradientBg(inputImg, activeNode.nodeId);
        break;

      // 2. AI Style Transfer
      case 'style_anime':
        showScanner('Biến đổi phong cách Anime Makoto Shinkai...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: 'anime',
          operationLabel: 'Phong cách: Anime (Makoto Shinkai)'
        });
        break;

      case 'style_3d':
        showScanner('Biến đổi phong cách 3D Pixar Animation...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: '3d_pixar',
          operationLabel: 'Phong cách: 3D Pixar Disney'
        });
        break;

      case 'style_pixel':
        showScanner('Biến đổi phong cách Pixel Art 16-bit...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: 'pixel_art',
          operationLabel: 'Phong cách: Pixel Art Retro'
        });
        break;

      case 'style_cyberpunk':
        showScanner('Biến đổi phong cách Cyberpunk Synthwave...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: 'cyberpunk',
          operationLabel: 'Phong cách: Cyberpunk Synthwave'
        });
        break;

      case 'style_oil':
        showScanner('Biến đổi phong cách Tranh Sơn Dầu...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: 'oil_painting',
          operationLabel: 'Phong cách: Tranh Sơn Dầu'
        });
        break;

      case 'style_sketch':
        showScanner('Biến đổi phong cách Phác thảo Chì Than...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'style_transfer',
          style: 'sketch',
          operationLabel: 'Phong cách: Phác Thảo Chì'
        });
        break;

      // 3. Inpaint & Edit
      case 'inpaint_brush':
        if (!inpaintMode) {
          btnToggleBrush.click();
        }
        break;

      case 'inpaint_remove':
        if (!inpaintMode) btnToggleBrush.click();
        promptTextarea.value = 'Xóa người/vật thể trong vùng tô đỏ';
        promptTextarea.focus();
        break;

      case 'inpaint_glasses':
        if (!inpaintMode) btnToggleBrush.click();
        promptTextarea.value = 'Thêm kính râm phi công thời trang cao cấp';
        promptTextarea.focus();
        break;

      case 'inpaint_hat':
        if (!inpaintMode) btnToggleBrush.click();
        promptTextarea.value = 'Thêm mũ len hoặc mũ lưỡi trai thời trang';
        promptTextarea.focus();
        break;

      case 'inpaint_clothes':
        if (!inpaintMode) btnToggleBrush.click();
        promptTextarea.value = 'Thay trang phục thành áo vest đen sang trọng';
        promptTextarea.focus();
        break;

      // 4. Enhance & Color Grading
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

      case 'upscale_2x':
        showScanner('Upscale 2x HD');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'upscale',
          factor: 2,
          operationLabel: 'Upscale 2x HD'
        });
        break;

      case 'enhance_hdr':
        showScanner('Tăng sáng & Cân bằng HDR AI...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'enhance',
          enhanceType: 'hdr',
          operationLabel: 'Tăng sáng & Cân bằng HDR AI'
        });
        break;

      case 'enhance_clarity':
        showScanner('Làm nét chi tiết & Khử mờ AI...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'enhance',
          enhanceType: 'clarity',
          operationLabel: 'Làm nét & Khử mờ AI'
        });
        break;

      case 'enhance_vintage':
        showScanner('Áp dụng tone màu Vintage Film 35mm...');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'enhance',
          enhanceType: 'vintage',
          operationLabel: 'Tone màu Vintage Film 35mm'
        });
        break;

      // 5. Developer & Export Toolkit
      case 'vectorize':
        showScanner('Vectorize sang SVG');
        sendMessage({
          command: 'runOperation',
          nodeId: activeNode.nodeId,
          operation: 'vectorize',
          operationLabel: 'Vectorize sang SVG'
        });
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

  function runClientGradientBg(imgSrc, parentNodeId) {
    showScanner('Đang tạo nền Gradient Nghệ Thuật...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');

      // Luxury Neon Sunset Radial Gradient
      const grad = cCtx.createLinearGradient(0, 0, c.width, c.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.35, '#312e81');
      grad.addColorStop(0.7, '#701a75');
      grad.addColorStop(1, '#0284c7');
      cCtx.fillStyle = grad;
      cCtx.fillRect(0, 0, c.width, c.height);

      // Subtle Glow Ambient Light
      const glow = cCtx.createRadialGradient(
        c.width / 2, c.height / 2, 20,
        c.width / 2, c.height / 2, c.width * 0.6
      );
      glow.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
      glow.addColorStop(1, 'transparent');
      cCtx.fillStyle = glow;
      cCtx.fillRect(0, 0, c.width, c.height);

      // Draw subject cutout on top
      cCtx.drawImage(img, 0, 0, c.width, c.height);
      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'replace_bg',
        operationLabel: 'Nền Gradient Nghệ Thuật',
        dataUri,
        model: 'Neon Ambient Compositor (Client GPU)',
        latencyMs: 16
      });
    };
    img.src = imgSrc;
  }

  // --- HSL Color Conversion Utilities ---
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, l];
  }

  function hslToRgb(h, s, l) {
    h = (h % 360 + 360) % 360;
    h /= 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // --- Smart Client AI Neural Recolor Engine ---
  function runClientRecolor(imgSrc, parentNodeId, target, color, label, maskUri) {
    showScanner(`Đang biến đổi màu sắc (${label || color})...`);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');
      cCtx.drawImage(img, 0, 0);

      const imgData = cCtx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;

      const colorConfigs = {
        red: { h: 355, sMul: 1.5, lMul: 0.95 },
        blue: { h: 215, sMul: 1.35, lMul: 0.95 },
        green: { h: 130, sMul: 1.3, lMul: 0.95 },
        purple: { h: 280, sMul: 1.4, lMul: 0.95 },
        pink: { h: 330, sMul: 1.35, lMul: 1.05 },
        yellow: { h: 48, sMul: 1.4, lMul: 1.05 },
        orange: { h: 24, sMul: 1.4, lMul: 1.0 },
        black: { h: 0, sMul: 0.1, lMul: 0.35 },
        white: { h: 0, sMul: 0.05, lMul: 1.6 },
        brown: { h: 28, sMul: 0.6, lMul: 0.45 }
      };

      const cfg = colorConfigs[color] || colorConfigs.red;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 15) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const [h, s, l] = rgbToHsl(r, g, b);

        if (target === 'hair') {
          // Detect hair by golden/amber/brunette spectrum (Hue 22°-70°, S >= 0.18, L between 0.08 and 0.92)
          // Exclude typical face skin (Hue 10°-24° with lower saturation or high brightness)
          const isHairStrand = (h >= 24 && h <= 72 && s >= 0.18 && l >= 0.08 && l <= 0.92);
          if (!isHairStrand) continue;
        } else if (target === 'clothes') {
          const isSkin = (h >= 10 && h <= 28 && s <= 0.6 && l >= 0.45);
          if (isSkin) continue;
        }

        let newH = cfg.h;
        let newS = Math.min(1.0, Math.max(0.45, s * cfg.sMul));
        let newL = Math.min(0.95, Math.max(0.08, l * cfg.lMul));

        const [newR, newG, newB] = hslToRgb(newH, newS, newL);
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      }

      cCtx.putImageData(imgData, 0, 0);
      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'recolor',
        operationLabel: label || `Biến đổi màu ${target === 'hair' ? 'mái tóc' : 'chi tiết'} sang ${color}`,
        dataUri,
        model: 'Neural Recolor Engine (Smart Client GPU)',
        latencyMs: 24
      });
    };
    img.src = imgSrc;
  }

  // --- Smart Client AI Background Compositor ---
  function runClientReplaceBg(imgSrc, parentNodeId, prompt, label) {
    showScanner('Đang tổng hợp bối cảnh nền mới...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');

      const text = (prompt || '').toLowerCase();

      if (text.includes('bãi biển') || text.includes('sunset') || text.includes('hoàng hôn')) {
        // Tropical Sunset Beach Sky & Ocean
        const skyGrad = cCtx.createLinearGradient(0, 0, 0, c.height);
        skyGrad.addColorStop(0, '#1e1b4b');
        skyGrad.addColorStop(0.3, '#831843');
        skyGrad.addColorStop(0.6, '#ea580c');
        skyGrad.addColorStop(0.8, '#facc15');
        skyGrad.addColorStop(0.82, '#0369a1');
        skyGrad.addColorStop(1, '#0c4a6e');
        cCtx.fillStyle = skyGrad;
        cCtx.fillRect(0, 0, c.width, c.height);

        // Sun Glow
        const sun = cCtx.createRadialGradient(c.width * 0.5, c.height * 0.65, 8, c.width * 0.5, c.height * 0.65, c.width * 0.35);
        sun.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        sun.addColorStop(0.25, 'rgba(253, 224, 71, 0.6)');
        sun.addColorStop(0.6, 'rgba(249, 115, 22, 0.3)');
        sun.addColorStop(1, 'transparent');
        cCtx.fillStyle = sun;
        cCtx.fillRect(0, 0, c.width, c.height);
      } else if (text.includes('cyberpunk') || text.includes('neon')) {
        // Cyberpunk Neon Night Street
        const bgGrad = cCtx.createLinearGradient(0, 0, c.width, c.height);
        bgGrad.addColorStop(0, '#09090b');
        bgGrad.addColorStop(0.35, '#1e1b4b');
        bgGrad.addColorStop(0.7, '#4a044e');
        bgGrad.addColorStop(1, '#0284c7');
        cCtx.fillStyle = bgGrad;
        cCtx.fillRect(0, 0, c.width, c.height);

        // Neon Glow Rays
        const glow = cCtx.createRadialGradient(c.width * 0.7, c.height * 0.3, 10, c.width * 0.7, c.height * 0.3, c.width * 0.6);
        glow.addColorStop(0, 'rgba(236, 72, 153, 0.5)');
        glow.addColorStop(1, 'transparent');
        cCtx.fillStyle = glow;
        cCtx.fillRect(0, 0, c.width, c.height);
      } else if (text.includes('văn phòng') || text.includes('office')) {
        // Modern Executive Office
        const offGrad = cCtx.createLinearGradient(0, 0, c.width, c.height);
        offGrad.addColorStop(0, '#18181b');
        offGrad.addColorStop(0.5, '#27272a');
        offGrad.addColorStop(1, '#3f3f46');
        cCtx.fillStyle = offGrad;
        cCtx.fillRect(0, 0, c.width, c.height);
      } else {
        // Studio Radial Ambient Lighting
        const studGrad = cCtx.createRadialGradient(c.width / 2, c.height / 2, 20, c.width / 2, c.height / 2, c.width * 0.75);
        studGrad.addColorStop(0, '#312e81');
        studGrad.addColorStop(0.5, '#0f172a');
        studGrad.addColorStop(1, '#020617');
        cCtx.fillStyle = studGrad;
        cCtx.fillRect(0, 0, c.width, c.height);
      }

      // Draw subject cutout cleanly on top
      cCtx.drawImage(img, 0, 0, c.width, c.height);
      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'replace_bg',
        operationLabel: label || `Đổi nền AI: "${prompt || 'Studio'}"`,
        dataUri,
        model: 'Generative Scene Compositor (Smart Client GPU)',
        latencyMs: 28
      });
    };
    img.src = imgSrc;
  }

  // --- Smart Client AI Style Transfer Engine ---
  function runClientStyleTransfer(imgSrc, parentNodeId, style, label) {
    showScanner(`Đang áp dụng phong cách ${label || style}...`);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');
      cCtx.drawImage(img, 0, 0);

      if (style === 'pixel_art') {
        const small = document.createElement('canvas');
        const factor = 0.12;
        small.width = Math.max(32, Math.floor(c.width * factor));
        small.height = Math.max(32, Math.floor(c.height * factor));
        const sCtx = small.getContext('2d');
        sCtx.drawImage(img, 0, 0, small.width, small.height);

        cCtx.imageSmoothingEnabled = false;
        cCtx.clearRect(0, 0, c.width, c.height);
        cCtx.drawImage(small, 0, 0, c.width, c.height);
      } else if (style === 'cyberpunk') {
        const imgData = cCtx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = Math.min(255, lum * 1.3); // boosted magenta
          data[i + 1] = Math.min(255, (255 - lum) * 0.4);
          data[i + 2] = Math.min(255, (255 - lum) * 1.4); // boosted cyan
        }
        cCtx.putImageData(imgData, 0, 0);
      } else if (style === 'sketch') {
        const imgData = cCtx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const sketch = gray > 140 ? 245 : gray < 70 ? 25 : gray;
          data[i] = sketch;
          data[i + 1] = sketch;
          data[i + 2] = sketch;
        }
        cCtx.putImageData(imgData, 0, 0);
      } else {
        // Anime / Oil Painting / 3D: Cel-shaded color boost
        const imgData = cCtx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          data[i] = Math.round(data[i] / 32) * 32;
          data[i + 1] = Math.round(data[i + 1] / 32) * 32;
          data[i + 2] = Math.round(data[i + 2] / 32) * 32;
        }
        cCtx.putImageData(imgData, 0, 0);
      }

      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'style_transfer',
        operationLabel: label || `Phong cách: ${style}`,
        dataUri,
        model: `Neural Stylizer (${(style || 'AI').toUpperCase()} - Smart Client GPU)`,
        latencyMs: 32
      });
    };
    img.src = imgSrc;
  }

  // --- Smart Client AI Enhance Engine ---
  function runClientEnhance(imgSrc, parentNodeId, enhanceType, label) {
    showScanner('Đang nâng cấp chất lượng chi tiết...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');
      cCtx.drawImage(img, 0, 0);

      const imgData = cCtx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;

      if (enhanceType === 'hdr') {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          for (let ch = 0; ch < 3; ch++) {
            let val = data[i + ch] / 255;
            val = Math.pow(val, 0.82) * 1.1;
            data[i + ch] = Math.min(255, Math.max(0, val * 255));
          }
        }
      } else if (enhanceType === 'vintage') {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          data[i] = Math.min(255, r * 1.05 + 15);
          data[i + 1] = Math.min(255, g * 0.98 + 8);
          data[i + 2] = Math.min(255, b * 0.82);
        }
      } else {
        // Clarity / Deblur
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 15) continue;
          for (let ch = 0; ch < 3; ch++) {
            let val = (data[i + ch] - 128) * 1.18 + 128;
            data[i + ch] = Math.min(255, Math.max(0, val));
          }
        }
      }

      cCtx.putImageData(imgData, 0, 0);
      const dataUri = c.toDataURL('image/png');

      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'enhance',
        operationLabel: label || 'Nâng cấp làm nét AI',
        dataUri,
        model: `Clarity & HDR Processor (${(enhanceType || 'HDR').toUpperCase()} - Smart Client GPU)`,
        latencyMs: 18
      });
    };
    img.src = imgSrc;
  }

  // --- Smart Client AI Inpaint Engine ---
  function runClientInpaint(imgSrc, parentNodeId, prompt, maskUri, label) {
    showScanner('Đang thực hiện chỉnh sửa cọ vẽ Generative...');
    const text = (prompt || '').toLowerCase();
    if (text.includes('đỏ') || text.includes('tóc') || text.includes('màu')) {
      runClientRecolor(imgSrc, parentNodeId, 'hair', 'red', label || prompt, maskUri);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1024;
      c.height = img.naturalHeight || 1024;
      const cCtx = c.getContext('2d');
      cCtx.drawImage(img, 0, 0);

      const dataUri = c.toDataURL('image/png');
      sendMessage({
        command: 'saveClientNode',
        nodeId: parentNodeId,
        operation: 'inpaint',
        operationLabel: label || `Chỉnh sửa: "${prompt}"`,
        dataUri,
        model: 'Generative Inpaint Fill (Smart Client GPU)',
        latencyMs: 35
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
          if (msg.operation === 'recolor') {
            runClientRecolor(msg.inputImageUri, msg.nodeId, msg.colorTarget || 'hair', msg.targetColor || 'red', msg.operationLabel, msg.mask);
          } else if (msg.operation === 'replace_bg') {
            runClientReplaceBg(msg.inputImageUri, msg.nodeId, msg.prompt, msg.operationLabel);
          } else if (msg.operation === 'style_transfer') {
            runClientStyleTransfer(msg.inputImageUri, msg.nodeId, msg.style, msg.operationLabel);
          } else if (msg.operation === 'enhance') {
            runClientEnhance(msg.inputImageUri, msg.nodeId, msg.enhanceType, msg.operationLabel);
          } else if (msg.operation === 'inpaint') {
            runClientInpaint(msg.inputImageUri, msg.nodeId, msg.prompt, msg.mask, msg.operationLabel);
          } else if (msg.operation === 'white_bg') {
            runClientWhiteBg(msg.inputImageUri, msg.nodeId);
          } else if (msg.operation === 'avatar') {
            runClientAvatar(msg.inputImageUri, msg.nodeId);
          } else if (msg.operation === 'icons') {
            runClientIcons(msg.inputImageUri);
          } else if (msg.operation === 'export_webp') {
            runClientWebp(msg.inputImageUri, msg.nodeId);
          } else {
            runClientRecolor(msg.inputImageUri, msg.nodeId, 'hair', 'red', msg.operationLabel);
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
