const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
let nextMapId = 0;
let stylesheetReady;

function ensureStyles() {
  if (stylesheetReady) return stylesheetReady;
  stylesheetReady = new Promise(resolve => {
    const url = new URL('./learn-map.css', import.meta.url);
    if (new URL(import.meta.url).search) url.search = new URL(import.meta.url).search;
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === url.href);
    if (existing) { resolve(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url.href;
    link.onload = resolve;
    link.onerror = () => {
      // Keep the map bounded and usable even if its small local stylesheet fails.
      if (!document.getElementById('learn-map-fallback-style')) {
        const fallback = document.createElement('style');
        fallback.id = 'learn-map-fallback-style';
        fallback.textContent = '.learn-map-interactive{position:relative;overflow:hidden;min-height:260px;height:290px;background:#181c20;border:1px solid #353a40;border-radius:14px}.learn-map-canvas{display:block;width:100%;height:100%;touch-action:none}.learn-map-ocean{fill:#181c20}.learn-map-grid{fill:none;stroke:#45515b;stroke-width:.5}.learn-map-shape{fill:#343b40;stroke:#69717a;stroke-width:.7}.learn-map-country-selected{fill:#d2c6f3;stroke:#fff}.learn-map-label{fill:#fff;stroke:#181c20;paint-order:stroke}.learn-map-labels,.learn-map-selected-marker{pointer-events:none}.learn-map-marker-hit{fill:transparent}.learn-map-marker-dot{fill:#adb9c1}.learn-map-selected-ring{fill:none;stroke:#fff}.learn-map-selected-dot{fill:#d2c6f3;stroke:#302539}.learn-map-controls{position:absolute;top:8px;right:8px;display:flex;flex-direction:column;background:#181c20;border-radius:10px}.learn-map-control{width:44px;height:44px}.learn-map-hint,.learn-map-tooltip{display:none}.learn-map-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}';
        document.head.append(fallback);
      }
      resolve();
    };
    document.head.append(link);
  });
  return stylesheetReady;
}

function svgElement(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

function countryPoint(country) {
  return { x: (Number(country.lng) + 180) * MAP_WIDTH / 360, y: (90 - Number(country.lat)) * MAP_HEIGHT / 180 };
}

function primaryBounds(path = '') {
  let largest = null;
  const components = [];
  for (const part of path.split(/(?=M)/)) {
    const points = (part.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (points.length < 6) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, area = 0;
    const pairs = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
      const x = points[i], y = points[i + 1];
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      pairs.push([x, y]);
    }
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i], b = pairs[(i + 1) % pairs.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const result = { minX, minY, maxX, maxY, area: Math.abs(area / 2) };
    components.push(result);
    if (!largest || result.area > largest.area) largest = result;
  }
  if (largest) {
    // Group neighbouring islands while keeping distant overseas land and date-line
    // fragments from making a small country appear as a whole-world question.
    const focus = { ...largest };
    const pending = components.filter(part => part !== largest);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const part = pending[i];
        const gapX = Math.max(0, focus.minX - part.maxX, part.minX - focus.maxX);
        const gapY = Math.max(0, focus.minY - part.maxY, part.minY - focus.maxY);
        if (Math.hypot(gapX, gapY) > 16) continue;
        focus.minX = Math.min(focus.minX, part.minX); focus.maxX = Math.max(focus.maxX, part.maxX);
        focus.minY = Math.min(focus.minY, part.minY); focus.maxY = Math.max(focus.maxY, part.maxY);
        pending.splice(i, 1); expanded = true;
      }
    }
    largest.focus = focus;
  }
  return largest;
}

const controlIcon = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18 16 16 0 0 1 0-18Z"/>'
};

/** Preload the small local map stylesheet before rendering a learning page. */
export function prepareLearningMaps() { return ensureStyles(); }

/** An offline, labelled atlas or an unlabelled country question, using local SVG data. */
export function mountLearningMap(element, {
  world, countries, selectedCode = '', labels = true, allowSelect = true,
  focusSelection = false, onSelect = () => {}
} = {}) {
  if (!element || !world || !Array.isArray(world.features) || !Array.isArray(countries)) {
    throw new TypeError('The learning map needs an element, world data, and countries.');
  }
  void ensureStyles();
  const id = `learn-map-${++nextMapId}`;
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const geometryByCode = new Map(world.features.map(feature => [feature.code, feature]));
  const boundsByCode = new Map(world.features.map(feature => [feature.code, primaryBounds(feature.path)]));
  const pointsByCode = new Map(countries.map(country => [country.code, countryPoint(country)]));
  const listeners = [];
  const pointers = new Map();
  let destroyed = false, revealed = Boolean(labels), selected = '', frame = 0;
  let width = 1000, height = 500, baseWidth = 1000, baseHeight = 500;
  let centerX = 500, centerY = 250, zoom = 1;
  let dragMoved = false, gesture = null, initialFocusDone = false;
  const minZoom = 1, maxZoom = 32;

  element.replaceChildren();
  element.classList.add('learn-map-interactive');
  element.dataset.mapZoom = '1';
  const svg = svgElement('svg', { class: 'learn-map-canvas', tabindex: '0', role: 'group', 'aria-label': labels ? 'Interactive world map' : 'Interactive country question map', 'aria-describedby': `${id}-help` });
  const ocean = svgElement('rect', { class: 'learn-map-ocean', x: '-2000', y: '-1000', width: '5000', height: '2500' });
  const grid = svgElement('g', { class: 'learn-map-grid', 'aria-hidden': 'true' });
  for (const lat of [-60, -30, 0, 30, 60]) {
    const y = (90 - lat) * MAP_HEIGHT / 180;
    grid.append(svgElement('path', { d: `M0 ${y}H1000`, 'vector-effect': 'non-scaling-stroke' }));
  }
  for (const lng of [-120, -60, 0, 60, 120]) {
    const x = (lng + 180) * MAP_WIDTH / 360;
    grid.append(svgElement('path', { d: `M${x} 0V500`, 'vector-effect': 'non-scaling-stroke' }));
  }
  const shapes = svgElement('g', { class: 'learn-map-shapes' });
  const shapeNodes = new Map();
  for (const feature of world.features) {
    const node = svgElement('path', { d: feature.path, class: 'learn-map-shape', 'data-country': feature.code, 'vector-effect': 'non-scaling-stroke' });
    if (!countryByCode.has(feature.code)) node.classList.add('learn-map-context');
    shapeNodes.set(feature.code, node);
    shapes.append(node);
  }
  const markerLayer = svgElement('g', { class: 'learn-map-markers' });
  const markers = new Map();
  for (const country of countries) {
    const bounds = boundsByCode.get(country.code);
    if (bounds && Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) > 5) continue;
    const point = pointsByCode.get(country.code);
    const marker = svgElement('g', { class: 'learn-map-marker', 'data-country': country.code, transform: `translate(${point.x} ${point.y})` });
    marker.append(svgElement('circle', { class: 'learn-map-marker-hit', r: '9' }), svgElement('circle', { class: 'learn-map-marker-dot', r: '2.5', 'vector-effect': 'non-scaling-stroke' }));
    markers.set(country.code, marker);
    markerLayer.append(marker);
  }
  const selectedRing = svgElement('g', { class: 'learn-map-selected-marker', 'aria-hidden': 'true', display: 'none' });
  selectedRing.append(svgElement('circle', { class: 'learn-map-selected-ring', r: '9', 'vector-effect': 'non-scaling-stroke' }), svgElement('circle', { class: 'learn-map-selected-dot', r: '3', 'vector-effect': 'non-scaling-stroke' }));
  const labelLayer = svgElement('g', { class: 'learn-map-labels', 'aria-hidden': 'true' });
  const labelsByCode = new Map();
  svg.append(ocean, grid, shapes, markerLayer, selectedRing, labelLayer);

  const controls = document.createElement('div');
  controls.className = 'learn-map-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Map controls');
  for (const [action, label] of [['plus', 'Zoom in'], ['minus', 'Zoom out'], ['world', 'Show world']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'learn-map-control';
    button.dataset.mapAction = action;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${controlIcon[action]}</svg>`;
    controls.append(button);
  }
  const help = document.createElement('span');
  help.id = `${id}-help`;
  help.className = 'learn-map-sr';
  help.textContent = 'Drag to explore. Pinch or use the plus and minus buttons to zoom. Use arrow keys to move the map and Home to show the world.';
  const hint = document.createElement('span');
  hint.className = 'learn-map-hint';
  hint.textContent = 'Drag to explore · Pinch to zoom';
  hint.setAttribute('aria-hidden', 'true');
  const tooltip = document.createElement('span');
  tooltip.className = 'learn-map-tooltip';
  tooltip.hidden = true;
  const status = document.createElement('span');
  status.className = 'learn-map-sr';
  status.setAttribute('role', 'status');
  element.append(svg, controls, hint, tooltip, help, status);

  function listen(node, type, listener, options) {
    node.addEventListener(type, listener, options);
    listeners.push(() => node.removeEventListener(type, listener, options));
  }
  function view() {
    return { x: centerX - baseWidth / zoom / 2, y: centerY - baseHeight / zoom / 2, w: baseWidth / zoom, h: baseHeight / zoom };
  }
  function contain() {
    const halfW = baseWidth / zoom / 2, halfH = baseHeight / zoom / 2;
    centerX = Math.max(-halfW * .2, Math.min(1000 + halfW * .2, centerX));
    centerY = Math.max(-halfH * .2, Math.min(500 + halfH * .2, centerY));
    if (baseWidth / zoom >= 1000) centerX = 500;
    if (baseHeight / zoom >= 500) centerY = 250;
  }
  function pointAt(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const current = view();
    return { x: current.x + (clientX - rect.left) / Math.max(rect.width, 1) * current.w, y: current.y + (clientY - rect.top) / Math.max(rect.height, 1) * current.h };
  }
  function screenPoint(point) {
    const current = view();
    return { x: (point.x - current.x) / current.w * width, y: (point.y - current.y) / current.h * height };
  }
  function updateLabels() {
    if (!revealed) {
      labelLayer.replaceChildren(); labelsByCode.clear();
      for (const node of shapeNodes.values()) node.removeAttribute('aria-label');
      for (const node of markers.values()) node.removeAttribute('aria-label');
      return;
    }
    const ordered = [...countries].sort((a, b) => {
      if (a.code === selected) return -1;
      if (b.code === selected) return 1;
      const areaA = boundsByCode.get(a.code)?.area || 0;
      const areaB = boundsByCode.get(b.code)?.area || 0;
      return areaB - areaA;
    });
    const occupied = [];
    const current = view();
    const textScale = current.w / Math.max(width, 1);
    for (const country of ordered) {
      const point = pointsByCode.get(country.code), screen = screenPoint(point);
      const text = country.name;
      const labelWidth = Math.min(210, text.length * 5.6 + 12), labelHeight = 18;
      const box = { x: screen.x - labelWidth / 2, y: screen.y - 10 - (country.code === selected ? 18 : 0), w: labelWidth, h: labelHeight };
      const outside = box.x + box.w < 0 || box.x > width || box.y + box.h < 0 || box.y > height;
      const collides = occupied.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y);
      let node = labelsByCode.get(country.code);
      if (outside || (collides && country.code !== selected)) {
        if (node) node.setAttribute('display', 'none');
        continue;
      }
      occupied.push(box);
      if (!node) {
        node = svgElement('text', { class: 'learn-map-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'data-country': country.code });
        node.textContent = text;
        labelsByCode.set(country.code, node);
        labelLayer.append(node);
      }
      node.removeAttribute('display');
      node.setAttribute('x', point.x);
      node.setAttribute('y', point.y - (country.code === selected ? 18 : 0) * textScale);
      node.setAttribute('font-size', 11 * textScale);
      node.setAttribute('stroke-width', 3 * textScale);
      node.classList.toggle('learn-map-label-selected', country.code === selected);
    }
    for (const country of countries) {
      const shape = shapeNodes.get(country.code), marker = markers.get(country.code);
      shape?.setAttribute('aria-label', country.name);
      marker?.setAttribute('aria-label', country.name);
    }
  }
  function paint() {
    frame = 0;
    if (destroyed) return;
    contain();
    const current = view();
    svg.setAttribute('viewBox', `${current.x} ${current.y} ${current.w} ${current.h}`);
    element.dataset.mapZoom = zoom.toFixed(2);
    const screenUnit = current.w / Math.max(width, 1);
    for (const marker of markers.values()) {
      marker.children[0].setAttribute('r', 11 * screenUnit);
      marker.children[1].setAttribute('r', 2.7 * screenUnit);
    }
    if (selected) {
      const point = pointsByCode.get(selected);
      selectedRing.setAttribute('transform', `translate(${point.x} ${point.y})`);
      selectedRing.children[0].setAttribute('r', 9 * screenUnit);
      selectedRing.children[1].setAttribute('r', 3 * screenUnit);
    }
    controls.querySelector('[data-map-action="plus"]').disabled = zoom >= maxZoom;
    controls.querySelector('[data-map-action="minus"]').disabled = zoom <= minZoom;
    updateLabels();
  }
  function schedulePaint() {
    if (!frame && !destroyed) frame = requestAnimationFrame(paint);
  }
  function setZoom(value, anchor) {
    const before = anchor ? pointAt(anchor.x, anchor.y) : { x: centerX, y: centerY };
    const oldZoom = zoom;
    zoom = Math.min(maxZoom, Math.max(minZoom, value));
    if (anchor && oldZoom !== zoom) {
      const after = pointAt(anchor.x, anchor.y);
      centerX += before.x - after.x;
      centerY += before.y - after.y;
    }
    schedulePaint();
  }
  function showWorld() {
    centerX = 500; centerY = 250; zoom = 1;
    schedulePaint();
  }
  function focusCountry(code) {
    const country = countryByCode.get(code);
    if (!country) return;
    const point = pointsByCode.get(code), rawBounds = boundsByCode.get(code);
    const bounds = rawBounds?.focus || rawBounds;
    if (bounds) {
      const spanX = Math.max(18, bounds.maxX - bounds.minX);
      const spanY = Math.max(18, bounds.maxY - bounds.minY);
      centerX = (bounds.minX + bounds.maxX) / 2;
      centerY = (bounds.minY + bounds.maxY) / 2;
      zoom = Math.min(18, Math.max(1.35, Math.min(baseWidth / (spanX * 2.15), baseHeight / (spanY * 2.15))));
      // Keep the country marker visible when the main landmass crosses the date line.
      if (Math.abs(point.x - centerX) < 150 && Math.abs(point.y - centerY) < 100) {
        centerX = centerX * .8 + point.x * .2;
        centerY = centerY * .8 + point.y * .2;
      }
    } else {
      centerX = point.x; centerY = point.y; zoom = 12;
    }
    schedulePaint();
  }
  function setSelection(code, { focus = false } = {}) {
    const valid = countryByCode.has(code) ? code : '';
    if (selected) {
      shapeNodes.get(selected)?.classList.remove('learn-map-country-selected');
      markers.get(selected)?.classList.remove('learn-map-country-selected');
    }
    selected = valid;
    element.dataset.selectedCountry = valid;
    element.classList.toggle('learn-map-has-selection', Boolean(valid));
    if (valid) {
      shapeNodes.get(valid)?.classList.add('learn-map-country-selected');
      markers.get(valid)?.classList.add('learn-map-country-selected');
      selectedRing.removeAttribute('display');
    } else selectedRing.setAttribute('display', 'none');
    if (revealed) status.textContent = valid ? `${countryByCode.get(valid).name} selected` : '';
    else status.textContent = valid ? 'The highlighted country is selected.' : '';
    if (focus && valid) focusCountry(valid);
    else schedulePaint();
  }
  function setRevealed(value = true) {
    revealed = Boolean(value);
    svg.setAttribute('aria-label', revealed ? 'Interactive world map' : 'Interactive country question map');
    tooltip.hidden = true;
    if (!revealed) updateLabels();
    status.textContent = revealed && selected ? `${countryByCode.get(selected).name} selected` : '';
    schedulePaint();
  }
  function resize() {
    if (destroyed) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    const ratio = width / height;
    if (ratio >= 2) { baseWidth = MAP_HEIGHT * ratio; baseHeight = MAP_HEIGHT; }
    else { baseWidth = MAP_WIDTH; baseHeight = MAP_WIDTH / ratio; }
    if (focusSelection && !initialFocusDone && selected) {
      initialFocusDone = true; focusCountry(selected);
    } else schedulePaint();
  }
  function countryFromTarget(target) {
    return target instanceof Element ? target.closest('[data-country]')?.getAttribute('data-country') || '' : '';
  }
  function startGesture() {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const a = points[0], b = points[1];
      gesture = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), zoom, centerX, centerY, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    } else if (points.length === 1) {
      gesture = { kind: 'pan', x: points[0].x, y: points[0].y, centerX, centerY };
    } else gesture = null;
  }
  listen(svg, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) { dragMoved = false; svg.classList.add('learn-map-dragging'); }
    else dragMoved = true;
    try { svg.setPointerCapture(event.pointerId); } catch {}
    startGesture();
    tooltip.hidden = true;
  });
  listen(svg, 'pointermove', event => {
    if (!pointers.has(event.pointerId)) {
      if (!revealed || event.pointerType === 'touch') return;
      const code = countryFromTarget(event.target), country = countryByCode.get(code);
      if (!country) { tooltip.hidden = true; return; }
      tooltip.textContent = country.name;
      const rect = element.getBoundingClientRect();
      tooltip.style.left = `${Math.max(7, Math.min(rect.width - 120, event.clientX - rect.left + 12))}px`;
      tooltip.style.top = `${Math.max(7, event.clientY - rect.top - 38)}px`;
      tooltip.hidden = false;
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    const points = [...pointers.values()];
    if (points.length >= 2 && gesture.kind === 'pinch') {
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = Math.max(.1, distance / Math.max(gesture.distance, 1));
      const rect = svg.getBoundingClientRect();
      const anchorX = gesture.centerX + (gesture.mid.x - rect.left - width / 2) * baseWidth / gesture.zoom / width;
      const anchorY = gesture.centerY + (gesture.mid.y - rect.top - height / 2) * baseHeight / gesture.zoom / height;
      zoom = Math.min(maxZoom, Math.max(minZoom, gesture.zoom * factor));
      centerX = anchorX - (mid.x - rect.left - width / 2) * baseWidth / zoom / width;
      centerY = anchorY - (mid.y - rect.top - height / 2) * baseHeight / zoom / height;
      dragMoved = true;
    } else if (gesture.kind === 'pan') {
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (Math.hypot(dx, dy) > 5) dragMoved = true;
      centerX = gesture.centerX - dx * baseWidth / zoom / width;
      centerY = gesture.centerY - dy * baseHeight / zoom / height;
    }
    schedulePaint();
  });
  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    startGesture();
    if (!pointers.size) svg.classList.remove('learn-map-dragging');
  }
  listen(svg, 'pointerup', finishPointer);
  listen(svg, 'pointercancel', event => { dragMoved = true; finishPointer(event); });
  listen(svg, 'lostpointercapture', finishPointer);
  listen(svg, 'pointerleave', () => { tooltip.hidden = true; });
  listen(svg, 'click', event => {
    if (dragMoved || !allowSelect || !revealed) return;
    // Pointer capture may retarget clicks to the SVG; hit-test the released position.
    const target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
    const code = countryFromTarget(target);
    if (!countryByCode.has(code)) return;
    setSelection(code);
    onSelect(code);
  });
  listen(svg, 'wheel', event => {
    event.preventDefault();
    setZoom(zoom * Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * .0035), { x: event.clientX, y: event.clientY });
  }, { passive: false });
  listen(svg, 'dblclick', event => {
    event.preventDefault();
    setZoom(zoom * 1.6, { x: event.clientX, y: event.clientY });
  });
  listen(svg, 'keydown', event => {
    const stepX = baseWidth / zoom * .12, stepY = baseHeight / zoom * .12;
    if (event.key === '+' || event.key === '=') setZoom(zoom * 1.5);
    else if (event.key === '-') setZoom(zoom / 1.5);
    else if (event.key === 'Home' || event.key === '0') showWorld();
    else if (event.key === 'ArrowLeft') { centerX -= stepX; schedulePaint(); }
    else if (event.key === 'ArrowRight') { centerX += stepX; schedulePaint(); }
    else if (event.key === 'ArrowUp') { centerY -= stepY; schedulePaint(); }
    else if (event.key === 'ArrowDown') { centerY += stepY; schedulePaint(); }
    else return;
    event.preventDefault();
  });
  listen(controls, 'click', event => {
    const action = event.target.closest('[data-map-action]')?.dataset.mapAction;
    if (action === 'plus') setZoom(zoom * 1.5);
    if (action === 'minus') setZoom(zoom / 1.5);
    if (action === 'world') showWorld();
  });
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(element);
  if (!observer) listen(window, 'resize', resize);
  setSelection(selectedCode);
  resize();
  ensureStyles().then(() => { if (!destroyed) resize(); });

  return {
    setSelection,
    setRevealed,
    showWorld,
    resize,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const remove of listeners) remove();
      for (const pointerId of pointers.keys()) { try { svg.releasePointerCapture(pointerId); } catch {} }
      pointers.clear();
      element.replaceChildren();
      element.classList.remove('learn-map-interactive', 'learn-map-has-selection');
      delete element.dataset.mapZoom;
      delete element.dataset.selectedCountry;
    }
  };
}
