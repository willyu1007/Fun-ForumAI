# 02 Operator Checklist

## Scope

This checklist is the task-local execution sheet for the real `staging` release window. It does not replace the canonical rollout runbooks:

- [deployment-mainline.md](/Users/phoenix/Desktop/project/Fun-ForumAI/ops/deploy/handbook/runbooks/deployment-mainline.md:1)
- [ecs-web-eci-worker-rollout.md](/Users/phoenix/Desktop/project/Fun-ForumAI/ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md:1)

Use those runbooks for the baseline ECS web + worker rollout. Use this checklist to capture the extra media injection / retrieval / planner evidence required by `T-954`.

## Preconditions

- The desired immutable image ref for `staging` is already approved and recorded.
- The staging API env-file has been compiled and injected through the normal cloud path, or the temporary staging bootstrap exception has been approved.
- The rollout operator has:
  - ECS shell access
  - access to the deploy workspace or ECS host repo checkout
  - a valid staging admin token
  - a real DashScope key in staging secrets
- `T-973` repo-side implementation is already part of the staging image being deployed.

## Evidence Folder

Create one operator evidence folder before touching the environment:

```bash
mkdir -p .ai/.tmp/staging-media-verify/$(date +%Y%m%d-%H%M%S)
```

Reuse that directory for:

- copied manifest file
- `media:inject` dry-run/apply JSON output
- SQL snapshots
- runtime logs
- operator notes and rollback notes

## Step 1: Freeze Release Inputs

Record the release intent and resolve the exact image ref:

```bash
node ops/deploy/scripts/release-intent.mjs show --env staging
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
printf '%s\n' "$IMAGE_REF"
```

Record:

- operator name
- staging web base URL
- staging worker base URL
- staging admin token source
- current commit SHA / image ref

If `IMAGE_REF` is empty or mutable, stop. Do not continue with a non-immutable target.

## Step 2: Roll ECS Web + Worker Baseline

Execute the normal staging rollout first. Do not run the media checks on a half-rolled environment.

Follow these sections in order:

1. [deployment-mainline.md](/Users/phoenix/Desktop/project/Fun-ForumAI/ops/deploy/handbook/runbooks/deployment-mainline.md:37)
2. [ecs-web-eci-worker-rollout.md](/Users/phoenix/Desktop/project/Fun-ForumAI/ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md:20)

Minimum evidence to keep:

- ECS web healthy
- worker healthy
- worker logs show runtime startup
- `/v1/admin/runtime/stats` reports `allow_public_growth=false` before activation
- `pnpm verify:launch:staging` passes only after warm-up activation

If the baseline warm-up / activation flow is red, stop. Do not attribute that failure to the media tranche yet.

## Step 3: Confirm Media Flags And Runtime Parity

Check the compiled/injected staging env-file contains the media flags intended for this rollout:

```bash
grep -nE '^(FF_MEDIA_INJECTION_V1|FF_MEDIA_RETRIEVAL_V1|FF_MEDIA_PLANNER_RETRIEVAL_V1)=' ops/deploy/env-files/staging.env
```

On the ECS host, confirm the running containers see the same flags:

```bash
cd /srv/apps/fun-forum
sudo -E docker compose exec -T web env | grep -E '^(FF_MEDIA_INJECTION_V1|FF_MEDIA_RETRIEVAL_V1|FF_MEDIA_PLANNER_RETRIEVAL_V1)='
sudo -E docker compose --profile staging-same-host-worker exec -T worker env | grep -E '^(FF_MEDIA_INJECTION_V1|FF_MEDIA_RETRIEVAL_V1|FF_MEDIA_PLANNER_RETRIEVAL_V1)='
```

Expected:

- all three flags are present
- values match the rollout intent
- no mismatch between web and worker

If the flags are missing or disagree between web and worker, stop and open a narrow repo/env task. Do not keep validating on a drifted runtime.

## Step 4: Prepare A Minimal Real Staging Manifest

Use one public-safe import and one private import in the same manifest.

Rules:

- The public item should use `platform_canonical` unless a community-specific scope is required.
- The private item must use a real staging `owner_user_id` and `steward_agent_id` pair that already exists.
- Do not invent agent/user ids. If you do not have a valid pair, stop and record that as an operator blocker.

Suggested manifest:

```yaml
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: staging-media-verify-001
  generated_by_tool: operator-checklist
  generated_at: 2026-04-16T00:00:00Z

defaults:
  entrypoint: cli_manifest
  indexing:
    primary_scope: public_safe
    public_safe_enabled: true
    embedding_policy_id: text-embedding-v4-1024
  dedupe:
    policy_id: exact_and_near
  reuse:
    mode_id: default
  catalog:
    policy_id: standard

items:
  - item_id: staging-public-canonical-001
    input_kind: local_file
    source_kind: platform_canonical
    path: ./artifacts/staging-public-canonical-001.png
    declared_mime_type: image/png
    annotations:
      tags: [staging, media, canonical, lantern]
      internal_note: Real staging canonical import verification.

  - item_id: staging-owner-private-001
    input_kind: local_file
    source_kind: owner_private_pool
    path: ./artifacts/staging-owner-private-001.png
    declared_mime_type: image/png
    target_scope:
      owner_user_id: <real-owner-user-id>
      steward_agent_id: <real-steward-agent-id>
    indexing:
      primary_scope: private_internal
      public_safe_enabled: false
      embedding_policy_id: text-embedding-v4-1024
    annotations:
      tags: [staging, media, private, memory]
      owner_note: Real staging private retrieval isolation verification.
```

Save the manifest inside the evidence folder.

## Step 5: Run `media:inject` Dry-Run And Apply

From the repo root on the deploy workspace or ECS host:

```bash
set -a
source /srv/apps/fun-forum/.env
set +a

pnpm media:inject \
  --manifest .ai/.tmp/staging-media-verify/<timestamp>/staging-media-verify.yaml \
  --dry-run \
  --requested-by-type system \
  --requested-by-id staging-operator | tee .ai/.tmp/staging-media-verify/<timestamp>/media-dry-run.json

pnpm media:inject \
  --manifest .ai/.tmp/staging-media-verify/<timestamp>/staging-media-verify.yaml \
  --apply \
  --requested-by-type system \
  --requested-by-id staging-operator | tee .ai/.tmp/staging-media-verify/<timestamp>/media-apply.json
```

Capture:

- dry-run `item_plan`
- apply `job_id`
- `request_fingerprint`
- `intent_fingerprint`

Expected:

- dry-run reports `create` for the first public/private imports
- apply returns a new `job_id`
- no immediate validation error

## Step 6: Confirm Worker Claim, Heartbeat, And Job Convergence

Extract the job id:

```bash
JOB_ID="$(jq -r '.job_id' .ai/.tmp/staging-media-verify/<timestamp>/media-apply.json)"
printf '%s\n' "$JOB_ID"
```

Check worker logs:

```bash
cd /srv/apps/fun-forum
sudo -E docker compose --profile staging-same-host-worker logs --tail=200 worker | grep -E 'MediaImportJobWorker|processed job='
```

Check DB state:

```bash
psql "$DATABASE_URL" -x -c "select id,status,phase,attempt_count,created_items,reused_items,suppressed_items,failed_items,result_manifest_key,failure_log_key,last_heartbeat_at from media_import_jobs where id = '$JOB_ID';"

psql "$DATABASE_URL" -c "select item_id,status,input_kind,source_kind,index_scope,resolved_asset_id,error_code from media_import_job_items where job_id = '$JOB_ID' order by item_index;"
```

Expected:

- job reaches `succeeded` or an intentional `partial_succeeded`
- `last_heartbeat_at` is populated while the worker is active
- `result_manifest_key` is present
- no unexplained `failed_items`
- each item has a `resolved_asset_id`

If the job stalls in `queued` or `running`, collect:

- worker logs
- `media_import_jobs` row
- `media_import_job_items` rows

and stop. That indicates a real ECS/worker/cloud-runtime drift.

## Step 7: Confirm Catalog, Retrieval Doc, And Searchable Snapshot

Use the resolved asset ids from Step 6:

```bash
psql "$DATABASE_URL" -c "select item_id,resolved_asset_id from media_import_job_items where job_id = '$JOB_ID' order by item_index;"
```

Then verify retrieval state:

```bash
psql "$DATABASE_URL" -c "
select
  d.asset_id,
  d.doc_scope,
  d.source_kind,
  d.owner_user_id,
  d.steward_agent_id,
  d.is_canonical,
  s.search_status,
  s.is_active,
  s.vector_dimension
from media_retrieval_documents d
join media_embedding_snapshots s
  on s.retrieval_document_id = d.id
where d.asset_id in (
  select resolved_asset_id
  from media_import_job_items
  where job_id = '$JOB_ID'
)
order by d.asset_id, d.doc_scope, s.created_at desc;
"
```

Expected:

- public import creates `public_safe`
- private import creates `private_internal`
- active snapshots exist
- `search_status=searchable`
- vector dimension is `1024`

If a snapshot is `backfill_required` or non-searchable, treat that as a real staging blocker unless the operator intentionally disabled retrieval for this rollout.

## Step 8: Confirm Scoped Retrieval Hits And Isolation

Run one public query and one private query against the real staging DB + DashScope embedding path.

```bash
PUBLIC_QUERY='lantern canonical staging asset'
PRIVATE_QUERY='private memory staging asset'
PRIVATE_OWNER_USER_ID='<real-owner-user-id>'
PRIVATE_STEWARD_AGENT_ID='<real-steward-agent-id>'

pnpm tsx --eval "
import { config } from './src/backend/lib/config.ts'
import { createRepositories } from './src/backend/container/repos.ts'
import { disconnectPrisma } from './src/backend/persistence/prisma-client.ts'
import { DashScopeTextEmbeddingGateway } from './src/backend/media/dashscope-text-embedding-gateway.ts'
import { MediaEmbeddingService } from './src/backend/media/media-embedding-service.ts'

const { repos } = await createRepositories(config.db.usePrisma)
const embedding = new MediaEmbeddingService({
  mediaEmbeddingSnapshotRepo: repos.mediaEmbeddingSnapshotRepo,
  gateway: new DashScopeTextEmbeddingGateway(),
})

try {
  const publicVector = await embedding.embedQuery({
    query_text: process.env.PUBLIC_QUERY ?? '',
    trace_id: 'staging-public-hit',
  })
  const privateVector = await embedding.embedQuery({
    query_text: process.env.PRIVATE_QUERY ?? '',
    trace_id: 'staging-private-hit',
  })

  const publicHits = publicVector
    ? await repos.mediaRetrievalSearchRepo.searchActive({
        query_vector: publicVector,
        index_profile_id: config.mediaRetrieval.indexProfileId,
        limit: 3,
        doc_scopes: ['public_safe'],
        only_canonical: true,
      })
    : []

  const privateHits = privateVector
    ? await repos.mediaRetrievalSearchRepo.searchActive({
        query_vector: privateVector,
        index_profile_id: config.mediaRetrieval.indexProfileId,
        limit: 3,
        doc_scopes: ['private_internal'],
        source_kinds: ['owner_private_pool'],
        owner_user_id: process.env.PRIVATE_OWNER_USER_ID || undefined,
        steward_agent_id: process.env.PRIVATE_STEWARD_AGENT_ID || undefined,
        only_canonical: true,
      })
    : []

  console.log(JSON.stringify({ publicHits, privateHits }, null, 2))
} finally {
  if (config.db.usePrisma) {
    await disconnectPrisma()
  }
}
" | tee .ai/.tmp/staging-media-verify/<timestamp>/media-search-check.json
```

Expected:

- `publicHits[0]` is non-empty and points at the public imported asset
- `privateHits[0]` is non-empty and points at the private imported asset
- the public search does not surface the owner-private document

If public-safe and private queries cross-hit each other, stop. That is a real scope-isolation regression.

## Step 9: Planner Retrieval Spot-Check

Do not toggle staging feature flags live without explicit approval. The safest spot-check is:

1. trigger one real staging planning flow that is allowed to use `platform_canonical`
2. use a query/theme that matches the imported canonical asset from Step 4
3. capture the latest `image_plans` row for that probe selection

Recommended DB evidence:

```bash
psql "$DATABASE_URL" -x -c "
select id,directive_id,status,decision,selected_sources,planner_audit,created_at
from image_plans
where created_at > now() - interval '30 minutes'
order by created_at desc
limit 5;
"
```

Expected:

- the selected source set includes the canonical imported asset or its duplicate-cluster canonical representative
- `planner_audit` contains a positive retrieval contribution when retrieval is active
- no non-canonical duplicate is selected as the winning retrieval hit

If a live retrieval-off vs retrieval-on A/B is explicitly approved, record the two resulting `image_plans` rows separately. Do not perform that toggle ad hoc during a normal staging release.

## Step 10: Rollback Notes

If any media-specific step fails after the baseline rollout is already healthy, capture:

- exact failing command
- job id
- relevant `media_import_jobs` / `media_import_job_items` rows
- worker log excerpt
- whether web/worker should be rolled back or whether the issue is limited to the new media flags

Use the existing rollback procedure for host rollback:

- [rollback-procedure.md](/Users/phoenix/Desktop/project/Fun-ForumAI/ops/deploy/handbook/runbooks/rollback-procedure.md:1)

Do not roll back only the media worker behavior if the deployed image and DB migration are already coupled incompatibly.
