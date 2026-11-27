import type {AppContext} from '../../app/context.js';
import {pageHeading} from '../../core/navigation.js';
import {honeypotField} from '../../core/forms.js';
import { icon } from '../../core/icons.js';
import { esc, $ } from '../../core/dom.js';
import { policyLinks } from '../legal/page.js';
export function createFeaturesJoinPage(context: AppContext) {
    const S = context.state;
    const shell = (...args) => context.shell(...args);
    function joinView(code = '') {
        let rememberedName = '';
        try { rememberedName = localStorage.getItem('gather.name') || ''; } catch { }
        const verification = S.joinVerificationPrompt?.code === code ? S.joinVerificationPrompt : null;
        const teams = S.joinTeamPrompt?.code === code ? S.joinTeamPrompt : null;
        if (teams || verification) rememberedName = (verification ?? teams).name;
        const teamPicker = teams ? `<div class="field"><label for="join-team">Team</label>
            <select id="join-team" required><option value="">Choose a team</option>
                <option value="a"${teams.team === 'a' ? ' selected' : ''}>Team A</option>
                <option value="b"${teams.team === 'b' ? ' selected' : ''}>Team B</option>
            </select><small class="hint">${esc(teams.message)}</small>
        </div>` : '';
        shell(`<main class="auth-layout join-layout"><section class="auth-card">${pageHeading('Join quiz')}<form id="join-form"><div class="field"><label for="join-code">Code</label><input id="join-code" class="code-input" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000" value="${esc(code)}" required></div><div class="field"><label for="join-name">Name</label><input id="join-name" name="name" autocomplete="nickname" placeholder="Your name" maxlength="32" minlength="1" value="${esc(rememberedName)}" required></div>${verification ? `<div class="field"><label for="join-verification-code">Verification code</label><input class="code-input" id="join-verification-code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000" required></div><p class="join-verification-hint">${esc(verification.message)}</p>` : ''}${teamPicker}${honeypotField()}<div id="form-error" role="alert"></div><button type="submit" class="btn primary full">Join ${icon('arrow', 16)}</button></form></section><footer class="join-legal">${policyLinks({ newTab: true, returnTo: code.length === 6 ? '#join/' + code : '#join' })}</footer></main>`);
        if (code.length === 6)
            setTimeout(() => $(verification ? '#join-verification-code' : teams ? '#join-team' : '#join-name')?.focus(), 50);
    }
    return { joinView };
}
