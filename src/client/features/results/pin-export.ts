import {pinRegion} from '../../core/pin-regions.js';
import {safeImage} from '../../core/dom.js';

/** Embed the same marked area in portable reports, with bounded download and memory costs. */
export async function preparePinImages(blocks) {
  const pending = blocks.filter(block => block.pinQuestion), deadline = Date.now() + 20_000;
  let cursor = 0, used = 0;
  async function worker() {
    while (cursor < pending.length) {
      const block = pending[cursor++], q = block.pinQuestion, source = safeImage(q.image);
      if (!source || Date.now() >= deadline || used >= 12_000_000) continue;
      let url = '';
      try {
        if(source.startsWith('data:')){
          const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);
          if(!match||match[2].length>4_194_304)continue;
          const bytes=Uint8Array.from(atob(match[2]),character=>character.charCodeAt(0));
          url=URL.createObjectURL(new Blob([bytes],{type:match[1]}));
        }else{
          const response = await fetch(source, {signal: AbortSignal.timeout(Math.min(8000, Math.max(1, deadline - Date.now()))), referrerPolicy: 'no-referrer', credentials: 'omit'});
          if (!response.ok || Number(response.headers.get('Content-Length')) > 3_145_728 || !response.body) continue;
          const reader = response.body.getReader(), parts = [];let size = 0;
          while (true) {const {value, done} = await reader.read();if (done) break;size += value.length;if (size > 3_145_728) {await reader.cancel();throw new Error('Image too large.');}parts.push(value);}
          url = URL.createObjectURL(new Blob(parts));
        }
        const image = new Image();image.src = url;await image.decode();
        const scale = Math.min(1, 1100 / image.naturalWidth, 800 / image.naturalHeight), canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');ctx.fillStyle = '#151515';ctx.fillRect(0, 0, canvas.width, canvas.height);ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const region = pinRegion(q), x = region.x * canvas.width, y = region.y * canvas.height, width = region.width * canvas.width, height = region.height * canvas.height;
        ctx.beginPath();if (region.shape === 'circle') ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);else ctx.rect(x - width / 2, y - height / 2, width, height);
        ctx.fillStyle = '#d3e7b82e';ctx.fill();ctx.strokeStyle = '#d3e7b8';ctx.lineWidth = Math.max(2, canvas.width / 300);ctx.stroke();
        const radius = Math.max(4, Math.min(canvas.width, canvas.height) * .018);
        ctx.beginPath();ctx.arc(x, y, radius, 0, Math.PI * 2);ctx.fillStyle = '#d3e7b8';ctx.fill();ctx.strokeStyle = '#ffffff';ctx.lineWidth = Math.max(2, radius * .22);ctx.stroke();
        const data = canvas.toDataURL('image/jpeg', .92);
        if (used + data.length <= 12_000_000) {block.pinImage = data;used += data.length;}
      } catch {/* A missing external image must not prevent exporting the other results. */}
      finally {if (url) URL.revokeObjectURL(url);}
    }
  }
  await Promise.all(Array.from({length: Math.min(3, pending.length)}, worker));
}
