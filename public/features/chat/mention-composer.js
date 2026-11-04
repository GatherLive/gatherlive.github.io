import {esc} from '../../core/dom.js';
import {mentionQuery, moveMentionRanges, mentionPayload} from './mentions.js';

// One small, debounced lookup over the existing socket; no room-wide roster broadcasts.
export class MentionComposer {
  constructor(chat) {
    this.chat = chat; this.text = chat.draft; this.marks = []; this.cache = new Map(); this.sequence = 0; this.items = []; this.index = 0; this.range = null;
    this.caret = () => { const input = document.activeElement; if (input?.id === 'chat-input' && !this.composing) this.update(input); };
    this.compositionEnd = event => { if (event.target.id === 'chat-input') this.input(event.target, false); };
    this.focus = event => {
      if (event.type === 'focusin' && event.target.id === 'chat-input') this.update(event.target);
      else if (event.type === 'focusout' && (event.target.id === 'chat-input' || event.target.closest?.('.chat-mention-picker')) && event.relatedTarget?.id !== 'chat-input' && !event.relatedTarget?.closest?.('.chat-mention-picker')) this.close();
    };
    document.addEventListener('focusin', this.focus);
    document.addEventListener('focusout', this.focus);
    document.addEventListener('selectionchange', this.caret);
    document.addEventListener('compositionend', this.compositionEnd);
  }
  allowed() { return this.chat.isHost() || !!this.chat.meta?.chatMentions; }
  eligible() { return this.allowed() && this.chat.open && !this.chat.hidden && this.chat.available() && this.chat.state().connected; }
  input(input, composing = false) {
    this.dismissed = null;
    this.marks = moveMentionRanges(this.marks, this.text, input.value); this.text = input.value; this.chat.draft = input.value; this.composing = composing;
    if (composing) this.close(); else this.update(input);
  }
  payload() { return mentionPayload(this.chat.draft, this.marks, this.allowed()); }
  reset() { this.marks = []; this.text = this.chat.draft; this.close(); }
  invalidate() { this.cache.clear(); if (this.range) this.update(document.querySelector('#chat-input'), true); }
  close() {
    clearTimeout(this.timer); this.sequence++; this.range = null; this.items = []; this.loading = false; this.error = ''; this.renderedList = null; this.renderedRows = ''; this.render();
  }
  destroy() { this.close(); document.removeEventListener('focusin', this.focus); document.removeEventListener('focusout', this.focus); document.removeEventListener('selectionchange', this.caret); document.removeEventListener('compositionend', this.compositionEnd); this.cache.clear(); }
  update(input, force = false) {
    const range = input && input.selectionStart === input.selectionEnd && this.eligible() ? mentionQuery(input.value, input.selectionStart, this.marks) : null;
    const signature = input ? input.value + ':' + input.selectionStart : '';
    if (!range || this.dismissed === signature) { if (this.range) this.close(); return; }
    if (!force && this.range?.query === range.query) { this.range = range; return; }
    this.range = range; this.index = 0; this.error = ''; clearTimeout(this.timer);
    const sequence = ++this.sequence, cached = this.cache.get(range.query);
    if (!force && cached && Date.now() - cached.at < 15_000) { this.items = cached.items; this.loading = false; this.render(); return; }
    this.items = this.chat.isHost() && 'all'.includes(range.query.trim().toLocaleLowerCase()) ? [{id: 'all', name: 'all', role: 'all'}] : [];
    this.loading = true; this.render();
    this.timer = setTimeout(async () => {
      try {
        const result = await this.chat.request('chat_members', {query: range.query});
        if (sequence !== this.sequence || !this.eligible()) return;
        this.items = (result.members ?? []).filter(item => item && typeof item.id === 'string' && typeof item.name === 'string').slice(0, 20);
        if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(range.query, {at: Date.now(), items: this.items});
      } catch { if (sequence === this.sequence) this.error = 'Couldn’t load names.'; }
      finally { if (sequence === this.sequence) { this.loading = false; this.render(); } }
    }, 300);
  }
  render() {
    const slot = document.querySelector('.chat-mention-slot'), input = document.querySelector('#chat-input');
    if (!slot || !input) return;
    if (!this.range || !this.eligible()) {
      this.renderedList = null; this.renderedRows = ''; slot.replaceChildren(); input.removeAttribute('aria-activedescendant'); input.removeAttribute('aria-controls'); input.removeAttribute('aria-autocomplete'); return;
    }
    if (!slot.firstElementChild) slot.innerHTML = '<section class="chat-mention-picker" aria-label="Mention a participant"><p class="chat-mention-heading">Mention</p><div id="chat-mention-list" class="chat-mention-list" role="listbox" aria-label="Participants"></div><p class="chat-mention-status" role="status"></p></section>';
    const list = slot.querySelector('.chat-mention-list'), scroll = list.scrollTop;
    const rows = this.items.map((item, index) => `<button type="button" role="option" tabindex="-1" id="chat-mention-option-${index}" aria-selected="${index === this.index}" data-action="chat-mention-select" data-id="${esc(item.id)}"><span class="chat-mention-initial" aria-hidden="true">${item.id === 'all' ? '@' : esc([...item.name][0]?.toLocaleUpperCase() ?? '@')}</span><span class="chat-mention-name" dir="auto">${esc(item.id === 'all' ? '@all' : item.name)}</span>${item.role === 'all' ? '<span class="chat-mention-scope">Everyone</span>' : item.role === 'host' ? `<span class="chat-host-label" aria-label="Host">${this.chat.icon('check', 12)}</span>` : ''}</button>`).join('');
    if (this.renderedList !== list || this.renderedRows !== rows) { list.innerHTML = rows; this.renderedList = list; this.renderedRows = rows; }
    list.scrollTop = scroll;
    const status = slot.querySelector('.chat-mention-status');
    status.hidden = !!this.items.length && !this.error;
    status.innerHTML = this.error ? 'Couldn’t load names. <button class="quiet-button" type="button" data-action="chat-mention-retry">Retry</button>' : this.loading ? 'Finding participants…' : this.items.length ? '' : 'No matching participants.';
    input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', 'chat-mention-list');
    if (this.items[this.index]) input.setAttribute('aria-activedescendant', 'chat-mention-option-' + this.index); else input.removeAttribute('aria-activedescendant');
  }
  choose(id) {
    const input = document.querySelector('#chat-input'), item = this.items.find(value => value.id === id), range = input && mentionQuery(input.value, input.selectionStart, this.marks);
    if (!item || !range || !this.range || range.start !== this.range.start || range.query !== this.range.query) { this.close(); return; }
    if (this.marks.length >= 10) { this.chat.notify('Use up to 10 mentions per message.', true); return; }
    const label = '@' + item.name, inserted = label + (/^\s/u.test(input.value.slice(range.end)) ? '' : ' ');
    const before = input.value, after = before.slice(0, range.start) + inserted + before.slice(range.end);
    if (after.length > input.maxLength) { this.chat.notify('Use up to 400 characters.', true); return; }
    this.marks = moveMentionRanges(this.marks, before, after);
    this.marks.push({id: item.id, start: range.start, end: range.start + label.length});
    input.setRangeText(inserted, range.start, range.end, 'end'); this.chat.draft = input.value; this.text = input.value;
    this.close(); input.focus({preventScroll: true}); input.dispatchEvent(new Event('input', {bubbles: true}));
  }
  keydown(event) {
    if (event.target.id !== 'chat-input' || event.isComposing || !this.range) return false;
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && this.items.length) {
      event.preventDefault(); this.index = (this.index + (event.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length; this.render();
      document.querySelector('#chat-mention-option-' + this.index)?.scrollIntoView({block: 'nearest'}); return true;
    }
    if ((event.key === 'Enter' || event.key === 'Tab' && !event.shiftKey) && this.items[this.index]) { event.preventDefault(); this.choose(this.items[this.index].id); return true; }
    if (event.key === 'Escape') { event.preventDefault(); this.dismissed = event.target.value + ':' + event.target.selectionStart; this.close(); return true; }
    return false;
  }
}
