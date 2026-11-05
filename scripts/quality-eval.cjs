const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SHA256 = /^[a-f0-9]{64}$/;
const DEFAULT_THRESHOLDS = { development: 40, holdout: 20, minPairsPerGroup: 20, minPassingPairs: 17 };

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveInside(root, relativePath, label, errors) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
    errors.push(`${label}: path must be a non-empty relative path`);
    return undefined;
  }
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${label}: path must stay inside the dataset directory`);
    return undefined;
  }
  return resolved;
}

function scorePasses(scores, criterionIds, severeFailure) {
  return severeFailure === false && criterionIds.every(id => Number.isInteger(scores[id]) && scores[id] >= 4 && scores[id] <= 5);
}

function evaluateQualityManifest(manifest, datasetRoot) {
  const errors = [];
  const root = path.resolve(datasetRoot);
  if (!manifest || manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const dataset = manifest?.dataset;
  if (!dataset || typeof dataset.id !== 'string' || !dataset.id || typeof dataset.revision !== 'string' || !dataset.revision) {
    errors.push('dataset id and revision are required');
  }
  if (!dataset?.rightsConfirmed || typeof dataset?.rightsSource !== 'string' || !dataset.rightsSource.trim()) {
    errors.push('dataset rights must be confirmed with a recorded source');
  }
  const rubric = manifest?.rubric;
  if (!rubric || typeof rubric.version !== 'string' || !rubric.version || !rubric.criteria || typeof rubric.criteria !== 'object' || Array.isArray(rubric.criteria)) {
    errors.push('rubric version and criteria map are required');
  }
  const criteriaByTask = rubric?.criteriaByTask;
  if (!criteriaByTask || typeof criteriaByTask !== 'object' || Array.isArray(criteriaByTask)) errors.push('rubric.criteriaByTask is required');

  const thresholds = { ...DEFAULT_THRESHOLDS, ...(manifest?.thresholds || {}) };
  for (const [name, value] of Object.entries(thresholds)) {
    if (!Number.isInteger(value) || value < 1) errors.push(`threshold ${name} must be a positive integer`);
  }

  const items = Array.isArray(dataset?.items) ? dataset.items : [];
  const itemById = new Map();
  const hashSplits = new Map();
  const splitCounts = { development: 0, holdout: 0 };
  for (const [index, item] of items.entries()) {
    const label = `dataset.items[${index}]`;
    if (!item || typeof item.id !== 'string' || !item.id || itemById.has(item.id)) {
      errors.push(`${label}: unique item id is required`);
      continue;
    }
    itemById.set(item.id, item);
    if (!['development', 'holdout'].includes(item.split)) errors.push(`${label}: split must be development or holdout`);
    else splitCounts[item.split]++;
    if (typeof item.contentGroup !== 'string' || !item.contentGroup.trim()) errors.push(`${label}: contentGroup is required`);
    if (!SHA256.test(item.sourceSha256 || '')) errors.push(`${label}: sourceSha256 must be lowercase SHA-256`);
    else {
      const prior = hashSplits.get(item.sourceSha256);
      if (prior && prior !== item.split) errors.push(`${label}: source hash leaks across ${prior} and ${item.split} splits`);
      else if (prior) errors.push(`${label}: duplicate source content would inflate the sample count`);
      else hashSplits.set(item.sourceSha256, item.split);
    }
    const input = resolveInside(root, item.sourcePath, `${label}.sourcePath`, errors);
    if (input && !fs.existsSync(input)) errors.push(`${label}: source file is missing`);
    else if (input && SHA256.test(item.sourceSha256 || '') && sha256(input) !== item.sourceSha256) errors.push(`${label}: source file hash mismatch`);
  }
  if (splitCounts.development !== thresholds.development) errors.push(`expected ${thresholds.development} development images, found ${splitCounts.development}`);
  if (splitCounts.holdout !== thresholds.holdout) errors.push(`expected ${thresholds.holdout} holdout images, found ${splitCounts.holdout}`);

  const groups = new Map();
  const seenPairs = new Set();
  const runs = Array.isArray(manifest?.runs) ? manifest.runs : [];
  if (!runs.length) errors.push('runs must contain scored holdout outputs');
  for (const [index, run] of runs.entries()) {
    const label = `runs[${index}]`;
    if (!run || !itemById.has(run.itemId)) {
      errors.push(`${label}: itemId does not reference a dataset item`);
      continue;
    }
    const item = itemById.get(run.itemId);
    if (item.split !== 'holdout') {
      errors.push(`${label}: quality acceptance runs must use holdout items`);
      continue;
    }
    for (const field of ['task', 'provider', 'model', 'configSha256']) {
      if (typeof run[field] !== 'string' || !run[field].trim()) errors.push(`${label}: ${field} is required`);
    }
    if (!SHA256.test(run.configSha256 || '')) errors.push(`${label}: configSha256 must be lowercase SHA-256`);
    const criteria = criteriaByTask?.[run.task];
    if (!Array.isArray(criteria) || !criteria.length || criteria.some(id => typeof id !== 'string' || !rubric?.criteria?.[id])) {
      errors.push(`${label}: task must map to known rubric criteria`);
    }
    const output = resolveInside(root, run.outputPath, `${label}.outputPath`, errors);
    if (!SHA256.test(run.outputSha256 || '')) errors.push(`${label}: outputSha256 must be lowercase SHA-256`);
    if (output && !fs.existsSync(output)) errors.push(`${label}: output file is missing`);
    else if (output && SHA256.test(run.outputSha256 || '') && sha256(output) !== run.outputSha256) errors.push(`${label}: output file hash mismatch`);

    const raters = Array.isArray(run.raters) ? run.raters : [];
    if (raters.length !== 2 || !raters[0]?.id || !raters[1]?.id || raters[0].id === raters[1].id) {
      errors.push(`${label}: exactly two independent raters with different IDs are required`);
    }
    const outcomes = [];
    for (const [raterIndex, rater] of raters.entries()) {
      const raterLabel = `${label}.raters[${raterIndex}]`;
      const scores = rater?.scores;
      if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
        errors.push(`${raterLabel}: scores map is required`);
        outcomes.push(false);
        continue;
      }
      if (Array.isArray(criteria)) {
        for (const criterion of criteria) {
          if (!Number.isInteger(scores[criterion]) || scores[criterion] < 1 || scores[criterion] > 5) {
            errors.push(`${raterLabel}: ${criterion} must be an integer from 1 to 5`);
          }
        }
        for (const key of Object.keys(scores)) if (!criteria.includes(key)) errors.push(`${raterLabel}: unknown or non-applicable criterion ${key}`);
        outcomes.push(scorePasses(scores, criteria, rater.severeFailure));
      } else outcomes.push(false);
      if (typeof rater?.severeFailure !== 'boolean') errors.push(`${raterLabel}: severeFailure must be boolean`);
    }
    if (outcomes.length === 2 && outcomes[0] !== outcomes[1] &&
        (!run.adjudication || !['pass', 'fail'].includes(run.adjudication.decision) || typeof run.adjudication.rationale !== 'string' || !run.adjudication.rationale.trim())) {
      errors.push(`${label}: rater disagreement requires a documented adjudication`);
    }

    if (!['string','undefined'].includes(typeof run.task) || !run.provider || !run.model || !item.id) continue;
    const key = `${run.task}\u0000${run.provider}\u0000${run.model}`;
    const pairKey = `${key}\u0000${run.itemId}`;
    if (seenPairs.has(pairKey)) errors.push(`${label}: duplicate item in task/provider/model group`);
    seenPairs.add(pairKey);
    const group = groups.get(key) || { task: run.task, provider: run.provider, model: run.model, total: 0, passed: 0 };
    group.total++;
    const adjudicated = run.adjudication?.decision;
    const passed = adjudicated ? adjudicated === 'pass' : outcomes.length === 2 && outcomes.every(Boolean);
    if (passed) group.passed++;
    groups.set(key, group);
  }

  const groupReports = [...groups.values()].map(group => ({
    ...group,
    requiredPairs: thresholds.minPairsPerGroup,
    requiredPasses: thresholds.minPassingPairs,
    status: group.total < thresholds.minPairsPerGroup ? 'incomplete' : group.passed >= thresholds.minPassingPairs ? 'pass' : 'fail'
  }));
  return {
    schemaVersion: 1,
    dataset: dataset?.id || 'unknown',
    revision: dataset?.revision || 'unknown',
    splitCounts,
    status: errors.length ? 'invalid' : groupReports.length && groupReports.every(group => group.status === 'pass') ? 'pass' : 'fail',
    errors,
    groups: groupReports
  };
}

if (require.main === module) {
  const manifestPath = process.argv[2];
  const reportPath = process.argv[3];
  if (!manifestPath) {
    process.stderr.write('Usage: node scripts/quality-eval.cjs <manifest.json> [report.json]\n');
    process.exit(2);
  }
  try {
    const absoluteManifest = path.resolve(manifestPath);
    const manifest = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8'));
    const report = evaluateQualityManifest(manifest, path.dirname(absoluteManifest));
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (reportPath) fs.writeFileSync(path.resolve(reportPath), json, { flag: 'wx' });
    process.stdout.write(json);
    process.exitCode = report.status === 'pass' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { evaluateQualityManifest };
