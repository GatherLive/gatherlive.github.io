export const JOIN_CODE_PERIOD = 30_000;

/** Short-lived presence code. The HMAC key never leaves the room server. */
export async function makeJoinCode(key: CryptoKey, room: string, at: number) {
    const window = Math.floor(at / JOIN_CODE_PERIOD);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`gather:join:${room}:${window}`)));
    let value = 0;for (const byte of signature.subarray(0, 6)) value = value * 256 + byte;
    return {code: String(value % 1_000_000).padStart(6, '0'), expiresAt: (window + 1) * JOIN_CODE_PERIOD, serverNow: at};
}
export function sameJoinCode(left: unknown, right: string) {
    if (typeof left !== 'string' || !/^\d{6}$/.test(left)) return false;
    let difference = 0;for (let index = 0; index < 6; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
}
