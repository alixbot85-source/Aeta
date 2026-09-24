export const API_BASE=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export const hasExternalApi=Boolean(API_BASE);
export type ApiResult<T>={ok:true;data:T;meta?:unknown}|{ok:false;code:string;message:string;details?:unknown};
async function request<T>(path:string,init:RequestInit={}):Promise<ApiResult<T>>{try{const res=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{'content-type':'application/json',...(init.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)return{ok:false,code:body?.error?.code||`HTTP_${res.status}`,message:body?.error?.message||'API request failed',details:body?.error?.details};return{ok:true,data:body.data??body,meta:body.meta}}catch(e:any){return{ok:false,code:hasExternalApi?'API_UNAVAILABLE':'BACKEND_NOT_CONFIGURED',message:hasExternalApi?'Backend is unavailable':'Backend URL is NOT_CONFIGURED for this static/mobile build',details:e?.message}}
}
export function login(email:string,password:string){return request<{id:string;email:string;role:string}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})})}
export function register(email:string,password:string){return request<{id:string;email:string;kycStatus:string}>('/api/auth/register',{method:'POST',body:JSON.stringify({email,password})})}
export function createUsdtTronDeposit(amount:string,txid?:string){return request('/api/deposits/usdt-tron',{method:'POST',body:JSON.stringify({amount,txid:txid||undefined,idempotencyKey:`dep-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`})})}
export function health(){return request('/api/health')}
