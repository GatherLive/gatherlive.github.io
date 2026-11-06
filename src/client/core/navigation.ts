import {esc} from './dom.js';
import {icon} from './icons.js';
export function pageHeading(title,{href='#',backLabel='Home',action=''}={}){
 return `<div class="page-heading"><a class="quiet-button back-link heading-back" href="${esc(href)}" aria-label="Back to ${esc(backLabel)}" title="Back to ${esc(backLabel)}">${icon('back',18)}</a><h1 tabindex="-1">${esc(title)}</h1><div class="heading-actions">${action}</div></div>`;
}
