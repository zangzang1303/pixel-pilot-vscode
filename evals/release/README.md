# Image quality evaluation workflow (T19)

The quality evaluator is intentionally separate from the Copilot intent accuracy evaluation and from provider runtime smoke tests. It reports one result per `task + provider + model`; passing one group cannot hide a failing group.

## Manifest contract

`node scripts/quality-eval.cjs <manifest.json> [report.json]` validates a JSON manifest with:

- `schemaVersion: 1` and a dataset ID/revision.
- `dataset.rightsConfirmed: true` plus a recorded `rightsSource` before any image enters the set.
- Exactly 40 `development` and 20 `holdout` items by default. Each has a unique ID, relative source path, SHA-256, and content group. Repeated image hashes and cross-split leakage fail validation.
- A versioned rubric with criteria labels and `criteriaByTask`. Only applicable criteria are scored for each task.
- Each holdout run binds the item, task, provider, model, configuration SHA-256, output path/hash, and two distinct rater IDs. Scores are integers 1–5 and severe failures are recorded explicitly.
- Rater outcome disagreement requires an adjudication decision and rationale.

The default release threshold is 20 scored holdout pairs and at least 17 passing pairs for every task/provider/model group. A case passes only when both raters score every applicable criterion at least 4/5 and record no severe failure, unless a documented adjudication resolves a disagreement. Thresholds can be changed in the manifest only with a recorded product decision.

The validator resolves source and output paths inside the manifest directory, verifies file hashes, rejects duplicate cases, and does not upload images or contact providers. `report.json` is created exclusively; choose a new output path for each run.

## Current evidence and outstanding inputs

The checked-in `TC1_recolor_clothes_blue.png` and local-provider JSON files are runtime fixtures/smokes, not the 60-image licensed dataset and not a visual holdout. No human ratings or product-approved task rubric are checked in. Therefore T19 is **not accepted** until the team supplies rights-confirmed source images, task/provider/model outputs, the final rubric/threshold decision, and two independent raters. Synthetic evaluator fixtures under `test/` only verify the validator; they are not quality evidence.
