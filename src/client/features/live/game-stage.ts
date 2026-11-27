import type {CompetitionReason, DataRecord, TeamId} from '../../../shared/types.js';
import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {avatarMarkup} from '../avatars/render.js';
import {answerLabel, competitionTeamName} from './competition.js';

interface StagePlayer {
    id: string;
    name: string;
    avatar?: unknown;
    team?: TeamId;
    lives?: number;
    eliminated?: boolean;
    spectating?: boolean;
    connected?: boolean;
}

interface StageAnswer {
    playerId: string;
    name: string;
    answer: unknown;
    reason?: CompetitionReason;
    publicReason?: CompetitionReason;
    lostLife?: boolean;
    note?: string;
}

interface StageFrame {
    key: string;
    revealed: number;
    charged: Set<string>;
    summary: StageUpdate | null;
}

interface StageUpdate { name: string; answer: string; announcement: string }

interface PlayerView {
    row?: StageAnswer;
    reason?: CompetitionReason;
    lives?: number;
    maximum: number;
    loss: boolean;
    current: boolean;
    newReveal: boolean;
}

const verdicts: Partial<Record<CompetitionReason, string>> = {
    duplicate: 'Duplicate', 'host-match': 'Matched the host', blank: 'No answer',
    rejected: 'Rejected', wrong: 'Incorrect'
};

const heart = icon('heart', 14);
let lastFrame: StageFrame | undefined;
let showLives = true;

export function gameStageMarkup(state: DataRecord) {
    if (!state.settings?.game || (state.phase !== 'lobby' && state.phase !== 'reveal')) return '';
    const competition = state.competition;
    const players: StagePlayer[] = competition?.stagePlayers ?? state.players ?? [];
    const review = state.phase === 'reveal' ? competition?.review : null;
    const revealed = Math.max(0, Math.floor(Number(review?.revealed) || 0));
    const revealInTurns = review && (review.stage === 'revealing' || review.reveal === 'turns');
    // A host can receive later answers privately for moderation. Only place revealed answers on the stage.
    const rows: StageAnswer[] = review?.rows ?? [];
    const visibleAnswers = revealInTurns ? rows.slice(0, revealed) : rows;
    const hideHostPreview = review?.stage !== 'complete' && state.role === 'host';
    const answers = new Map(visibleAnswers.map(answer => [answer.playerId, answer]));
    const latest = revealInTurns ? visibleAnswers.at(-1) : undefined;
    const key = `${state.code}/${state.questionIndex ?? 'lobby'}`;
    const previous = lastFrame?.key === key ? lastFrame : undefined;
    const maximum = Number(competition?.lives) || 0;
    const charged = new Set(visibleAnswers.filter(row => row.lostLife).map(row => row.playerId));
    const losses = previous ? new Set([...charged].filter(id => !previous.charged.has(id))) : new Set<string>();

    const newReveal = Boolean(previous && visibleAnswers.length > previous.revealed);
    const summary = revealSummary(state, players, latest, losses);
    const sameTurn = previous?.revealed === visibleAnswers.length && !losses.size;
    const status = sameTurn && previous.summary ? previous.summary : summary;
    lastFrame = {key, revealed: visibleAnswers.length, charged, summary: status};
    const progress = review && review.total > 0 && (revealInTurns || visibleAnswers.length > 0)
        ? `${visibleAnswers.length} / ${Number(review.total)} revealed` : `${players.length}`;
    const hostAnswer = review?.stage === 'revealing' ? '' : review?.hostAnswer;

    const lobby = state.phase === 'lobby';
    return `<section class="game-stage" aria-labelledby="game-stage-title"${showLives ? ' data-show-lives' : ''}>
        <div class="game-stage-heading">
            <div class="game-stage-title"><h2 id="game-stage-title"${lobby ? '' : ' class="sr-only"'}>${lobby ? 'Players' : 'Answers'}</h2><span>${esc(progress)}</span></div>
            ${maximum > 0 && players.length ? `<button id="game-stage-lives" class="quiet-button game-stage-lives-toggle" type="button" data-action="toggle-game-lives" aria-pressed="${showLives}" aria-label="Show everyone’s lives" title="Show everyone’s lives">${heart}</button>` : ''}
        </div>
        ${hostAnswer ? `<p class="game-stage-host-answer"><span>Host’s answer</span> <strong>${esc(hostAnswer)}</strong></p>` : ''}
        ${status ? `<div class="game-stage-update" data-stage-update="${esc(status.announcement)}"><strong dir="auto">${esc(status.answer)}</strong><span dir="auto">${esc(status.name)}</span></div>` : ''}
        <p class="sr-only" role="status" data-game-stage-announcement></p>
        ${players.length ? `<ul id="game-stage-players" class="game-stage-players" role="list" aria-labelledby="game-stage-title" data-stage-key="${esc(key)}" tabindex="0">
            ${players.map(player => {
                const row = answers.get(player.id);
                const team = competition?.teams?.sharedLives ? competition.teams.entries?.find(entry => entry.id === player.team) : null;
                const lives = team?.lives ?? player.lives;
                const reason = hideHostPreview ? row?.publicReason : row?.reason;
                const current = latest?.playerId === player.id;
                return playerMarkup(state, player, {
                    row, reason, lives: Number.isInteger(lives) ? lives : undefined, maximum,
                    loss: losses.has(player.id), current, newReveal: newReveal && (!revealInTurns || current)
                });
            }).join('')}
        </ul>` : '<p class="game-stage-empty">Waiting for players</p>'}
    </section>`;
}

function playerMarkup(state: DataRecord, player: StagePlayer, {row, reason, lives, maximum, loss, current, newReveal}: PlayerView) {
    const out = player.eliminated || player.spectating;
    const presence = out ? 'Spectating' : player.connected === false ? 'Offline' : '';
    const meta = [player.id === state.me?.id ? 'You' : '', player.team ? competitionTeamName(player.team) : '', presence].filter(Boolean).join(' · ');
    const verdict = reason && verdicts[reason];
    const answer = row ? String(answerLabel(state, row.answer)) : '';
    const waiting = state.phase === 'reveal' && !row && !out && state.competition?.review?.stage === 'revealing';
    const removable = state.phase === 'lobby' && state.role === 'host' && player.id !== state.me?.id;
    const livesInHeader = state.phase === 'reveal' && player.id === state.me?.id && Number.isInteger(state.me.lives);
    return `<li class="game-stage-player${current ? ' game-stage-current' : ''}${verdict ? ' game-stage-hit' : ''}${out ? ' game-stage-out' : ''}${loss ? ' game-stage-loss' : ''}" data-stage-player="${esc(player.id)}">
        ${removable ? `<button id="game-stage-remove-${esc(player.id)}" class="icon-btn game-stage-remove" type="button" data-action="kick-player" data-id="${esc(player.id)}" data-name="${esc(player.name)}" aria-label="Remove ${esc(player.name)}" title="Remove ${esc(player.name)}" data-needs-connection>${icon('close', 14)}</button>` : ''}
        <div class="game-stage-avatar${current && newReveal && !loss ? ' game-stage-avatar-reveal' : ''}">${avatarMarkup(player.avatar, player.name, 'stage')}</div>
        <strong class="game-stage-name" title="${esc(player.name)}">${esc(player.name)}</strong>
        ${meta ? `<span class="game-stage-meta">${esc(meta)}</span>` : ''}
        ${maximum > 0 && lives != null && !livesInHeader ? playerLives(lives, maximum, loss) : ''}
        ${row ? `<div class="game-stage-answer${newReveal ? ' game-stage-enter' : ''}">
            <strong>${esc(answer || 'No answer')}</strong>
            ${row.note ? `<p class="game-review-note" dir="auto" title="Host note">${esc(row.note)}</p>` : ''}
            ${verdict && reason !== 'blank' ? `<span class="${reason === 'rejected' && !row.note ? 'game-review-note' : 'sr-only'}">${esc(verdict)}</span>` : ''}
        </div>` : waiting ? '<div class="game-stage-answer game-stage-waiting"><span aria-hidden="true">—</span><span class="sr-only">Awaiting reveal</span></div>' : ''}
    </li>`;
}

function playerLives(lives: number, maximum: number, loss: boolean) {
    const compressed = maximum > 5;
    const hearts = Array.from({length: compressed ? 1 : maximum}, (_, index) => {
        const empty = lives <= index;
        const justLost = loss && (compressed || index === lives);
        return `<span class="game-stage-heart${empty ? ' game-stage-heart-empty' : ''}${justLost ? ' game-stage-heart-lost' : ''}">${heart}</span>`;
    }).join('');
    return `<span class="game-stage-lives" role="img" aria-label="${lives} ${lives === 1 ? 'life' : 'lives'} left">${hearts}${compressed ? `<b aria-hidden="true">${lives}</b>` : ''}</span>`;
}

function revealSummary(state: DataRecord, players: StagePlayer[], latest: StageAnswer | undefined, losses: Set<string>): StageUpdate | null {
    if (!latest) return null;
    const names = players.filter(player => losses.has(player.id)).map(player => player.name);
    const people = names.length > 2 ? `${names.length} players` : names.join(' and ');
    const matched = (latest.publicReason ?? latest.reason) === 'duplicate';
    const name = matched ? names.length > 1 ? `${people} matched` : `${latest.name} matched an earlier answer` : latest.name;
    const answer = String(answerLabel(state, latest.answer)) || 'No answer';
    const announcement = people ? `${answer}. ${name}. ${people} lost a life.` : `${answer}. ${name}.`;
    return {name, answer, announcement};
}

export function toggleGameStageLives(button: HTMLElement) {
    const stage = button.closest('.game-stage');
    if (!stage) return;
    showLives = !showLives;
    stage.toggleAttribute('data-show-lives', showLives);
    button.setAttribute('aria-pressed', String(showLives));
}

export function preserveGameStageScroll(root: HTMLElement) {
    const previous = root.querySelector<HTMLElement>('#game-stage-players');
    const key = previous?.dataset.stageKey;
    const scrollTop = previous?.scrollTop;
    const lastUpdate = root.querySelector<HTMLElement>('[data-stage-update]')?.dataset.stageUpdate;
    return () => {
        const next = root.querySelector<HTMLElement>('#game-stage-players');
        if (previous && next && next.dataset.stageKey === key) {
            // Keep loaded portraits in place across reveal snapshots; only new or edited profiles need decoding.
            const portraits = new Map([...previous.querySelectorAll<HTMLElement>('[data-stage-player]')]
                .map(slot => [slot.dataset.stagePlayer, slot.querySelector<HTMLElement>('.gather-avatar[data-avatar-ready]')]));
            for (const slot of next.querySelectorAll<HTMLElement>('[data-stage-player]')) {
                const old = portraits.get(slot.dataset.stagePlayer);
                const current = slot.querySelector<HTMLElement>('.gather-avatar[data-avatar-profile]');
                if (old && current && old.dataset.avatarProfile === current.dataset.avatarProfile) current.replaceWith(old);
            }
            next.scrollTop = scrollTop || 0;
        }
        const update = root.querySelector<HTMLElement>('[data-stage-update]')?.dataset.stageUpdate;
        const announcement = root.querySelector('[data-game-stage-announcement]');
        if (announcement && update && update !== lastUpdate) requestAnimationFrame(() => {
            if (announcement.isConnected) announcement.textContent = update;
        });
    };
}
