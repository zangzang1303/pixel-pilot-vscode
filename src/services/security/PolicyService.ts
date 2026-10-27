import * as vscode from 'vscode';

export type CloudConfirmation = (provider: string, purpose: string) => Promise<boolean | undefined>;

/** Host-enforced guard for operations that disclose workspace content externally. */
export class PolicyService {
  constructor(private readonly webviewConfirmation?: CloudConfirmation) {}
  private isOfflineMode(): boolean {
    try {
      const configuration = vscode.workspace.getConfiguration?.('pixelPilot');
      return configuration?.get<boolean>('offlineMode', false) === true;
    } catch {
      // A missing configuration surface must not make policy checks unusable in
      // extension-host tests; VS Code supplies it in production.
      return false;
    }
  }

  public async requireTrustedWorkspace(action: string): Promise<void> {
    if (!vscode.workspace.isTrusted) {
      throw new Error(`${action} is unavailable because this workspace is not trusted.`);
    }
  }

  /** Per-request consent: grants are deliberately not persisted or replayed. */
  public async requireCloudConsent(provider: string, purpose: string): Promise<void> {
    if (this.isOfflineMode()) {
      throw new Error(`${purpose} is unavailable while Pixel Pilot offline mode is enabled.`);
    }
    await this.requireTrustedWorkspace(purpose);
    const webviewDecision = this.webviewConfirmation ? await this.webviewConfirmation(provider, purpose) : undefined;
    if (webviewDecision !== undefined) {
      if (!webviewDecision) throw new Error('Cloud operation was not approved.');
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `${purpose} will send the selected image or prompt to ${provider}.`,
      { modal: true },
      'Continue'
    );
    if (choice !== 'Continue') {
      throw new Error('Cloud operation was not approved.');
    }
  }
}
