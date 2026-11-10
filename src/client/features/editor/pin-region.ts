import type {AppContext} from '../../app/context.js';
import type {AnswerRegion, Point} from '../../../shared/types.js';
import {pinRegion, pinRegionDot, pinRegionSvg} from '../../core/pin-regions.js';
import {$, esc, safeImage} from '../../core/dom.js';

type Direction = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const handles: [Direction, number, number][] = [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createPinRegionEditor(context: AppContext) {
    const S = context.state;
    let drag: {id: number; element: HTMLElement; questionId: string; start: Point; original: AnswerRegion; mode: 'place' | 'move' | 'resize'; direction?: Direction; moved: boolean} | null = null;
    const question = () => S.draft?.questions[S.questionIndex];
    const size = (region: AnswerRegion) => Math.round(clamp(Math.max(region.width, region.height) * 100, 1, 100));
    const boundsStyle = (region: AnswerRegion) => `left:${(region.x - region.width / 2) * 100}%;top:${(region.y - region.height / 2) * 100}%;width:${region.width * 100}%;height:${region.height * 100}%`;

    function pinAreaEditor(q) {
        const image = safeImage(q.image), region = pinRegion(q);
        if (!image) return '<p class="pin-region-note">Add an image to place the correct dot.</p>';
        return `<div class="pin-area-controls"><span class="field-label">Accepted area</span><div class="pin-shapes" role="group" aria-label="Accepted area shape">${[['circle', 'Circle'], ['box', 'Box']].map(([shape, label]) => `<button type="button" data-pin-shape="${shape}" aria-pressed="${region.shape === shape}">${label}</button>`).join('')}</div></div><p class="pin-region-note">Tap to place the dot. Drag a handle to resize.</p><span id="pin-region-help" class="sr-only">The dot marks the correct location. Pins inside the area are accepted. Drag the dot or area to move it. Arrow keys move it; Shift and arrow keys resize it.</span><div class="pin-area pin-region-editor" id="editor-pin" tabindex="0" role="group" aria-label="Correct dot and accepted area" aria-describedby="pin-region-help"><img src="${esc(image)}" alt="Question image" draggable="false">${pinRegionSvg(q)}<div class="pin-region-controls" data-pin-region-controls data-shape="${region.shape}" style="${boundsStyle(region)}" aria-hidden="true"><span class="pin-region-move" data-pin-move></span>${handles.map(([direction, left, top]) => `<span class="pin-region-handle" data-pin-resize="${direction}" style="left:${left}%;top:${top}%" ${region.shape === 'circle' && direction.length === 1 ? 'hidden' : ''}></span>`).join('')}</div>${pinRegionDot(q, true)}</div><div class="pin-size-control"><label for="pin-area-size">Area size</label><div class="pin-size-slider"><button type="button" data-pin-size-step="-1" aria-label="Smaller accepted area" ${size(region) <= 1 ? 'disabled' : ''}>−</button><input id="pin-area-size" type="range" min="1" max="100" step="1" value="${size(region)}"><button type="button" data-pin-size-step="1" aria-label="Larger accepted area" ${size(region) >= 100 ? 'disabled' : ''}>+</button></div></div>`;
    }
    const coordinate = (event: PointerEvent, element: HTMLElement): Point => {
        const bounds = element.getBoundingClientRect();
        return {x: clamp((event.clientX - bounds.left) / (bounds.width || 1), 0, 1), y: clamp((event.clientY - bounds.top) / (bounds.height || 1), 0, 1)};
    };
    function update(region: AnswerRegion) {
        const q = question(), element = $('#editor-pin');
        if (!q || q.type !== 'pin' || !element) return;
        q.answerRegion = region;q.target = {x: region.x, y: region.y};
        const svg = element.querySelector('.pin-region');
        if (svg) svg.outerHTML = pinRegionSvg(q);
        const controls = element.querySelector<HTMLElement>('[data-pin-region-controls]');
        if (controls) {
            controls.style.cssText = boundsStyle(region);controls.dataset.shape = region.shape;
            controls.querySelectorAll<HTMLElement>('[data-pin-resize]').forEach(handle => handle.hidden = region.shape === 'circle' && handle.dataset.pinResize.length === 1);
        }
        const dot = element.querySelector<HTMLElement>('.pin-region-target');
        if (dot) {dot.style.left = region.x * 100 + '%';dot.style.top = region.y * 100 + '%';}
        const slider = $<HTMLInputElement>('#pin-area-size');if (slider) slider.value = String(size(region));
        document.querySelectorAll<HTMLButtonElement>('[data-pin-size-step]').forEach(button => button.disabled = Number(button.dataset.pinSizeStep) < 0 ? size(region) <= 1 : size(region) >= 100);
        document.querySelectorAll<HTMLButtonElement>('[data-pin-shape]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pinShape === region.shape)));
        context.markDirty();
    }
    function moved(region: AnswerRegion, point: Point): AnswerRegion {
        return {...region, x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1)};
    }
    function scaled(region: AnswerRegion, factor: number): AnswerRegion {
        const scale = clamp(factor, .001 / Math.min(region.width, region.height), 1 / Math.max(region.width, region.height));
        return {...region, width: region.width * scale, height: region.height * scale};
    }
    function resized(region: AnswerRegion, direction: Direction, dx: number, dy: number, element: HTMLElement): AnswerRegion {
        const x = direction.includes('w') ? -dx : direction.includes('e') ? dx : 0;
        const y = direction.includes('n') ? -dy : direction.includes('s') ? dy : 0;
        if (region.shape === 'circle') {
            const bounds = element.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return region;
            const deltaX = x * bounds.width, deltaY = y * bounds.height;
            const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
            const radius = clamp(Math.min(region.width * bounds.width, region.height * bounds.height) / 2 + delta, Math.max(bounds.width, bounds.height) * .0005, Math.min(bounds.width, bounds.height) / 2);
            return {...region, width: radius * 2 / bounds.width, height: radius * 2 / bounds.height};
        }
        return {...region, width: clamp(region.width + x * 2, .01, 1), height: clamp(region.height + y * 2, .01, 1)};
    }
    function pointerDown(event: PointerEvent) {
        const target = event.target instanceof Element ? event.target : null, element = target?.closest<HTMLElement>('#editor-pin'), q = question();
        if (!element || event.button !== 0 || !event.isPrimary || !q || q.type !== 'pin' || drag) return;
        event.preventDefault();element.focus({preventScroll: true});element.setPointerCapture(event.pointerId);
        const handle = target.closest<HTMLElement>('[data-pin-resize]'), mode = handle ? 'resize' : target.closest('[data-pin-move]') ? 'move' : 'place';
        drag = {id: event.pointerId, element, questionId: q.id, start: coordinate(event, element), original: pinRegion(q), mode, direction: handle?.dataset.pinResize as Direction, moved: false};
        if (mode === 'place') update(moved(drag.original, drag.start));
    }
    function pointerMove(event: PointerEvent) {
        if (!drag || drag.id !== event.pointerId || question()?.id !== drag.questionId) return;
        const end = coordinate(event, drag.element), dx = end.x - drag.start.x, dy = end.y - drag.start.y, bounds = drag.element.getBoundingClientRect();
        if (!drag.moved && Math.hypot(dx * bounds.width, dy * bounds.height) < 3) return;
        drag.moved = true;
        if (drag.mode === 'resize') update(resized(drag.original, drag.direction, dx, dy, drag.element));
        else update(moved(drag.original, drag.mode === 'place' ? end : {x: drag.original.x + dx, y: drag.original.y + dy}));
    }
    function pointerUp(event: PointerEvent) {
        if (!drag || drag.id !== event.pointerId) return;
        if (question()?.id === drag.questionId && !drag.moved && drag.mode !== 'resize') update(moved(drag.original, coordinate(event, drag.element)));
        if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
        drag = null;
    }
    function click(event: MouseEvent) {
        const target = event.target instanceof Element ? event.target : null, button = target?.closest<HTMLButtonElement>('[data-pin-shape],[data-pin-size-step]');
        const q = question(), element = $('#editor-pin');if (!button || button.disabled || !q || !element) return;
        const previous = pinRegion(q);
        if (button.dataset.pinSizeStep) {update(scaled(previous, clamp(size(previous) + Number(button.dataset.pinSizeStep) * 5, 1, 100) / (Math.max(previous.width, previous.height) * 100)));return;}
        const shape = button.dataset.pinShape === 'circle' ? 'circle' : 'box', bounds = element.getBoundingClientRect();
        let region: AnswerRegion = {...previous, shape};
        if (shape === 'circle' && bounds.width && bounds.height) {
            const radius = Math.min(previous.width * bounds.width, previous.height * bounds.height, bounds.width, bounds.height) / 2;
            region = {...region, width: radius * 2 / bounds.width, height: radius * 2 / bounds.height};
        }
        update(region);
    }
    function onSizeInput(event: Event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.id !== 'pin-area-size') return false;
        const q = question();if (!q || q.type !== 'pin') return false;
        const region = pinRegion(q);update(scaled(region, Number(input.value) / (Math.max(region.width, region.height) * 100)));return true;
    }
    function keyboard(event: KeyboardEvent) {
        if (!(event.target instanceof HTMLElement) || event.target.id !== 'editor-pin' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
        const q = question();if (!q) return false;event.preventDefault();
        const region = pinRegion(q), dx = event.key === 'ArrowLeft' ? -.01 : event.key === 'ArrowRight' ? .01 : 0, dy = event.key === 'ArrowUp' ? -.01 : event.key === 'ArrowDown' ? .01 : 0;
        update(event.shiftKey ? scaled(region, dx + dy < 0 ? .92 : 1.08) : moved(region, {x: region.x + dx, y: region.y + dy}));
        return true;
    }
    function bindPinRegionEditor() {
        document.addEventListener('pointerdown', pointerDown);document.addEventListener('pointermove', pointerMove);
        document.addEventListener('pointerup', pointerUp);document.addEventListener('pointercancel', () => {drag = null;});
        document.addEventListener('lostpointercapture', event => {if (drag?.id === event.pointerId) drag = null;});
    }
    return {pinAreaEditor, bindPinRegionEditor, clicks: [click], inputs: [onSizeInput], changes: [onSizeInput], keys: [keyboard]};
}
