import {DurableObject} from 'cloudflare:workers';
import type {WorkerEnv} from '../env.js';
import {RoomProbeWindow} from '../../shared/rooms/abuse.js';

/** Short-lived abuse counters. Never shares storage with accounts or quiz rooms. */
export class RoomGate extends DurableObject<WorkerEnv> {
  window = new RoomProbeWindow();
  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<ReturnType<RoomProbeWindow['serialize']>>('window');
      if (saved) this.window = new RoomProbeWindow(saved);
    });
  }
  async save() {
    await this.ctx.storage.put('window', this.window.serialize());
    if ((await this.ctx.storage.getAlarm() || 0) < Date.now() + 60_000) await this.ctx.storage.setAlarm(Date.now() + 120_000);
  }
  async probe(code: string) {const before=this.window.codes.get(code),start=this.window.start,now=Date.now(),result = this.window.probe(code,now);if (!result.cached && result.allowed&&(start!==this.window.start||!before||before.until<=now)) await this.save();return result;}
  async settle(code: string, available: boolean) {const prior=this.window.codes.get(code);if(prior?.available===available&&prior.until>Date.now())return;this.window.settle(code, available);await this.save();}
  async verification(code: string, failed = false) {const allowed = this.window.verification(code, failed);if (failed) await this.save();return allowed;}
  async claim(nonce: string) {
    const sql=this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS relay_nonces(nonce TEXT PRIMARY KEY,expires INTEGER NOT NULL)');
    const claimed=this.ctx.storage.transactionSync(()=>{
      sql.exec('DELETE FROM relay_nonces WHERE expires<=?',Date.now());
      if(sql.exec('SELECT nonce FROM relay_nonces WHERE nonce=?',nonce).toArray().length)return false;
      sql.exec('INSERT INTO relay_nonces(nonce,expires) VALUES(?,?)',nonce,Date.now()+60_000);return true;
    });
    if((await this.ctx.storage.getAlarm()||0)<Date.now()+30_000)await this.ctx.storage.setAlarm(Date.now()+60_000);
    return claimed;
  }
  async alarm() {await this.ctx.storage.deleteAll();this.window = new RoomProbeWindow();}
}
