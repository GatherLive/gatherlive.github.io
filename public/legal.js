// Keep these notices aligned with the service's actual data handling.
export const LEGAL_VERSION = '2026-11-03';
export const LEGAL_CONTACT = {name:'Gather',email:'gathercontact@proton.me',country:''};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const outside=(url,label)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const pages={
  terms:{
    title:'Terms and Conditions',
    intro:'Gather is a quiz and learning platform. By creating an account or joining a quiz, you agree to these terms.',
    sections:[
      {title:'Use responsibly',items:[
        'No illegal activity, fraud, scams, malware, spam or attempts to disrupt the service.',
        'No pornographic or sexually explicit (18+) content, sexual exploitation, harassment, hate or threats.',
        'Respect privacy and intellectual property. Only share content you have the right to use.'
      ],text:'These rules apply to names, quizzes, images, answers and chat.'},
      {title:'Accounts and access',text:'Keep your account secure. We may remove content, restrict access, or suspend or delete accounts for rule violations, safety or security risks, or legal requirements. Serious violations may result in immediate action. Chat access is optional and may be declined or revoked for misuse. You can delete your account from Account.'},
      {title:'Your content and quizzes',text:'You keep ownership of your content and allow us to store, process and display it to provide Gather. You are responsible for what you submit. Hosts are responsible for their quizzes, participant permissions and any prizes or rewards.'},
      {title:'Age and permission',text:'Use Gather only when you can legally agree to these terms, or with the parent, guardian or institutional authorisation required by law. Hosts must arrange any required permissions for children’s participation.'},
      {title:'Service and responsibility',text:'Gather is provided as available; uninterrupted access and the accuracy of user content are not guaranteed. We do not endorse user content or authorise unlawful activity. Users remain responsible for their own unlawful acts. These terms do not exclude our legal responsibilities or your mandatory rights.'},
      {title:'Privacy and updates',html:'Our <a href="#privacy">Privacy Policy</a> explains how information is handled. Updated terms will show a new date and apply going forward.'}
    ]
  },
  privacy:{
    title:'Privacy Policy',
    intro:'No ads, analytics trackers or data sales. We do not sell or rent personal information or share it for advertising. We process information needed to provide and secure Gather.',
    sections:[
      {title:'Information we use',text:'We keep information only to run Gather, provide and support the service you request, and keep it secure. This includes account emails and sign-in credentials, quizzes, uploaded images, participant names, answers, results, optional chat, chat access applications and messages you send us. Technical details, including IP addresses, support delivery, security and abuse prevention.'},
      {title:'Who can see it',text:'Hosts can view and download participant names, answers and results. Names, leaderboards, shared responses and chat may be visible to other participants. Choose a display name and avoid sharing sensitive information.'},
      {title:'Cookies, browser storage and learning',text:'We do not use advertising or analytics cookies. Essential browser storage supports sign-in, security and features you choose. Security providers may use essential cookies. Your browser stores sign-in sessions, your chosen name, reconnect details, cached quiz media, dismissed site announcements and learning progress. Learning progress stays on your device unless you enable account sync. Clearing site data removes local copies.'},
      {title:'Storage and deletion',text:'Room chat and host announcements clear when a quiz ends. Site announcements are separate and stay published until removed or expired. Chat applications contain your account ID, email and review status; pending applications expire after 90 days and reviewed applications after 30 days. Account deletion removes your application and chat access. Ended rooms and unsaved results expire after 15 minutes; unfinished rooms expire after 24 hours from creation. Saved quizzes, images and reports remain until deleted by their owner or through account deletion. Downloads kept by hosts are outside Gather’s control.'},
      {title:'Service providers',html:`${outside('https://supabase.com/privacy','Supabase')} provides account and saved-data services, ${outside('https://www.cloudflare.com/privacypolicy/','Cloudflare')} provides live-quiz hosting and security, and ${outside('https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement','GitHub Pages')} hosts the website. ${outside('https://proton.me/mail/privacy-policy','Proton Mail')} handles messages sent to our contact email. Providers may process network and device details, retain limited logs or backups, and process data in other countries.`},
      {title:'Your choices and rights',text:'You can join without an account, choose whether to sync learning progress, and delete your account in Account. Contact your quiz host about reports they keep. Depending on your location, you may request access, correction, deletion or restriction, object to processing, withdraw consent where applicable, or complain to your data-protection authority.'},
      {title:'Why we use information',text:'We use essential information to provide the service you request and protect it against misuse. Where required, our legal bases are providing that service, legitimate interests in security, legal obligations and consent. Updates to this policy show a new date.'}
    ]
  }
};
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
  return `<main class="page legal-page"><a class="quiet-button back-link" href="${esc(destination)}">${backIcon} ${backLabel}</a><header class="legal-heading"><h1 tabindex="-1">${page.title}</h1><p>Updated <time datetime="${LEGAL_VERSION}">3 November 2026</time></p></header><p class="legal-intro">${page.intro}</p><div class="legal-copy">${page.sections.map(section=>`<section class="legal-section"><h2>${section.title}</h2>${section.items?`<ul>${section.items.map(item=>`<li>${item}</li>`).join('')}</ul>`:''}${section.text||section.html?`<p>${section.html?withContext(section.html):section.text}</p>`:''}</section>`).join('')}${contact}</div><footer class="legal-footer">${policyLinks({current:kind,returnTo:destination})}</footer></main>`;
}
