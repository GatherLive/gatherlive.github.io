import {esc} from '../../core/dom.js';
import {LEGAL_VERSION,LEGAL_CONTACT,POLICIES as pages} from './content.js';
export {LEGAL_VERSION,LEGAL_CONTACT} from './content.js';

// Only known internal pages can be a policy's return destination.
export function policyReturn(value='#'){
  return typeof value==='string'&&/^#(?:account|dashboard|join(?:\/\d{6})?|learn(?:\/[a-z-]+)*|host(?:\/signup)?)?$/.test(value)?value:'#';
}
export function policyURL(kind,returnTo='#'){
  const destination=policyReturn(returnTo);
  return '#'+(kind==='terms'?'terms':'privacy')+(destination==='#'?'':'?return='+encodeURIComponent(destination));
}
export function policyLinks({newTab=false,current='',returnTo='#'}={}){
  const attributes=newTab?' target="_blank" rel="noopener noreferrer"':'';
  return `<nav class="legal-links" aria-label="Legal">${[['terms','Terms and Conditions'],['privacy','Privacy Policy']].map(([key,label])=>`<a href="${policyURL(key,returnTo)}"${attributes}${current===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
export function policyNotice(action='signing up',returnTo='#host/signup'){
  return `<p class="legal-notice">By ${esc(action)}, you agree to our <a href="${policyURL('terms',returnTo)}" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and acknowledge our <a href="${policyURL('privacy',returnTo)}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>`;
}
export function policyPage(kind,backIcon='',returnTo='#'){
  const page=pages[kind];if(!page)return '';
  const destination=policyReturn(returnTo),backLabel=destination==='#account'?'Account':destination==='#dashboard'?'My quizzes':destination.startsWith('#learn')?'Learn':destination.startsWith('#join')?'Join quiz':destination==='#host/signup'?'Create account':destination==='#host'?'Sign in':'Home';
  const withContext=html=>html.replace(/href="#(terms|privacy)"/g,(_,key)=>`href="${policyURL(key,destination)}"`);
  const contact=LEGAL_CONTACT.email?`<section class="legal-section"><h2>Contact</h2><p>Contact me to report misuse: <a href="mailto:${esc(LEGAL_CONTACT.email)}">${esc(LEGAL_CONTACT.email)}</a>.</p></section>`:'';
  return `<main class="page legal-page"><a class="quiet-button back-link" href="${esc(destination)}">${backIcon} ${backLabel}</a><header class="legal-heading"><h1 tabindex="-1">${page.title}</h1><p>Updated <time datetime="${LEGAL_VERSION}">4 November 2026</time></p></header><p class="legal-intro">${page.intro}</p><div class="legal-copy">${page.sections.map(section=>`<section class="legal-section"><h2>${section.title}</h2>${section.items?`<ul>${section.items.map(item=>`<li>${item}</li>`).join('')}</ul>`:''}${section.text||section.html?`<p>${section.html?withContext(section.html):section.text}</p>`:''}</section>`).join('')}${contact}</div><footer class="legal-footer">${policyLinks({current:kind,returnTo:destination})}</footer></main>`;
}
