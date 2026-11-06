import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {LEGAL_CONTACT} from '../legal/content.js';
import {policyURL} from '../legal/page.js';
import {changelog} from './changelog.js';
import {APP_VERSION,REPOSITORY_URL} from './releases.js';
export function aboutSettings(){
 const row=(title,href,detail='',external=false)=>`<a class="settings-link" href="${esc(href)}" ${external?'target="_blank" rel="noopener noreferrer"':''}><span><strong>${title}</strong>${detail?`<small>${detail}</small>`:''}</span>${icon(external?'arrow':'chevron',18)}</a>`;
 return `<section class="settings-group about-gather"><div class="settings-version"><div><h2>Gather</h2><p>Live quizzes, together.</p></div><span>Version ${APP_VERSION}</span></div>${changelog()}</section><section class="settings-group">${row('GitHub repository',REPOSITORY_URL,'Source code and contributions',true)}${row('Contact','mailto:'+LEGAL_CONTACT.email,esc(LEGAL_CONTACT.email))}</section><section class="settings-group">${row('Terms and Conditions',policyURL('terms','#settings/about'))}${row('Privacy Policy',policyURL('privacy','#settings/about'))}</section>`;
}
