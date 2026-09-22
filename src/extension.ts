// extension.ts - Entrypoint for Pixel Pilot VS Code Extension
import * as vscode from 'vscode';
import { PixelPilotViewProvider } from './providers/PixelPilotViewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('✨ Pixel Pilot AI Vision Studio is now active!');

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

  // Command: Set Runware API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Nhập Runware API Key của bạn (hoặc đăng ký miễn phí tại https://runware.ai)',
        password: true,
        placeHolder: 'e.g. your_api_key_here'
      });

      if (apiKey !== undefined) {
        const config = vscode.workspace.getConfiguration('pixelPilot');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✨ Pixel Pilot: Đã lưu Runware API Key thành công!');
      }
    })
  );

  // Command: Quick Remove Background from File Explorer Context Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.removeBackground', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${uri.fsPath} vào Studio...`);
      }
    })
  );

  // Command: Quick Vectorize
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.vectorizeImage', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${uri.fsPath} để chuyển đổi Vector...`);
      }
    })
  );

  // Command: Quick Upscale
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelPilot.upscaleImage', async (uri?: vscode.Uri) => {
      await vscode.commands.executeCommand('workbench.view.extension.pixel-pilot');
      if (uri) {
        vscode.window.showInformationMessage(`✨ Pixel Pilot: Đang nạp ảnh ${uri.fsPath} để Upscale siêu nét...`);
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
  statusBarItem.tooltip = 'Mở Pixel Pilot Vision AI Studio';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  console.log('Pixel Pilot extension deactivated.');
}
