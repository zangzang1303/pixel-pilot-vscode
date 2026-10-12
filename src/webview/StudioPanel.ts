// StudioPanel.ts - Controller for AI Image Studio Webview Panel
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class StudioPanel {
  public static currentPanel: StudioPanel | undefined;
  public static readonly viewType = 'aiImageStudio.canvasPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Nếu panel đã mở, tập trung vào nó
    if (StudioPanel.currentPanel) {
      StudioPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Tạo mới Webview Panel
    const panel = vscode.window.createWebviewPanel(
      StudioPanel.viewType,
      'AI Image Studio (InvokeAI)',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    StudioPanel.currentPanel = new StudioPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Load nội dung Webview HTML
    this._update();

    // Lắng nghe sự kiện đóng panel
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Lắng nghe thông điệp 2 chiều từ React Webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        this.handleWebviewMessage(message);
      },
      null,
      this._disposables
    );
  }

  public postMessage(message: any) {
    this._panel.webview.postMessage(message);
  }

  private handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'generateImage':
        // Sẽ được kết nối với InvokeApiService ở Giai đoạn 2 & 3
        vscode.window.showInformationMessage(`Nhận yêu cầu sinh ảnh: ${message.prompt}`);
        break;
      case 'showError':
        vscode.window.showErrorMessage(message.error || 'Lỗi không xác định từ Webview');
        break;
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Đường dẫn bundle React (nếu đã build) hoặc fallback HTML giao diện
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js');
    const scriptUri = webview.asWebviewUri(distPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Image Studio - InvokeAI</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    #root {
      display: flex;
      flex: 1;
      height: 100%;
    }
    .placeholder-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      gap: 16px;
      color: var(--vscode-descriptionForeground);
    }
    .status-badge {
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="placeholder-panel">
      <h2>🎨 AI Image Studio</h2>
      <span class="status-badge">Sẵn sàng kết nối Local InvokeAI Engine</span>
      <p>Giao diện React Webview sẽ được tải lên tại đây trong Giai đoạn 3.</p>
    </div>
  </div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose() {
    StudioPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
