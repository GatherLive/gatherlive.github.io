// Pointer-based reordering also works on touchscreens, without native HTML drag.
export class ReorderLists {
  constructor({move,allowed=()=>true}) {
    this.move=move;this.allowed=allowed;this.active=null;this.frame=null;
    document.addEventListener('pointerdown',event=>this.start(event));
    document.addEventListener('pointermove',event=>this.update(event),{passive:false});
    document.addEventListener('pointerup',event=>this.finish(event));
    document.addEventListener('pointercancel',event=>{if(event.pointerId===this.active?.pointerId)this.cancel();});
    document.addEventListener('lostpointercapture',event=>{if(event.pointerId===this.active?.pointerId)this.cancel();});
    document.addEventListener('keydown',event=>this.key(event));
  }
  items(list){return [...list.querySelectorAll(':scope > [data-reorder-item]')];}
  start(event) {
    if(!event.isPrimary||event.button!==0)return;
    const handle=event.target.closest('[data-reorder-handle]');if(!handle||handle.disabled)return;
    const row=handle.closest('[data-reorder-item]'),list=row?.parentElement,kind=list?.dataset.reorderList;
    if(!row||!kind||!this.allowed(kind))return;
    const items=this.items(list);if(items.length<2)return;
    this.cancel();event.preventDefault();handle.focus({preventScroll:true});
    const rect=row.getBoundingClientRect(),first=items[0].getBoundingClientRect(),second=items[1].getBoundingClientRect();
    const horizontal=Math.abs(second.left-first.left)>Math.abs(second.top-first.top);
    this.active={handle,row,list,kind,items,from:items.indexOf(row),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,rect,horizontal,ghost:null};
    // Keep capture on the list: the dragged row moves within the DOM.
    try{list.setPointerCapture(event.pointerId);}catch{this.cancel();}
  }
  update(event) {
    const active=this.active;if(!active||event.pointerId!==active.pointerId)return;
    if(!active.row.isConnected||!this.allowed(active.kind)){this.cancel();return;}
    event.preventDefault();active.x=event.clientX;active.y=event.clientY;
    if(!active.ghost&&Math.hypot(active.x-active.startX,active.y-active.startY)<5)return;
    if(!active.ghost){
      const ghost=active.row.cloneNode(true);ghost.classList.add('reorder-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
      ghost.removeAttribute('id');for(const item of ghost.querySelectorAll('[id]'))item.removeAttribute('id');
      Object.assign(ghost.style,{width:active.rect.width+'px',height:active.rect.height+'px'});
      document.body.append(ghost);active.ghost=ghost;active.row.classList.add('reorder-placeholder');document.body.classList.add('is-reordering');
    }
    this.schedule();
  }
  schedule(){if(this.frame===null)this.frame=requestAnimationFrame(()=>{this.frame=null;this.paint();});}
  paint() {
    const active=this.active;if(!active?.ghost)return;
    if(!active.row.isConnected||!this.allowed(active.kind)){this.cancel();return;}
    active.ghost.style.transform=`translate3d(${active.x-active.offsetX}px,${active.y-active.offsetY}px,0)`;
    const coordinate=active.horizontal?active.x:active.y;
    const before=this.items(active.list).find(item=>{
      if(item===active.row)return false;
      const rect=item.getBoundingClientRect();return coordinate<(active.horizontal?rect.left+rect.width/2:rect.top+rect.height/2);
    });
    if(before){if(active.row.nextElementSibling!==before)active.list.insertBefore(active.row,before);}
    else if(active.row.nextElementSibling)active.list.append(active.row);
    if(this.scroll(active))this.schedule();
  }
  scroll(active) {
    const axis=active.horizontal?'X':'Y';let scroller=active.list;
    while(scroller!==document.body){
      const style=getComputedStyle(scroller),overflow=axis==='X'?style.overflowX:style.overflowY;
      if(/auto|scroll/.test(overflow)&&(axis==='X'?scroller.scrollWidth>scroller.clientWidth:scroller.scrollHeight>scroller.clientHeight))break;
      scroller=scroller.parentElement;if(!scroller)return false;
    }
    const page=scroller===document.body,element=page?document.scrollingElement:scroller;
    const rect=page?{left:0,top:0,right:innerWidth,bottom:innerHeight}:scroller.getBoundingClientRect();
    const coordinate=axis==='X'?active.x:active.y,start=Math.max(0,axis==='X'?rect.left:rect.top),end=Math.min(axis==='X'?innerWidth:innerHeight,axis==='X'?rect.right:rect.bottom);
    const delta=coordinate<start+32?-Math.min(14,(start+32-coordinate)*.45):coordinate>end-32?Math.min(14,(coordinate-end+32)*.45):0;
    const key=axis==='X'?'scrollLeft':'scrollTop',previous=element[key];if(delta)element[key]+=delta;
    return previous!==element[key];
  }
  finish(event) {
    const active=this.active;if(!active||event.pointerId!==active.pointerId)return;
    active.x=event.clientX;active.y=event.clientY;if(active.ghost)this.paint();
    if(this.active!==active)return;
    const to=this.items(active.list).indexOf(active.row),changed=!!active.ghost&&to!==active.from&&this.allowed(active.kind);
    this.clear(!changed);
    if(changed)this.move(active.kind,active.row.dataset.reorderItem,to);
  }
  clear(restore) {
    const active=this.active;this.active=null;
    if(this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}
    if(!active)return;
    active.ghost?.remove();active.row.classList.remove('reorder-placeholder');document.body.classList.remove('is-reordering');
    if(restore&&active.list.isConnected)for(const row of active.items)active.list.append(row);
    try{if(active.list.hasPointerCapture(active.pointerId))active.list.releasePointerCapture(active.pointerId);}catch{}
  }
  cancel(){this.clear(true);}
  key(event) {
    if(event.key==='Escape'&&this.active){event.preventDefault();this.cancel();return;}
    const handle=event.target.closest('[data-reorder-handle]');if(!handle||handle.disabled||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const row=handle.closest('[data-reorder-item]'),list=row?.parentElement,kind=list?.dataset.reorderList;if(!kind||!this.allowed(kind))return;
    event.preventDefault();const items=this.items(list),from=items.indexOf(row),to=from+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1);
    if(to>=0&&to<items.length)this.move(kind,row.dataset.reorderItem,to);
  }
}
