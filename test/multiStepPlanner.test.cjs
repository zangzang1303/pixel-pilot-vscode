const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AgentToolRegistry } = require('../out/services/ai/AgentToolRegistry');
const { PriorityToolExecutors } = require('../out/services/tools/PriorityToolExecutors');
const { PlanValidator, PlanValidationError } = require('../out/services/planner/PlanValidator');
const { RulePlanner } = require('../out/services/planner/RulePlanner');
const { IntentRouter } = require('../out/services/planner/IntentRouter');
const { PlanExecutionCoordinator } = require('../out/services/planner/PlanExecutionCoordinator');
const { CopilotOrchestrator } = require('../out/services/copilot/CopilotOrchestrator');
const { ProviderCatalog } = require('../out/services/execution/ProviderCatalog');
const { CopilotError } = require('../out/services/execution/errors');

// Ensure priority tools are registered
PriorityToolExecutors.registerAll();

test('PlanValidator enforces max 5 steps, known tools, and rejects cycles', () => {
  // 1. Valid plan passes
  const validPlan = {
    planId: 'plan_1',
    intent: 'edit',
    prompt: 'Tách nền',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.remove_background',
        args: { imageId: 'img_1', quality: 'model', preserveDetails: true }
      }
    ],
    summary: 'Tách nền ảnh'
  };
  assert.doesNotThrow(() => PlanValidator.validate(validPlan));

  // 2. Reject > 5 steps
  const sixSteps = {
    planId: 'plan_long',
    intent: 'edit',
    prompt: 'quá nhiều bước',
    steps: [1, 2, 3, 4, 5, 6].map(i => ({
      stepId: `step_${i}`,
      toolName: 'image.remove_background',
      args: { imageId: 'img_1', quality: 'model', preserveDetails: true }
    })),
    summary: '6 bước'
  };
  assert.throws(() => PlanValidator.validate(sixSteps), /exceeds maximum allowed steps/);

  // 3. Reject forward reference in binding
  const forwardRef = {
    planId: 'plan_fwd',
    intent: 'edit',
    prompt: 'tham chiếu tương lai',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.recolor',
        args: { target: 'clothes', color: 'blue' },
        inputBindings: { imageId: '$step_2.artifactId' }
      },
      {
        stepId: 'step_2',
        toolName: 'image.remove_background',
        args: { imageId: 'img_1', quality: 'model', preserveDetails: true }
      }
    ],
    summary: 'forward ref'
  };
  assert.throws(() => PlanValidator.validate(forwardRef), /Forward reference/);

  // 4. Reject cyclic binding to self
  const selfCycle = {
    planId: 'plan_cycle',
    intent: 'edit',
    prompt: 'vòng lặp',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.remove_background',
        args: { quality: 'model', preserveDetails: true },
        inputBindings: { imageId: '$step_1.artifactId' }
      }
    ],
    summary: 'cycle'
  };
  assert.throws(() => PlanValidator.validate(selfCycle), /Cyclic dependency/);

  // 5. Reject unknown tool
  const unknownTool = {
    planId: 'plan_unk',
    intent: 'edit',
    prompt: 'tool lạ',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.super_teleport',
        args: {}
      }
    ],
    summary: 'unknown'
  };
  assert.throws(() => PlanValidator.validate(unknownTool), /Unknown tool/);
});

test('RulePlanner correctly handles negation, questions, clarification, and sequential plans', () => {
  // 1. Negation: user asks NOT to edit
  const neg1 = RulePlanner.plan('xin đừng sửa ảnh này');
  assert.equal(neg1.intent, 'chat');
  assert.equal(neg1.steps.length, 0);

  const neg2 = RulePlanner.plan("don't edit or remove anything");
  assert.equal(neg2.intent, 'chat');
  assert.equal(neg2.steps.length, 0);

  // 2. Pure questions: conversational
  const q1 = RulePlanner.plan('ảnh này có đẹp không?');
  assert.equal(q1.intent, 'chat');
  assert.equal(q1.steps.length, 0);

  // 3. Analysis: image.analyze
  const a1 = RulePlanner.plan('phân tích các thông số độ sáng của ảnh', { currentImageId: 'img_test' });
  assert.equal(a1.intent, 'analyze');
  assert.equal(a1.steps.length, 1);
  assert.equal(a1.steps[0].toolName, 'image.analyze');

  // 4. Inpaint without mask: requests clarification
  const clarify = RulePlanner.plan('xóa người đứng bên phải', { currentImageId: 'img_test', maskId: undefined });
  assert.equal(clarify.intent, 'clarify');
  assert.equal(clarify.steps.length, 0);
  assert.ok(clarify.clarificationMessage.includes('khoanh vùng'));

  // 5. Sequential plan (tách nền rồi đổi màu áo)
  const seq = RulePlanner.plan('tách nền rồi đổi màu áo sang xanh', { currentImageId: 'img_test' });
  assert.equal(seq.intent, 'edit');
  assert.equal(seq.steps.length, 2);
  assert.equal(seq.steps[0].toolName, 'image.remove_background');
  assert.equal(seq.steps[1].toolName, 'image.recolor');
  assert.equal(seq.steps[1].inputBindings.imageId, '$prev.artifactId');

  const green = RulePlanner.plan('tách nền rồi đổi màu áo sang xanh lá', { currentImageId: 'img_test' });
  assert.equal(green.steps[1].args.color, 'green');
  const red = RulePlanner.plan('tách nền rồi đổi màu tóc sang đỏ', { currentImageId: 'img_test' });
  assert.equal(red.steps[1].args.color, 'red');

  const partial = RulePlanner.plan('tách nền rồi làm một việc chưa biết', { currentImageId: 'img_test' });
  assert.equal(partial.intent, 'clarify');
  assert.equal(partial.steps.length, 0);
  assert.match(partial.clarificationMessage, /bước 2/i);
});

test('IntentRouter enforces local-first routing and strictly blocks cloud calls in offline mode', async () => {
  const catalog = new ProviderCatalog();
  const router = new IntentRouter(catalog);

  const plan = {
    planId: 'plan_route',
    intent: 'edit',
    prompt: 'tách nền',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.remove_background',
        args: { imageId: 'img_1', quality: 'basic', preserveDetails: true }
      }
    ],
    summary: 'tách nền'
  };

  // 1. Basic processing selects local Sharp with cost = 0.
  const onlinePlan = await router.routePlan(JSON.parse(JSON.stringify(plan)), { offlineMode: false });
  assert.equal(onlinePlan.steps[0].route.providerId, 'sharp');
  assert.equal(onlinePlan.steps[0].route.isCloud, false);
  assert.equal(onlinePlan.estimatedCost.totalEstimate, 0);
  assert.equal(onlinePlan.estimatedCost.requiresConsent, false);

  const modelPlan = JSON.parse(JSON.stringify(plan));
  modelPlan.steps[0].args.quality = 'model';
  catalog.registerProbe('comfyui', async () => ({
    providerId: 'comfyui', name: 'ComfyUI (Local)', isOnline: false, supportedTools: []
  }));
  await assert.rejects(() => router.routePlan(JSON.parse(JSON.stringify(modelPlan)), { offlineMode: true }), /not available in local offline mode/);
  catalog.registerProbe('comfyui', async () => ({
    providerId: 'comfyui', name: 'ComfyUI (Local)', isOnline: true,
    supportedTools: ['image.remove_background', 'image.recolor']
  }));
  const routedModel = await router.routePlan(modelPlan, { offlineMode: true });
  assert.equal(routedModel.steps[0].route.providerId, 'comfyui');

  // 2. Offline: Tool not available locally (e.g. image.generate with sharp) throws unavailable
  const genPlan = {
    planId: 'plan_gen',
    intent: 'edit',
    prompt: 'tạo ảnh',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.generate',
        args: { prompt: 'a cat', width: 512, height: 512 }
      }
    ],
    summary: 'tạo ảnh'
  };

  await assert.rejects(
    () => router.routePlan(genPlan, { offlineMode: true }),
    (err) => err instanceof CopilotError && err.code === 'unavailable' && err.message.includes('offline mode')
  );
});

test('PlanExecutionCoordinator handles session concurrency, checkpointing, and partial recovery', async () => {
  const coordinator = new PlanExecutionCoordinator();
  const sessionId = 'session_test_1';

  const plan = {
    planId: 'plan_resume_test',
    intent: 'edit',
    prompt: '2 bước',
    steps: [
      {
        stepId: 'step_1',
        toolName: 'image.remove_background',
        args: { imageId: 'img_base', quality: 'model', preserveDetails: true }
      },
      {
        stepId: 'step_2',
        toolName: 'image.recolor',
        args: { target: 'clothes', color: 'blue' },
        inputBindings: { imageId: '$prev.artifactId' }
      }
    ],
    summary: 'test resume'
  };

  // 1. First execution: step 1 succeeds, step 2 fails
  let step1Called = 0;
  let step2Called = 0;

  const failingExecutor = async (step, args) => {
    if (step.stepId === 'step_1') {
      step1Called++;
      return { artifactId: 'art_cutout_42', value: { alphaFraction: 0.3 } };
    }
    if (step.stepId === 'step_2') {
      step2Called++;
      assert.equal(args.imageId, 'art_cutout_42', 'Dynamic binding should have injected step 1 output');
      throw new Error('Step 2 network timeout');
    }
  };

  await assert.rejects(
    () => coordinator.executePlan(plan, sessionId, failingExecutor),
    /Step 2 network timeout/
  );

  assert.equal(step1Called, 1);
  assert.equal(step2Called, 1);

  // Checkpoint records step 1 succeeded and step 2 failed
  const cp = coordinator.getCheckpoint(plan.planId);
  assert.ok(cp);
  assert.equal(cp.stepResults['step_1'].status, 'succeeded');
  assert.equal(cp.stepResults['step_1'].artifactId, 'art_cutout_42');
  assert.equal(cp.stepResults['step_2'].status, 'failed');
  assert.equal(cp.isCompleted, false);

  // 2. Resume execution: step 1 is skipped, only step 2 is retried
  const recoveringExecutor = async (step, args) => {
    if (step.stepId === 'step_1') {
      step1Called++;
      return { artifactId: 'art_cutout_42' };
    }
    if (step.stepId === 'step_2') {
      step2Called++;
      assert.equal(args.imageId, 'art_cutout_42', 'Resumed step should receive prior step artifact');
      return { artifactId: 'art_recolor_99', value: { selectionMaskId: 'mask_1' } };
    }
  };

  const finalCp = await coordinator.resumePlan(plan, sessionId, recoveringExecutor);
  assert.equal(step1Called, 1, 'Step 1 should NOT be re-executed upon resume');
  assert.equal(step2Called, 2, 'Step 2 should be executed upon resume');
  assert.equal(finalCp.isCompleted, true);
  assert.equal(finalCp.stepResults['step_2'].status, 'succeeded');
  assert.equal(finalCp.stepResults['step_2'].artifactId, 'art_recolor_99');
});

test('PlanExecutionCoordinator prevents concurrent execution on same session', async () => {
  const coordinator = new PlanExecutionCoordinator();
  const sessionId = 'session_locked';

  coordinator.acquireSessionLock(sessionId);

  assert.throws(
    () => coordinator.acquireSessionLock(sessionId),
    (err) => err instanceof CopilotError && err.code === 'concurrency_limit'
  );

  coordinator.releaseSessionLock(sessionId);
  assert.doesNotThrow(() => coordinator.acquireSessionLock(sessionId));
  coordinator.releaseSessionLock(sessionId);
});

test('checkpoint survives restart and resumes only the failed local step', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-plan-'));
  const plan = {
    planId: 'restart-plan', intent: 'edit', prompt: 'fixture', summary: 'fixture',
    steps: [
      { stepId: 'cutout', toolName: 'image.remove_background', args: { imageId: 'fixture' } },
      { stepId: 'recolor', toolName: 'image.recolor', args: { color: 'blue' }, inputBindings: { imageId: '$prev.artifactId' } }
    ]
  };
  try {
    const first = new PlanExecutionCoordinator(directory);
    let cutoutCalls = 0;
    await assert.rejects(() => first.executePlan(plan, 'session-a', async step => {
      if (step.stepId === 'cutout') { cutoutCalls++; return { artifactId: 'art-cutout', value: { privatePrompt: 'do-not-persist' } }; }
      throw new Error('local failure');
    }), /local failure/);
    const files = fs.readdirSync(directory);
    assert.equal(files.length, 1);
    assert.ok(!fs.readFileSync(path.join(directory, files[0]), 'utf8').includes('do-not-persist'));

    const restarted = new PlanExecutionCoordinator(directory);
    const result = await restarted.resumePlan(plan, 'session-a', async (step, args) => {
      assert.equal(step.stepId, 'recolor');
      assert.equal(args.imageId, 'art-cutout');
      return { artifactId: 'art-recolor' };
    });
    assert.equal(cutoutCalls, 1);
    assert.equal(result.isCompleted, true);
    assert.equal(result.stepResults.recolor.artifactId, 'art-recolor');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('unknown remote outcome and checkpoint disk failure never resubmit a step', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-plan-'));
  const plan = {
    planId: 'remote-plan', intent: 'edit', prompt: 'fixture', summary: 'fixture',
    steps: [{ stepId: 'paid', toolName: 'image.generate', args: { prompt: 'fixture' }, route: { providerId: 'runware', isCloud: true } }]
  };
  try {
    const first = new PlanExecutionCoordinator(directory);
    await assert.rejects(() => first.executePlan(plan, 'session-a', async () => {
      throw new Error('connection dropped after submit');
    }), /connection dropped/);
    let calls = 0;
    const restarted = new PlanExecutionCoordinator(directory);
    await assert.rejects(() => restarted.resumePlan(plan, 'session-a', async () => {
      calls++;
      return { artifactId: 'unexpected' };
    }), /unknown outcome/);
    assert.equal(calls, 0);

    const blockedPath = path.join(directory, 'not-a-directory');
    fs.writeFileSync(blockedPath, 'fixture');
    const blocked = new PlanExecutionCoordinator(blockedPath);
    await assert.rejects(() => blocked.executePlan({ ...plan, planId: 'disk-failure' }, 'session-a', async () => {
      calls++;
      return { artifactId: 'unexpected' };
    }));
    assert.equal(calls, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reused plan ID with another session or revised steps cannot reuse a checkpoint', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-plan-'));
  const plan = {
    planId: 'same-id', intent: 'edit', prompt: 'fixture', summary: 'fixture',
    steps: [{ stepId: 'first', toolName: 'image.remove_background', args: { imageId: 'fixture' } }]
  };
  try {
    await new PlanExecutionCoordinator(directory).executePlan(plan, 'session-a', async () => ({ artifactId: 'art-original' }));
    let calls = 0;
    const restarted = new PlanExecutionCoordinator(directory);
    const unexpected = async () => { calls++; return { artifactId: 'art-unexpected' }; };
    await assert.rejects(() => restarted.executePlan(plan, 'session-b', unexpected), /different session or plan revision/);
    await assert.rejects(() => restarted.executePlan({ ...plan, steps: [{ ...plan.steps[0], args: { imageId: 'another-image' } }] }, 'session-a', unexpected), /different session or plan revision/);
    assert.equal(calls, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('same plan ID cannot execute concurrently in two sessions', async () => {
  const coordinator = new PlanExecutionCoordinator();
  const plan = {
    planId: 'concurrent-plan', intent: 'edit', prompt: 'fixture', summary: 'fixture',
    steps: [{ stepId: 'first', toolName: 'image.remove_background', args: { imageId: 'fixture' } }]
  };
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  let finish;
  const held = new Promise(resolve => { finish = resolve; });
  const first = coordinator.executePlan(plan, 'session-a', async () => {
    started();
    await held;
    return { artifactId: 'art-first' };
  });
  await entered;
  try {
    await assert.rejects(() => coordinator.executePlan(plan, 'session-b', async () => ({ artifactId: 'art-duplicate' })),
      err => err instanceof CopilotError && err.code === 'concurrency_limit');
  } finally {
    finish();
  }
  assert.equal((await first).stepResults.first.artifactId, 'art-first');
});
