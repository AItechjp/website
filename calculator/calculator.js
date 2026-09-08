(() => {
  'use strict';
  const exprEl=document.querySelector('#expression'), resultEl=document.querySelector('#result'), keys=document.querySelector('#keys'), historyEl=document.querySelector('#history'), emptyEl=document.querySelector('#history-empty');
  const histKey='webdesk:calculator:history:v1';
  let expr='', angle='deg', lastResult=0, history=JSON.parse(localStorage.getItem(histKey)||'[]');
  const allowedFns=new Set(['sin','cos','tan','sqrt','ln','log','abs','floor','ceil','round']);

  function tokenize(s){
    const out=[]; let i=0;
    while(i<s.length){
      const c=s[i]; if(/\s/.test(c)){i++;continue}
      if(/[0-9.]/.test(c)){let j=i+1; while(j<s.length&&/[0-9.eE]/.test(s[j])) j++; const raw=s.slice(i,j); if(!/^((\d+\.?\d*)|(\.\d+))([eE][+-]?\d+)?$/.test(raw)) throw Error('数値の形式が不正です'); out.push({t:'num',v:Number(raw)}); i=j; continue}
      if(/[A-Za-z]/.test(c)){let j=i+1; while(j<s.length&&/[A-Za-z]/.test(s[j])) j++; out.push({t:'name',v:s.slice(i,j).toLowerCase()}); i=j; continue}
      if('+-*/%^(),'.includes(c)){out.push({t:c,v:c});i++;continue}
      throw Error('使えない文字があります');
    }
    return out;
  }
  function evaluate(s){
    const ts=tokenize(s); let p=0;
    const peek=()=>ts[p], take=t=>{if(peek()?.t===t)return ts[p++];return null}, need=t=>{const x=take(t);if(!x)throw Error('式が途中です');return x};
    function primary(){
      if(take('(')){const v=add();need(')');return v}
      const n=take('num'); if(n)return n.v;
      const name=take('name'); if(name){
        if(name.v==='pi') return Math.PI; if(name.v==='e') return Math.E; if(name.v==='ans') return lastResult;
        if(!allowedFns.has(name.v)) throw Error(`未対応の関数: ${name.v}`); need('('); const v=add(); need(')');
        if(name.v==='sin') return Math.sin(angle==='deg'?v*Math.PI/180:v);
        if(name.v==='cos') return Math.cos(angle==='deg'?v*Math.PI/180:v);
        if(name.v==='tan') return Math.tan(angle==='deg'?v*Math.PI/180:v);
        if(name.v==='sqrt') return Math.sqrt(v); if(name.v==='ln') return Math.log(v); if(name.v==='log') return Math.log10(v);
        return Math[name.v](v);
      }
      throw Error('値が必要です');
    }
    function unary(){if(take('+'))return unary();if(take('-'))return -unary();return primary()}
    function power(){let v=unary(); if(take('^')) v=Math.pow(v,power()); return v}
    function mul(){let v=power(); for(;;){if(take('*'))v*=power();else if(take('/'))v/=power();else if(take('%'))v%=power();else break} return v}
    function add(){let v=mul(); for(;;){if(take('+'))v+=mul();else if(take('-'))v-=mul();else break} return v}
    const value=add(); if(p<ts.length)throw Error('式を解釈できません'); if(!Number.isFinite(value)) throw Error('計算結果が定義されません'); return value;
  }
  const pretty=v=>Number.isInteger(v)?String(v):Number(v.toPrecision(12)).toString();
  function preview(){exprEl.textContent=expr||'0'; if(!expr){resultEl.textContent='0';return} try{resultEl.textContent=pretty(evaluate(expr))}catch{resultEl.textContent='…'}}
  function calculate(){if(!expr)return; try{const value=evaluate(expr), res=pretty(value); lastResult=value; history.unshift({expr,result:res,at:Date.now()}); history=history.slice(0,40); localStorage.setItem(histKey,JSON.stringify(history)); resultEl.textContent=res; renderHistory();}catch(e){resultEl.textContent='Error';exprEl.textContent=e.message}}
  function append(v){ if(expr.length<120){expr+=v;preview()} }
  function renderHistory(){historyEl.innerHTML=history.map((h,i)=>`<div class="history-row" data-i="${i}"><div class="expr">${escapeHtml(h.expr)}</div><div class="res">= ${escapeHtml(h.result)}</div></div>`).join('');emptyEl.classList.toggle('hidden',history.length>0)}
  function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  keys.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.action,v=b.dataset.value;if(v)append(v);else if(a==='clear'){expr='';lastResult=0;preview()}else if(a==='back'){expr=expr.slice(0,-1);preview()}else if(a==='equals')calculate();else if(a==='sign'){expr=expr?`-(${expr})`:'-';preview()}});
  document.querySelectorAll('[data-angle]').forEach(b=>b.addEventListener('click',()=>{angle=b.dataset.angle;document.querySelectorAll('[data-angle]').forEach(x=>x.classList.toggle('active',x===b));preview()}));
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(/^[0-9.+\-*/%^()]$/.test(e.key)){append(e.key);e.preventDefault()}else if(e.key==='Enter'||e.key==='='){calculate();e.preventDefault()}else if(e.key==='Backspace'){expr=expr.slice(0,-1);preview();e.preventDefault()}else if(e.key==='Escape'){expr='';preview()} });
  historyEl.addEventListener('click',e=>{const row=e.target.closest('[data-i]');if(!row)return;expr=history[Number(row.dataset.i)].expr;preview()});
  document.querySelector('#clear-history').addEventListener('click',()=>{history=[];localStorage.removeItem(histKey);renderHistory()});
  renderHistory(); preview();
})();
