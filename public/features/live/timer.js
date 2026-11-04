import { $ } from '../../core/dom.js';
export function createFeaturesLiveTimer(context) {
    const S = context.state;
    function updateTimer() {
        const st = S.roomState;
        if (!st)
            return;
        const remainingMs = st.deadline == null ? null : Math.max(0, st.deadline - (S.clock?.now() ?? Date.now()));
        const remaining = remainingMs == null ? null : Math.ceil(remainingMs / 1000);
        const countdown = $('#countdown-number');
        if (st.phase === 'countdown' && countdown) {
            const waiting = remaining === 0 && !!st.mediaPreparation;
            countdown.textContent = waiting ? '…' : remaining ?? '—';
            const media = $('#countdown-media');
            if (media) {
                media.hidden = !waiting;
                media.textContent = st.role === 'host' && st.mediaProgress ? `Preparing images · ${st.mediaProgress.ready} / ${st.mediaProgress.total} devices ready` : 'Preparing images…';
            }
            const skip = $('#media-skip');
            if (skip)
                skip.hidden = !waiting || !st.mediaProgress?.waiting || (S.clock?.now() ?? Date.now()) < st.deadline + 3000;
            return;
        }
        const timer = $('#live-timer');
        if (!timer)
            return;
        const seconds = st.phase === 'question' ? remaining ?? 0 : 0;
        $('span', timer).textContent = st.phase === 'reveal' ? '✓' : st.deadline == null ? '∞' : seconds;
        timer.classList.toggle('urgent', seconds <= 5 && st.phase === 'question');
        const fill = $('#timer-fill');
        if (fill)
            fill.style.width = `${st.phase === 'question' ? Math.max(0, Math.min(100, (remainingMs ?? 0) / ((st.question?.timeLimit || 20) * 1000) * 100)) : 0}%`;
    }
    return { updateTimer };
}
