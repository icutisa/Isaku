let toastTimer;
function h(tag,attrs,...children){
  const node=document.createElement(tag);
  Object.entries(attrs||{}).forEach(function(entry){
    const key=entry[0],value=entry[1];
    if(value===false || value===null || value===undefined)return;
    if(key.startsWith('on') && typeof value==='function')node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='class')node.className=value;
    else if(key==='value')node.value=value;
    else node.setAttribute(key,value===true?'':String(value));
  });
  children.flat(3).forEach(function(child){if(child!==null && child!==undefined && child!==false)node.append(typeof child==='string'||typeof child==='number'?String(child):child);});
  return node;
}
const paths={
  play:'M8 4.5 20 12 8 19.5Z',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',
  chevron:'m9 5 7 7-7 7',left:'m14 5-7 7 7 7',clock:'M12 7v5l3 2',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9Z',
  bookmark:'M6 3h12v18l-6-4-6 4Z',search:'m16 16 4.5 4.5',
  filter:'M4 7h16M7 12h10M10 17h4',calendar:'M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3',
  info:'M12 11v6M12 7h.01',reload:'M3 11a9 9 0 1 1 2.3 6M3 5v6h6',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'
};
function icon(name){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const add=function(tag,attrs){const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(function(x){el.setAttribute(x[0],String(x[1]));});svg.append(el);};
  if(['clock','info'].includes(name))add('circle',{cx:12,cy:12,r:9});
  if(name==='search')add('circle',{cx:10.5,cy:10.5,r:6.5});
  if(name==='calendar')add('rect',{x:3,y:5,width:18,height:16,rx:2});
  add('path',{d:paths[name]||paths.play});
  if(name==='play'){svg.setAttribute('fill','currentColor');svg.setAttribute('stroke','none');}
  return svg;
}
function button(text,options={},symbol){
  const attrs=Object.assign({type:'button',class:'btn'},options);
  return h('button',attrs,symbol?icon(symbol):null,text);
}
function linkButton(text,href,className='btn',symbol){
  return h('a',{href,class:className},symbol?icon(symbol):null,text);
}
function toast(message){clearTimeout(toastTimer);const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');toastTimer=setTimeout(function(){el.classList.remove('show');},2700);}

export {h,icon,button,linkButton,toast};
