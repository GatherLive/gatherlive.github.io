/** Pure report calculations, shared by the host view and every export. */
export const OPINION_TYPES = new Set(['poll','open_ended','word_cloud','slide']);
export const typeLabel = type => ({single:'Multiple choice',multi:'Multiple answers',true_false:'True or false',short_answer:'Type an answer',poll:'Poll',order:'Order',slider:'Number',word_cloud:'Word cloud',open_ended:'Open response',pin:'Pin on image',slide:'Slide'}[type]||type);
export const hasDetails = report => Array.isArray(report?.questions)&&Array.isArray(report?.players);
export const percent = (part,total) => total?Math.round(part/total*100):null;
export const seconds = ms => Number.isFinite(ms)?`${(ms/1000).toFixed(1)} s`:'—';
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeName(value){
  const name=String(value||'Quiz').normalize('NFKC').replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu,'').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'');
  let result='',bytes=0;
  for(const char of name){const size=new TextEncoder().encode(char).length;if(bytes+size>80)break;result+=char;bytes+=size;}
  return result.replace(/[. ]+$/g,'')||'Quiz';
}
export function answerText(q,answer){
  if(answer==null)return 'No response';
  const label=id=>q.options?.find(o=>o.id===id)?.text||`Image choice ${Math.max(1,(q.options||[]).findIndex(o=>o.id===id)+1)}`;
  if(q.options)return Array.isArray(answer)?answer.map(label).join(q.type==='order'?' → ':'; '):label(answer);
  if(q.type==='pin')return `x ${Math.round(answer.x*100)}%, y ${Math.round(answer.y*100)}%`;
  return String(answer);
}
export function correctText(q){
  if(OPINION_TYPES.has(q.type))return 'Not graded';
  if(q.acceptedAnswers)return q.acceptedAnswers.join(' / ');
  if(q.target!=null)return answerText(q,q.target)+(q.type==='slider'?` (±${q.tolerance||0})`:` (within ${Math.round((q.tolerance||0)*100)}% of image width)`);
  return answerText(q,q.correct);
}
export function resultStatus(q,a,eligible=true){
  if(!eligible)return 'Not present';
  if(q.type==='slide')return 'Not graded';
  if(!a)return 'No response';
  return OPINION_TYPES.has(q.type)?'Not graded':a.correct?'Correct':'Incorrect';
}
export function analyze(report,participantId=''){
  const all=report.players||[], players=participantId?all.filter(p=>p.id===participantId):all;
  const timings=report.questionTimings||{};
  const hasTimings=Object.keys(timings).length>0;
  const questions=(report.questions||[]).map((q,index)=>({...q,number:index+1})).filter(q=>hasTimings?Object.hasOwn(timings,q.id):all.some(p=>Object.hasOwn(p.answers||{},q.id)));
  const roundFor=q=>report.settings?.roundsEnabled?report.settings.rounds?.find(r=>r.questionIds.includes(q.id)):null;
  const questionStats=questions.map(q=>{
    const timing=timings[q.id];
    const eligible=p=>!timing?.closedAt||!p.joinedAt||p.joinedAt<=timing.closedAt;
    const rows=players.map(p=>{const a=Object.hasOwn(p.answers||{},q.id)?p.answers[q.id]:null;return {player:p,answer:a,eligible:eligible(p),status:resultStatus(q,a,eligible(p))};});
    const present=rows.filter(r=>r.eligible),answers=present.filter(r=>r.answer),graded=!OPINION_TYPES.has(q.type),correct=answers.filter(r=>r.answer.correct===true).length;
    const distribution=new Map<string,{label: string; count: number; correct?: boolean}>((q.options||[]).map(o=>[o.id,{label:answerText(q,o.id),count:0,correct:!OPINION_TYPES.has(q.type)&&q.type!=='order'&&(q.correct||[]).includes(o.id)}]));
    if(q.type!=='order')for(const {answer:a} of answers){
      for(const value of Array.isArray(a.answer)?a.answer:[a.answer]){
        const key=q.options?value:typeof value==='string'?value.normalize('NFKC').toLocaleLowerCase():JSON.stringify(value);
        if(!distribution.has(key))distribution.set(key,{label:answerText(q,value),count:0});
        distribution.get(key).count++;
      }
    }
    const round=roundFor(q);
    return {q,round,rows,eligible:present.length,answered:answers.length,correct,incorrect:graded?answers.length-correct:0,missed:q.type==='slide'?0:present.length-answers.length,graded,accuracy:graded?percent(correct,present.length):null,responseRate:q.type==='slide'?null:percent(answers.length,present.length),averageTime:answers.length?answers.reduce((s,r)=>s+r.answer.elapsed,0)/answers.length:null,averageValue:q.type==='slider'&&answers.length?answers.reduce((s,r)=>s+r.answer.answer,0)/answers.length:null,distribution:[...distribution.values()].sort((a,b)=>b.count-a.count)};
  });
  const standings=new Map<string,{id: string; score: number; rank: number}>((report.overallLeaderboard||report.leaderboard||[]).map(p=>[p.id,p]));
  const participantStats=players.map((p,playerIndex)=>{
    const rows=questionStats.filter(s=>s.q.type!=='slide').map(s=>({q:s.q,round:s.round,...s.rows[playerIndex]}));
    const present=rows.filter(r=>r.eligible),answered=present.filter(r=>r.answer),graded=present.filter(r=>!OPINION_TYPES.has(r.q.type));
    const correct=graded.filter(r=>r.answer?.correct===true).length;
    const standing=standings.get(p.id);
    const rounds=(report.settings?.roundsEnabled?report.settings.rounds||[]:[]).map(r=>({id:r.id,title:r.title,score:rows.filter(row=>r.questionIds.includes(row.q.id)).reduce((s,row)=>s+(row.answer?.awarded?row.answer.points:0),0)}));
    return {player:p,rows,rounds,answered:answered.length,eligible:present.length,correct,incorrect:graded.filter(r=>r.answer&&r.answer.correct!==true).length,missed:present.length-answered.length,accuracy:percent(correct,graded.length),score:p.overallScore??standing?.score??p.score??0,rank:standing?.rank??null,averageTime:answered.length?answered.reduce((s,r)=>s+r.answer.elapsed,0)/answered.length:null};
  }).sort((a,b)=>b.score-a.score||a.player.name.localeCompare(b.player.name));
  const eligible=questionStats.filter(s=>s.q.type!=='slide').reduce((s,q)=>s+q.eligible,0),answered=questionStats.reduce((s,q)=>s+q.answered,0),graded=questionStats.filter(s=>s.graded).reduce((s,q)=>s+q.eligible,0),correct=questionStats.reduce((s,q)=>s+q.correct,0),incorrect=questionStats.reduce((s,q)=>s+q.incorrect,0);
  const elapsed=questionStats.reduce((s,q)=>s+(q.averageTime??0)*q.answered,0);
  return {report,players,questions,questionStats,participantStats,eligible,answered,correct,incorrect,missed:eligible-answered,accuracy:percent(correct,graded),responseRate:percent(answered,eligible),averageTime:answered?elapsed/answered:null,averageScore:players.length?participantStats.reduce((s,p)=>s+p.score,0)/players.length:null};
}
export function reportBase(report,participant=null){
  const date=new Date(report.finishedAt||report.createdAt||Date.now()).toISOString().slice(0,10);
  return `${safeName(report.title)} - ${date} - ${safeName(report.code||'results')}${participant?' - '+safeName(participant.name):''} - ${participant?'Participant report':'Detailed results'}`;
}
export function csv(rows){
  const cell=v=>{let s=String(v??'');if(/^[\s\uFEFF]*[=+\-@]/u.test(s)||/^[\t\r\n]/u.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
