import type {AppState} from './context.js';
export const S: AppState = {config:{},session:null,quizzes:[],reports:[],openRooms:[],roomsError:'',dashboardTab:'quizzes',filter:'',search:'',draft:null,questionIndex:0,dirty:false,saving:false,room:null,roomState:null,ws:null,wsGeneration:0,reconnectTimer:null,retries:0,connected:false,selection:null,answerPending:false,answerSent:false,order:[],pin:null,authMode:'login',authMessage:'',loading:false};
try { S.session=JSON.parse(localStorage.getItem('gather.session')||'null'); }catch{}
