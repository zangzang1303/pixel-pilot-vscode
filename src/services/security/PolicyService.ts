import * as vscode from 'vscode';

/** Host-enforced guard for operations that disclose workspace content externally. */
export class PolicyService {
  public async requireTrustedWorkspace(action: string): Promise<void> {
    if (!vscode.workspace.isTrusted) {
      throw new Error(`${action} is unavailable because this workspace is not trusted.`);
    }
  }

  /** Per-request consent: grants are deliberately not persisted or replayed. */
  public async requireCloudConsent(provider: string, purpose: string): Promise<void> {
    await this.requireTrustedWorkspace(purpose);
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
