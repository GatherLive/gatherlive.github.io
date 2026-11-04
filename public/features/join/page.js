import { icon } from '../../core/icons.js';
import { esc, $ } from '../../core/dom.js';
import { policyLinks } from '../legal/page.js';
export function createFeaturesJoinPage(context) {
    const S = context.state;
    const shell = (...args) => context.shell(...args);
    function joinView(code = '') {
        let rememberedName = '';
        try { rememberedName = localStorage.getItem('gather.name') || ''; } catch { }
        shell(`<main class="auth-layout join-layout"><section class="auth-card"><a class="quiet-button back-link" href="#">${icon('back', 15)} Home</a><h1>Join quiz</h1><form id="join-form"><div class="field"><label for="join-code">Code</label><input id="join-code" class="code-input" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000" value="${esc(code)}" required></div><div class="field"><label for="join-name">Name</label><input id="join-name" name="name" autocomplete="nickname" placeholder="Your name" maxlength="32" minlength="1" value="${esc(rememberedName)}" required></div><div id="form-error" role="alert"></div><button type="submit" class="btn primary full">Join ${icon('arrow', 16)}</button></form></section><footer class="join-legal">${policyLinks({ newTab: true, returnTo: code.length === 6 ? '#join/' + code : '#join' })}</footer></main>`);
        if (code.length === 6)
            setTimeout(() => $('#join-name')?.focus(), 50);
    }
    return { joinView };
}
