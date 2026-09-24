# Multi-model monitoring

Production models: gpt-6-astra, gpt-5.6-terra, gpt-5.6-sol, gpt-6-sol,
gpt-6-luna. Candy runs every 10 minutes per model. Attribution runs every
30 minutes per model, three independent Responses requests, provider-default
reasoning. Pelican keeps the existing gpt-6-astra executor and 30-minute cadence.

Environment configuration:
```
PROBE_MODELS=gpt-6-astra,gpt-5.6-terra,gpt-5.6-sol,gpt-6-sol,gpt-6-luna
ATTRIBUTION_ENABLED=true
ATTRIBUTION_TIMEOUT_MS=180000
CANDY_HISTORY_LIMIT=5000
PROBE_GROUP_ID=58
PROBE_GROUP_NAME="Primary group display name"
ATTRIBUTION_EXTRA_GROUPS_JSON='[{"id":"64","name":"Temporary group display name","apiKeyEnv":"ATTRIBUTION_TEMP_API_KEY"}]'
```

Set ATTRIBUTION_TEMP_API_KEY only in the protected server environment file,
never in Git or public configuration. Extra groups inherit PROBE_MODELS unless
an explicit models array is supplied. They run attribution only, not candy or
pelican. Group 64 is the production temporary non-degraded test group.

All model loops use one worker. A single FIFO queue also serializes candy,
attribution and the pelican executor across ALL groups. An attribution round's
three requests run sequentially while holding the queue slot. Actual upstream
request concurrency is therefore at most one, not one per job or per group.
Cadences remain 10/30 minutes, but queued work waits. Overlapping rounds are
skipped, not accumulated; a slow batch can miss a scheduled boundary. Times
are actual execution times, not queue times. No backdated data is created.
The public monitor.probe_queue exposes the active job and queued labels.
ModelTrace's immutable source/version/license and transport differences are in
server/modeltrace/PROVENANCE.md. The score is closed-set probability, not a
guarantee of identity. The group may route each request to different accounts.

Candy rows have model_id. Legacy rows without this field belong to gpt-6-astra.
The UI filters spectrum, latency, answers and rate by the selected model.
Attribution rows retain model, timestamps, status, three prompts/responses,
diagnostics, full candidate/family distribution, method revision and bank hash.
New rows also retain group_id and group_name. Legacy rows without group_id
belong only to the primary group. The attribution group selector scopes both
the latest result and the history; the candy model selector is unchanged.
Only rounds with all three accepted outputs publish probabilities. Error/running
rounds never display a previous round's probability as their current result.
The newest 500 attribution rounds are retained; detail view lists 12 recent
rounds per model. No upstream account is deleted or disabled by this feature.
