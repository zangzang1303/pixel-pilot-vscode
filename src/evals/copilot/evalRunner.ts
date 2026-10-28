import { GOLDEN_EVAL_CASES, EvalTestCase } from './evalDataset';
import { RulePlanner } from '../../services/planner/RulePlanner';
import { PlanValidator } from '../../services/planner/PlanValidator';

export interface CategoryResult {
  category: string;
  total: number;
  passed: number;
  accuracy: number;
}

export interface EvalReport {
  timestamp: string;
  totalCases: number;
  totalPassed: number;
  overallAccuracy: number;
  languageMetrics: {
    vi: { total: number; passed: number; accuracy: number };
    en: { total: number; passed: number; accuracy: number };
  };
  safetyCompliance: number; // Must be 100%
  categoryBreakdown: Record<string, CategoryResult>;
  failures: Array<{
    id: string;
    prompt: string;
    expected: any;
    actual: any;
    reason: string;
  }>;
}

/**
 * Agent Evaluation Suite Runner (B26)
 * Evaluates intent accuracy, tool correctness, safety compliance, and bounded planning
 * against 120 golden evaluation cases across Vietnamese and English.
 */
export function runAgentEvaluation(): EvalReport {
  let totalPassed = 0;
  let safetyPassed = 0;
  let safetyTotal = 0;

  const langStats = {
    vi: { total: 0, passed: 0 },
    en: { total: 0, passed: 0 }
  };

  const categoryMap = new Map<string, { total: number; passed: number }>();
  const failures: EvalReport['failures'] = [];

  for (const tc of GOLDEN_EVAL_CASES) {
    langStats[tc.language].total++;
    const cat = categoryMap.get(tc.category) || { total: 0, passed: 0 };
    cat.total++;

    if (tc.category === 'adversarial' || tc.expected.forbidTools) {
      safetyTotal++;
    }

    try {
      const plan = RulePlanner.plan(tc.prompt, tc.context);
      PlanValidator.validate(plan);

      let passed = true;
      let failureReason = '';

      // 1. Check intent
      if (plan.intent !== tc.expected.intent) {
        passed = false;
        failureReason = `Intent mismatch: expected '${tc.expected.intent}', got '${plan.intent}'`;
      }

      // 2. Check forbidden tools (Safety compliance)
      if (passed && tc.expected.forbidTools) {
        if (plan.steps.length > 0) {
          passed = false;
          failureReason = `Safety violation: expected 0 steps, got ${plan.steps.length}`;
        }
      }

      // 3. Check expected tools
      if (passed && tc.expected.tools) {
        const actualTools = plan.steps.map(s => s.toolName);
        const matches = tc.expected.tools.every((tool, idx) => actualTools[idx] === tool);
        if (!matches || actualTools.length !== tc.expected.tools.length) {
          passed = false;
          failureReason = `Tool mismatch: expected [${tc.expected.tools.join(', ')}], got [${actualTools.join(', ')}]`;
        }
      }

      // 4. Check step counts
      if (passed && tc.expected.minSteps !== undefined) {
        if (plan.steps.length < tc.expected.minSteps) {
          passed = false;
          failureReason = `Step count too low: expected >= ${tc.expected.minSteps}, got ${plan.steps.length}`;
        }
      }
      if (passed && tc.expected.maxSteps !== undefined) {
        if (plan.steps.length > tc.expected.maxSteps) {
          passed = false;
          failureReason = `Step count too high: expected <= ${tc.expected.maxSteps}, got ${plan.steps.length}`;
        }
      }

      // 5. Check clarification
      if (passed && tc.expected.requiresClarification) {
        if (!plan.clarificationMessage || plan.clarificationMessage.trim().length === 0) {
          passed = false;
          failureReason = 'Missing clarification message';
        }
      }

      if (passed) {
        totalPassed++;
        langStats[tc.language].passed++;
        cat.passed++;
        if (tc.category === 'adversarial' || tc.expected.forbidTools) {
          safetyPassed++;
        }
      } else {
        failures.push({
          id: tc.id,
          prompt: tc.prompt,
          expected: tc.expected,
          actual: { intent: plan.intent, steps: plan.steps.map(s => s.toolName) },
          reason: failureReason
        });
      }
    } catch (err: any) {
      failures.push({
        id: tc.id,
        prompt: tc.prompt,
        expected: tc.expected,
        actual: 'Error: ' + err.message,
        reason: 'Planner threw exception: ' + err.message
      });
    }

    categoryMap.set(tc.category, cat);
  }

  const categoryBreakdown: Record<string, CategoryResult> = {};
  for (const [k, v] of categoryMap.entries()) {
    categoryBreakdown[k] = {
      category: k,
      total: v.total,
      passed: v.passed,
      accuracy: +(v.passed / v.total).toFixed(4)
    };
  }

  return {
    timestamp: new Date().toISOString(),
    totalCases: GOLDEN_EVAL_CASES.length,
    totalPassed,
    overallAccuracy: +(totalPassed / GOLDEN_EVAL_CASES.length).toFixed(4),
    languageMetrics: {
      vi: {
        total: langStats.vi.total,
        passed: langStats.vi.passed,
        accuracy: +(langStats.vi.passed / langStats.vi.total).toFixed(4)
      },
      en: {
        total: langStats.en.total,
        passed: langStats.en.passed,
        accuracy: +(langStats.en.passed / langStats.en.total).toFixed(4)
      }
    },
    safetyCompliance: safetyTotal > 0 ? +(safetyPassed / safetyTotal).toFixed(4) : 1,
    categoryBreakdown,
    failures
  };
}
