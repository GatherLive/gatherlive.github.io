// Short notices must continue to describe the service's actual behavior.
export const LEGAL_VERSION = '2026-11-04';
export const LEGAL_CONTACT = { name: 'Gather', email: 'gathercontact@proton.me', country: '' };
export const POLICIES = {
  terms: {
    title: 'Terms and Conditions',
    intro: 'Gather is an open-source quiz and learning app.',
    sections: [
      { title: 'Acceptance of use', text: 'By using Gather, you accept these terms. Get a parent’s or guardian’s permission when required by law.' },
      { title: 'Prohibited use', text: 'No illegal activity, explicit sexual (18+) content, harassment, scams, spam or disruption. Respect privacy and others’ rights. We may remove content, restrict access or delete accounts for misuse.' },
      { title: 'Your responsibility', text: 'You are responsible for what you upload, share and do. Hosts handle participant permissions and rewards. We do not endorse user content and, where the law allows, are not liable for users’ misuse.' },
      { title: 'Provided as is', text: 'Gather is provided “as is” and “as available”, without warranty of any kind, to the extent permitted by law. These terms do not exclude rights or responsibilities that the law protects.' }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'We use information only to run and secure Gather. No ads, analytics trackers or data sales.',
    sections: [
      { title: 'Information used', text: 'Account details, quizzes, images, participant names, answers, results, chat and access requests support the service. Hosts can view and download participant results; shared names, responses and chat may be visible to others.' },
      { title: 'On your device', text: 'Essential storage keeps sign-in, reconnect details, preferences and learning progress. Progress stays on your device unless you enable sync. No advertising or analytics cookies; security services may use essential cookies.' },
      { title: 'Storage and deletion', text: 'Chat clears when a quiz ends. Unsaved results expire after 15 minutes; unfinished rooms after 24 hours. Pending access requests expire after 90 days and reviewed requests after 30 days. Saved data stays until deleted. Delete your account in Account; host downloads remain outside our control.' },
      { title: 'Providers and your choices', text: 'Supabase stores accounts and saved data, Cloudflare runs live quizzes and security, GitHub Pages hosts the site, and Proton Mail handles contact emails. Providers may process technical details, backups and data in other countries. You can request access, correction or deletion of your information.' }
    ]
  }
};
