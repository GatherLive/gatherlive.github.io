import multiavatar from '@multiavatar/multiavatar/esm';
import type {AvatarProfile} from '../../../../shared/avatars/profile.js';

const parts = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15'] as const;
const themes = ['A', 'B', 'C'] as const;

export function svg(profile: AvatarProfile) {
    const preset = profile.preset;
    const version = preset === undefined ? undefined : {
        part: parts[preset % parts.length],
        theme: themes[Math.floor(preset / parts.length)]
    };
    return multiavatar(profile.seed, Boolean(profile.background), version);
}
