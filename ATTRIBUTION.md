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
```

Both multi-model jobs use two workers and skip overlapping rounds. Each round
is timestamped at actual execution time. No backdated data is created.
ModelTrace's immutable source/version/license and transport differences are in
server/modeltrace/PROVENANCE.md. The score is closed-set probability, not a
guarantee of identity. The group may route each request to different accounts.

Candy rows have model_id. Legacy rows without this field belong to gpt-6-astra.
The UI filters spectrum, latency, answers and rate by the selected model.
Attribution rows retain model, timestamps, status, three prompts/responses,
diagnostics, full candidate/family distribution, method revision and bank hash.
Only rounds with all three accepted outputs publish probabilities. Error/running
rounds never display a previous round's probability as their current result.
The newest 500 attribution rounds are retained; detail view lists 12 recent
rounds per model. No upstream account is deleted or disabled by this feature.
