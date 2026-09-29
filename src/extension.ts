// extension.ts - Entrypoint for Pixel Pilot VS Code Extension
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PixelPilotViewProvider } from './providers/PixelPilotViewProvider';
import { BatchProcessor } from './services/batch/BatchProcessor';
import { OperationType } from './services/session/types';

export function activate(context: vscode.ExtensionContext) {
  console.log('✨ Pixel Pilot Enterprise Vision Studio is now active!');

  // Register the Sidebar Webview Provider
  const provider = new PixelPilotViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PixelPilotViewProvider.viewType, provider)
  );

  // Command: Open Sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.openSidebar', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
    })
  );

  // Command: Set Runware API Key (Securely in SecretStorage)
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Nhập Runware API Key của bạn (khóa sẽ được mã hóa an toàn trong OS SecretStorage)',
        password: true,
        placeHolder: 'e.g. your_api_key_here'
      });

      if (apiKey !== undefined && apiKey.trim()) {
        await provider.getSecretManager().setApiKey(apiKey.trim());
        provider.getRunwareAdapter().setApiKey(apiKey.trim());
        vscode.window.showInformationMessage('🔒 Pixel Pilot Enterprise: Đã lưu API Key vào SecretStorage thành công!');
      }
    })
  );

  // Command: Clear API Key from SecretStorage
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

  // Command: Initialize Enterprise Configuration (.pixelpilotrc.json)
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.initEnterpriseConfig', async () => {
      await provider.getConfigManager().initConfigFile();
    })
  );

  // Command: Clear Disk Cache
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.clearCache', async () => {
      const sizeMb = provider.getAssetStorage().getCacheSizeMb();
      await provider.getAssetStorage().clearCache();
      vscode.window.showInformationMessage(`🧹 Pixel Pilot Enterprise: Đã giải phóng ${sizeMb} MB bộ đệm cache đĩa cứng!`);
    })
  );

  // Command: Batch Process Folder from File Explorer
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

      // 3. Define output folder
      const defaultOutputDir = path.join(targetUri.fsPath, 'pixelpilot_output');
      const outputDir = defaultOutputDir;

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

  // Command: Quick Remove Background from File Explorer Context Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.removeBackground', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${path.basename(uri.fsPath)} vào Studio...`);
      }
    })
  );

  // Command: Quick Vectorize
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.vectorizeImage', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${path.basename(uri.fsPath)} để chuyển đổi Vector...`);
      }
    })
  );

  // Command: Quick Upscale
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.upscaleImage', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${path.basename(uri.fsPath)} để Upscale siêu nét...`);
      }
    })
  );

  // Command: Move View to Secondary Sidebar (Right Side like Codex)
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.moveToRightSide', async () => {
      try {
        await vscode.commands.executeCommand('pixelPilot.sidebarView.focus');
        await vscode.commands.executeCommand('workbench.action.moveFocusedView');
      } catch {
        await vscode.commands.executeCommand('workbench.action.toggleAuxiliaryBar');
      }
      vscode.window.showInformationMessage('✨ Pixel Pilot: Bạn có thể kéo icon sang thanh bên phải (Secondary Sidebar) để sử dụng song song như Codex!');
    })
  );

  // Status Bar Shortcut Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'pixelPilot.openSidebar';
  statusBarItem.text = '$(sparkle) Pixel Pilot';
  statusBarItem.tooltip = 'Mở Pixel Pilot Enterprise AI Studio';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  console.log('Pixel Pilot extension deactivated.');
}
