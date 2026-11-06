export function normalizeTags(input){
 if(!Array.isArray(input)||input.length>12)throw Object.assign(new Error('Use up to 12 tags.'),{status:400});
 const result=[],seen=new Set();
 for(const raw of input){
  if(typeof raw!=='string')throw Object.assign(new Error('Tags must be text.'),{status:400});
  const value=raw.trim();if(!value)continue;
  if(value.length>80||/[\u0000-\u001f\u007f]/.test(value))throw Object.assign(new Error('Keep each tag under 80 characters.'),{status:400});
  const key=value.normalize('NFKC').toLowerCase();if(!seen.has(key)){seen.add(key);result.push(value);}
 }
 return result;
}
export function quizTags(quiz){
 const values=quiz?.tags??quiz?.settings?.tags??(quiz?.collection?[quiz.collection]:[]);
 try{return normalizeTags(values);}catch{return [];}
}
