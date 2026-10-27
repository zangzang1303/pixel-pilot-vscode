export interface ConfirmationRequest {
  token: string;
  provider: string;
  purpose: string;
}

/** Host-owned, one-time confirmation tokens for an attached webview. */
export class ConfirmationBroker {
  private readonly pending = new Map<string, { resolve: (approved: boolean) => void; timeout: ReturnType<typeof setTimeout> }>();

  public request(provider: string, purpose: string, publish: (request: ConfirmationRequest) => void, timeoutMs = 120_000): Promise<boolean> {
    const token = crypto.randomUUID();
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => this.settle(token, false), timeoutMs);
      this.pending.set(token, { resolve, timeout });
      publish({ token, provider, purpose });
    });
  }

  public settle(token: string, approved: boolean): boolean {
    const pending = this.pending.get(token);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pending.delete(token);
    pending.resolve(approved === true);
    return true;
  }
}
