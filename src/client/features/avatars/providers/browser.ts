export {AVATAR_STYLES, normalizeAvatar} from '../../../../shared/avatars/profile.js';

// Each family and each DiceBear style is a lazy same-origin browser module.
export const loadDiceBear = () => import('./dicebear.js');
export const loadMultiavatar = () => import('./multiavatar.js');
export const loadBoringAvatars = () => import('./boring.js');
