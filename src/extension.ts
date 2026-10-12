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

export function activate(context: vscode.ExtensionContext) {
  console.log('✨ Pixel Pilot Enterprise Vision Studio is now active!');

  const invokeApi = new InvokeApiService();

  // 1. Register the Sidebar Webview Provider
  const provider = new PixelPilotViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PixelPilotViewProvider.viewType, provider)
  );

  // 2. Open Canvas Studio Panel (React + Tailwind + InvokeAI)
  const openStudioHandler = (uri?: vscode.Uri) => {
    StudioPanel.createOrShow(context.extensionUri, uri);
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
      await provider.getAssetStorage().clearCache();
      vscode.window.showInformationMessage(`🧹 Pixel Pilot: Đã giải phóng ${sizeMb} MB bộ đệm cache đĩa cứng!`);
    })
  );

  // 8. Command: Batch Process Folder from File Explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.batchProcessFolder', async (uri?: vscode.Uri) => {
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
      const batchProcessor = new BatchProcessor(provider.getRunwareAdapter());
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

      // 4. Check API Key
      const key = await provider.getSecretManager().getApiKey();
      if (!key) {
        vscode.window.showErrorMessage('Vui lòng cấu hình API Key trước khi xử lý hàng loạt!');
        await vscode.commands.executeCommand('pixelPilot.setApiKey');
        return;
      }
      provider.getRunwareAdapter().setApiKey(key);

      // 5. Execute
      const summary = await batchProcessor.executeBatch(images, choice.op, outputDir);

      // 6. Report
      const action = await vscode.window.showInformationMessage(
        `✅ Hoàn thành xử lý lô: ${summary.succeeded}/${summary.total} ảnh thành công (${(summary.totalTimeMs / 1000).toFixed(1)}s)`,
        'Mở thư mục kết quả'
      );

      if (action === 'Mở thư mục kết quả') {
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
    // If invokeAI is online, use local ESRGAN; otherwise trigger sidebar upscale
    const isInvokeOnline = await invokeApi.ping();
    if (isInvokeOnline && uri) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Pixel Pilot: Upscaling "${path.basename(uri.fsPath)}" (InvokeAI 2x)...`,
          cancellable: false
        },
        async () => {
          const fileData = await vscode.workspace.fs.readFile(uri);
          const result = await invokeApi.upscaleImage(Buffer.from(fileData), 2);
          const baseName = path.parse(uri.fsPath).name;
          const savedResult = await FileSystemUtils.saveImageToWorkspace(
            result.imageBuffer,
            `${baseName}_upscaled.png`
          );
          await FileSystemUtils.autoInsertImageSnippet(savedResult.relativePath, 'Upscaled Image');
          vscode.window.showInformationMessage(`Upscaled saved to ${savedResult.relativePath}`);
        }
      );
    } else {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        await provider.loadFileAndExecute(uri.fsPath, 'upscale', 'Upscale 2x HD');
      }
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

  // 13. Status Bar Shortcut Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'pixel-pilot.openStudio';
  statusBarItem.text = '$(sparkle) Pixel Pilot Studio';
  statusBarItem.tooltip = 'Mở Pixel Pilot AI Studio';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  if (StudioPanel.currentPanel) {
    StudioPanel.currentPanel.dispose();
  }
}
