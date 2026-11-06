// extension.ts - Entrypoint for Pixel Pilot VS Code Extension
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { promisify } from 'util';
import sharp from 'sharp';
import { PixelPilotViewProvider } from './providers/PixelPilotViewProvider';
import { BatchProcessor } from './services/batch/BatchProcessor';
import { OperationType } from './services/session/types';
import { StudioPanel } from './panels/StudioPanel';
import { InvokeApiService } from './services/InvokeApiService';
import { FileSystemUtils } from './utils/fileSystem';
import { ImageProcessor } from './services/image/ImageProcessor';
import { ComfyUIAdapter } from './services/ai/ComfyUIAdapter';
import { PriorityToolExecutors } from './services/tools/PriorityToolExecutors';
import { PolicyService } from './services/security/PolicyService';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  console.log('✨ Pixel Pilot Enterprise Vision Studio is now active!');

  // Register the 5 priority tool executors (B16)
  PriorityToolExecutors.registerAll();

  const invokeApi = new InvokeApiService();
  const policy = new PolicyService();
  const setupDoctorOutput = vscode.window.createOutputChannel('Pixel Pilot Setup Doctor');
  context.subscriptions.push(setupDoctorOutput);
  const loadRecolorPythonPath = () => {
    ImageProcessor.setRecolorPythonPath(vscode.workspace.getConfiguration('pixelPilot').get<string>('recolorPythonPath', ''));
  };
  loadRecolorPythonPath();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('pixelPilot.recolorPythonPath')) loadRecolorPythonPath();
  }));

  // 1. Register the Sidebar Webview Provider
  const provider = new PixelPilotViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PixelPilotViewProvider.viewType, provider)
  );

  // 2. Open Canvas Studio Panel (React + Tailwind + InvokeAI)
  const openStudioHandler = (uri?: vscode.Uri) => {
    StudioPanel.createOrShow(context.extensionUri, provider, uri);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('pixel-pilot.openStudio', openStudioHandler),
    vscode.commands.registerCommand('pixelPilot.openStudio', openStudioHandler)
  );

  // 3. Command: Open Sidebar View
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.openSidebar', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
    })
  );

  // Diagnose only the dependencies selected by the user; this command never calls a cloud provider.
  context.subscriptions.push(vscode.commands.registerCommand('pixelPilot.diagnoseSetup', async (taskId?: string) => {
    const tasks = [
      { label: 'Tác vụ cơ bản (Sharp)', value: 'sharp' },
      { label: 'Tách nền cục bộ (ComfyUI)', value: 'comfy' },
      { label: 'Đổi màu chọn lọc (Python / ONNX / ComfyUI)', value: 'recolor' },
      { label: 'Sinh ảnh (InvokeAI)', value: 'invoke' },
      { label: 'Runware cloud (API key)', value: 'runware' }
    ];
    const task = taskId
      ? tasks.find(candidate => candidate.value === taskId)
      : await vscode.window.showQuickPick(tasks, { placeHolder: 'Chọn tác vụ cần kiểm tra. Chỉ các phụ thuộc liên quan sẽ được kiểm tra.' });
    if (taskId && !task) throw new Error(`Unknown Setup Doctor task: ${taskId}`);
    if (!task) return;

    const lines: string[] = [`Pixel Pilot Setup Doctor — ${task.label}`, `Thời điểm: ${new Date().toISOString()}`, ''];
    const report = (ok: boolean, name: string, detail: string, fix?: string) => {
      lines.push(`${ok ? '[PASS]' : '[NEEDS SETUP]'} ${name}: ${detail}`);
      if (!ok && fix) lines.push(`  Cách khắc phục: ${fix}`);
    };

    if (task.value === 'sharp') {
      try {
        const probe = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000000' } }).png().toBuffer();
        await ImageProcessor.getInstance().processImage(probe, { format: 'png' });
        report(true, 'Sharp', 'Đã xử lý ảnh PNG kiểm tra cục bộ.');
      } catch (error: any) {
        report(false, 'Sharp', error?.message || String(error), 'Cài lại Pixel Pilot từ VSIX phù hợp với hệ điều hành và kiến trúc hiện tại.');
      }
    }

    if (task.value === 'comfy' || task.value === 'recolor') {
      const comfy = new ComfyUIAdapter();
      const online = await comfy.ping();
      report(online, `ComfyUI ${comfy.getBaseUrl()}`, online ? 'Server phản hồi.' : 'Không kết nối được server.', 'Khởi động ComfyUI hoặc cấu hình server tại địa chỉ mặc định http://127.0.0.1:8188.');
      if (online) {
        const setup = await comfy.getRmbgSetupStatus();
        if (setup.error) report(false, 'ComfyUI object_info', setup.error, 'Kiểm tra server và API /object_info.');
        else {
          report(Boolean(setup.node), 'Node tách nền', setup.node ? `Tìm thấy node ${setup.node}.` : 'Không tìm thấy node tách nền được hỗ trợ.', 'Cài custom node tách nền tương thích và khởi động lại ComfyUI.');
          if (setup.model === 'available') report(true, 'Model tách nền ComfyUI', `Tìm thấy ${setup.modelName}.`);
          else if (setup.model === 'missing') report(false, 'Model tách nền ComfyUI', setup.modelIssue || 'Không tìm thấy model.', 'Cài LoadBackgroundRemovalModel và foreground model tương thích, sau đó khởi động lại ComfyUI.');
          else if (setup.node) lines.push('[UNVERIFIED] Model tách nền ComfyUI: node này không công bố danh sách model qua object_info. Chạy smoke provider local để xác nhận weights và workflow.');
        }
      }
    }

    if (task.value === 'recolor') {
      const root = context.extensionPath;
      const python = ImageProcessor.getRecolorPythonPath();
      const pythonExists = Boolean(python && fs.existsSync(python));
      report(pythonExists, 'Python', pythonExists ? 'Đường dẫn cấu hình tồn tại.' : 'Chưa cấu hình hoặc không tìm thấy python.exe.', 'Đặt pixelPilot.recolorPythonPath trong Settings hoặc biến PIXEL_PILOT_PYTHON.');
      const scriptExists = fs.existsSync(path.join(root, 'scripts', 'recolor_mask.py'));
      report(scriptExists, 'Mask script', scriptExists ? 'recolor_mask.py có sẵn.' : 'Không tìm thấy script.', 'Cài lại extension từ VSIX đầy đủ.');
      const modelPath = path.join(root, '.pixelpilot_runtime', 'selfie_multiclass.onnx');
      if (fs.existsSync(modelPath)) {
        const expectedHash = '35EC1ECD9EE7F85073C99C00020B7F6751B69506EEACF683BC8665F6117F85B0';
        try {
          const actualHash = createHash('sha256').update(await fs.promises.readFile(modelPath)).digest('hex').toUpperCase();
          report(actualHash === expectedHash, 'ONNX model', actualHash === expectedHash ? 'Model có SHA-256 đúng phiên bản đã ghim.' : `SHA-256 không khớp: ${actualHash}.`, 'Chạy scripts/setup_recolor.ps1 để tải lại model đúng hash.');
        } catch (error: any) {
          report(false, 'ONNX model', error?.message || String(error), 'Kiểm tra quyền đọc model rồi chạy lại Setup Doctor.');
        }
      } else report(false, 'ONNX model', 'Chưa có model tại .pixelpilot_runtime/selfie_multiclass.onnx.', 'Chạy scripts/setup_recolor.ps1 sau khi xác minh nguồn tải và hash model.');
      if (pythonExists) {
        const runtimeDir = path.join(root, '.pixelpilot_runtime');
        try {
          const runtime = await execFileAsync(python, ['-c', 'import onnxruntime; print(onnxruntime.__version__)'], {
            encoding: 'utf8', timeout: 5000, windowsHide: true,
            env: { ...process.env, PYTHONPATH: [runtimeDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
          });
          report(true, 'ONNX Runtime', `Import được phiên bản ${runtime.stdout.trim()}.`);
        } catch (error: any) {
          report(false, 'ONNX Runtime', error?.stderr?.trim() || error?.message || String(error), 'Chạy scripts/setup_recolor.ps1 với đúng Python; script thiết lập runtime vào .pixelpilot_runtime.');
        }
      }
    }

    if (task.value === 'invoke') {
      const online = await invokeApi.ping();
      report(online, `InvokeAI ${invokeApi.getBaseUrl()}`, online ? 'Server phản hồi.' : 'Không kết nối được server.', 'Khởi động InvokeAI hoặc chỉnh pixelPilot.invokeAIServerUrl.');
      if (online) {
        const models = await invokeApi.getModels(5000);
        report(models.length > 0, 'Model sinh ảnh', models.length ? `Tìm thấy ${models.length} model khả dụng.` : 'Server chưa có model dùng được.', 'Cài hoặc kích hoạt main model trong InvokeAI Model Manager.');
      }
    }

    if (task.value === 'runware') {
      const key = await provider.getSecretManager().getApiKey();
      report(Boolean(key?.trim() && key.trim().length > 10), 'Runware API key', key?.trim() && key.trim().length > 10 ? 'Key đã lưu trong SecretStorage (giá trị không hiển thị).' : 'Chưa cấu hình key hợp lệ về độ dài.', 'Chạy Pixel Pilot: Configure AI API Key để lưu key.');
      lines.push('Ghi chú: chẩn đoán không gửi request cloud; tác vụ thực tế sẽ yêu cầu consent và cần tài khoản/provider phù hợp.');
    }

    lines.push('', lines.some(line => line.startsWith('[NEEDS SETUP]'))
      ? 'Kết luận: Có phụ thuộc cần thiết lập hoặc sửa.'
      : lines.some(line => line.startsWith('[UNVERIFIED]'))
        ? 'Kết luận: Các kiểm tra xác định đã đạt; còn model cần xác minh bằng workflow local.'
        : 'Kết luận: Các điều kiện đã kiểm tra đều đạt.');

    setupDoctorOutput.clear();
    const result = lines.join('\n');
    setupDoctorOutput.appendLine(result);
    setupDoctorOutput.show(true);
    return result;
  }));

  const broadcastApiKeyStatus = async () => {
    const key = await provider.getSecretManager().getApiKey();
    provider.getRunwareAdapter().setApiKey(key);
    const masked = await provider.getSecretManager().getMaskedApiKey();
    const msg = {
      command: 'apiKeyStatus',
      type: 'apiKeyStatus',
      hasApiKey: !!key,
      apiKeyMasked: masked
    };
    provider.postToWebview(msg);
    if (StudioPanel.currentPanel) {
      StudioPanel.currentPanel.sendMessage(msg);
    }
  };

  // 4. Command: Set Runware / AI API Key (Securely in SecretStorage)
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Nhập Runware/AI API Key của bạn (khóa sẽ được mã hóa an toàn trong OS SecretStorage)',
        password: true,
        placeHolder: 'e.g. your_api_key_here'
      });

      if (apiKey !== undefined && apiKey.trim()) {
        await provider.getSecretManager().setApiKey(apiKey.trim());
        provider.getRunwareAdapter().setApiKey(apiKey.trim());
        await broadcastApiKeyStatus();
        vscode.window.showInformationMessage('🔒 Pixel Pilot: Đã lưu API Key vào SecretStorage thành công!');
      }
    })
  );

  // 5. Command: Clear API Key from SecretStorage
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.clearApiKey', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Bạn có chắc chắn muốn xóa API Key khỏi kho bảo mật SecretStorage?',
        'Xóa',
        'Hủy'
      );
      if (confirm === 'Xóa') {
        await provider.getSecretManager().deleteApiKey();
        provider.getRunwareAdapter().setApiKey('');
        await broadcastApiKeyStatus();
        vscode.window.showInformationMessage('🔒 Pixel Pilot: Đã xóa API Key khỏi SecretStorage.');
      }
    })
  );

  // 6. Command: Initialize Enterprise Configuration (.pixelpilotrc.json)
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.initEnterpriseConfig', async () => {
      await provider.getConfigManager().initConfigFile();
    })
  );

  // 7. Command: Clear Disk Cache
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.clearCache', async () => {
      const sizeMb = provider.getAssetStorage().getCacheSizeMb();
      const result = await provider.getAssetStorage().clearCache(provider.getReferencedArtifactPaths());
      vscode.window.showInformationMessage(`🧹 Pixel Pilot: Đã xóa ${result.removed} cache file (${sizeMb} MB trước dọn); giữ ${result.retained} artifact thuộc lịch sử.`);
    })
  );

  // 8. Command: Batch Process Folder from File Explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.batchProcessFolder', async (uri?: vscode.Uri) => {
      try {
        await policy.requireTrustedWorkspace('Batch image processing');
      } catch (error: any) {
        vscode.window.showWarningMessage(error.message || String(error));
        return;
      }
      let targetUri = uri;
      if (!targetUri) {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Chọn thư mục chứa ảnh cần xử lý hàng loạt'
        });
        if (selected && selected[0]) {
          targetUri = selected[0];
        } else {
          return;
        }
      }

      // 1. Scan images
      const comfy = new ComfyUIAdapter();
      const isComfyOnline = await comfy.ping();
      let aiProvider = isComfyOnline ? comfy : provider.getRunwareAdapter();
      const batchProcessor = new BatchProcessor(aiProvider);
      const images = await batchProcessor.scanImages(targetUri, false);

      if (images.length === 0) {
        vscode.window.showWarningMessage(
          `Không tìm thấy ảnh hợp lệ (.png, .jpg, .webp, .bmp) trong thư mục: ${targetUri.fsPath}`
        );
        return;
      }

      // 2. Choose operation
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '✂️ Tách nền 1-Click (Remove Background - BiRefNet)',
            description: 'Tách nền trong suốt chất lượng cao cho toàn bộ ảnh',
            op: 'remove_background' as OperationType
          },
          {
            label: '📐 Vector hóa sang SVG (Vectorize to SVG)',
            description: 'Chuyển đổi toàn bộ icon/ảnh thành file vector SVG',
            op: 'vectorize' as OperationType
          },
          {
            label: '⚡ Upscale 2x Siêu nét (Upscale 2x)',
            description: 'Tăng gấp đôi độ phân giải bằng mô hình Super-Resolution',
            op: 'upscale' as OperationType
          }
        ],
        {
          placeHolder: `Tìm thấy ${images.length} ảnh. Hãy chọn tác vụ AI muốn áp dụng:`
        }
      );

      if (!choice) return;

      const outputDir = path.join(targetUri.fsPath, 'pixelpilot_output');

      // 4. Configure Provider
      let runwareBatch = false;
      if (!isComfyOnline) {
        const key = await provider.getSecretManager().getApiKey();
        if (key && key.trim().length > 10) {
          provider.getRunwareAdapter().setApiKey(key);
          runwareBatch = true;
        } else {
          // Use ComfyUIAdapter in native fallback mode
          batchProcessor.setAIProvider(comfy);
        }
      }

      // 5. Execute
      if (runwareBatch) {
        try {
          await policy.requireCloudConsent('Runware', `Batch ${choice.op} for ${images.length} images`);
        } catch (error: any) {
          vscode.window.showWarningMessage(error.message || String(error));
          return;
        }
      }
      const summary = await batchProcessor.executeBatch(images, choice.op, outputDir, {
        beforeEach: async () => {
          await policy.requireTrustedWorkspace('Batch processing');
          if (runwareBatch) await policy.assertCloudAllowed('Runware', `Batch ${choice.op}`);
        },
        beforeWrite: async () => policy.requireTrustedWorkspace('Batch output write')
      });

      // 6. Report
      const batchActions = summary.failed > 0 ? ['Retry failed', 'Open output folder'] : ['Open output folder'];
      const action = await vscode.window.showInformationMessage(
        `Batch complete: ${summary.succeeded}/${summary.total} succeeded (${(summary.totalTimeMs / 1000).toFixed(1)}s). Manifest: ${summary.manifestPath}${summary.manifestError ? ` (manifest update warning: ${summary.manifestError})` : ''}`,
        ...batchActions
      );

      if (action === 'Retry failed') {
        const failedCount = summary.results.filter(result => !result.success).length;
        try {
          await policy.requireTrustedWorkspace('Batch retry');
          if (runwareBatch) await policy.requireCloudConsent('Runware', `Retry ${failedCount} failed batch images`);
          const retry = await batchProcessor.retryFailed(summary, {
            beforeEach: async () => {
              await policy.requireTrustedWorkspace('Batch retry');
              if (runwareBatch) await policy.assertCloudAllowed('Runware', `Retry batch ${choice.op}`);
            },
            beforeWrite: async () => policy.requireTrustedWorkspace('Batch output write')
          });
          if (retry) vscode.window.showInformationMessage(
            `Retry completed: ${retry.succeeded}/${retry.total} images succeeded. Manifest: ${retry.manifestPath}`,
            'Open output folder'
          ).then(async retryAction => {
            if (retryAction === 'Open output folder') await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDir));
          });
        } catch (error: any) {
          vscode.window.showWarningMessage(error.message || String(error));
        }
      } else if (action === 'Open output folder') {
        if (fs.existsSync(outputDir)) {
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDir));
        }
      }
    })
  );

  // 9. Command: Quick Remove Background from File Explorer Context Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.removeBackground', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        await provider.loadFileAndExecute(uri.fsPath, 'remove_background', 'Tách nền 1-Click (BiRefNet SOTA)');
      }
    })
  );

  // 10. Command: Quick Vectorize
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.vectorizeImage', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        await provider.loadFileAndExecute(uri.fsPath, 'vectorize', 'Vectorize sang SVG');
      }
    })
  );

  // 11. Command: Upscale Image (Context Menu & Studio)
  const upscaleHandler = async (uri?: vscode.Uri) => {
    if (uri) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Pixel Pilot: Upscaling "${path.basename(uri.fsPath)}" (2x Lanczos3 Super-Resolution)...`,
          cancellable: false
        },
        async () => {
          const fileData = await vscode.workspace.fs.readFile(uri);
          const upscaledBuf = await ImageProcessor.getInstance().upscale(Buffer.from(fileData), 2);
          const baseName = path.parse(uri.fsPath).name;
          const savedResult = await FileSystemUtils.saveImageToWorkspace(
            upscaledBuf,
            `${baseName}_upscaled.png`
          );
          await FileSystemUtils.autoInsertImageSnippet(savedResult.relativePath, 'Upscaled Image');
          vscode.window.showInformationMessage(`✨ Upscale 2x thành công: ${savedResult.relativePath}`);
        }
      );
    } else {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('pixel-pilot.upscaleImage', upscaleHandler),
    vscode.commands.registerCommand('pixelPilot.upscaleImage', upscaleHandler)
  );

  // 12. Command: Check InvokeAI Status
  context.subscriptions.push(
    vscode.commands.registerCommand('pixel-pilot.checkStatus', async () => {
      const isOnline = await invokeApi.ping();
      vscode.window.showInformationMessage(
        isOnline
          ? `🟢 InvokeAI is ONLINE at ${invokeApi.getBaseUrl()}`
          : `🔴 InvokeAI is OFFLINE at ${invokeApi.getBaseUrl()}`
      );
    })
  );

  // 13. Command: Start ComfyUI Local GPU Server
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.startComfyUI', async () => {
      const comfy = new ComfyUIAdapter();
      const isOnline = await comfy.ping();
      if (isOnline) {
        vscode.window.showInformationMessage(`🟢 ComfyUI GPU Server đang hoạt động tốt tại ${comfy.getBaseUrl()}!`);
        return;
      }

      const portableBatch = 'D:\\Start_ComfyUI_PixelPilot.bat';
      const defaultBatch = 'D:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat';

      let runFile = '';
      if (fs.existsSync(portableBatch)) {
        runFile = portableBatch;
      } else if (fs.existsSync(defaultBatch)) {
        runFile = defaultBatch;
      }

      if (runFile) {
        const terminal = vscode.window.createTerminal('ComfyUI GPU Server');
        terminal.show();
        terminal.sendText(`"${runFile}"`);
        vscode.window.showInformationMessage('🚀 Đang khởi động ComfyUI GPU Server (port 8188)... Vui lòng đợi vài giây.');
      } else {
        const choice = await vscode.window.showInformationMessage(
          'Chưa tìm thấy ComfyUI Portable trên ổ D:. Bạn có muốn chạy file tự động cài đặt (setup_comfyui.bat) không?',
          'Cài đặt tự động',
          'Mở link tải GitHub'
        );
        if (choice === 'Cài đặt tự động') {
          const setupBat = path.join(context.extensionPath, 'scripts', 'setup_comfyui.bat');
          const terminal = vscode.window.createTerminal('ComfyUI Installer');
          terminal.show();
          terminal.sendText(`"${setupBat}"`);
        } else if (choice === 'Mở link tải GitHub') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/Comfy-Org/ComfyUI/releases'));
        }
      }
    })
  );

  // 14. Status Bar Shortcut Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'pixel-pilot.openStudio';
  statusBarItem.text = '$(sparkle) Pixel Pilot Studio';
  statusBarItem.tooltip = 'Mở Pixel Pilot AI Studio';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // F5 should open the product immediately. Keep production installs quiet,
  // but remove the extra command-palette step in the Extension Development Host.
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    setTimeout(() => {
      void vscode.commands.executeCommand('pixel-pilot.openStudio');
    }, 300);
  }
}

export function deactivate() {
  if (StudioPanel.currentPanel) {
    StudioPanel.currentPanel.dispose();
  }
}
