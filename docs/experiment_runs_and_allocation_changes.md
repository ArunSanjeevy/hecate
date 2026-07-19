# Experiment Runs And Allocation Changes

## Problem Statement

The backend currently treats an experiment key as both the public client-facing
identifier and the lifetime identity of one experiment configuration. Once an
experiment becomes active, its variants and allocations are immutable.

That conservative rule protects analytics correctness, but it creates an
awkward product experience:

```text
Client code calls: getVariant("checkout_button_text")
```

If the team wants to run the same product experiment again with a different
allocation or variant set, forcing the client to change the key to something
like `checkout_button_text_v2` leaks backend lifecycle details into application
code.

The user-facing need is:

```text
Keep the same stable experiment key in client code.
Allow new experiment runs or allocation strategies behind that key.
Keep analytics correct across historical and current runs.
```

## Example

Suppose the client integrates once:

```js
const variant = await hecate.getVariant('checkout_button_text');
```

The product team first runs:

```text
Run 1
experiment_key: checkout_button_text
allocation: control 50%, treatment 50%
status: archived
```

Later, the team wants to run the same product surface again:

```text
Run 2
experiment_key: checkout_button_text
allocation: control 90%, treatment 10%
status: active
```

The client should not need to change from `checkout_button_text` to
`checkout_button_text_v2`. The backend should resolve the stable public key to
the current active run.

## Why The Current Block Exists

The current backend computes assignment statelessly from:

```text
visitorId + experimentKey + current variant allocation
```

If allocation changes in place, the same visitor can move cohorts.

Example:

```text
visitor_123 hashes to bucket 6200
```

At 50/50:

```text
0-4999    -> control
5000-9999 -> treatment
```

`visitor_123` gets `treatment`.

At 90/10:

```text
0-8999    -> control
9000-9999 -> treatment
```

The same visitor now gets `control`.

That breaks sticky assignment and can corrupt result interpretation:

- users can see one variant and later another variant;
- exposure verification can reject legitimate events if the current config no
  longer matches the variant previously shown;
- conversions can be attributed to a moving cohort;
- raw results mix users enrolled under different assignment rules.

For that reason, the current implementation blocks allocation and variant
changes once an experiment is active, paused, or archived.

## Discussion

We discussed whether soft delete alone solves the data model problem.

Soft delete or archive helps preserve historical rows, but by itself it is only
safe if:

- archived keys remain reserved;
- archived experiments cannot be reactivated;
- active or previously active configurations cannot be mutated in place.

We agreed that archived experiments should be terminal. A paused experiment can
resume, but an archived experiment should not be activated again because that
would mix old and new traffic under the same historical run.

We also discussed the developer experience problem: asking client applications
to keep changing experiment keys for the same product purpose is undesirable.
The client-facing key should be stable.

The key insight:

```text
experimentKey should be the stable public API key.
experimentRunId/version should be the internal analytics identity.
```

## How Mature Platforms Handle This

Statsig and Adobe Target allow traffic/allocation changes, but they do it with
guardrails.

Statsig allows increasing experiment allocation after start, but warns against
decreasing allocation without resetting because it can bias results. Statsig
also supports persistent assignment so already exposed users keep their group
when allocation or targeting changes.

Adobe Target supports manual traffic allocation and also has Auto-Allocate. In
Auto-Allocate, more new visitors can be sent to better-performing experiences,
while returning visitors continue seeing their original experience to protect
test validity.

The common pattern is:

```text
Do not freely rebucket existing exposed users.
Allocation changes should affect new entrants or use persisted assignments.
```

## Proposed Solution

Introduce experiment runs under a stable experiment key.

Conceptually:

```text
experiments
  id
  key
  user_id
  created_at

experiment_runs
  id
  experiment_id
  status
  variants
  allocation
  started_at
  ended_at
  created_at
  updated_at
```

Events should record both:

```text
experiment_key
experiment_run_id
```

The public assignment flow becomes:

```text
Client asks for checkout_button_text
Backend finds active run for checkout_button_text
Backend assigns visitor within that run
Backend records exposure against that run
Results aggregate by run, not just by key
```

This lets the client keep one stable key:

```js
hecate.getVariant('checkout_button_text');
```

while the backend keeps analytics separated:

```text
checkout_button_text / run_1 -> 50/50 historical result
checkout_button_text / run_2 -> 90/10 current result
```

## Allocation Change Options

There are two safe ways to support allocation changes.

### Option 1: New Run For Meaningful Config Changes

When variants or allocation meaningfully change, create a new run under the same
experiment key.

Use this when:

- the team wants a clean analytical reset;
- the variant set changes;
- allocation changes would materially alter cohort composition;
- the previous run has been archived or decided.

This is the simplest production-safe model.

### Option 2: Persistent Assignment For Ramping

If the team wants traffic ramping within the same run, persist each visitor's
first assignment.

Flow:

```text
first request:
  compute assignment from current allocation
  save visitorId -> experiment_run_id -> variant

later request:
  return saved assignment even if allocation changed
```

Allocation changes then apply only to new entrants. Existing exposed visitors
stay sticky.

This supports Statsig-like ramping without changing the client key or corrupting
existing cohorts.

## Recommended Direction

For the current backend:

1. Keep the current archive behavior: delete means archive, keys remain
   reserved, archived is terminal.
2. Keep active/paused/archived configs immutable until experiment runs are
   introduced.
3. Add `experiment_runs` before allowing same-key relaunches or in-place
   allocation changes.
4. For ramping, add persistent assignment so allocation changes only affect new
   visitors.

This gives the desired client experience:

```text
Stable key forever in client code.
Clean historical analytics in the backend.
Safe allocation changes without rebucketing existing users.
```

