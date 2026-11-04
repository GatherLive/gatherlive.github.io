import {esc} from '../../core/dom.js';

export function moveMentionRanges(marks, before, after) {
  let start = 0, tail = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (tail < before.length - start && tail < after.length - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  const end = before.length - tail, delta = after.length - before.length;
  return marks.flatMap(mark => mark.end <= start ? [{...mark}] : mark.start >= end ? [{...mark, start: mark.start + delta, end: mark.end + delta}] : []);
}

export function mentionQuery(value, caret, marks = []) {
  if (!Number.isInteger(caret) || caret < 1) return null;
  const start = value.lastIndexOf('@', caret - 1);
  if (start < 0 || start > 0 && /[\p{L}\p{N}_@]/u.test(value[start - 1])) return null;
  const query = value.slice(start + 1, caret);
  if (query.length > 32 || /[\r\n@{}]/u.test(query) || marks.some(mark => start >= mark.start && start < mark.end)) return null;
  return {start, end: caret, query};
}

export function mentionPayload(value, marks, enabled = true) {
  const text = value.trim(), leading = value.length - value.trimStart().length;
  return {text, mentions: enabled ? marks.filter(mark => mark.start >= leading && mark.end <= leading + text.length).map(mark => ({id: mark.id, start: mark.start - leading, end: mark.end - leading})) : []};
}

function validMentions(item) {
  const marks = Array.isArray(item.mentions) ? item.mentions : [];
  return marks.filter(mark => mark && typeof mark.id === 'string' && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start && mark.end <= item.text.length).sort((a, b) => a.start - b.start);
}

function targetsViewer(item, mark, actorId) {
  return !!actorId && !item.deleted && item.senderId !== actorId && (mark.id === actorId || mark.id === 'all' && item.role === 'host');
}

export function mentionedViewer(item, actorId) {
  return validMentions(item).some(mark => targetsViewer(item, mark, actorId));
}

export function mentionText(item, actorId) {
  let offset = 0, html = '';
  for (const mark of validMentions(item)) {
    if (mark.start < offset) continue;
    html += esc(item.text.slice(offset, mark.start)) + `<bdi class="chat-mention${targetsViewer(item, mark, actorId) ? ' is-targeted' : ''}">${esc(item.text.slice(mark.start, mark.end))}</bdi>`;
    offset = mark.end;
  }
  return html + esc(item.text.slice(offset));
}
