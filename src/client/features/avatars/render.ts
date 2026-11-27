import {esc} from '../../core/dom.js';
import type {AvatarProfile} from '../../../shared/avatars/profile.js';
import {loadBoringAvatars, loadDiceBear, loadMultiavatar, normalizeAvatar} from './providers/browser.js';

type AvatarSize = 'chat' | 'room' | 'stage' | 'preview';
const images = new Map<string, Promise<string>>();
const waitingForViewport = new Set<HTMLElement>();
let viewport: IntersectionObserver | undefined;

function initials(name: string) {
    const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return [words[0], words.length > 1 ? words[words.length - 1] : '']
        .map(word => Array.from(word ?? '')[0] ?? '').join('').toLocaleUpperCase() || '•';
}

export function avatarMarkup(raw: unknown, name = '', size: AvatarSize = 'room') {
    const profile = normalizeAvatar(raw);
    const classes = `gather-avatar gather-avatar-${size}`;
    const background = profile?.background ? ` style="--avatar-background:${profile.background}"` : '';
    const data = profile ? ` data-avatar-profile="${esc(JSON.stringify(profile))}"` : '';
    return `<span class="${classes}"${background}${data} aria-hidden="true"><span class="avatar-initials">${esc(initials(name))}</span></span>`;
}

async function paint(profile: AvatarProfile, animated: boolean) {
    const family = profile.style.split(':')[0];
    const renderer = await (family === 'dicebear' ? loadDiceBear()
        : family === 'multiavatar' ? loadMultiavatar() : loadBoringAvatars());
    const svg = await renderer.svg(profile, animated);
    // Provider SVG is generated locally and decoded in image mode, never inserted into the document.
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function avatarImage(profile: AvatarProfile, allowMotion: boolean) {
    const animated = allowMotion && profile.style.startsWith('dicebear:') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const key = JSON.stringify([profile, animated]);
    let image = images.get(key);
    if (image) {
        images.delete(key);
        images.set(key, image);
        return image;
    }
    image = paint(profile, animated).catch(error => {
        if (images.get(key) === image) images.delete(key);
        throw error;
    });
    images.set(key, image);
    if (images.size > 144) images.delete(images.keys().next().value);
    return image;
}

export function fillAvatar(element: HTMLElement, profile: AvatarProfile, url: string) {
    const image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    image.className = 'avatar-image';
    const zoom = (profile.zoom ?? 100) / 100;
    const x = profile.flip === 'horizontal' || profile.flip === 'both' ? -zoom : zoom;
    const y = profile.flip === 'vertical' || profile.flip === 'both' ? -zoom : zoom;
    image.style.transform = `rotate(${profile.rotation ?? 0}deg) scale(${x}, ${y})`;
    image.addEventListener('load', () => {
        if (image.parentElement === element) element.dataset.avatarReady = '';
    }, {once: true});
    delete element.dataset.avatarReady;
    element.querySelector('.avatar-image')?.remove();
    element.append(image);
    image.src = url;
}

function paintElement(element: HTMLElement) {
    const encoded = element.dataset.avatarProfile;
    if (!element.isConnected || !encoded || encoded.length > 1500) return;
    let profile: AvatarProfile | null;
    try { profile = normalizeAvatar(JSON.parse(encoded)); }
    catch { return; }
    if (!profile) return;
    // Large stage portraits can animate. Compact chat and room rows use still images.
    avatarImage(profile, element.classList.contains('gather-avatar-stage')).then(url => {
        if (element.isConnected && element.dataset.avatarProfile === encoded) fillAvatar(element, profile, url);
    }).catch(() => { delete element.dataset.avatarRequested; });
}

export function hydrateAvatars(root: Element | Document = document) {
    for (const element of waitingForViewport) {
        if (element.isConnected) continue;
        waitingForViewport.delete(element);
        viewport.unobserve(element);
    }
    const selector = '[data-avatar-profile]:not([data-avatar-requested])';
    const elements = [...root.querySelectorAll<HTMLElement>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) elements.unshift(root);
    if (!elements.length) return;

    if (typeof IntersectionObserver !== 'undefined') {
        viewport ??= new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const element = entry.target as HTMLElement;
                waitingForViewport.delete(element);
                viewport.unobserve(element);
                paintElement(element);
            }
        }, {rootMargin: '80px'});
    }
    for (const element of elements) {
        element.dataset.avatarRequested = '';
        if (!viewport || element.classList.contains('gather-avatar-room')) paintElement(element);
        else {
            waitingForViewport.add(element);
            viewport.observe(element);
        }
    }
}
