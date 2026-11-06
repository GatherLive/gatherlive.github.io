import {esc} from '../../core/dom.js';

export function countdownLabel(endsAt, now) {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '0:00';
}

export function announcementText(item, now) {
  const {text, countdown} = item;
  if (!countdown || !Number.isFinite(countdown.endsAt) || Math.abs(countdown.endsAt) > 8.64e15 || !Number.isInteger(countdown.start) || !Number.isInteger(countdown.end) || countdown.start < 0 || countdown.end <= countdown.start || countdown.end > text.length) return esc(text);
  return esc(text.slice(0, countdown.start)) + `<time class="announcement-countdown${now >= countdown.endsAt ? ' is-finished' : ''}" role="timer" aria-live="off" aria-label="Time remaining" datetime="${new Date(countdown.endsAt).toISOString()}" data-announcement-countdown>${countdownLabel(countdown.endsAt, now)}</time>` + esc(text.slice(countdown.end));
}

export function tickAnnouncement(item, now, root = document) {
  if (!item?.countdown) return;
  const clock = root.querySelector('[data-announcement-countdown]');
  if (!clock) return;
  const label = countdownLabel(item.countdown.endsAt, now);
  if (clock.textContent !== label) {
    clock.textContent = label;
    clock.classList.toggle('is-finished', now >= item.countdown.endsAt);
  }
}
