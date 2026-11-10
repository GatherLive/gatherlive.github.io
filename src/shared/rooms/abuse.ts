/** A failed-code budget, rather than a small join budget shared by an entire venue. */
export class RoomProbeWindow {
  start = 0;
  codes = new Map<string, {until: number; available?: boolean}>();
  guesses = new Set<string>();
  failures = new Map<string, {start: number; count: number}>();
  constructor(saved?: {start: number; codes: [string, {until: number; available?: boolean}][]; guesses?: string[]; failures?: [string, {start: number; count: number}][]}) {
    if (saved) {this.start = saved.start;this.codes = new Map(saved.codes);this.guesses=new Set(saved.guesses||saved.codes.filter(([,value])=>value.available!==true).map(([code])=>code));this.failures = new Map(saved.failures || []);}
  }
  probe(code: string, now = Date.now()) {
    if (now - this.start >= 60_000) {this.start = now;this.codes.clear();this.guesses.clear();}
    for (const [key, value] of this.codes) if (value.until <= now) this.codes.delete(key);
    const prior = this.codes.get(code);
    if (prior?.available !== undefined) return {allowed: true, cached: true, available: prior.available};
    if (!this.guesses.has(code) && this.guesses.size >= 30) return {allowed: false, cached: false};
    if (!prior) {this.codes.set(code, {until: now + 60_000});this.guesses.add(code);}
    return {allowed: true, cached: false};
  }
  settle(code: string, available: boolean, now = Date.now()) {
    // Successful rooms do not consume the failed-code allowance.
    this.codes.set(code, {available, until: now + (available ? 5000 : 60_000)});
    if(available)this.guesses.delete(code);else this.guesses.add(code);
    if (this.codes.size > 128) this.codes.delete(this.codes.keys().next().value);
  }
  verification(code: string, failed = false, now = Date.now()) {
    for (const [key, value] of this.failures) if (now - value.start >= 60_000) this.failures.delete(key);
    if(!this.failures.has(code)&&this.failures.size>=128)return false;
    const row = this.failures.get(code) || {start: now, count: 0};
    if (failed) {row.count++;this.failures.set(code, row);}
    return row.count < 600;
  }
  serialize() {return {start: this.start, codes: [...this.codes], guesses:[...this.guesses], failures: [...this.failures]};}
}
export async function networkKey(ip: string) {
  let bucket=ip;
  // Rotating IPv6 addresses in one /64 must not reset the guessing allowance.
  if(ip.includes(':')&&/^[a-f0-9:]+$/i.test(ip)){
    const [left,right]=ip.toLowerCase().split('::'),head=left?left.split(':'):[],tail=right?right.split(':'):[];
    const groups=right!==undefined?[...head,...Array(Math.max(0,8-head.length-tail.length)).fill('0'),...tail]:head;
    if(groups.length===8)bucket=groups.slice(0,4).map(value=>parseInt(value||'0',16).toString(16)).join(':')+'::/64';
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bucket));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
