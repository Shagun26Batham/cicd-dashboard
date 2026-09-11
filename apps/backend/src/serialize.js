export function publicProject(project) {
  if (!project) return project;
  const { githubTokenEnc, ...rest } = project;
  return rest;
}

export function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
