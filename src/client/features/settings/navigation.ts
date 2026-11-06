export function settingsDestination(origin){
 if(typeof origin!=='string')return '#';
 if(/^#host(?:\/(?:login|signup))?$/.test(origin))return '#dashboard';
 return /^#(?:dashboard|edit\/[a-f0-9-]{36}|results\/(?:saved\/[a-f0-9-]{36}|live\/\d{6})|join(?:\/\d{6})?|learn(?:\/[a-z-]+)*)?$/.test(origin)?origin:'#';
}
export function settingsBackLabel(destination){
 return destination==='#dashboard'?'My quizzes':destination.startsWith('#edit/')?'Quiz editor':destination.startsWith('#results/')?'Results':destination.startsWith('#join')?'Join quiz':destination.startsWith('#learn')?'Learn':'Home';
}
