import type {DataRecord} from '../../../shared/types.js';
import {analyze,answerText,correctText,escapeHTML as esc,seconds,typeLabel,csv,reportBase} from './data.js';
const logoPromise=()=>fetch(new URL('../../assets/images/logo.svg',import.meta.url)).then(r=>{if(!r.ok)throw new Error('The report logo could not load.');return r.text();});
let logo,pdfReady;
const number=n=>n==null?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
const percent=n=>n==null?'Ungraded':n+'%';
const dateValue=report=>new Date(report.finishedAt||report.createdAt||Date.now());
const reportDate=report=>dateValue(report).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const participantLabel=(report,participant,options)=>options.names?participant.name:`Participant ${(report.players||[]).findIndex(p=>p.id===participant.id)+1}`;
const cellText=value=>typeof value==='number'?number(value):String(value??'');
const numericColumn=(header,index)=>index>0&&['Points','Accuracy','Correct','Incorrect','Missed','Answered','Average time','Time'].includes(header);
async function reportLogo(){if(!logo)logo=logoPromise().catch(error=>{logo=null;throw error;});return logo;}
// Kept as a public helper for existing integrations. Reports use compact, labelled bars.
export function ringSVG(value,label,dark=false){
  const v=Math.max(0,Math.min(100,value??0)),ink=dark?'#f1f0ec':'#252525',track=dark?'#343434':'#e5e5e5';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="${esc(label)}: ${value==null?'not applicable':v+'%'}"><circle cx="70" cy="70" r="52" fill="none" stroke="${track}" stroke-width="5"/><circle cx="70" cy="70" r="52" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="${v/100*326.73} 326.73" transform="rotate(-90 70 70)"/><text x="70" y="77" text-anchor="middle" font-family="sans-serif" font-size="26" fill="${ink}">${value==null?'—':v+'%'}</text></svg>`;
}
function sectionsFor(report,options,participantId=''){
  const data=analyze(report,participantId),blocks=[],personal=!!participantId,learner=data.participantStats[0];
  if(personal&&!learner)throw new Error('This participant is not in the report.');
  const label=p=>participantLabel(report,p,options),graded=data.questionStats.filter(q=>q.graded),gradedMissed=graded.reduce((sum,q)=>sum+q.missed,0);
  if(options.summary){
    const metrics=personal?[
      ...(graded.length?[['Accuracy',percent(data.accuracy)]]:[]),['Answered',`${data.answered} / ${data.eligible}`],
      ...(options.scores&&graded.length?[['Points',number(learner.score)]]:[]),...(options.timing?[['Average time',seconds(data.averageTime)]]:[])
    ]:[['Participants',number(data.players.length)],['Questions',number(data.questions.length)],...(graded.length?[['Accuracy',percent(data.accuracy)]]:[]),...(options.scores&&graded.length?[['Average points',number(data.averageScore)]]:[]),...(options.timing?[['Average time',seconds(data.averageTime)]]:[])];
    blocks.push({kind:'summary',metrics});
    if(options.charts){
      const items=graded.length?[{label:'Correct',count:data.correct,tone:'correct'},{label:'Incorrect',count:data.incorrect,tone:'incorrect'},{label:'No response',count:gradedMissed,tone:'missed'}]:[{label:'Submitted',count:data.answered,tone:'correct'},{label:'No response',count:data.missed,tone:'missed'}];
      blocks.push({kind:'outcomes',items});
    }

  }
  if(options.participants){
    if(personal){if(!options.summary)blocks.push({kind:'totals',text:[`${learner.correct} correct · ${learner.incorrect} incorrect · ${learner.missed} unanswered`]});}
    else blocks.push({title:'Participants',rows:[['Participant','Accuracy','Answered',...(options.scores?['Points']:[]),...(options.timing?['Average time']:[])],...data.participantStats.map(p=>[label(p.player),percent(p.accuracy),`${p.answered} / ${p.eligible}`,...(options.scores?[p.score]:[]),...(options.timing?[seconds(p.averageTime)]:[])])]});
  }
  if(options.rounds&&report.settings?.roundsEnabled){
    if(personal)blocks.push({title:'Round results',rows:[['Round',options.scores?'Points':'Responses'],...learner.rounds.map(r=>[r.title,options.scores?r.score:learner.rows.filter(row=>row.round?.id===r.id&&row.answer).length])]});
    else{
      // Keep printed columns readable even when a quiz has many rounds.
      const rounds=report.settings.rounds||[];
      for(let start=0;start<rounds.length;start+=4){const group=rounds.slice(start,start+4);blocks.push({title:start?'Round results (continued)':'Round results',roundTable:true,rows:[['Participant',...group.map(r=>r.title)],...data.participantStats.map(p=>[label(p.player),...group.map(r=>options.scores?p.rounds.find(round=>round.id===r.id)?.score??0:p.rows.filter(row=>row.round?.id===r.id&&row.answer).length)])]});}
    }
  }
  if(options.questions){
    blocks.push({title:personal?'Answers':'Questions',kind:'heading'});
    for(const stat of data.questionStats){
      const q=stat.q,row=stat.rows[0],text=[],fields=[];
      const meta=[typeLabel(q.type),...(stat.round?[stat.round.title]:[]),...(!stat.graded&&q.type!=='slide'?['Ungraded']:[])].join(' · ');
      const detail=personal?[]:q.type==='slide'?[]:[...(stat.graded?[`${stat.correct} / ${stat.eligible} correct (${percent(stat.accuracy)})`]:[]),`${stat.answered} / ${stat.eligible} answered`];
      if(options.timing&&q.type!=='slide')detail.push(personal?seconds(row?.answer?.elapsed):seconds(stat.averageTime)+' average');
      if(personal&&options.responses&&q.type!=='slide'){const value=row?.eligible?answerText(q,row.answer?.answer):'Not present';fields.push({label:'Your answer',value});text.push('Your answer: '+value);}
      if(!personal&&options.responses&&stat.averageValue!=null){fields.push({label:'Average answer',value:number(stat.averageValue)});text.push('Average answer: '+number(stat.averageValue));}
      if(options.correct&&stat.graded&&(!personal||!options.responses||row?.status!=='Correct')){const value=correctText(q);fields.push({label:'Correct answer',value});text.push('Correct answer: '+value);}
      if(options.explanations&&q.explanation){fields.push({label:stat.graded?'Explanation':'Notes',value:q.explanation});text.push(q.explanation);}
      const block: DataRecord={title:`${q.number}. ${q.prompt}`,kind:'question',meta,detail:detail.join(' · '),status:personal&&q.type!=='slide'?row?.status:'',fields,text};
      if(!personal&&options.charts&&q.type!=='slide'&&stat.distribution.length&&!['pin','open_ended','order'].includes(q.type)){
        block.bars=stat.distribution.slice(0,8);block.total=stat.answered;
        block.barNote=(q.type==='multi'?'Participants may select more than one answer. ':'')+(stat.distribution.length>8?`Showing the 8 most common of ${stat.distribution.length} responses.`:'');
      }
      if(!personal&&options.responses&&q.type!=='slide')block.rows=[['Participant','Response','Result',...(options.scores?['Points']:[]),...(options.timing?['Time']:[])],...stat.rows.map(r=>[label(r.player),r.eligible?answerText(q,r.answer?.answer):'Not present',r.status,...(options.scores?[r.eligible&&r.answer?.awarded?r.answer.points:0]:[]),...(options.timing?[seconds(r.answer?.elapsed)]:[])])];
      blocks.push(block);
    }
  }
  return {data,blocks,participant:personal?data.players[0]:null};
}
export function exportRows(report,options,participantId=''){
  const {blocks,participant}=sectionsFor(report,options,participantId);
  return [['Gather · '+report.title],['Date',dateValue(report).toISOString()],...(participant?[['Participant',participantLabel(report,participant,options)]]:[]),...blocks.flatMap(b=>[[],...(b.title?[[b.title]]:[]),...(b.meta?[[b.meta]]:[]),...(b.detail?[[b.detail]]:[]),...(b.status?[['Result',b.status]]:[]),...(b.metrics||[]),...(b.items||[]).map(item=>[item.label,item.count]),...(b.text||[]).map(t=>[t]),...(b.bars?[['Response','Count'],...b.bars.map(d=>[d.label,d.count])]:[]),...(b.note?[[b.note]]:[]),...(b.rows||[])])];
}
const reportCSS=`
:root{font-family:Inter,Arial,sans-serif;color-scheme:dark;--bg:#151515;--text:#f1f0ec;--soft:#b7b7b1;--line:#343434;--surface:#1d1d1d;--accent:#d2c6f3;--good:#d3e7b8;--bad:#f4b4a9}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-size:14px;line-height:1.65}main{max-width:900px;margin:auto;padding:36px 32px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:28px;font-size:12px;color:var(--soft)}.brand{display:flex;align-items:center;gap:8px;color:var(--text)}.brand svg{width:24px;height:24px}.brand strong{font-size:18px;font-weight:600}h1{font-size:26px;font-weight:600;line-height:1.4;margin:0 0 8px;overflow-wrap:anywhere}h2{font-size:18px;font-weight:600;line-height:1.5;margin:28px 0 12px;break-after:avoid;overflow-wrap:anywhere}.subtitle{color:var(--soft);margin:0 0 24px;font-size:14px;overflow-wrap:anywhere}.document-kind{font-size:12px;color:var(--soft);margin:0 0 8px}p{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}.note,.meta{font-size:12px;color:var(--soft);line-height:1.7}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:20px 24px;margin:24px 0 16px}.metrics dt{font-size:12px;color:var(--soft)}.metrics dd{font-size:24px;margin:4px 0 0;line-height:1.4;font-variant-numeric:tabular-nums}.overview{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px;break-inside:avoid}.outcomes{margin:16px 0 20px;break-inside:avoid}.outcome-track{display:flex;gap:2px;height:6px;overflow:hidden;border-radius:3px;background:var(--surface)}.outcome-track span{flex:none}.tone-correct{background:var(--accent)}.tone-incorrect{background:var(--bad)}.tone-missed{background:#8c8c86}.outcome-labels{display:flex;gap:12px 24px;flex-wrap:wrap;font-size:12px;color:var(--soft);margin-top:8px}.outcome-labels strong{font-weight:500;color:var(--text)}.finding{padding:12px 16px;background:var(--surface);border-radius:8px;font-size:13px;margin:16px 0}.finding p{margin:0}.question{padding:20px 0;border-top:1px solid var(--line)}.question-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;break-inside:avoid;break-after:avoid}.question h3{font-size:15px;font-weight:600;line-height:1.65;margin:0 0 8px;overflow-wrap:anywhere}.status{font-size:12px;white-space:nowrap;color:var(--soft)}.status.correct{color:var(--good)}.status.incorrect{color:var(--bad)}.answer-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;margin:16px 0 0}.answer-field{min-width:0}.answer-field:last-child:nth-child(odd),.answer-field.explanation{grid-column:1/-1}.answer-field dt{font-size:12px;color:var(--soft);margin-bottom:4px}.answer-field dd{margin:0;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.answer-field.explanation dd{color:var(--soft);font-size:13px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:13px}thead{display:table-header-group}th,td{text-align:left;vertical-align:top;padding:10px 8px;border-bottom:1px solid var(--line);white-space:pre-wrap;overflow-wrap:anywhere}th{font-weight:400;font-size:12px;color:var(--soft);white-space:nowrap}th:first-child,td:first-child{padding-left:0}th:last-child,td:last-child{padding-right:0}td:first-child{min-width:100px}tr{break-inside:avoid}.numeric{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.bars{margin:16px 0}.bar-row{margin:12px 0;break-inside:avoid}.bar-label{display:flex;justify-content:space-between;gap:20px;font-size:13px;margin-bottom:6px}.bar-label>span{overflow-wrap:anywhere}.bar-label b{font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}.bar-track{height:4px;background:var(--surface)}.bar-track span{display:block;height:100%;background:#94948e}.bar-row.correct .bar-track span{background:var(--accent)}.bar-row small{font-size:11px;color:var(--soft)}footer{border-top:1px solid var(--line);padding-top:16px;margin-top:28px;font-size:12px;color:var(--soft)}
@media(max-width:600px){main{padding:24px 20px}header{margin-bottom:24px}h1{font-size:23px}.metrics{grid-template-columns:1fr 1fr;gap:20px}.metrics>div:last-child:nth-child(odd){grid-column:1/-1}.metrics dd{font-size:23px}.question-heading{flex-direction:column;gap:0}.answer-fields{grid-template-columns:1fr}.answer-field{grid-column:1/-1}table{font-size:12px}th,td{padding:8px 6px}.outcome-labels{gap:8px 16px}.table-wrap{margin-right:-4px}table.responses{min-width:520px}}
@page{size:A4;margin:16mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}main{max-width:none;padding:0}.table-wrap{overflow:visible}table,table.responses{min-width:0;font-size:9pt}.question-heading,.question h3{break-after:avoid}.answer-fields{display:block}.answer-field{margin-bottom:12px}}

`;
export async function htmlReport(report,options,participantId=''){
  const {blocks,participant}=sectionsFor(report,options,participantId);
  const brand=await reportLogo();
  const renderTable=(rows,responses=false,rounds=false)=>`<div class="table-wrap"><table class="${responses?'responses':''}"><thead><tr>${rows[0].map((t,i)=>`<th scope="col" class="${numericColumn(t,i)||rounds&&i>0?'numeric':''}">${esc(t)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row=>`<tr>${row.map((t,i)=>`<td class="${numericColumn(rows[0][i],i)||rounds&&i>0?'numeric':''}" dir="auto">${esc(cellText(t))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const renderBars=b=>b.bars?`<div class="bars">${b.bars.map(d=>`<div class="bar-row ${d.correct?'correct':''}"><div class="bar-label"><span dir="auto">${esc(d.label)}${d.correct?' <small>· Correct answer</small>':''}</span><b>${d.count}${b.total?' · '+Math.round(d.count/b.total*100)+'%':''}</b></div><div class="bar-track" aria-hidden="true"><span style="width:${b.total?Math.min(100,d.count/b.total*100):0}%"></span></div></div>`).join('')}${b.barNote?`<p class="note">${esc(b.barNote)}</p>`:''}</div>`:'';
  const renderBlock=b=>{
    if(b.kind==='summary')return `<section class="overview"><dl class="metrics">${b.metrics.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>`;
    if(b.kind==='outcomes'){const total=b.items.reduce((sum,item)=>sum+item.count,0);return `<section class="outcomes" aria-label="Answer outcomes"><div class="outcome-track" aria-hidden="true">${b.items.map(item=>`<span class="tone-${item.tone}" style="width:${total?item.count/total*100:0}%"></span>`).join('')}</div><div class="outcome-labels">${b.items.map(item=>`<span><strong>${item.count}</strong> ${esc(item.label)}</span>`).join('')}</div></section>`;}
    if(b.kind==='question')return `<section class="question"><div class="question-heading"><h3 dir="auto">${esc(b.title)}</h3>${b.status?`<span class="status ${b.status==='Correct'?'correct':b.status==='Incorrect'?'incorrect':''}">${esc(b.status)}</span>`:''}</div><p class="meta">${esc(b.meta)}</p>${b.detail?`<p class="meta">${esc(b.detail)}</p>`:''}${b.fields.length?`<dl class="answer-fields">${b.fields.map(field=>`<div class="answer-field ${['Explanation','Notes'].includes(field.label)?'explanation':''}"><dt>${esc(field.label)}</dt><dd dir="auto">${esc(field.value)}</dd></div>`).join('')}</dl>`:''}${renderBars(b)}${b.rows?renderTable(b.rows,true):''}</section>`;
    return (b.title?`<h2>${esc(b.title)}</h2>`:'')+(b.text?.length?`<div class="${b.kind==='finding'?'finding':''}">${b.text.map(text=>`<p>${esc(text)}</p>`).join('')}</div>`:'')+(b.note?`<p class="note">${esc(b.note)}</p>`:'')+(b.rows?renderTable(b.rows,false,b.roundTable):'');
  };
  const kind=participant?'Participant report':'Quiz report',name=participant?participantLabel(report,participant,options):'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><title>${esc(report.title)} · Gather</title><style>${reportCSS}</style></head><body class="dark"><main><header><span class="brand">${brand}<strong>Gather</strong></span><span>${esc(reportDate(report))}</span></header><h1 dir="auto">${esc(report.title)}</h1><p class="subtitle" dir="auto">${esc(name||kind)}</p>${blocks.map(renderBlock).join('')}</main></body></html>`;
}
function dataSummary(report){const count=report.players?.length||0;return `${number(count)} ${count===1?'participant':'participants'}`;}
function loadScript(name){
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('../../vendor/pdfmake/'+name,import.meta.url).href;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('PDF tools could not load. Please try again.'));};document.head.append(script);});
}
async function pdfLibrary(){
  if(!pdfReady)pdfReady=(async()=>{if(!window.pdfMake)await loadScript('pdfmake.min.js');if(!window.pdfMake.vfs)await loadScript('vfs_fonts.js');return window.pdfMake;})().catch(e=>{pdfReady=null;throw e;});
  return pdfReady;
}

export async function pdfReport(report,options,participantId=''){
  const pdf=await pdfLibrary(),{blocks,participant}=sectionsFor(report,options,participantId),dark=true;
  const ink=dark?'#f1f0ec':'#252525',muted=dark?'#b7b7b1':'#62625f',bg=dark?'#151515':'#ffffff',line=dark?'#343434':'#dededb',accent=dark?'#d2c6f3':'#756291',negative=dark?'#f4b4a9':'#944b42';
  const brand=(await reportLogo()).replaceAll('#d2c6f3',dark?'#d2c6f3':ink),kind=participant?'Participant report':'Quiz report';
  const content: DataRecord[]=[{columns:[{columns:[{svg:brand,width:22},{text:'Gather',fontSize:16,bold:true,margin:[4,2,0,0]}],width:'*'},{text:reportDate(report),alignment:'right',fontSize:9,color:muted,margin:[0,5,0,0]}],margin:[0,0,0,20]},{canvas:[{type:'line',x1:0,y1:0,x2:511.28,y2:0,lineWidth:.5,lineColor:line}],margin:[0,0,0,20]},{text:kind,color:muted,fontSize:9,margin:[0,0,0,6]},{text:report.title,style:'title'},{text:participant?participantLabel(report,participant,options):dataSummary(report),color:muted,fontSize:11,margin:[0,0,0,20]}];
  const note=text=>({text,fontSize:9,color:muted,lineHeight:1.35,margin:[0,4,0,12]});
  const table=(rows,{responses=false,rounds=false}={})=>{
    const widths=rows[0].map((_,index)=>responses?(index===0?88:index===1?'*':'auto'):(index===0?'*':rounds?'*':'auto'));
    return {table:{headerRows:1,keepWithHeaderRows:1,widths,body:rows.map((row,i)=>row.map((cell,j)=>({text:cellText(cell),bold:false,color:i===0?muted:ink,alignment:numericColumn(rows[0][j],j)||rounds&&j>0?'right':'left',fontSize:i===0?8.5:9.5})))},layout:{hLineWidth:()=>.4,vLineWidth:()=>0,hLineColor:()=>line,paddingLeft:i=>i===0?0:8,paddingRight:(i,node)=>i===node.table.widths.length-1?0:8,paddingTop:()=>8,paddingBottom:()=>8},margin:[0,4,0,16]};
  };
  for(const block of blocks){
    if(block.kind==='summary'){
      for(let i=0;i<block.metrics.length;i+=3)content.push({columns:block.metrics.slice(i,i+3).map(([label,value])=>({stack:[{text:label,color:muted,fontSize:9,margin:[0,0,0,6]},{text:String(value),fontSize:22}],width:'*'})),columnGap:20,margin:[0,0,0,16]});
      if(block.note)content.push(note(block.note));continue;
    }
    if(block.kind==='outcomes'){
      const total=block.items.reduce((sum,item)=>sum+item.count,0);let start=0;
      const canvas=block.items.filter(item=>item.count>0).map(item=>{const width=item.count/total*511.28,shape={type:'rect',x:start,y:0,w:Math.max(0,width-1.5),h:5,color:item.tone==='correct'?accent:item.tone==='incorrect'?negative:'#8c8c86'};start+=width;return shape;});
      if(canvas.length)content.push({canvas,margin:[0,0,0,8]});
      content.push({text:block.items.map(item=>`${item.count} ${item.label.toLocaleLowerCase()}`).join('     ·     '),fontSize:9,color:muted,margin:[0,0,0,16]});continue;
    }
    if(block.kind==='question'){
      const top=[{text:block.title,style:'question'},...(block.status?[{text:block.status,fontSize:9,color:block.status==='Incorrect'?negative:muted,margin:[0,0,0,6]}]:[]),{text:block.meta,fontSize:8.5,color:muted,margin:[0,0,0,5]},...(block.detail?[{text:block.detail,fontSize:9,color:muted,margin:[0,0,0,10]}]:[])];
      const fields=block.fields.map(field=>({stack:[{text:field.label,fontSize:9,color:muted,margin:[0,0,0,4]},{text:field.value,fontSize:10.5,lineHeight:1.3}],margin:[0,0,0,12]}));
      // Short answers stay with their question; long responses may flow onto another page.
      const short=(block.title+block.fields.map(f=>f.value).join('')).length<1200;
      content.push({stack:[{canvas:[{type:'line',x1:0,y1:0,x2:511.28,y2:0,lineWidth:.4,lineColor:line}],margin:[0,0,0,16]},...top,...fields],unbreakable:short,margin:[0,12,0,4]});
      if(block.bars){
        content.push({stack:block.bars.map(d=>({stack:[{columns:[{text:d.label+(d.correct?' · Correct answer':''),width:'*'},{text:String(d.count)+(block.total?' · '+Math.round(d.count/block.total*100)+'%':''),alignment:'right',width:64}],columnGap:16,fontSize:9.5,margin:[0,0,0,6]},{canvas:[{type:'rect',x:0,y:0,w:511.28,h:3,color:dark?'#252525':'#f0f0ed'},...(block.total&&d.count?[{type:'rect',x:0,y:0,w:Math.min(1,d.count/block.total)*511.28,h:3,color:d.correct?accent:'#8c8c86'}]:[])]}],unbreakable:d.label.length<700,margin:[0,4,0,8]})),margin:[0,0,0,4]});if(block.barNote)content.push(note(block.barNote));
      }
      if(block.rows)content.push(table(block.rows,{responses:true}));
      continue;
    }
    if(block.title)content.push({text:block.title,style:'heading'});
    for(const text of block.text||[])content.push({text,fontSize:10,color:block.kind==='finding'?ink:muted,margin:[0,4,0,10]});
    if(block.note)content.push(note(block.note));
    if(block.rows)content.push(table(block.rows,{rounds:block.roundTable}));
  }
  const definition={pageSize:'A4',pageMargins:[42,36,42,48],info:{title:report.title+' · Gather',author:'Gather',subject:kind},pageBreakBefore:(node,following)=>['heading','question'].includes(node.style)&&following.length===0,defaultStyle:{font:'Roboto',fontSize:10.5,lineHeight:1.2,color:ink},styles:{title:{fontSize:23,bold:true,lineHeight:1.15,margin:[0,0,0,8]},heading:{fontSize:15,bold:true,margin:[0,18,0,10]},question:{fontSize:12,bold:true,lineHeight:1.3,margin:[0,0,0,8]}},background:()=>({canvas:[{type:'rect',x:0,y:0,w:595.28,h:841.89,color:bg}]}),footer:(page,count)=>({columns:[{text:'Gather',width:'*'},{text:`${page} / ${count}`,alignment:'right',width:80}],color:muted,fontSize:8.5,margin:[42,16,42,0]}),content};
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('PDF generation took too long. Try fewer sections.')),90000);try{pdf.createPdf(definition).getBlob(blob=>{clearTimeout(timer);resolve(blob);});}catch(error){clearTimeout(timer);reject(error);}});
}
export async function exportFile(report,options,participantId=''){
  const participant=participantId?report.players.find(p=>p.id===participantId):null;
  const name=reportBase(report,options.names?participant:participant?{name:'Participant'}:null)+'.'+options.format;
  const blob=options.format==='pdf'?await pdfReport(report,options,participantId):new Blob([options.format==='html'?await htmlReport(report,options,participantId):csv(exportRows(report,options,participantId))],{type:options.format==='html'?'text/html;charset=utf-8':'text/csv;charset=utf-8'});
  return {name,blob};
}
export function saveBlob(name,blob){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
// ZIP "store" format: no dependencies, and Unicode names supported by standard unzip tools.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
export async function zipFiles(files){
  const chunks=[],central=[],encode=new TextEncoder();let offset=0,size=0;
  for(const file of files){
    const bytes=new Uint8Array(await file.blob.arrayBuffer()),name=encode.encode(file.name),crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
    const entry=new Uint8Array(46+name.length),ev=new DataView(entry.buffer);ev.setUint32(0,0x02014b50,true);ev.setUint16(4,20,true);ev.setUint16(6,20,true);ev.setUint16(8,0x0800,true);ev.setUint32(16,crc,true);ev.setUint32(20,bytes.length,true);ev.setUint32(24,bytes.length,true);ev.setUint16(28,name.length,true);ev.setUint32(42,offset,true);entry.set(name,46);
    chunks.push(local,bytes);central.push(entry);offset+=local.length+bytes.length;size+=entry.length;
  }
  if(files.length>65535||offset+size>0xffffffff)throw new Error('This archive is too large. Download individual reports instead.');
  const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}

