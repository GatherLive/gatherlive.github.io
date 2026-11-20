import type {ChatTypingEvent} from '../../../shared/types.js';
import type {RoomChat} from './room-chat.js';

const REFRESH_MS = 3000;
const IDLE_MS = 3500;
const MAX_STATUS_MS = 6500;

export class ChatTyping {
  private watching = false;
  private lastPulse = -Infinity;
  private idleTimer: ReturnType<typeof setTimeout>;
  private expiryTimer: ReturnType<typeof setTimeout>;
  private people = new Map<string, {name: string; expiresAt: number}>();

  constructor(private chat: RoomChat) {}

  sync() {
    const supported = this.chat.state().connected && this.chat.meta?.typingIndicators === true;
    const watching = !!supported && this.chat.open && !this.chat.hidden && this.chat.available();
    if (watching === this.watching) return;

    if (supported) this.chat.send({type: 'chat_typing', viewing: watching}, {quiet: true});
    this.watching = watching;
    if (!watching) {
      clearTimeout(this.idleTimer);
      this.lastPulse = -Infinity;
      this.people.clear();
      this.update();
    }
  }

  input(value: string) {
    if (!this.watching) return;
    if (!value.trim()) {
      this.stop();
      return;
    }
    const now = performance.now();
    if (now - this.lastPulse >= REFRESH_MS && this.chat.send({type: 'chat_typing', active: true}, {quiet: true})) {
      this.lastPulse = now;
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), IDLE_MS);
  }

  stop() {
    clearTimeout(this.idleTimer);
    if (!Number.isFinite(this.lastPulse)) return;
    this.lastPulse = -Infinity;
    this.chat.send({type: 'chat_typing', active: false}, {quiet: true});
  }

  receive({senderId, senderName, remainingMs}: ChatTypingEvent) {
    if (!this.watching || senderId === this.chat.actorId() || !Number.isFinite(remainingMs)) return;
    if (remainingMs <= 0) {
      this.clear(senderId);
    } else if (typeof senderName === 'string' && senderName) {
      this.people.set(senderId, {name: senderName, expiresAt: performance.now() + Math.min(remainingMs, MAX_STATUS_MS)});
      this.update();
    }
  }

  clear(senderId: string) {
    if (this.people.delete(senderId)) this.update();
  }

  private update() {
    clearTimeout(this.expiryTimer);
    const now = performance.now();
    let nextExpiry = Infinity;
    for (const [id, person] of this.people) {
      if (person.expiresAt <= now) this.people.delete(id);
      else nextExpiry = Math.min(nextExpiry, person.expiresAt);
    }
    if (Number.isFinite(nextExpiry)) this.expiryTimer = setTimeout(() => this.update(), nextExpiry - now);
    this.render();
  }

  render() {
    const status = document.querySelector<HTMLElement>('.chat-typing');
    const label = status?.querySelector<HTMLElement>('.chat-typing-label');
    if (!label) return;
    let text = '';
    if (this.people.size > 2) {
      text = 'Several people are typing…';
    } else if (this.people.size) {
      const [first, second] = this.people.values();
      text = second ? `${first.name} and ${second.name} are typing…` : `${first.name} is typing…`;
    }
    if (label.textContent === text) return;
    label.textContent = text;
    status.classList.toggle('is-active', !!text);
  }
}
