import { esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { policyLinks } from '../legal/page.js';
export function createFeaturesAccountPage(context) {
    const S = context.state;
    const shell = (...args) => context.shell(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const accountChatView = (...args) => context.accountChatView(...args);
    const loadAccountChat = (...args) => context.loadAccountChat(...args);
    function accountView() {
        const fromLearn = S.section === 'learn', returnTo = fromLearn ? (/^#learn(?:\/[a-z-]+)*$/.test(S.learnReturn || '') ? S.learnReturn : '#learn') : '#dashboard';
        shell(`<main class="page"><div class="page-head"><div><a class="quiet-button" href="${esc(returnTo)}" style="padding:0;margin-bottom:15px">${icon('back', 14)} ${fromLearn ? 'Go back to Learn' : 'My quizzes'}</a><h1>Account</h1></div></div><section class="card account-section"><h2 style="font-size:22px">Your account</h2><p>Signed in as <span class="subtle">${esc(activeUser()?.email)}</span></p><div class="account-actions"><button class="btn" data-action="sign-out">${icon('logout', 15)} Sign out</button><a class="btn ghost" href="${fromLearn ? '#' : '#learn'}">${fromLearn ? 'Go to Quiz' : 'Go to Learn'} ${icon('arrow', 16)}</a></div></section><section class="card account-section"><h2 style="font-size:22px">Room chat</h2><div id="account-chat-content">${accountChatView()}</div></section><section class="card account-section"><h2 style="font-size:22px">Change your password</h2><form id="password-form"><div class="field"><label for="new-password">New password</label><input id="new-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></div><button class="btn" type="submit">Update password</button></form></section><section class="card account-section"><h2 style="font-size:22px">Delete your account</h2><p>Permanently deletes your account, quizzes, images and results.</p><button class="btn danger" data-action="delete-account">Delete my account</button></section><footer class="legal-footer account-legal">${policyLinks({ returnTo: '#account' })}</footer></main>`);
        void loadAccountChat();
    }
    return { accountView };
}
