import {esc} from '../../core/dom.js';

type Hsl = [hue: number, saturation: number, lightness: number];

const toHex = ([hue, saturation, lightness]: Hsl) => {
    const l = lightness / 100;
    const amplitude = saturation / 100 * Math.min(l, 1 - l);
    const channel = (offset: number) => {
        const k = (offset + hue / 30) % 12;
        const value = l - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return '#' + [0, 8, 4].map(channel).join('');
};

function toHsl(hex: string): Hsl {
    const [red, green, blue] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
    const delta = max - min, lightness = (max + min) / 2;
    if (!delta) return [0, 0, lightness * 100];
    const sector = max === red ? (green - blue) / delta
        : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    return [(sector * 60 + 360) % 360, delta / (1 - Math.abs(2 * lightness - 1)) * 100, lightness * 100];
}

function readHex(value: string) {
    const hex = value.trim().toLowerCase().replace(/^#/, '');
    return /^[0-9a-f]{6}$/.test(hex) ? '#' + hex : null;
}

export function avatarColorSwatch(key: string, label: string, value: string, fallback: string) {
    return `<button class="avatar-color-swatch" type="button" data-avatar-color="${esc(key)}"
        data-color-label="${esc(label)}" data-color-value="${esc(value)}" data-color-default="${esc(fallback)}"
        aria-label="${esc(label + ' color, ' + value)}" aria-controls="avatar-color-editor" aria-expanded="false"
        style="--swatch:${esc(value)}" title="${esc(label)}"><span aria-hidden="true"></span></button>`;
}

export function bindAvatarColorPicker(root: HTMLElement, apply: (key: string, value: string | null) => void) {
    const panel = document.createElement('div');
    panel.id = 'avatar-color-editor';
    panel.className = 'avatar-color-editor';
    panel.setAttribute('role', 'group');
    panel.innerHTML = `<strong class="avatar-color-title"></strong>
        <div class="avatar-color-channels">
            <label>Hue<input class="avatar-color-slider color-hue" type="range" min="0" max="359" step="1"></label>
            <label>Saturation<input class="avatar-color-slider color-saturation" type="range" min="0" max="100" step="1"></label>
            <label>Lightness<input class="avatar-color-slider color-lightness" type="range" min="0" max="100" step="1"></label>
        </div>
        <div class="avatar-color-actions">
            <label>Hex<input class="input avatar-color-hex" maxlength="7" autocomplete="off" spellcheck="false" aria-describedby="avatar-hex-error"></label>
            <button class="quiet-button" type="button" data-color-default-button>Reset</button>
            <button class="btn small" type="button" data-color-done>Done</button>
        </div>
        <span id="avatar-hex-error" class="small avatar-picker-error" hidden>Enter six hex digits.</span>`;

    const title = panel.querySelector<HTMLElement>('.avatar-color-title');
    const hexInput = panel.querySelector<HTMLInputElement>('.avatar-color-hex');
    const error = panel.querySelector<HTMLElement>('#avatar-hex-error');
    const sliders = [...panel.querySelectorAll<HTMLInputElement>('.avatar-color-slider')];
    let active: HTMLButtonElement | null = null;
    let channels: Hsl = [0, 0, 0];

    function showValues(hex: string, writeHex = true) {
        const [hue, saturation, lightness] = channels;
        if (writeHex) hexInput.value = hex;
        sliders.forEach((slider, index) => { slider.value = String(Math.round(channels[index])); });
        panel.style.setProperty('--color-hue', String(hue));
        panel.style.setProperty('--color-saturation', saturation + '%');
        panel.style.setProperty('--color-lightness', lightness + '%');
        panel.style.setProperty('--current-color', hex);
        hexInput.removeAttribute('aria-invalid');
        error.hidden = true;
    }

    function updateSwatch(value: string | null) {
        const color = value ?? active.dataset.colorDefault;
        active.dataset.colorValue = color;
        active.style.setProperty('--swatch', color);
        active.setAttribute('aria-label', `${active.dataset.colorLabel} color, ${color}`);
        apply(active.dataset.avatarColor, value);
    }

    function close(restoreFocus = false) {
        active?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) active?.focus({preventScroll: true});
        active = null;
        panel.remove();
    }

    root.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-avatar-color]');
        if (!button) return;
        if (button === active) return close();
        close();
        active = button;
        const color = button.dataset.colorValue;
        button.setAttribute('aria-expanded', 'true');
        title.textContent = button.dataset.colorLabel;
        panel.setAttribute('aria-label', title.textContent + ' color');
        channels = toHsl(color);
        showValues(color);
        button.closest('[data-avatar-color-anchor]').after(panel);
        sliders[0].focus({preventScroll: true});
        panel.scrollIntoView({block: 'nearest'});
    });

    sliders.forEach((slider, index) => slider.addEventListener('input', () => {
        channels[index] = slider.valueAsNumber;
        const color = toHex(channels);
        showValues(color);
        updateSwatch(color);
    }));

    hexInput.addEventListener('input', () => {
        const color = readHex(hexInput.value);
        if (!color) {
            hexInput.setAttribute('aria-invalid', 'true');
            return;
        }
        channels = toHsl(color);
        showValues(color, false);
        updateSwatch(color);
    });

    panel.querySelector('[data-color-default-button]').addEventListener('click', () => {
        const color = active.dataset.colorDefault;
        channels = toHsl(color);
        showValues(color);
        updateSwatch(null);
    });

    function done() {
        if (readHex(hexInput.value)) return close(true);
        error.hidden = false;
        hexInput.focus();
    }

    panel.querySelector('[data-color-done]').addEventListener('click', done);
    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close(true);
        } else if (event.key === 'Enter' && event.target === hexInput) {
            event.preventDefault();
            done();
        }
    });
    return close;
}
