import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server.browser';
import Avatar from 'boring-avatars';
import type {AvatarProfile} from '../../../../shared/avatars/profile.js';

export function svg(profile: AvatarProfile) {
    const variant = profile.style.split(':')[1] as Parameters<typeof Avatar>[0]['variant'];
    return renderToStaticMarkup(createElement(Avatar, {
        name: profile.seed,
        variant,
        size: 128,
        ...(profile.palette ? {colors: profile.palette} : {})
    })) as string;
}
