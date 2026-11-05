// extension.ts - Entrypoint for Pixel Pilot VS Code Extension
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

export function activate(context: vscode.ExtensionContext) {
  console.log('✨ Pixel Pilot Enterprise Vision Studio is now active!');

  // Register the 5 priority tool executors (B16)
  PriorityToolExecutors.registerAll();

  const invokeApi = new InvokeApiService();
  const policy = new PolicyService();

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
