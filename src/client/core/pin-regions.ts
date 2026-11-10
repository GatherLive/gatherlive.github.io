import type {AnswerRegion, Point, Question} from '../../shared/types.js';

/** Pure image geometry, also used by authoritative server scoring. */
export function validPinRegion(value: unknown): value is AnswerRegion {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const region = value as AnswerRegion;
    return ['circle', 'box'].includes(region.shape) &&
        [region.x, region.y, region.width, region.height].every(number => typeof number === 'number' && Number.isFinite(number)) &&
        region.x >= 0 && region.x <= 1 && region.y >= 0 && region.y <= 1 &&
        region.width >= .001 && region.width <= 3 && region.height >= .001 && region.height <= 3;
}

export function pinRegion(question: Pick<Question, 'target' | 'tolerance' | 'answerRegion'>): AnswerRegion {
    if (validPinRegion(question.answerRegion)) return {...question.answerRegion};
    const point = question.target && typeof question.target === 'object' ? question.target : {x: .5, y: .5};
    const radius = Math.max(.001, Math.min(1.5, question.tolerance ?? .1));
    return {shape: 'circle', x: point.x, y: point.y, width: radius * 2, height: radius * 2};
}

export function pinInside(region: AnswerRegion, point: Point): boolean {
    const x = (point.x - region.x) / (region.width / 2), y = (point.y - region.y) / (region.height / 2);
    const epsilon = 1e-10;
    return region.shape === 'box' ? Math.abs(x) <= 1 + epsilon && Math.abs(y) <= 1 + epsilon : x * x + y * y <= 1 + epsilon;
}

export function pinRegionSvg(question: Pick<Question, 'target' | 'tolerance' | 'answerRegion'>): string {
    const region = pinRegion(question), n = (value: number) => Math.round(value * 100000) / 100;
    const paint = 'fill="#d3e7b8" fill-opacity=".18" stroke="#d3e7b8" stroke-width="2" vector-effect="non-scaling-stroke"';
    const shape = region.shape === 'box'
        ? `<rect x="${n(region.x - region.width / 2)}" y="${n(region.y - region.height / 2)}" width="${n(region.width)}" height="${n(region.height)}" ${paint}/>`
        : `<ellipse cx="${n(region.x)}" cy="${n(region.y)}" rx="${n(region.width / 2)}" ry="${n(region.height / 2)}" ${paint}/>`;
    return `<svg class="pin-region" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${shape}</svg>`;
}

export function pinRegionDot(question: Pick<Question, 'target' | 'tolerance' | 'answerRegion'>, editable = false): string {
    const region = pinRegion(question);
    return `<span class="pin-dot target${editable ? ' pin-region-target' : ''}" ${editable ? 'data-pin-move' : ''} style="left:${region.x * 100}%;top:${region.y * 100}%" role="img" aria-label="Correct location"></span>`;
}
