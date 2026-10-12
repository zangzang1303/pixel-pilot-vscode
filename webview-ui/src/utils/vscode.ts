/**
 * Type declarations for the VS Code Webview API.
 */
interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

class VSCodeWrapper {
  private vscode: VsCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
  }

  public postMessage(message: any) {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else {
      console.log('[Dev Mode] postMessage:', message);
    }
  }

  public getState() {
    return this.vscode ? this.vscode.getState() : null;
  }

  public setState(state: any) {
    if (this.vscode) {
      this.vscode.setState(state);
    }
  }
}

export const vscode = new VSCodeWrapper();
