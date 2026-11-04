import {escapeHTML as esc,OPINION_TYPES} from './data.js';

/** Each pie uses one denominator: graded opportunities, or all answerable opportunities. */
export function overviewPies(data){
  const graded=data.questionStats.filter(q=>q.graded);
  return [
    {id:'accuracy',title:'Answer outcomes',items:[
      {key:'correct',label:'Correct',value:data.correct,tone:'correct'},
      {key:'incorrect',label:'Incorrect',value:data.incorrect,tone:'incorrect'},
      {key:'missed',label:'Missed',value:graded.reduce((sum,q)=>sum+q.missed,0),tone:'missed'}
    ],empty:graded.length?'No participants':'No graded questions'},
    {id:'participation',title:'Participation',items:[
      {key:'submitted',label:'Submitted',value:data.answered,tone:'submitted'},
      {key:'unanswered',label:'No response',value:data.missed,tone:'missed'}
    ],empty:'No responses yet'}
  ];
}

export function questionPie(stat){
  return {id:`question-${stat.q.number}`,title:stat.graded?'Answer outcomes':'Participation',items:stat.graded?[
    {key:'correct',label:'Correct',value:stat.correct,tone:'correct'},
    {key:'incorrect',label:'Incorrect',value:stat.incorrect,tone:'incorrect'},
    {key:'missed',label:'Missed',value:stat.missed,tone:'missed'}
  ]:[
    {key:'submitted',label:'Submitted',value:stat.answered,tone:'submitted'},
    {key:'unanswered',label:'No response',value:stat.missed,tone:'missed'}
  ],empty:'No participants'};
}

export function participantPie(participant){
  const graded=participant.rows.filter(row=>row.eligible&&!OPINION_TYPES.has(row.q.type));
  return {id:`participant-${participant.player.id}`,title:graded.length?'Answer outcomes':'Participation',items:graded.length?[
    {key:'correct',label:'Correct',value:participant.correct,tone:'correct'},
    {key:'incorrect',label:'Incorrect',value:participant.incorrect,tone:'incorrect'},
    {key:'missed',label:'Missed',value:graded.filter(row=>!row.answer).length,tone:'missed'}
  ]:[
    {key:'submitted',label:'Submitted',value:participant.answered,tone:'submitted'},
    {key:'unanswered',label:'No response',value:participant.missed,tone:'missed'}
  ],empty:'No questions yet'};
}

export function pieSlices(items){
  const values=items.map(item=>({...item,value:Number.isFinite(item.value)?Math.max(0,item.value):0}));
  const total=values.reduce((sum,item)=>sum+item.value,0);
  const ticks=values.map(item=>total?item.value/total*1000:0),shares=ticks.map(Math.floor);
  const order=ticks.map((value,index)=>({index,remainder:value-shares[index]})).sort((a,b)=>b.remainder-a.remainder);
  for(let i=0,remaining=total?1000-shares.reduce((sum,value)=>sum+value,0):0;i<remaining;i++)shares[order[i].index]++;
  let angle=-Math.PI/2;
  return values.map((item,index)=>{
    const fraction=total?item.value/total:0,start=angle,end=angle+fraction*Math.PI*2;
    angle=end;
    const point=a=>[110+92*Math.cos(a),110+92*Math.sin(a)].map(v=>Number(v.toFixed(5))).join(' ');
    const path=!fraction?'':fraction===1?'M 110 18 A 92 92 0 1 1 110 202 A 92 92 0 1 1 110 18 Z':`M 110 110 L ${point(start)} A 92 92 0 ${fraction>.5?1:0} 1 ${point(end)} Z`;
    const share=total?(shares[index]/10).toLocaleString(undefined,{maximumFractionDigits:1})+'%':'—';
    return {...item,total,fraction,share,path};
  });
}

export function renderPieChart(model,selected=''){
  const slices=pieSlices(model.items),total=slices[0]?.total||0,active=slices.find(s=>s.key===selected&&s.value>0);
  const info=s=>`${s.label} · ${s.value.toLocaleString()} (${s.share})`;
  return `<section class="report-pie ${active?'has-selection':''}" data-pie="${esc(model.id)}" aria-labelledby="pie-${esc(model.id)}-title"><h2 id="pie-${esc(model.id)}-title">${esc(model.title)}</h2><div class="report-pie-body"><div class="report-pie-graphic"><svg viewBox="0 0 220 220" role="group" aria-label="${esc(model.title)}"><title>${esc(model.title)}</title>${total?slices.filter(s=>s.value>0).map(s=>`<path class="report-pie-slice tone-${s.tone} ${active?.key===s.key?'is-active':''}" d="${s.path}" role="button" tabindex="0" data-pie-item="${esc(s.key)}" aria-label="${esc(info(s))}" aria-pressed="${active?.key===s.key}"><title>${esc(info(s))}</title></path>`).join(''):`<circle cx="110" cy="110" r="92" class="report-pie-empty"/><text x="110" y="110" text-anchor="middle" dominant-baseline="middle" class="report-pie-empty-label">No data</text>`}</svg></div><div class="report-pie-details"><div class="report-pie-legend">${slices.map(s=>`<button class="report-pie-key tone-${s.tone} ${active?.key===s.key?'is-active':''}" data-pie-item="${esc(s.key)}" aria-label="${esc(info(s))}" aria-pressed="${active?.key===s.key}" ${!s.value?'disabled':''}><span class="pie-swatch" aria-hidden="true"></span><span>${esc(s.label)}</span><strong>${s.value.toLocaleString()}</strong><span class="pie-share">${s.share}</span></button>`).join('')}</div><p class="pie-insight" role="status" aria-live="polite" aria-atomic="true">${active?esc(info(active)):!total?esc(model.empty||'No responses'):''}</p></div></div></section>`;
}

/** Mouse, touch and keyboard all select the same slice. No chart data goes over the network. */
export function bindPieCharts(root,{models,selections,onSelect}){
  function update(chart,key){
    const model=(typeof models==='function'?models():models).find(m=>m.id===chart.dataset.pie);
    if(!model)return;
    const slices=pieSlices(model.items),item=slices.find(s=>s.key===key&&s.value>0);
    chart.classList.toggle('has-selection',!!item);
    for(const node of chart.querySelectorAll('[data-pie-item]')){
      const active=node.dataset.pieItem===item?.key;
      node.classList.toggle('is-active',active);node.setAttribute('aria-pressed',String(active));
    }
    chart.querySelector('.pie-insight').textContent=item?`${item.label} · ${item.value.toLocaleString()} (${item.share})`:!slices[0]?.total?model.empty:'';
  }
  function targetOf(event){return event.target.closest?.('[data-pie-item]');}
  function show(event){const target=targetOf(event);if(!target||target.disabled)return;const chart=target.closest('[data-pie]');if(chart)update(chart,target.dataset.pieItem);}
  function pin(event){
    const target=targetOf(event);if(!target||target.disabled)return;
    const chart=target.closest('[data-pie]');if(!chart)return;
    const key=selections[chart.dataset.pie]===target.dataset.pieItem?'':target.dataset.pieItem;
    onSelect(chart.dataset.pie,key);update(chart,key);
  }
  function leave(event){
    const chart=event.target.closest?.('[data-pie]');if(!chart)return;
    if(event.relatedTarget instanceof Node&&chart.contains(event.relatedTarget))return;
    update(chart,selections[chart.dataset.pie]||'');
  }
  function keyboard(event){
    const target=targetOf(event);if(!target)return;
    if(target.tagName.toLowerCase()==='path'&&['Enter',' '].includes(event.key)){event.preventDefault();pin(event);return;}
    if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Escape'].includes(event.key))return;
    event.preventDefault();
    const chart=target.closest('[data-pie]');
    if(event.key==='Escape'){onSelect(chart.dataset.pie,'');update(chart,'');return;}
    const group=target.closest('svg')||target.closest('.report-pie-legend');
    const items=[...group.querySelectorAll('[data-pie-item]')].filter(item=>!item.disabled),index=items.indexOf(target);
    const delta=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;
    items[(index+delta+items.length)%items.length]?.focus();
  }
  const events={pointerover:show,focusin:show,click:pin,pointerout:leave,focusout:leave,keydown:keyboard};
  for(const [name,handler] of Object.entries(events))root.addEventListener(name,handler);
  return ()=>{for(const [name,handler] of Object.entries(events))root.removeEventListener(name,handler);};
}
