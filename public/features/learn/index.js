import { createLearnSharedView } from './views/shared.js';
import { createLearnHomeView } from './views/home.js';
import { createLearnTopicsView } from './views/topics.js';
import { createLearnLibraryView } from './views/library.js';
import { createLearnCardsView } from './views/cards.js';
import { createLearnCountryView } from './views/country.js';
import { createLearnReviewView } from './views/review.js';
import { createLearnPracticeView } from './views/practice.js';
import { createLearnSourcesView } from './views/sources.js';
import { createLearnSyncView } from './views/sync.js';
import { policyLinks } from '../legal/page.js';
import { createProgressStore, recordAnswer, progressStats } from './progress.js';
import { mountLearningMap, prepareLearningMaps } from './map.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REGIONS = ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
const TOPICS = { flags: { name: 'Flags', noun: 'flag', question: 'Which country does this flag belong to?', color: 'lavender' }, capitals: { name: 'Capitals', noun: 'capital', question: 'What is the capital?', color: 'green' }, map: { name: 'On the map', noun: 'country', question: 'Which country is highlighted?', color: 'sand' }, all: { name: 'All', noun: 'country', color: 'lavender' } };
const assetURL = path => { const url = new URL(path, import.meta.url); url.search = new URL(import.meta.url).search; return url.href; };
const localURL = path => assetURL(`../../learn-data/${path}`);
let stylesheetPromise;
function loadStyles() { if (!stylesheetPromise)
    stylesheetPromise = new Promise((resolve, reject) => { const href = assetURL('./styles.css'); const existing = document.querySelector('link[data-gather-learn]'); if (existing?.sheet) {
        resolve();
        return;
    } const link = existing || document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.gatherLearn = ''; link.onload = resolve; link.onerror = () => { stylesheetPromise = null; link.remove(); reject(Error('Learning styles unavailable.')); }; if (!existing)
        document.head.append(link); }); return stylesheetPromise; }
const flagURL = code => localURL(`flags/${code}.svg`);
const flag = (country, extra = '') => `<img class="learn-flag ${extra}" src="${flagURL(country.code)}" alt="${esc(country.name)} flag" loading="lazy" decoding="async" width="180" height="120">`;
// Material-style filled symbols; rendered locally with the existing icon licence.
const symbol = (name, size = 24) => {
    const paths = { book: 'M480-180q-61-40-132-60t-148-20q-36 0-71 4.5T60-240v-560q34-11 69-15.5t71-4.5q77 0 148 20t132 60q61-40 132-60t148-20q36 0 71 4.5t69 15.5v560q-34-11-69-15.5t-71-4.5q-77 0-148 20T480-180Zm-40-116v-374q-50-30-111-45t-129-15q-16 0-30 .5t-30 3.5v386q16-2 30-3t30-1q68 0 129 12t111 36Zm80 0q50-24 111-36t129-12q16 0 30 1t30 3v-386q-16-3-30-3.5t-30-.5q-68 0-129 15t-111 45v374Z', flag: 'M200-80v-760h360l16 80h224v440H520l-16-80H280v320h-80Zm80-400h290l16 80h134v-280H510l-16-80H280v280Z', map: 'm600-120-240-84-186 72q-20 8-37-4t-17-33v-560q0-13 7.5-23t19.5-15l213-73 240 84 186-72q20-8 37 4t17 33v560q0 13-7.5 23T813-193l-213 73Zm-40-98v-488l-160-56v488l160 56Zm80-6 120-42v-440l-120 46v436Zm-440 0 120-46v-436l-120 42v440Z', check: 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z', review: 'M480-80q-123 0-222-67T113-324l75-28q35 86 113 139t179 53q134 0 227-93t93-227q0-134-93-227t-227-93q-83 0-155 39t-118 105h113v80H80v-240h80v112q57-82 142-129t178-47q83 0 156 31.5t127 85.5q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm112-232L440-464v-216h80v184l128 128-56 56Z', spark: 'm480-40-84-276-276-84 276-84 84-276 84 276 276 84-276 84-84 276Z' };
    return `<svg width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
};
function shuffle(list) { const out = [...list]; for (let i = out.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
} return out; }
const normalize = text => String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]/gu, '').trim();
const countryAnswers = country => [country.name, country.code, ...(country.aliases || [])];
const capitalAnswers = country => [...(country.capital || []), ...(country.capitalAliases || [])];
const capitalLabel = country => (country.capital || []).join(' / ');
const capitalFactLabel = country => country.code === 'nr' ? 'Seat of government' : country.code === 'ch' ? 'Federal city' : country.code === 'bo' ? 'Capital / seat of government' : country.capital.length > 1 ? 'Capitals' : 'Capital';
const capitalQuestion = (country, answerMode) => country.code === 'bo' && answerMode === 'choice' ? 'Which option names Bolivia’s constitutional capital and seat of government?' : country.capitalQuestion || (country.capital.length > 1 ? (answerMode === 'type' ? `Name a capital of ${country.name}.` : `Which are the capitals of ${country.name}?`) : `What is the capital of ${country.name}?`);
const matchAnswer = (country, topic, text) => (topic === 'capitals' ? capitalAnswers(country) : countryAnswers(country)).some(answer => normalize(answer) === normalize(text));
const shortDate = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
export function createLearning({ shell, icon, session, signIn, loadCloud, saveCloud, resetCloud, notify }) {
    let libraryInfo = {}, countries = [], countryByCode = new Map(), mapData = null, dataPromise, active = false, routeParts = [], topic = 'all', mode = 'cards', region = 'World', answerMode = 'choice', count = 10, customCount = '', cardCodes = [], cardIndex = 0, cardRegion = '', cardsShuffled = false, search = '', shown = 24, selectedCountry = '', current = null, lastFinished = null, cleanups = [], pending = false, shownReviewCount = -1;
    const maps = new Map(), mapSpecs = new Map();
    let mapId = 0, sourcesReturn = '#learn';
    const store = createProgressStore({ session, loadCloud, saveCloud, resetCloud, notify, changed: () => { if (active)
            updateProgressUI(); } });
    const back = (href = '#learn', label = 'Learn') => `<a class="quiet-button learn-back" href="${href}">${icon?.('back', 16) || '←'} ${label}</a>`;
    const beta = '<span class="learn-beta">beta</span>';
    const signedIn = () => !!(session?.()?.user?.id || session?.()?.id);
    const filtered = () => countries.filter(country => region === 'World' || country.region === region);
    // Live getters keep views connected to this instance, including async route changes.
    const viewContext = { get answerMode() { return answerMode; }, set answerMode(value) { answerMode = value; }, get atlasCaption() { return atlasCaption; }, get availableQuestions() { return availableQuestions; }, get back() { return back; }, get beta() { return beta; }, get capitalFactLabel() { return capitalFactLabel; }, get capitalLabel() { return capitalLabel; }, get capitalQuestion() { return capitalQuestion; }, get cardCodes() { return cardCodes; }, set cardCodes(value) { cardCodes = value; }, get cardIndex() { return cardIndex; }, set cardIndex(value) { cardIndex = value; }, get cardsContent() { return cardsContent; }, get cardsShuffled() { return cardsShuffled; }, set cardsShuffled(value) { cardsShuffled = value; }, get count() { return count; }, set count(value) { count = value; }, get countryByCode() { return countryByCode; }, set countryByCode(value) { countryByCode = value; }, get current() { return current; }, set current(value) { current = value; }, get customCount() { return customCount; }, set customCount(value) { customCount = value; }, get disposeMaps() { return disposeMaps; }, get ensureCards() { return ensureCards; }, get esc() { return esc; }, get exploreContent() { return exploreContent; }, get filtered() { return filtered; }, get flag() { return flag; }, get flagURL() { return flagURL; }, get frame() { return frame; }, get icon() { return icon; }, get libraryInfo() { return libraryInfo; }, set libraryInfo(value) { libraryInfo = value; }, get mapMarkup() { return mapMarkup; }, get mode() { return mode; }, set mode(value) { mode = value; }, get mountMaps() { return mountMaps; }, get notify() { return notify; }, get overview() { return overview; }, get policyLinks() { return policyLinks; }, get progressStats() { return progressStats; }, get region() { return region; }, set region(value) { region = value; }, get REGIONS() { return REGIONS; }, get reviewEntries() { return reviewEntries; }, get routeParts() { return routeParts; }, set routeParts(value) { routeParts = value; }, get search() { return search; }, set search(value) { search = value; }, get selectedCountry() { return selectedCountry; }, set selectedCountry(value) { selectedCountry = value; }, get shown() { return shown; }, set shown(value) { shown = value; }, get shownReviewCount() { return shownReviewCount; }, set shownReviewCount(value) { shownReviewCount = value; }, get sourcesReturn() { return sourcesReturn; }, set sourcesReturn(value) { sourcesReturn = value; }, get store() { return store; }, get symbol() { return symbol; }, get topic() { return topic; }, set topic(value) { topic = value; }, get topicIcon() { return topicIcon; }, get TOPICS() { return TOPICS; }, get topicView() { return topicView; }, get validCustomCount() { return validCustomCount; } };
    const { progressBar, learningFooter, overview } = createLearnSharedView(viewContext);
    const { homeView } = createLearnHomeView(viewContext);
    const { regionSelect, topicView, setupContent } = createLearnTopicsView(viewContext);
    const { exploreContent, countryCards } = createLearnLibraryView(viewContext);
    const { cardsContent, atlasCaption } = createLearnCardsView(viewContext);
    const { showCountry } = createLearnCountryView(viewContext);
    const { reviewEntries, reviewView } = createLearnReviewView(viewContext);
    const { renderQuestion, resultsView } = createLearnPracticeView(viewContext);
    const { sourcesView } = createLearnSourcesView(viewContext);
    const { resetPrompt, syncPrompt } = createLearnSyncView(viewContext);
    async function loadData() {
        if (!dataPromise)
            dataPromise = Promise.all([fetch(localURL('countries.json')).then(r => { if (!r.ok)
                    throw Error('Learning library unavailable.'); return r.json(); }), fetch(localURL('world.json')).then(r => { if (!r.ok)
                    throw Error('Map unavailable.'); return r.json(); })]).then(([data, world]) => { libraryInfo = data; countries = data.countries || data; if (!Array.isArray(countries) || !countries.length)
                throw Error('Learning library unavailable.'); countryByCode = new Map(countries.map(country => [country.code, country])); mapData = world; return data; }).catch(error => { dataPromise = null; throw error; });
        return dataPromise;
    }
    function disposeMaps(root) { for (const [element, controller] of maps) {
        if (!root || root.contains(element)) {
            controller.destroy();
            maps.delete(element);
            mapSpecs.delete(element.dataset.learningMap);
        }
    } }
    function mountMaps(root) {
        if (!root?.isConnected)
            return;
        for (const element of root.querySelectorAll('[data-learning-map]')) {
            if (maps.has(element))
                continue;
            const spec = mapSpecs.get(element.dataset.learningMap);
            if (!spec)
                continue;
            const controller = mountLearningMap(element, { world: mapData, countries, selectedCode: spec.country?.code || '', labels: spec.labels, allowSelect: spec.allowSelect, focusSelection: spec.focusSelection, onSelect: code => {
                    if (spec.kind === 'atlas')
                        selectAtlasCountry(code, false);
                    else {
                        // Keep a study card's location consistent while inspecting its neighbours.
                        controller.setSelection(spec.country?.code || '');
                        showCountry(code);
                    }
                } });
            maps.set(element, controller);
        }
    }
    function disposeListeners() { for (const cleanup of cleanups)
        cleanup(); cleanups = []; }
    function on(element, name, fn, options) { if (!element)
        return; element.addEventListener(name, fn, options); cleanups.push(() => element.removeEventListener(name, fn, options)); }
    function frame(content, className = '') {
        disposeListeners();
        disposeMaps(document.getElementById('learn-root'));
        shell(`<main id="learn-root" class="learn-page ${className}"><div class="learn-content">${content}</div>${className === 'learn-session' || pending ? '' : learningFooter()}</main>`);
        const root = document.getElementById('learn-root');
        on(root, 'click', handleClick);
        on(root, 'change', handleChange);
        on(root, 'input', handleInput);
        on(root, 'submit', handleSubmit);
        on(root, 'keydown', handleKeydown);
        updateProgressUI();
        mountMaps(root);
    }
    function updateProgressUI() {
        const state = document.getElementById('learn-save-state'), action = document.getElementById('learn-save-action');
        if (!state || !action)
            return;
        state.textContent = store.enabled ? ({ loading: 'Connecting…', saving: 'Saving…', pending: 'Saved on this device', saved: 'Synced to your account', error: 'Saved on this device · sync paused' }[store.state] || 'Saved on this device') : 'Progress stays on this device';
        const stats = progressStats(store.value), statNodes = document.querySelectorAll('.learn-stat-strip strong');
        if (statNodes.length === 3) {
            statNodes[0].textContent = stats.practised;
            statNodes[1].textContent = stats.learned;
            statNodes[2].textContent = stats.answers ? stats.accuracy + '%' : '—';
        }
        const due = reviewEntries().length, reviewLabel = document.querySelector('.learn-review-link small');
        if (reviewLabel)
            reviewLabel.textContent = due ? `${due} ready to revisit` : 'Keep what you learn';
        if (document.querySelector('.learn-review-page') && !current && shownReviewCount !== due) {
            reviewView();
            return;
        }
        action.innerHTML = !signedIn() ? '<button class="quiet-button" data-learn-action="signin">Sign in to sync</button>' : !store.enabled ? '<button class="quiet-button" data-learn-action="sync-enable">Enable account sync</button>' : store.state === 'error' ? '<button class="quiet-button" data-learn-action="sync-retry">Retry sync</button>' : '<button class="quiet-button" data-learn-action="sync-disable">Pause sync</button>';
    }
    const topicIcon = name => symbol(name === 'flags' ? 'flag' : name === 'capitals' ? 'book' : 'map', 28);
    function availableQuestions(pool = filtered()) { return pool.length * (topic === 'all' ? 3 : 1); }
    function validCustomCount(pool = filtered()) { return /^\d+$/.test(customCount) && Number(customCount) >= 1 && Number(customCount) <= availableQuestions(pool); }
    function updateCustomCount() {
        const valid = validCustomCount(), root = document.getElementById('learn-root');
        for (const button of root?.querySelectorAll('[data-learn-action="count"]') || []) {
            button.classList.remove('learn-active');
            button.setAttribute('aria-pressed', 'false');
        }
        root?.querySelector('.learn-custom-count')?.classList.add('learn-active');
        const input = document.getElementById('learn-custom-count');
        input?.setAttribute('aria-invalid', String(!valid));
        const error = document.getElementById('learn-count-error');
        if (error)
            error.hidden = valid;
        const start = root?.querySelector('.learn-start');
        if (start)
            start.disabled = !valid;
    }
    function ensureCards(pool) { if (cardRegion !== region || !cardCodes.length) {
        cardRegion = region;
        cardCodes = pool.map(country => country.code);
        cardIndex = 0;
        cardsShuffled = false;
    } cardIndex = Math.min(cardIndex, Math.max(0, cardCodes.length - 1)); }
    function focusStudyCard() {
        const card = document.querySelector('.learn-flashcard');
        const heading = card?.querySelector('h2');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
        card?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    function selectAtlasCountry(code, focus = false) {
        const country = countryByCode.get(code);
        if (code && !country)
            return;
        selectedCountry = code;
        const selector = document.getElementById('learn-country');
        if (selector) {
            if (country && ![...selector.options].some(option => option.value === code)) {
                region = country.region;
                const regionSelector = document.getElementById('learn-region');
                if (regionSelector)
                    regionSelector.value = region;
                selector.innerHTML = '<option value="">World map</option>' + [...filtered()].sort((a, b) => a.name.localeCompare(b.name)).map(item => `<option value="${item.code}">${esc(item.name)}</option>`).join('');
            }
            selector.value = code;
        }
        const caption = document.querySelector('.learn-atlas-caption');
        if (caption)
            caption.innerHTML = atlasCaption(country);
        for (const [element, controller] of maps) {
            if (mapSpecs.get(element.dataset.learningMap)?.kind === 'atlas') {
                controller.setSelection(code, { focus });
                if (!code)
                    controller.showWorld();
            }
        }
    }
    function mapMarkup(country, reveal = false, options = {}) {
        const id = `learn-map-${++mapId}`;
        mapSpecs.set(id, { country, labels: reveal, allowSelect: options.allowSelect ?? true, focusSelection: options.focusSelection ?? true, kind: options.kind || 'location' });
        return `<div class="learn-map-wrap" data-learning-map="${id}"></div>`;
    }
    function startSession(entries) {
        const pool = filtered();
        if (!entries && count === 'custom' && !validCustomCount(pool)) {
            updateCustomCount();
            document.getElementById('learn-custom-count')?.focus();
            return;
        }
        const amount = count === 'all' ? availableQuestions(pool) : count === 'custom' ? Number(customCount) : Math.min(count, availableQuestions(pool));
        let list = entries;
        if (!list) {
            if (topic === 'all') {
                const topics = shuffle(['flags', 'map', 'capitals']), decks = Object.fromEntries(topics.map(key => [key, shuffle(pool)]));
                list = [];
                for (let i = 0; i < pool.length; i++)
                    for (const key of topics)
                        list.push({ country: decks[key][i], topic: key });
                list = list.slice(0, amount);
            }
            else
                list = shuffle(pool).slice(0, amount).map(country => ({ country, topic }));
        }
        if (!list.length) {
            notify?.('Choose a region with countries to practise.');
            return;
        }
        current = { id: crypto.randomUUID?.() || String(Date.now()), entries: list, index: 0, results: [], answered: false, choice: '', correct: false, topic, mode: entries ? 'review' : mode, answerMode, region, startedAt: Date.now() };
        prepareQuestion();
    }
    function prepareQuestion() {
        if (!current)
            return;
        current.answered = false;
        current.choice = '';
        const entry = current.entries[current.index];
        const targetAnswers = new Set(capitalAnswers(entry.country).map(normalize));
        const pool = countries.filter(country => country.code !== entry.country.code && (entry.topic !== 'capitals' || !capitalAnswers(country).some(answer => targetAnswers.has(normalize(answer)))));
        let local = pool.filter(country => country.region === entry.country.region);
        if (local.length < 3)
            local = pool;
        current.choices = shuffle([entry.country, ...shuffle(local).slice(0, 3)]);
        renderQuestion();
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Only this public learning exercise is preloaded; private live quiz media is separate.
        if (entry.topic === 'flags') {
            const image = new Image();
            image.src = flagURL(entry.country.code);
        }
        const next = current.entries[current.index + 1];
        if (next?.topic === 'flags') {
            const image = new Image();
            image.src = flagURL(next.country.code);
        }
    }
    async function answer(value, isCode = false) {
        const s = current;
        if (!s || s.answered)
            return;
        const entry = s.entries[s.index];
        const correct = isCode ? value === entry.country.code : matchAnswer(entry.country, entry.topic, value);
        s.answered = true;
        s.correct = correct;
        s.choice = value;
        s.results.push({ topic: entry.topic, country: entry.country, correct });
        await store.update(progress => recordAnswer(progress, entry.topic, entry.country.code, correct));
        if (current !== s || !active)
            return;
        for (const [element, controller] of maps) {
            if (document.getElementById('learn-root')?.contains(element))
                controller.setRevealed(true);
        }
        const root = document.getElementById('learn-root');
        root?.querySelectorAll('.learn-choice').forEach(button => { button.disabled = true; const right = button.dataset.code === entry.country.code, chosen = isCode && button.dataset.code === value; button.classList.toggle('learn-correct', right); button.classList.toggle('learn-incorrect', chosen && !correct); if (right)
            button.querySelector('.learn-choice-mark').innerHTML = symbol('check', 20); });
        const input = document.getElementById('learn-answer');
        if (input) {
            input.disabled = true;
            const submit = input.form?.querySelector('button');
            if (submit)
                submit.disabled = true;
        }
        const bottom = root?.querySelector('.learn-question-bottom');
        if (bottom)
            bottom.hidden = true;
        const label = entry.topic === 'capitals' ? capitalLabel(entry.country) : entry.country.name;
        const feedback = document.getElementById('learn-feedback');
        if (feedback) {
            feedback.className = `learn-feedback learn-feedback-visible ${correct ? 'learn-feedback-correct' : 'learn-feedback-wrong'}`;
            feedback.innerHTML = `<div><strong>${correct ? 'That’s right' : value ? 'Keep this one in mind' : 'A new one to remember'}</strong><p>${esc(label)}${entry.topic !== 'capitals' ? ` <span>·</span> ${esc(capitalLabel(entry.country))}` : ''}</p>${entry.country.capitalNote && entry.topic === 'capitals' ? `<small>${esc(entry.country.capitalNote)}</small>` : ''}${entry.country.flagNote && entry.topic === 'flags' ? `<small>${esc(entry.country.flagNote)}</small>` : ''}</div><button class="btn ${correct ? 'green' : 'primary'}" data-learn-action="next">${s.index + 1 === s.entries.length ? 'See results' : 'Continue'} ${icon?.('arrow', 17) || '→'}</button>`;
        }
        root?.querySelector('.learn-session-progress i')?.style.setProperty('width', `${(s.index + 1) / s.entries.length * 100}%`);
        root?.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(s.index + 1));
        // Keep the question and flag nodes in place after answering.
        if (matchMedia('(max-width:700px)').matches && feedback)
            requestAnimationFrame(() => { const box = feedback.getBoundingClientRect(); if (box.bottom > innerHeight)
                feedback.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
    }
    async function finishSession() {
        const s = current;
        if (!s || s.finishing)
            return;
        s.finishing = true;
        const next = document.querySelector('[data-learn-action="next"]');
        if (next)
            next.disabled = true;
        const correct = s.results.filter(result => result.correct).length;
        await store.update(progress => { progress.tests.push({ id: s.id, topic: s.mode === 'review' ? 'review' : s.topic, region: s.region, total: s.entries.length, correct, at: Date.now() }); progress.tests = progress.tests.slice(-20); progress.updatedAt = Date.now(); });
        if (current !== s || !active)
            return;
        lastFinished = s;
        current = null;
        resultsView(s);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    async function handleClick(event) {
        const button = event.target.closest('[data-learn-action]');
        if (!button)
            return;
        const action = button.dataset.learnAction;
        if (action === 'mode') {
            mode = button.dataset.mode;
            search = '';
            shown = 24;
            topicView();
            document.getElementById(`learn-tab-${mode}`)?.focus({ preventScroll: true });
        }
        else if (action === 'answer-mode') {
            answerMode = button.dataset.value;
            topicView();
            document.querySelector(`[data-learn-action="answer-mode"][data-value="${answerMode}"]`)?.focus({ preventScroll: true });
        }
        else if (action === 'count') {
            count = button.dataset.value === 'all' ? 'all' : Number(button.dataset.value);
            customCount = '';
            topicView();
            document.querySelector(`[data-learn-action="count"][data-value="${count}"]`)?.focus({ preventScroll: true });
        }
        else if (action === 'card-next' || action === 'card-prev') {
            cardIndex = Math.max(0, Math.min(cardCodes.length - 1, cardIndex + (action === 'card-next' ? 1 : -1)));
            topicView();
            focusStudyCard();
        }
        else if (action === 'card-shuffle') {
            cardCodes = shuffle(cardCodes);
            cardIndex = 0;
            cardsShuffled = true;
            topicView();
            focusStudyCard();
        }
        else if (action === 'card-order') {
            cardCodes = filtered().map(country => country.code);
            cardIndex = 0;
            cardsShuffled = false;
            topicView();
            focusStudyCard();
        }
        else if (action === 'more') {
            shown += 24;
            topicView();
        }
        else if (action === 'country')
            showCountry(button.dataset.code);
        else if (action === 'start')
            startSession();
        else if (action === 'answer')
            await answer(button.dataset.code, true);
        else if (action === 'skip')
            await answer('');
        else if (action === 'next') {
            if (current?.answered) {
                if (current.index + 1 >= current.entries.length)
                    await finishSession();
                else {
                    current.index++;
                    prepareQuestion();
                }
            }
        }
        else if (action === 'exit-session') {
            if (!current)
                return;
            current = null;
            if (routeParts[0] === 'review')
                reviewView();
            else
                topicView();
        }
        else if (action === 'review-start')
            startSession(shuffle(reviewEntries()).slice(0, 30));
        else if (action === 'review-missed' && lastFinished)
            startSession(shuffle(lastFinished.results.filter(result => !result.correct).map(({ country, topic }) => ({ country, topic }))));
        else if (action === 'again') {
            if (lastFinished?.entries[0])
                topic = lastFinished.topic || lastFinished.entries[0].topic;
            mode = 'practice';
            startSession();
        }
        else if (action === 'signin')
            signIn?.(location.hash || '#learn');
        else if (action === 'sync-enable')
            syncPrompt();
        else if (action === 'sync-disable')
            store.disable();
        else if (action === 'sync-retry')
            await store.retry();
        else if (action === 'reset')
            resetPrompt();
        else if (action === 'retry') {
            await route(routeParts);
        }
    }
    function handleChange(event) {
        if (event.target.id === 'learn-region') {
            region = event.target.value;
            selectedCountry = '';
            shown = 24;
            cardRegion = '';
            if (typeof count === 'number' && count > availableQuestions())
                count = 'all';
            topicView();
        }
        else if (event.target.id === 'learn-practice-topic') {
            topic = event.target.value;
            if (!TOPICS[topic])
                topic = 'all';
            if (typeof count === 'number' && count > availableQuestions())
                count = 'all';
            topicView();
            document.getElementById('learn-practice-topic')?.focus({ preventScroll: true });
        }
        else if (event.target.id === 'learn-country') {
            selectAtlasCountry(event.target.value, true);
        }
    }
    function handleInput(event) {
        if (event.target.id === 'learn-custom-count') {
            customCount = event.target.value;
            count = 'custom';
            updateCustomCount();
            return;
        }
        if (event.target.id === 'learn-search') {
            search = event.target.value;
            shown = 24;
            const results = filtered().filter(country => `${country.name} ${capitalLabel(country)} ${(country.aliases || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
            const grid = document.getElementById('learn-country-grid');
            if (grid)
                grid.innerHTML = countryCards(results.slice(0, shown));
            const countNode = document.querySelector('.learn-result-count');
            if (countNode)
                countNode.textContent = `${results.length} countries`;
            const more = document.querySelector('.learn-more');
            if (more)
                more.remove();
            if (results.length > shown)
                grid?.insertAdjacentHTML('afterend', '<div class="learn-more"><button class="btn" data-learn-action="more">Show more</button></div>');
            document.querySelector('.learn-empty')?.remove();
            if (!results.length)
                grid?.insertAdjacentHTML('afterend', '<p class="learn-empty">No countries found.</p>');
        }
    }
    function handleKeydown(event) {
        const tabs = [...document.querySelectorAll('.learn-tab')];
        if (event.target.classList.contains('learn-tab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            let index = tabs.indexOf(event.target);
            index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            tabs[index].click();
            document.querySelectorAll('.learn-tab')[index]?.focus();
        }
        if (current && !event.target.closest('input,textarea,select,button,a')) {
            if (!current.answered && /^[1-4]$/.test(event.key) && current.answerMode === 'choice') {
                event.preventDefault();
                const choice = current.choices[Number(event.key) - 1];
                if (choice)
                    answer(choice.code, true);
            }
            else if (current.answered && event.key === 'Enter') {
                event.preventDefault();
                document.querySelector('[data-learn-action="next"]')?.click();
            }
        }
    }
    function handleSubmit(event) { if (event.target.id === 'learn-answer-form') {
        event.preventDefault();
        event.stopPropagation();
        const value = document.getElementById('learn-answer')?.value?.trim();
        if (value)
            answer(value);
    } }
    async function route(parts = []) {
        const nextParts = [...parts];
        if (nextParts[0] === 'learn')
            nextParts.shift();
        if (nextParts[0] === 'sources' && routeParts[0] !== 'sources') {
            const previous = '#learn' + (routeParts.length ? '/' + routeParts.join('/') : '');
            sourcesReturn = /^#learn(?:\/[a-z-]+)*$/.test(previous) ? previous : '#learn';
        }
        const returningFromSources = routeParts[0] === 'sources';
        active = true;
        routeParts = nextParts;
        current = null;
        pending = true;
        frame('<div class="learn-loading"><span class="spinner"></span><p>Opening your learning library…</p></div>');
        try {
            await Promise.all([loadData(), loadStyles(), prepareLearningMaps(), store.init()]);
            if (!active)
                return;
            pending = false;
            const section = routeParts[0] || '';
            if (section === 'world' || TOPICS[section]) {
                if (TOPICS[section])
                    topic = section;
                if (!returningFromSources)
                    mode = 'cards';
                search = '';
                shown = 24;
                topicView();
            }
            else if (section === 'review')
                reviewView();
            else if (section === 'sources')
                sourcesView();
            else if (section === 'explore') {
                mode = 'explore';
                topicView();
            }
            else
                homeView();
        }
        catch (error) {
            if (!active)
                return;
            pending = false;
            frame(`${back()}<section class="learn-review-panel"><h1>Couldn’t open Learn</h1><p>${esc(error.message)}</p><button class="btn primary" data-learn-action="retry">Try again</button></section>`);
        }
    }
    return { route, destroy() { active = false; disposeListeners(); disposeMaps(); mapSpecs.clear(); document.querySelectorAll('.learn-dialog').forEach(dialog => dialog.remove()); store.destroy(); current = null; }, async sessionChanged() { await store.sessionChanged(); if (active && !pending) {
            current = null;
            if (!routeParts.length)
                homeView();
            else if (routeParts[0] === 'review')
                reviewView();
            else if (routeParts[0] === 'world' || TOPICS[routeParts[0]])
                topicView();
            else
                homeView();
        } }, get progress() { return store.value; } };
}
