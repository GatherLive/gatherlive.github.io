import type {Quiz} from '../../../shared/types.js';

const HISTORY_LIMIT = 40;
const GROUP_TYPING_MS = 750;
type DraftContent = Pick<Quiz, 'title' | 'description' | 'collection' | 'tags' | 'questions' | 'settings'>;
type Position = {questionId?: string; roundId?: string};
type Frame = {content: DraftContent; position: Position};

// Share unchanged subtrees between snapshots, including large image strings.
function snapshot<T>(value: T, previous?: T): T {
    if (Object.is(value, previous) || !value || typeof value !== 'object') return value;
    const keys = Object.keys(value);
    const prior = previous && typeof previous === 'object' && Array.isArray(value) === Array.isArray(previous)
        ? previous as Record<string, unknown> : undefined;
    let same = Boolean(prior && Object.keys(prior).length === keys.length);
    const entries = keys.map(key => {
        const old = prior && Object.hasOwn(prior, key) ? prior[key] : undefined;
        const next = snapshot(value[key], old);
        same &&= Object.hasOwn(prior, key) && Object.is(next, old);
        return [key, next] as const;
    });
    return same ? previous : (Array.isArray(value) ? entries.map(([, next]) => next) : Object.fromEntries(entries)) as T;
}

function contentOf(draft: Quiz, previous?: DraftContent): DraftContent {
    const {title, description, collection, tags, questions, settings} = draft;
    return snapshot({title, description, collection, tags, questions, settings}, previous);
}

export class QuizHistory {
    private draftId: string;
    private current: Frame;
    private saved: DraftContent | null;
    private past: Frame[] = [];
    private future: Frame[] = [];
    private typing: {element: HTMLElement; at: number} | null = null;

    get content() { return this.current?.content; }
    get dirty() { return this.current?.content !== this.saved; }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }

    bind(draft: Quiz, position: Position, dirty: boolean) {
        if (this.current && this.draftId === draft.id) {
            this.current.position = position;
            return;
        }
        this.draftId = draft.id;
        this.current = {content: contentOf(draft), position};
        this.saved = dirty ? null : this.content;
        this.past = [];
        this.future = [];
        this.typing = null;
    }

    record(draft: Quiz, position: Position, element?: HTMLElement) {
        if (!this.current || this.draftId !== draft.id) this.bind(draft, position, true);
        const next = contentOf(draft, this.content);
        if (next === this.content) return;
        const at = Date.now();
        const grouped = element && this.typing?.element === element && at - this.typing.at < GROUP_TYPING_MS && this.content !== this.saved;
        if (!grouped) {
            this.past.push(this.current);
            if (this.past.length > HISTORY_LIMIT) this.past.shift();
        }
        this.current = {content: next, position};
        this.future = [];
        this.typing = element ? {element, at} : null;
    }

    move(draft: Quiz, undo: boolean): Position | undefined {
        const frame = (undo ? this.past : this.future).pop();
        if (!frame) return;
        (undo ? this.future : this.past).push(this.current);
        this.current = frame;
        this.typing = null;
        Object.assign(draft, snapshot(frame.content));
        return frame.position;
    }

    markSaved(draft: Quiz, submitted: DraftContent) {
        this.saved = contentOf(draft, submitted);
        for (const frame of [...this.past, this.current, ...this.future]) {
            if (frame.content === submitted) frame.content = this.saved;
        }
        this.typing = null;
    }
}
