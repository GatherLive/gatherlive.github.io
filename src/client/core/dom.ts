export const $ = <E extends HTMLElement = HTMLInputElement>(s: string, root: ParentNode = document): E | null => root.querySelector<E>(s);
export const $$ = <E extends HTMLElement = HTMLInputElement>(s: string, root: ParentNode = document): E[] => [...root.querySelectorAll<E>(s)];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => {
    if (crypto.randomUUID)
        return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export function safeImage(value) {
    if (typeof value !== 'string')
        return '';
    if (value.length <= 2800000 && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value))
        return value;
    if (/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}\/plain$/.test(value))
        return value;
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
    }
    catch {
        return '';
    }
}
export function download(name, content, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function slug(title) { return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gather-quiz'; }
export function dateLabel(value) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
