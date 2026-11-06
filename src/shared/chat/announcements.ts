// A countdown is one deadline, persisted with the announcement. No per-second writes.
export function announcementCountdown(body, now) {
  const tokens = [...body.matchAll(/\{([^{}]*)\}/gu)].filter(match => /^[\s+\-\d.]*$/u.test(match[1]));
  if (!tokens.length) return null;
  const value = tokens[0][1].trim();
  if (tokens.length !== 1 || !/^(?:[1-9]|[1-5]\d|60)$/.test(value)) {
    const error = new Error('Use one countdown from {1} to {60} minutes.');
    error.name = 'EngineError';
    throw error;
  }
  const start = tokens[0].index;
  let end = start + tokens[0][0].length;
  // The displayed clock already includes seconds, so omit a redundant English unit.
  end += body.slice(end).match(/^\s*(?:minutes?|mins?)\b/iu)?.[0].length ?? 0;
  return {start, end, endsAt: now + Number(value) * 60_000};
}
