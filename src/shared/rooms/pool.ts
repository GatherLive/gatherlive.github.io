import {HttpError, json, readJson} from '../http/api.js';

export interface PoolEnvironment {ROOM_POOL_NODES?: string; ROOM_POOL_SLOT?: string; ROOM_POOL_KEY?: string}
interface Node {slot: string; origin: string}
const encoder = new TextEncoder(), PATH = '/api/room-relay';
const validOwner = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
export function roomPool(env: PoolEnvironment) {
  if (!env.ROOM_POOL_NODES) return null;
  let nodes: Node[];
  try {nodes = JSON.parse(env.ROOM_POOL_NODES);} catch {throw new HttpError(503, 'The room service is temporarily unavailable. Please retry.');}
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 8 || !/^[a-f0-9]{64,128}$/.test(env.ROOM_POOL_KEY || '')) throw new HttpError(503, 'The room service is temporarily unavailable. Please retry.');
  const slots = new Set();
  for (const node of nodes) {
    let url: URL;try {url = new URL(node.origin);} catch {throw new HttpError(503, 'The room service is temporarily unavailable. Please retry.');}
    if (!/^[1-9]$/.test(node.slot) || slots.has(node.slot) || url.username || url.password || url.origin !== node.origin || url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new HttpError(503, 'The room service is temporarily unavailable. Please retry.');
    slots.add(node.slot);
  }
  const self = nodes.find(node => node.slot === env.ROOM_POOL_SLOT);
  if (!self) throw new HttpError(503, 'The room service is temporarily unavailable. Please retry.');
  return {self, primary: nodes[0], nodes, peers: nodes.filter(node => node !== self)};
}
async function key(env: PoolEnvironment) {return crypto.subtle.importKey('raw', encoder.encode(env.ROOM_POOL_KEY), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);}
function signatureInput(timestamp, nonce, body) {return encoder.encode(`POST\n${PATH}\n${timestamp}\n${nonce}\n${body}`);}
async function call(env: PoolEnvironment, node: Node, op: string, data: unknown) {
  const body = JSON.stringify({op, data}), timestamp = String(Date.now()), nonce = crypto.randomUUID();
  const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', await key(env), signatureInput(timestamp, nonce, body)))].map(value => value.toString(16).padStart(2, '0')).join('');
  let response: Response;
  try {response = await fetch(node.origin + PATH, {method: 'POST', body, redirect: 'error', headers: {'Content-Type': 'application/json', 'X-Gather-Time': timestamp, 'X-Gather-Nonce': nonce, 'X-Gather-Signature': signature}, signal: AbortSignal.timeout(15_000)});}
  catch {throw new HttpError(503, 'A room service is temporarily unavailable. Please retry.');}
  const result = await response.json().catch(() => null) as {ok?: boolean; error?: string; value?: any} | null;
  if (!response.ok || !result?.ok) throw new HttpError(response.status >= 500 ? 503 : response.status, result?.error || 'The room service could not complete this request.');
  return result.value;
}
export async function poolChatAccess(env: PoolEnvironment, ownerId: string): Promise<boolean | null> {
  const pool = roomPool(env);if (!pool || pool.self === pool.primary) return null;
  return (await call(env, pool.primary, 'chatAccess', {ownerId})) === true;
}
export async function poolUnlockChat(env: PoolEnvironment, ownerId: string, code: string): Promise<boolean> {
  const pool = roomPool(env);if (!pool || pool.self === pool.primary) return false;
  await call(env, pool.primary, 'unlockChat', {ownerId, code});return true;
}
export function poolCode(env: PoolEnvironment) {
  const pool = roomPool(env), range = pool ? 100_000 : 900_000, ceiling = Math.floor(2 ** 32 / range) * range;
  let value: number;do {value = crypto.getRandomValues(new Uint32Array(1))[0];} while (value >= ceiling);
  return String((pool ? Number(pool.self.slot) * 100_000 : 100_000) + value % range);
}

/** The ordinary account API stays at the primary origin; only room traffic is distributed. */
export function pooledRooms(env: PoolEnvironment, local) {
  const pool = roomPool(env);if (!pool) return {...local, discover: async code => ({available: await local.available(code)})};
  const remoteFor = code => pool.peers.find(node => node.slot === String(code)[0]);
  async function discover(code) {
    // Local-first lookup preserves rooms created before prefix allocation was enabled.
    if (await local.available(code)) return {available: true};
    const node = remoteFor(code);
    return node && await call(env, node, 'available', {code}) ? {available: true, apiUrl: node.origin} : {available: false};
  }
  async function ownerRoom(code, op, data) {
    if (await local.available(code)) return local[op](code, data.ownerId, ...(op === 'close' ? [data.roomId, data.options] : []));
    const node = remoteFor(code);if (!node) throw new HttpError(404, 'Room is not available.');
    return call(env, node, op, {code, ...data});
  }
  return {...local, discover, available: async code => (await discover(code)).available,
    async create(data) {
      if (pool.self !== pool.primary) throw new HttpError(403, 'Open your dashboard to host a quiz.');
      const first = crypto.getRandomValues(new Uint32Array(1))[0] % pool.nodes.length;
      for (let attempt = 0; attempt < pool.nodes.length; attempt++) {
        const node = pool.nodes[(first + attempt) % pool.nodes.length];
        try {
          if (node === pool.self) return await local.create(data);
          const code = await call(env, node, 'create', data);
          if (await local.available(code)) {
            const collision = (await call(env, node, 'list', {ownerId: data.ownerId})).find(row => row.code === code);
            if (collision) await call(env, node, 'close', {code, ownerId: data.ownerId, roomId: collision.roomId});
            continue;
          }
          return code;
        } catch (error) {if (error.status !== 503 || attempt === pool.nodes.length - 1) throw error;}
      }
      throw new HttpError(503, 'Could not reserve a room. Please retry.');
    },
    async list(ownerId) {
      const lists = await Promise.all([local.list(ownerId), ...pool.peers.map(node => call(env, node, 'list', {ownerId}))]);
      return lists.flat().sort((a, b) => b.expires - a.expires);
    },
    close: (code, ownerId, roomId, options = {}) => ownerRoom(code, 'close', {ownerId, roomId, options}),
    report: (code, ownerId) => ownerRoom(code, 'report', {ownerId}),
    async imageInUse(ownerId, url) {return (await Promise.all([local.imageInUse(ownerId, url), ...pool.peers.map(node => call(env, node, 'imageInUse', {ownerId, url}))])).some(Boolean);},
    async purgeOwner(ownerId) {await Promise.all([local.purgeOwner(ownerId), ...pool.peers.map(node => call(env, node, 'purgeOwner', {ownerId}))]);}
  };
}

/** Signed server-to-server operations never accept a browser session as authority. */
export async function handleRoomRelay(request: Request, env: PoolEnvironment, local, claim: (nonce: string) => Promise<boolean> | boolean) {
  if (new URL(request.url).pathname !== PATH) return null;
  try {
    const pool=roomPool(env);
    if (!pool || request.method !== 'POST') throw new HttpError(404, 'Endpoint not found.');
    const timestamp = request.headers.get('X-Gather-Time') || '', nonce = request.headers.get('X-Gather-Nonce') || '', signature = request.headers.get('X-Gather-Signature') || '';
    if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 30_000 || !/^[a-f0-9-]{36}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) throw new HttpError(401, 'Invalid room service request.');
    const payload = await readJson(request, 2_000_000), body = JSON.stringify(payload);
    const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16));
    if (!await crypto.subtle.verify('HMAC', await key(env), bytes, signatureInput(timestamp, nonce, body))) throw new HttpError(401, 'Invalid room service request.');
    if (!await claim(nonce)) throw new HttpError(409, 'This room service request was already received.');
    const {op, data} = payload;
    if(op==='create'&&pool.self===pool.primary)throw new HttpError(403,'Open your dashboard to host a quiz.');
    if (!data || typeof data !== 'object') throw new HttpError(400, 'Invalid room service request.');
    if (op !== 'available' && !validOwner(data.ownerId)) throw new HttpError(400, 'Invalid account.');
    if (['available', 'close', 'report'].includes(op) && !/^\d{6}$/.test(data.code)) throw new HttpError(400, 'Invalid room.');
    let value;
    if (op === 'available') value = await local.available(data.code);
    else if (op === 'create') value = await local.create(data);
    else if (op === 'list') value = await local.list(data.ownerId);
    else if (op === 'close') value = await local.close(data.code, data.ownerId, data.roomId, data.options);
    else if (op === 'report') value = await local.report(data.code, data.ownerId);
    else if (op === 'imageInUse' && typeof data.url === 'string' && data.url.length <= 2048) value = await local.imageInUse(data.ownerId, data.url);
    else if (op === 'purgeOwner') value = await local.purgeOwner(data.ownerId);
    else if (op === 'chatAccess') value = await local.chatAccess(data.ownerId);
    else if (op === 'unlockChat') value = await local.unlockChat(data.ownerId, data.code);
    else throw new HttpError(400, 'Unknown room service request.');
    return json({ok: true, value: value ?? null});
  } catch (error) {return json({error: error.status || error.name === 'EngineError' ? error.message : 'The room service could not complete this request.'}, error.status || (error.name === 'EngineError' ? 400 : 503));}
}
export function roomPeerRequestAllowed(request: Request, env: PoolEnvironment) {
  const pool = roomPool(env);if (!pool || pool.self === pool.primary) return true;
  return request.method === 'OPTIONS' || request.method === 'GET' && /^\/api\/(?:health|rooms\/\d{6}(?:\/ws|\/media\/[a-f0-9-]{36}(?:\/plain)?)?)$/.test(new URL(request.url).pathname);
}
