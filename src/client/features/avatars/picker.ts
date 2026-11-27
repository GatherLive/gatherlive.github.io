import type {AppContext} from '../../app/context.js';
import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import type {AvatarFamily, AvatarProfile} from '../../../shared/avatars/profile.js';
import {avatarImage, avatarMarkup, fillAvatar} from './render.js';
import {avatarColorSwatch, bindAvatarColorPicker} from './color-picker.js';
import {AVATAR_STYLES, loadDiceBear, normalizeAvatar} from './providers/browser.js';

const storageKey = 'gather-avatar-v1';
const boringColors = ['#92a1c6', '#146a7c', '#f0ab3d', '#c271b4', '#c20d90'];
const backgroundColor = '#252525';
const shuffleHistoryLimit = 30;
const diceBear = (styles: string[]) => styles.map(style => 'dicebear:' + style);
const styleGroups = [
    {name: 'People', styles: [
        ...diceBear(['adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral', 'big-ears', 'big-ears-neutral',
            'big-smile', 'cameo', 'clay', 'cutouts', 'dylan', 'gaze', 'initial-face', 'line-face', 'lorelei',
            'lorelei-neutral', 'micah', 'miniavs', 'notionists', 'notionists-neutral', 'open-peeps', 'personas', 'toon-head']),
        'multiavatar:people', 'boring:beam'
    ]},
    {name: 'Characters', styles: diceBear(['critters', 'cats', 'dogs', 'croodles', 'croodles-neutral', 'fun-emoji', 'moods', 'blobs', 'thumbs'])},
    {name: 'Robots & pixels', styles: [
        ...diceBear(['bottts', 'bottts-neutral', 'pixel-art', 'pixel-art-neutral', 'pixelbot', 'voxel-art', 'voxel-bot']),
        'boring:pixel'
    ]},
    {name: 'Nature & space', styles: diceBear(['landscape', 'planets', 'constellation', 'sprouts'])},
    {name: 'Symbols & initials', styles: diceBear(['glyphs', 'icons', 'identicon', 'initials'])}
];
const categorized = new Set(styleGroups.flatMap(group => group.styles));
styleGroups.push({name: 'Patterns', styles: Object.entries(AVATAR_STYLES)
    .flatMap(([family, styles]) => styles.map(style => family + ':' + style))
    .filter(style => !categorized.has(style))});

const styleLabels: Record<string, string> = {
    'multiavatar:people': 'Illustrated portraits',
    'boring:beam': 'Geometric faces',
    'boring:pixel': 'Pixel mosaic',
    'boring:ring': 'Color rings',
    'boring:marble': 'Color marble'
};

export function readAvatarProfile(): AvatarProfile | null {
    try {
        const raw = localStorage.getItem(storageKey);
        return raw && raw.length <= 1500 ? normalizeAvatar(JSON.parse(raw)) : null;
    } catch { return null; }
}

export function saveAvatarProfile(profile: AvatarProfile) {
    try {
        const value = normalizeAvatar(profile);
        if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    } catch { /* The selected avatar still works for this room. */ }
}

function randomSeed() {
    return [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function displayLabel(value: string) {
    return value.replace(/([a-z])([A-Z\d])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, first => first.toUpperCase());
}

const option = (value: string | number, label: string, selected: string | number) =>
    `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;

function rangeControl(field: 'zoom' | 'rotation', value: number) {
    const zoom = field === 'zoom';
    const title = zoom ? 'Zoom' : 'Rotation';
    return `<div class="avatar-transform"><div class="avatar-transform-label">
        <label for="avatar-${field}">${title}</label><button class="quiet-button" type="button" data-avatar-reset="${field}" aria-label="Reset ${field}">Reset</button>
        </div><div class="avatar-range"><input type="range" id="avatar-${field}" data-avatar-field="${field}" min="${zoom ? 60 : -180}" max="${zoom ? 150 : 180}" step="5" value="${value}"><span>${value}${zoom ? '%' : '°'}</span></div></div>`;
}

const colorField = (key: string, label: string, value: string, fallback: string) =>
    `<div class="avatar-color-setting" data-avatar-color-anchor><span>${esc(label)}</span>${avatarColorSwatch(key, label, value, fallback)}</div>`;

export function openAvatarPicker(context: AppContext, supplied: unknown, save: (profile: AvatarProfile) => void | Promise<void>) {
    let draft: AvatarProfile = normalizeAvatar(supplied) ?? readAvatarProfile() ?? {style: 'dicebear:critters', seed: randomSeed()};
    let previewRevision = 0;
    let settingsRevision = 0;
    const past: AvatarProfile[] = [], future: AvatarProfile[] = [];

    context.modal('Your avatar', `<div class="avatar-picker" data-ui>
        <div class="avatar-picker-top">
            <div class="avatar-picker-portrait" aria-hidden="true">${avatarMarkup(null, '', 'preview')}</div>
            <div class="avatar-picker-style">
                <label>Category<select data-avatar-field="category">${styleGroups.map(group => option(group.name, group.name, '')).join('')}</select></label>
                <label>Style<select data-avatar-field="style"></select></label>
            </div>
        </div>
        <div class="avatar-picker-utilities">
            <button class="quiet-button avatar-credits" type="button" data-avatar-credits>Credits</button>
            <div class="avatar-shuffle-controls">
                <button class="icon-btn" type="button" data-avatar-history="undo" aria-label="Undo shuffle" title="Undo shuffle" disabled>${icon('undo', 17)}</button>
                <button class="icon-btn" type="button" data-avatar-history="redo" aria-label="Redo shuffle" title="Redo shuffle" disabled>${icon('redo', 17)}</button>
                <button class="quiet-button" type="button" data-avatar-shuffle>${icon('refresh', 17)} Shuffle</button>
            </div>
        </div>
        <details class="avatar-customize">
            <summary>Customize</summary>
            <div data-avatar-options></div>
            <div class="avatar-customize-actions"><button class="quiet-button" type="button" data-avatar-reset="all">Reset all</button></div>
        </details>
        <output class="avatar-picker-error" aria-live="polite"></output>
    </div>`, '<button class="btn primary" type="button" id="use-avatar">Use avatar</button>', () => {
        const root = document.querySelector<HTMLElement>('.avatar-picker');
        const saveButton = document.querySelector<HTMLButtonElement>('#use-avatar');
        const paintArea = root.querySelector<HTMLElement>('.gather-avatar-preview');
        const errorText = root.querySelector<HTMLOutputElement>('.avatar-picker-error');
        const categorySelect = root.querySelector<HTMLSelectElement>('[data-avatar-field=category]');
        const styleSelect = root.querySelector<HTMLSelectElement>('[data-avatar-field=style]');
        const customize = root.querySelector<HTMLDetailsElement>('.avatar-customize');
        const customization = root.querySelector<HTMLElement>('[data-avatar-options]');
        const undo = root.querySelector<HTMLButtonElement>('[data-avatar-history="undo"]');
        const redo = root.querySelector<HTMLButtonElement>('[data-avatar-history="redo"]');
        let previewTimer: ReturnType<typeof setTimeout> | null = null;

        root.querySelector('[data-avatar-credits]').addEventListener('click', () => {
            context.modal('Avatar credits', `<ul class="avatar-credit-list">
                <li><a href="https://www.dicebear.com/licenses/" target="_blank" rel="noopener noreferrer">DiceBear ${icon('arrow', 15)}</a></li>
                <li><a href="https://github.com/multiavatar/Multiavatar/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Multiavatar ${icon('arrow', 15)}</a></li>
                <li><a href="https://github.com/boringdesigners/boring-avatars/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">Boring Avatars ${icon('arrow', 15)}</a></li>
            </ul><p class="small muted">Players can customize the artwork in Gather.</p>`, '', () => {
                const back = document.querySelector<HTMLButtonElement>('.modal-actions [data-action="close-modal"]');
                back.innerHTML = `${icon('back', 15)} Back to room`;
                context.state.previousFocus = document.querySelector<HTMLElement>('#room-avatar-button');
                context.state.previousFocusAction = 'room-avatar';
            });
        });

        async function preview() {
            const revision = ++previewRevision;
            const profile = normalizeAvatar(draft);
            if (!profile) return;
            errorText.value = '';
            paintArea.style.setProperty('--avatar-background', profile.background ?? '');
            try {
                const url = await avatarImage(profile, true);
                if (root.isConnected && revision === previewRevision) fillAvatar(paintArea, profile, url);
            } catch {
                if (root.isConnected && revision === previewRevision) errorText.value = 'Preview unavailable. Try another style.';
            }
        }

        function requestPreview() {
            if (previewTimer !== null) return;
            previewTimer = setTimeout(() => {
                previewTimer = null;
                if (root.isConnected) void preview();
            }, 40);
        }

        const closeColorPicker = bindAvatarColorPicker(root, (key, value) => {
            if (key === 'background') draft.background = value ?? undefined;
            else if (key.startsWith('palette:')) {
                const index = Number(key.slice(8));
                draft.palette ??= [...boringColors];
                draft.palette[index] = value ?? boringColors[index];
                if (draft.palette.every((color, i) => color === boringColors[i])) delete draft.palette;
            } else {
                const detail = key.slice(7);
                if (value) (draft.details ??= {})[detail] = value;
                else if (draft.details) delete draft.details[detail];
            }
            requestPreview();
        });

        async function renderSettings() {
            const revision = ++settingsRevision;
            closeColorPicker();
            const [family, style] = draft.style.split(':') as [AvatarFamily, string];
            const group = styleGroups.find(group => group.styles.includes(draft.style)) ?? styleGroups[0];
            categorySelect.value = group.name;
            styleSelect.innerHTML = group.styles.map(id => option(id, styleLabels[id] ?? displayLabel(id.split(':')[1]), draft.style)).join('');
            customization.innerHTML = `<div class="avatar-fields">
                ${family !== 'boring' ? colorField('background', 'Background', draft.background ?? backgroundColor, backgroundColor) : ''}
                <label>Flip<select data-avatar-field="flip" aria-label="Flip">${['', 'horizontal', 'vertical', 'both'].map(value => option(value, value ? displayLabel(value) : 'Off', draft.flip ?? '')).join('')}</select></label>
                ${family === 'multiavatar' ? `<label>Character<select data-avatar-field="preset" aria-label="Character">${option('', 'Mixed', draft.preset ?? '')}${Array.from({length: 48}, (_, index) => option(index, `Character ${index % 16 + 1} · ${['A', 'B', 'C'][Math.floor(index / 16)]}`, draft.preset ?? '')).join('')}</select></label>` : ''}
                ${rangeControl('zoom', draft.zoom ?? 100)}
                ${rangeControl('rotation', draft.rotation ?? 0)}
            </div>
            ${family === 'boring' ? `<fieldset class="avatar-palette"><legend>Palette</legend><div class="avatar-palette-swatches" data-avatar-color-anchor>${(draft.palette ?? boringColors).map((color, index) => avatarColorSwatch(`palette:${index}`, `Palette ${index + 1}`, color, boringColors[index])).join('')}</div></fieldset>` : ''}
            <div data-avatar-details></div>`;
            if (family !== 'dicebear') return;
            try {
                const info = await (await loadDiceBear()).describe(style);
                if (!root.isConnected || revision !== settingsRevision) return;
                const details = customization.querySelector<HTMLElement>('[data-avatar-details]');
                const parts = info.variants.filter(part => part.values.length > 1 || part.probabilityKey);
                details.innerHTML = `<div class="avatar-style-details">
                    ${parts.length ? `<details><summary>Parts</summary><div class="avatar-fields">${parts.map(part => {
                        const label = displayLabel(part.key.replace(/Variant$/, ''));
                        const hidden = part.probabilityKey && draft.details?.[part.probabilityKey] === 0;
                        const selected = hidden ? 'hide' : draft.details?.[part.key] ?? '';
                        return `<label>${esc(label)}<select data-avatar-field="detail:${esc(part.key)}" aria-label="${esc(label)}" data-avatar-probability="${esc(part.probabilityKey)}">${option('', 'Random', selected)}${part.probabilityKey ? option('hide', 'Hide', selected) : ''}${part.values.map(value => option(value, displayLabel(value), selected)).join('')}</select></label>`;
                    }).join('')}</div></details>` : ''}
                    ${info.colors.length ? `<details><summary>Colors</summary><div class="avatar-fields">${info.colors.map(color => {
                        const label = displayLabel(color.key);
                        return colorField(`detail:${color.key}`, label, String(draft.details?.[color.key] ?? color.sample), color.sample);
                    }).join('')}</div></details>` : ''}
                </div>`;
            } catch { /* The common appearance controls remain usable. */ }
        }

        function changeStyle(style: string) {
            const {seed, background, flip, rotation, zoom} = draft;
            draft = {style, seed, flip, rotation, zoom, ...(!style.startsWith('boring:') ? {background} : {})};
            void renderSettings();
        }

        root.addEventListener('input', event => {
            const input = event.target as HTMLInputElement;
            const field = input.dataset.avatarField;
            if (field !== 'zoom' && field !== 'rotation') return;
            draft[field] = input.valueAsNumber;
            input.nextElementSibling.textContent = input.value + (field === 'zoom' ? '%' : '°');
            requestPreview();
        });

        root.addEventListener('change', event => {
            const input = event.target as HTMLInputElement | HTMLSelectElement;
            const field = input.dataset.avatarField;
            if (!field) return;
            const value = input.value;
            if (field === 'category') changeStyle(styleGroups.find(group => group.name === value).styles[0]);
            else if (field === 'style') changeStyle(value);
            else if (field === 'flip') draft.flip = (value || undefined) as AvatarProfile['flip'];
            else if (field === 'preset') draft.preset = value ? Number(value) : undefined;
            else if (field.startsWith('detail:')) {
                const key = field.slice(7), probability = input.dataset.avatarProbability;
                draft.details ??= {};
                if (value && value !== 'hide') draft.details[key] = value;
                else delete draft.details[key];
                if (probability && value === 'hide') draft.details[probability] = 0;
                else if (probability) delete draft.details[probability];
            } else return;
            requestPreview();
        });

        root.addEventListener('click', event => {
            const button = (event.target as Element).closest<HTMLButtonElement>('button');
            if (!button) return;
            const reset = button.dataset.avatarReset;
            if (button.hasAttribute('data-avatar-shuffle')) {
                past.push(structuredClone(draft));
                if (past.length > shuffleHistoryLimit) past.shift();
                future.length = 0;
                draft.seed = randomSeed();
                if (draft.preset !== undefined) {
                    delete draft.preset;
                    root.querySelector<HTMLSelectElement>('[data-avatar-field=preset]').value = '';
                }
            } else if (button === undo || button === redo) {
                const source = button === undo ? past : future;
                const next = source.pop();
                if (!next) return;
                (button === undo ? future : past).push(structuredClone(draft));
                draft = next;
                void renderSettings();
            } else if (reset === 'all') {
                draft = {style: draft.style, seed: draft.seed};
                void renderSettings();
            } else if (reset === 'zoom' || reset === 'rotation') {
                const slider = root.querySelector<HTMLInputElement>(`#avatar-${reset}`);
                slider.value = reset === 'zoom' ? '100' : '0';
                slider.dispatchEvent(new Event('input', {bubbles: true}));
                return;
            } else return;
            undo.disabled = past.length === 0;
            redo.disabled = future.length === 0;
            requestPreview();
        });

        saveButton.addEventListener('click', async () => {
            const profile = normalizeAvatar(draft);
            if (!profile) {
                errorText.value = 'This avatar has too many changes. Reset a few options and try again.';
                return;
            }
            saveButton.disabled = true;
            try {
                await save(profile);
                saveAvatarProfile(profile);
                if (root.isConnected) context.closeModal();
            } catch (error) {
                errorText.value = error instanceof Error ? error.message : 'Could not save your avatar.';
            } finally { saveButton.disabled = false; }
        });

        customize.addEventListener('toggle', () => {
            if (customize.open) customize.scrollIntoView({block: 'nearest'});
        });
        void renderSettings();
        void preview();
    });
}
