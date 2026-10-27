export type RunTelemetryEvent = {
  at: number;
  requestId: string;
  command: 'chat' | 'analyze' | 'tool' | 'cancel';
  outcome: 'started' | 'succeeded' | 'failed' | 'cancelled';
  toolName?: string;
  latencyMs?: number;
};

/** Bounded in-memory telemetry with a deliberately non-content schema. */
export class SafeTelemetry {
  private readonly events: RunTelemetryEvent[] = [];

  constructor(private readonly capacity = 200) {}

  public record(event: Omit<RunTelemetryEvent, 'at'> & { at?: number }): void {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(event.requestId)) return;
    const stored: RunTelemetryEvent = {
      at: Number.isFinite(event.at) ? Math.max(0, Number(event.at)) : Date.now(),
      requestId: event.requestId,
      command: event.command,
      outcome: event.outcome,
      toolName: event.toolName && /^[A-Za-z0-9._:-]{1,128}$/.test(event.toolName) ? event.toolName : undefined,
      latencyMs: Number.isFinite(event.latencyMs) ? Math.max(0, Math.round(Number(event.latencyMs))) : undefined
    };
    this.events.push(stored);
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity);
  }

  public recent(): readonly RunTelemetryEvent[] {
    return this.events.map(event => ({ ...event }));
  }
}
