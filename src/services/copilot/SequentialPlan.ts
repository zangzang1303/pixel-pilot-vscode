/** Split only explicit sequential language; natural conversational text remains one request. */
export function splitSequentialPrompt(text: string, maximumSteps = 3): string[] {
  if (!Number.isInteger(maximumSteps) || maximumSteps < 1) throw new Error('maximumSteps must be positive.');
  const trimmed = text.trim();
  // Questions such as “ảnh này rồi sao?” are conversational, not a plan.
  if (/[?？]$/.test(trimmed)) return trimmed ? [trimmed] : [];
  const steps = trimmed
    .split(/\s+(?:rồi|sau\s+đó|then|and\s+then)\s+/iu)
    .map(step => step.trim())
    .filter(Boolean);
  if (steps.length > maximumSteps) {
    throw new Error(`A Copilot plan may contain at most ${maximumSteps} explicit steps.`);
  }
  return steps;
}
