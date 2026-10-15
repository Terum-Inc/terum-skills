import type { AskKind, Frame, Result, Run } from '../types';
export interface RunContext {print(line:string):void;/** `item` names the skill a rung is about when one run works through several (a batched publish). */progress(done:number,total:number,label?:string,item?:string):void;ask(kind:AskKind,question:string,opts?:{default?:string;choices?:readonly string[];detail?:readonly string[];descriptions?:readonly string[]}):Promise<string|boolean>;sleep(ms:number):Promise<void>}
export function createRun<T>(script:(ctx:RunContext)=>Promise<Result<T>>):Run<T> {
 const buffer:Frame[]=[];
 const readers=new Set<()=>void>();
 const asks=new Map<string,{resolve:(v:string|boolean)=>void;reject:(e:Error)=>void;kind:AskKind;choices?:readonly string[]}>();
 const sleepers=new Set<()=>void>();
 let finished=false,serial=0;
 let settle!:(r:Result<T>)=>void;
 const done=new Promise<Result<T>>(resolve=>{settle=resolve;});
 const push=(frame:Frame)=>{if(finished)return;buffer.push(frame);for(const wake of readers)wake();readers.clear();};
 const finish=(result:Result<T>)=>{
  if(finished)return;
  push({t:'result',ok:result.ok,...(result.ok?{}:{error:result.error,...(result.cancelled?{declined:true}:{}),...(result.refused?{refused:true}:{})})});finished=true;
  for(const ask of asks.values())ask.reject(new Error(result.ok?'Run completed.':result.error));asks.clear();
  for(const stop of sleepers)stop();sleepers.clear();
  for(const wake of readers)wake();readers.clear();
  settle(result);
 };
 const assertActive=()=>{if(finished)throw new Error('Cancelled.');};
 const ctx:RunContext={
  print:line=>{assertActive();push({t:'print',line});},
  progress:(done,total,label,item)=>{assertActive();if(!Number.isFinite(done)||!Number.isFinite(total)||done<0||total<done)throw new Error('Invalid progress.');push({t:'progress',done,total,...(label===undefined?{}:{label}),...(item===undefined?{}:{item})});},
  ask:(kind,question,opts={})=>{assertActive();if(kind==='select'&&!opts.choices?.length)return Promise.reject(new Error('Select requires choices.'));const id=String(++serial);return new Promise((resolve,reject)=>{asks.set(id,{resolve,reject,kind,...(opts.choices?{choices:opts.choices}:{})});push({t:'ask',id,kind,question,...opts});});},
  sleep:ms=>{assertActive();if(!Number.isFinite(ms)||ms<0)return Promise.reject(new Error('Invalid delay.'));return new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(new Error('Cancelled.'));};const timer=setTimeout(()=>{sleepers.delete(stop);resolve();},ms);sleepers.add(stop);});}
 };
 // Defer script execution so consumers can subscribe before its first frame.
 void Promise.resolve().then(()=>{assertActive();return script(ctx);}).then(finish,error=>finish({ok:false,error:error instanceof Error?error.message:String(error)}));
 return {done,frames:{async *[Symbol.asyncIterator](){
  let cursor=0;
  while(true){
   const frame=buffer[cursor];
   if(frame){cursor++;yield structuredClone(frame);continue;}
   if(finished)return;
   await new Promise<void>(resolve=>readers.add(resolve));
  }
 }},answer(id,value){const ask=asks.get(id);if(!ask)return;const valid=ask.kind==='confirm'?typeof value==='boolean':typeof value==='string'&&(ask.kind!=='select'||!!ask.choices?.includes(value));if(!valid)throw new Error('Invalid answer for '+id);asks.delete(id);ask.resolve(value);},async cancel(){finish({ok:false,error:'Cancelled.'});await done;}};
}
