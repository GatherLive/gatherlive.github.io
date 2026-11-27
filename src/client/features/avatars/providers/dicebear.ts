import {Avatar, OptionsDescriptor, Style} from '@dicebear/core';
import {get} from '@dicebear/styles';
import type {AvatarProfile} from '../../../../shared/avatars/profile.js';

interface StyleDefinition {
    colors?: Record<string, {values?: unknown[]} | {extends: string}>;
}

async function readStyle(name: string) {
    const definition = await get(name);
    if (!definition) throw new Error('Avatar style unavailable.');
    const style = new Style(definition);
    return {style, options: new OptionsDescriptor(style).toJSON(), definition: definition as StyleDefinition};
}

const styles = new Map<string, ReturnType<typeof readStyle>>();
function getStyle(name: string) {
    if (!styles.has(name)) styles.set(name, readStyle(name).catch(error => {
        styles.delete(name);
        throw error;
    }));
    return styles.get(name);
}

export async function describe(name: string) {
    const {options, definition} = await getStyle(name);
    const variants = Object.entries(options).flatMap(([key, option]) => {
        if (!key.endsWith('Variant') || option.type !== 'enum') return [];
        const probabilityKey = key.replace(/Variant$/, 'Probability');
        return [{key, values: option.values, probabilityKey: Object.hasOwn(options, probabilityKey) ? probabilityKey : ''}];
    });
    const colors = Object.entries(definition.colors ?? {}).flatMap(([name, color]) => {
        const key = name + 'Color';
        if (!Object.hasOwn(options, key) || key === 'backgroundColor') return [];
        const sample = ('values' in color ? color.values ?? [] : []).find(value => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value));
        return [{key, sample: typeof sample === 'string' ? sample : '#d2c6f3'}];
    });
    return {variants, colors};
}

export async function svg(profile: AvatarProfile, animated: boolean) {
    const {style, options} = await getStyle(profile.style.split(':')[1]);
    const appearance: Record<string, string | number | string[]> = {};
    for (const [key, value] of Object.entries(profile.details ?? {})) {
        if (!Object.hasOwn(options, key)) continue;
        const option = options[key];
        if (option.type === 'enum' && typeof value === 'string' && option.values.includes(value)) {
            appearance[key] = [value];
            const probability = key.replace(/Variant$/, 'Probability');
            if (Object.hasOwn(options, probability) && !Object.hasOwn(profile.details, probability)) appearance[probability] = 100;
        } else if (option.type === 'color' && typeof value === 'string') appearance[key] = [value];
        else if (option.type === 'number' && typeof value === 'number' && value >= option.min && value <= option.max) appearance[key] = value;
    }
    return new Avatar(style, {
        ...appearance,
        seed: profile.seed,
        size: 128,
        animation: animated,
        ...(animated ? {animationDelay: [0, 2]} : {}),
        ...(profile.background ? {backgroundColor: [profile.background]} : {})
    }).toString();
}
