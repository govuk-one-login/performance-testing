# Dynamic Profiles — Usage & Implementation Guide

## What is it?

The dynamic profile feature lets you configure k6 load test scenarios entirely through environment variables at runtime — no code changes, no recompile. You pass a structured string to `SCENARIO_CONFIG` and the framework builds the correct k6 scenario for you.

---

## Step 1 — Understand the Config String Format

```
scenarioName:target:duration:rampUp:type
```

Multiple scenarios are comma-separated:

```
scenarioName1:target:duration:rampUp:type,scenarioName2:target:duration:rampUp:type
```

### Field Reference

| Field          | Type    | Description                                                                 |
|----------------|---------|-----------------------------------------------------------------------------|
| `scenarioName` | string  | Must match an exported function in your `test.ts` (e.g. `identity`, `idReuse`) |
| `target`       | integer | Peak throughput. For `peakSignUp`/`spikeSignUp`: iterations per 10s. For `peakSignIn`/`spikeSignIn`: iterations per second |
| `duration`     | integer | Max iteration duration in seconds — used to size the VU pool                |
| `rampUp`       | integer | Ramp-up duration in seconds to reach peak throughput                        |
| `type`         | string  | One of: `peakSignUp`, `peakSignIn`, `spikeSignUp`, `spikeSignIn`            |

---

## Step 2 — Choose the Right Type

| Journey type          | Recommended `type` |
|-----------------------|--------------------|
| Identity prove (new)  | `peakSignUp`       |
| ID reuse / sign-in    | `peakSignIn`       |
| Identity spike test   | `spikeSignUp`      |
| Sign-in spike test    | `spikeSignIn`      |

**Peak types** produce a simple ramp-up then 30-minute hold.
**Spike types** produce a two-wave pattern: ramp to 33% → fast spike to 100% → drop → NFR-rate ramp to 100%.

---

## Step 3 — Build Your Config String

### Example: Peak test (identity + idReuse)

```
identity:180:42:181:peakSignUp,idReuse:71:6:33:peakSignIn
```

Breaking this down:

| Field    | `identity`   | `idReuse`   |
|----------|--------------|-------------|
| target   | 180 (per 10s)| 71 (per 1s) |
| duration | 42s          | 6s          |
| rampUp   | 181s         | 33s         |
| type     | peakSignUp   | peakSignIn  |

### Example: Spike test (identity + idReuse)

```
identity:540:36:541:spikeSignUp,idReuse:143:6:66:spikeSignIn
```

---

## Step 4 — Run the Test

### Locally with k6

```bash
# Build first
npm start

# Run with dynamic profile
k6 run \
  --env PROFILE=dynamic \
  --env SCENARIO_CONFIG="identity:180:42:181:peakSignUp,idReuse:71:6:33:peakSignIn" \
  --env ENVIRONMENT=BUILD \
  --env IDENTITY_BUILD_ORCH_STUB_URL=https://your-stub-url \
  --env IDENTITY_BUILD_CORE_URL=https://your-core-url \
  --env IDENTITY_BUILD_CORE_VTR_TEXT=your-vtr \
  --env IDENTITY_ORCH_STUB_USERNAME=user \
  --env IDENTITY_ORCH_STUB_PASSWORD=pass \
  dist/ipv-core/test.js
```

### Via AWS CodeBuild / pipeline

Set these as environment variables in your pipeline configuration:

```
PROFILE=dynamic
SCENARIO_CONFIG=identity:180:42:181:peakSignUp,idReuse:71:6:33:peakSignIn
```

All other required env vars (`ENVIRONMENT`, URLs, credentials) should already be sourced from SSM Parameter Store via the existing pipeline setup.

---

## Step 5 — Adding Dynamic Profile Support to a New Test File

If you are writing a new `test.ts` and want to support dynamic profiles, follow this pattern:

### 1. Import `createDynamicProfile`

```typescript
import { createDynamicProfile } from '../common/utils/config/dynamic-profiles'
```

### 2. Add `dynamic` to your profiles object

```typescript
const profiles: ProfileList = {
  smoke: {
    ...createScenario('myScenario', LoadProfile.smoke)
  },
  load: {
    ...createScenario('myScenario', LoadProfile.full, 100, 30)
  },
  // Add this entry — the ?? {} fallback is required
  dynamic: createDynamicProfile() ?? {}
}
```

### 3. Ensure your scenario names match exported functions

The `scenarioName` in `SCENARIO_CONFIG` must exactly match an exported function in your test file:

```typescript
// This must exist as an export for scenarioName "myScenario" to work
export function myScenario(): void {
  // your test logic
}
```

That's all — no other changes needed.

---

## Step 6 — Validate Your Config Before Running

Because invalid entries are silently skipped, a typo in `SCENARIO_CONFIG` will result in an empty scenario list and k6 will exit immediately with no iterations run.

**Quick validation checklist:**

- [ ] Each entry has exactly 5 colon-separated fields
- [ ] `scenarioName` matches an exported function in the test file
- [ ] `target`, `duration`, `rampUp` are positive integers
- [ ] `type` is one of: `peakSignUp`, `peakSignIn`, `spikeSignUp`, `spikeSignIn`
- [ ] No trailing commas or spaces around colons
- [ ] `PROFILE=dynamic` is set alongside `SCENARIO_CONFIG`

---

## Real-World Examples from ipv-core

These are taken directly from the static profiles in `ipv-core/test.ts` and show the equivalent dynamic config string:

### perf006Iteration7PeakTest

Static definition:
```typescript
perf006Iteration7PeakTest: {
  ...createI4PeakTestSignUpScenario('identity', 180, 42, 181),
  ...createI4PeakTestSignInScenario('idReuse', 71, 6, 33)
}
```

Equivalent dynamic config:
```
SCENARIO_CONFIG=identity:180:42:181:peakSignUp,idReuse:71:6:33:peakSignIn
```

---

### perf006Iteration7SpikeTest

Static definition:
```typescript
perf006Iteration7SpikeTest: {
  ...createI3SpikeSignUpScenario('identity', 540, 36, 541),
  ...createI3SpikeSignInScenario('idReuse', 143, 6, 66)
}
```

Equivalent dynamic config:
```
SCENARIO_CONFIG=identity:540:36:541:spikeSignUp,idReuse:143:6:66:spikeSignIn
```

---

### perf006Iteration8PeakTest

```
SCENARIO_CONFIG=identity:170:42:171:peakSignUp,idReuse:126:6:58:peakSignIn
```

### perf006Iteration8SpikeTest

```
SCENARIO_CONFIG=identity:630:42:631:spikeSignUp,idReuse:227:6:104:spikeSignIn
```

---

## Troubleshooting

### k6 exits immediately with 0 iterations

The `dynamic` profile resolved to an empty scenario list. Check:
- `PROFILE=dynamic` is set
- `SCENARIO_CONFIG` is set and non-empty
- All entries have exactly 5 fields separated by `:`
- `type` is spelled correctly

### Only some scenarios run

One or more entries were silently skipped. Check each entry individually — a missing field or unknown type causes that entry to be dropped.

### VU allocation warnings from k6

Your `duration` value may be too low relative to `target`, resulting in an undersized VU pool. Increase `duration` to match the actual iteration completion time of your journey.

### Wrong throughput

Remember the `target` unit differs by type:
- `peakSignUp` / `spikeSignUp` → iterations per **10 seconds**
- `peakSignIn` / `spikeSignIn` → iterations per **1 second**

A `target` of `180` for `peakSignUp` = 18 iterations/second. The same `180` for `peakSignIn` = 180 iterations/second.