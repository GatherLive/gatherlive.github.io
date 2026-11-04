import { safeImage, esc, $, $$ } from '../../core/dom.js';
export function createFeaturesLiveMedia(context) {
    const S = context.state;
    const refreshAnswerUI = (...args) => context.refreshAnswerUI(...args);
    const modal = (...args) => context.modal(...args);
    function roomImage(source, classes = '', alt = 'Question image') { const safe = safeImage(source), cached = S.images?.cached(safe); return `<img data-room-image="${esc(safe)}" ${cached ? `src="${esc(cached)}" data-ready="true"` : ''} class="room-image ${cached ? '' : 'loading-image'} ${classes}" alt="${esc(alt)}" decoding="async" fetchpriority="high">`; }
    function fitChoiceQuestion() {
        const screen = $('.live-choice-screen');
        if (!screen)
            return;
        const height = window.visualViewport?.height ?? window.innerHeight, top = screen.getBoundingClientRect().top + window.scrollY;
        screen.style.setProperty('--choice-height', Math.max(160, Math.floor(height - top - 12)) + 'px');
    }
    function hydrateRoomImages() {
        const images = $$('img[data-room-image]');
        S.images?.retain(images.map(img => img.dataset.roomImage));
        const section = $('.live-question'), controls = section ? $$('button,input,textarea', section).map(el => [el, el.disabled]) : [];
        const sync = () => { if (!section?.isConnected)
            return; const waiting = images.some(img => img.isConnected && img.dataset.ready !== 'true'); const failed = images.some(img => img.classList.contains('image-failed')); section.setAttribute('aria-busy', String(waiting)); section.classList.toggle('media-pending', waiting && !failed); section.inert = waiting && !failed; const loading = $('.question-media-status'); if (loading) {
            loading.hidden = !waiting;
            loading.textContent = failed ? 'Image unavailable. Retry to continue.' : 'Preparing images…';
        } for (const [el, disabled] of controls)
            el.disabled = disabled || !S.connected || waiting; if (S.roomState?.phase === 'question')
            refreshAnswerUI(); };
        sync();
        for (const img of images) {
            if (img.dataset.ready === 'true')
                continue;
            const source = img.dataset.roomImage;
            const failed = () => {
                if (!img.isConnected)
                    return;
                img.classList.remove('loading-image');
                img.classList.add('image-failed');
                img.alt = 'Image unavailable';
                sync();
                const retry = document.createElement('button');
                retry.className = 'quiet-button image-retry';
                retry.type = 'button';
                retry.textContent = 'Retry image';
                retry.onclick = event => { event.stopPropagation(); retry.remove(); img.classList.remove('image-failed'); img.classList.add('loading-image'); sync(); load(true); };
                (img.closest('button')?.closest('.answer-grid') || img).after(retry);
            };
            const load = (retry = false) => void Promise.resolve(S.images?.source(source) || source).then(url => {
                if (!img.isConnected)
                    return;
                img.onload = () => { img.classList.remove('loading-image'); img.dataset.ready = 'true'; sync(); };
                img.onerror = failed;
                img.src = url + (retry && !url.startsWith('blob:') ? (url.includes('?') ? '&' : '?') + 'retry=' + Date.now() : '');
            }).catch(failed);
            load();
        }
    }
    function zoomAnswer(element) {
        const image = element.closest('.answer-card')?.querySelector('img[data-ready="true"]');
        if (!image?.src)
            return;
        modal(image.alt, `<img class="answer-image-expanded" src="${esc(image.src)}" alt="${esc(image.alt)}">`, '<button class="btn primary" data-action="close-modal">Done</button>');
        $('.modal').classList.add('image-modal');
    }
    return { roomImage, fitChoiceQuestion, hydrateRoomImages, zoomAnswer };
}
