export function publicProject(project) {
  if (!project) return project;
  const { githubTokenEnc, webhookSecret, ...rest } = project;
  return {
    ...rest,
    hasWebhookSecret: Boolean(webhookSecret),
  };
}


export function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
