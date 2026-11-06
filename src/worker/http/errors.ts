import {HttpError} from '../../shared/http/api.js';
export function rpcFailure(error): {ok: false; status: number; message: string}{
  const status=error.status || (error.name==='EngineError'?400:500);
  return {ok:false,status,message:status>=500&&!error.status?'The room could not complete that action. Please retry.':error.message};
}
export function unwrapRpc(result,key?: string){if(!result?.ok)throw new HttpError(result?.status || 502,result?.message || 'The room service is unavailable.');return result[key];}
