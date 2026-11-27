// Keep the room payload independent of the browser rendering libraries.
const diceBearStyles = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral', 'big-ears', 'big-ears-neutral',
    'big-smile', 'blobs', 'bottts', 'bottts-neutral', 'cameo', 'cats', 'clay', 'constellation', 'critters',
    'croodles', 'croodles-neutral', 'cutouts', 'disco', 'dogs', 'dylan', 'fun-emoji', 'gaze', 'glass',
    'glyphs', 'icons', 'identicon', 'initial-face', 'initials', 'landscape', 'line-face', 'loops',
    'lorelei', 'lorelei-neutral', 'marbles', 'micah', 'miniavs', 'moods', 'notionists', 'notionists-neutral',
    'open-peeps', 'patchwork', 'personas', 'pixel-art', 'pixel-art-neutral', 'pixelbot', 'planets', 'rings',
    'shadows', 'shape-grid', 'shapes', 'slice', 'sprouts', 'squircles', 'stack', 'stripes', 'thumbs',
    'toon-head', 'triangles', 'voxel-art', 'voxel-bot', 'waves', 'weave'
] as const;

export const AVATAR_STYLES = {
    dicebear: diceBearStyles,
    multiavatar: ['people'],
    boring: ['bauhaus', 'beam', 'marble', 'pixel', 'ring', 'sunset']
} as const;

export type AvatarFamily = keyof typeof AVATAR_STYLES;
type AvatarFlip = 'horizontal' | 'vertical' | 'both';

export interface AvatarProfile {
    style: string;
    seed: string;
    background?: string;
    flip?: AvatarFlip;
    rotation?: number;
    zoom?: number;
    preset?: number;
    palette?: string[];
    details?: Record<string, string | number>;
}

const avatarStyles = new Set(Object.entries(AVATAR_STYLES).flatMap(([family, styles]) =>
    styles.map(style => `${family}:${style}`)));
const profileFields = new Set(['style', 'seed', 'background', 'flip', 'rotation', 'zoom', 'preset', 'palette', 'details']);
const colorPattern = /^#[a-f\d]{6}$/i;
const detailField = /^[a-z][a-z\d]{0,30}(?:Variant|Color|Probability)$/i;
const variantName = /^[a-z\d][a-z\d_-]{0,31}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function normalizeAvatar(raw: unknown): AvatarProfile | null {
    if (!isObject(raw) || Object.keys(raw).some(key => !profileFields.has(key))) return null;
    const {style, seed, background, flip, rotation, zoom, preset, palette, details} = raw;
    if (typeof style !== 'string' || !avatarStyles.has(style) || typeof seed !== 'string' || !/^[a-f\d]{32}$/.test(seed)) return null;
    const profile: AvatarProfile = {style, seed};
    if (background !== undefined) {
        if (typeof background !== 'string' || !colorPattern.test(background)) return null;
        profile.background = background.toLowerCase();
    }
    if (flip !== undefined) {
        if (flip !== 'horizontal' && flip !== 'vertical' && flip !== 'both') return null;
        profile.flip = flip;
    }
    if (rotation !== undefined) {
        if (!boundedInteger(rotation, -180, 180)) return null;
        if (rotation !== 0) profile.rotation = rotation;
    }
    if (zoom !== undefined) {
        if (!boundedInteger(zoom, 60, 150)) return null;
        if (zoom !== 100) profile.zoom = zoom;
    }
    if (preset !== undefined) {
        if (style !== 'multiavatar:people' || !boundedInteger(preset, 0, 47)) return null;
        profile.preset = preset;
    }
    if (palette !== undefined) {
        if (!style.startsWith('boring:') || !Array.isArray(palette) || palette.length !== 5
            || !palette.every(color => typeof color === 'string' && colorPattern.test(color))) return null;
        profile.palette = palette.map(color => color.toLowerCase());
    }
    if (details !== undefined) {
        if (!style.startsWith('dicebear:') || !isObject(details)) return null;
        const fields = Object.keys(details).sort();
        if (fields.length > 40) return null;
        const options: AvatarProfile['details'] = {};
        for (const key of fields) {
            const value = details[key];
            if (!detailField.test(key)) return null;
            if (key.endsWith('Variant') && typeof value === 'string' && variantName.test(value)) options[key] = value;
            else if (key.endsWith('Color') && typeof value === 'string' && colorPattern.test(value)) options[key] = value.toLowerCase();
            else if (key.endsWith('Probability') && boundedInteger(value, 0, 100)) options[key] = value;
            else return null;
        }
        if (fields.length) profile.details = options;
    }
    return JSON.stringify(profile).length <= 1500 ? profile : null;
}
