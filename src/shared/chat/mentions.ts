export const MAX_MENTIONS = 10;
const fail = message => { const error = new Error(message); error.name = 'EngineError'; throw error; };
const searchName = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');

// Only public room identities leave this lookup, at most twenty per query.
export function mentionMembers(query, players, actor) {
  if (typeof query !== 'string' || query.length > 32 || /[\u0000-\u001f\u007f]/u.test(query)) fail('Use a participant name of up to 32 characters.');
  const needle = searchName(query.trim()), members = [];
  if (actor.role === 'host' && 'all'.includes(needle)) members.push({id: 'all', name: 'all', role: 'all'});
  if (actor.id !== 'host' && searchName('Host').includes(needle)) members.push({id: 'host', name: 'Host', role: 'host'});
  for (const player of players.values()) {
    if (members.length >= 20) break;
    if (player.connected && player.id !== actor.id && searchName(player.name).includes(needle)) members.push({id: player.id, name: player.name, role: 'player'});
  }
  return members;
}

// Offsets refer to the trimmed message, in JavaScript string units. IDs, names,
// permissions and ranges are all checked here; client labels never grant a ping.
export function messageMentions(raw, body, {host, enabled, players}) {
  if (raw != null && !Array.isArray(raw)) fail('Choose a valid mention.');
  if ((raw?.length ?? 0) > MAX_MENTIONS) fail('Use up to 10 mentions per message.');
  const mentions = (raw ?? []).map(value => {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !Number.isInteger(value.start) || !Number.isInteger(value.end) || value.start < 0 || value.end <= value.start || value.end > body.length) fail('Choose a valid mention.');
    let name;
    if (value.id === 'all') {
      if (!host) fail('Only the host can mention @all.');
      name = 'all';
    } else {
      if (!host && !enabled) fail('Participant mentions are turned off.');
      const player = players.get(value.id);
      if (value.id !== 'host' && !player) fail('That participant is no longer in the room.');
      name = value.id === 'host' ? 'Host' : player.name;
    }
    const label = body.slice(value.start, value.end);
    if (value.id === 'all' ? !/^@all$/iu.test(label) : label !== '@' + name) fail('Choose a name from the mention list.');
    return {id: value.id, start: value.start, end: value.end};
  });
  // A host can also type @all directly. Explicit individual mentions take
  // precedence, including a participant whose nickname happens to be "all".
  if (host) for (const match of body.matchAll(/(^|[\s([{.,!?;:])(@all)(?=$|[^\p{L}\p{N}_])/giu)) {
    const start = match.index + match[1].length, end = start + match[2].length;
    if (!mentions.some(item => start < item.end && end > item.start)) mentions.push({id: 'all', start, end});
  }
  mentions.sort((a, b) => a.start - b.start);
  if (mentions.length > MAX_MENTIONS) fail('Use up to 10 mentions per message.');
  for (let i = 1; i < mentions.length; i++) if (mentions[i].start < mentions[i - 1].end) fail('Mentions cannot overlap.');
  return mentions;
}
