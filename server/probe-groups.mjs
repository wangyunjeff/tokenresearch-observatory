export function attributionGroups(env, config, models) {
  const primary = {
    groupId:env.PROBE_GROUP_ID || 'primary',
    groupName:env.PROBE_GROUP_NAME || 'Primary',
    models,
    openaiBaseUrl:config.openaiBaseUrl,
    openaiApiKey:config.openaiApiKey
  };
  const extra = JSON.parse(env.ATTRIBUTION_EXTRA_GROUPS_JSON || '[]');
  if (!Array.isArray(extra)) throw new Error('ATTRIBUTION_EXTRA_GROUPS_JSON must be an array');
  const ids = new Set([primary.groupId]);
  return [primary, ...extra.map(group => {
    const id = String(group.id || '');
    if (!id || ids.has(id) || !group.name || !group.apiKeyEnv || !env[group.apiKeyEnv]) {
      throw new Error('Attribution group requires a unique id, name and configured API key environment variable');
    }
    ids.add(id);
    const groupModels = group.models || models;
    if (!Array.isArray(groupModels) || !groupModels.length || groupModels.some(x => typeof x !== 'string' || !x.trim())) {
      throw new Error('Attribution group models must be a nonempty string array');
    }
    return {groupId:id, groupName:group.name, models:[...new Set(groupModels)],
      openaiBaseUrl:config.openaiBaseUrl, openaiApiKey:env[group.apiKeyEnv]};
  })];
}
