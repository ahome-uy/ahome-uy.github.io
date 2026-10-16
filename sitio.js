/* Lógica compartida: lista de trabajos, datos de cada uno y portada de reserva */
(function(){
  const S = window.SITIO || {};

  async function leerJSON(url){
    try{const r=await fetch(url,{cache:'no-store'}); if(!r.ok) return null; return await r.json();}catch(e){return null;}
  }

  // Carpetas dentro de /trabajos: desde GitHub (automático) o desde trabajos.js
  async function carpetas(){
    const g=S.github||{};
    if(g.usuario&&g.repo){
      const lista=await leerJSON(`https://api.github.com/repos/${encodeURIComponent(g.usuario)}/${encodeURIComponent(g.repo)}/contents/trabajos`);
      if(Array.isArray(lista)){const ids=lista.filter(x=>x.type==='dir').map(x=>x.name); if(ids.length) return ids;}
    }
    return Array.isArray(window.TRABAJOS)?window.TRABAJOS.slice():[];
  }

  function legible(id){const t=id.replace(/[-_]+/g,' ').trim();return t.charAt(0).toUpperCase()+t.slice(1);}

  async function datos(id){
    const d=(await leerJSON(`trabajos/${encodeURIComponent(id)}/datos.json`))||{};
    return Object.assign({id, titulo:legible(id), tipo:'', lugar:'', anio:'', descripcion:'', orden:999, portada:'portada.jpg', modelo:'modelo.cifrado'}, d);
  }

  // Modelo 3D cifrado (AES-GCM, clave derivada con PBKDF2-SHA256). Devuelve el HTML o lanza 'clave'.
  const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  let cache={};
  async function paquete(t){
    if(cache[t.id]) return cache[t.id];
    const r=await fetch(`trabajos/${encodeURIComponent(t.id)}/${encodeURIComponent(t.modelo)}`,{cache:'no-store'});
    if(!r.ok) throw new Error('falta');
    return cache[t.id]=await r.json();
  }
  async function abrir(t,clave){
    if(!(window.crypto&&crypto.subtle)) throw new Error('navegador');
    const p=await paquete(t);
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(clave.normalize('NFC')),'PBKDF2',false,['deriveKey']);
    const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(p.s),iterations:p.it,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
    try{
      const plano=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(p.i)},k,b64(p.d));
      return new TextDecoder().decode(plano);
    }catch(e){throw new Error('clave');}
  }

  async function todos(){
    const ids=await carpetas();
    const items=await Promise.all(ids.map(datos));
    return items.sort((a,b)=>(a.orden-b.orden)||(String(b.anio).localeCompare(String(a.anio)))||a.titulo.localeCompare(b.titulo));
  }

  function meta(t){return [t.tipo,t.lugar,t.anio].filter(Boolean).join(' · ');}

  // Portada de reserva: una planta dibujada a partir del nombre del trabajo
  function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function planta(id){
    let h=hash(id); const r=()=>{h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;h^=h>>>16;return (h>>>0)/4294967296;};
    const W=400,H=300, x0=70,y0=52,x1=330,y1=248, rooms=[[x0,y0,x1,y1]];
    for(let i=0;i<5;i++){const k=Math.floor(r()*rooms.length),[a,b,c,d]=rooms[k];
      const vert=(c-a)>(d-b); const t=0.35+r()*0.3;
      if(vert&&c-a>70){const m=Math.round(a+(c-a)*t);rooms.splice(k,1,[a,b,m,d],[m,b,c,d]);}
      else if(d-b>60){const m=Math.round(b+(d-b)*t);rooms.splice(k,1,[a,b,c,m],[a,m,c,d]);}}
    const ac=getComputedStyle(document.documentElement).getPropertyValue('--negro').trim()||'#121212';
    const cf=getComputedStyle(document.documentElement).getPropertyValue('--cafe').trim()||'#4A3428';
    const ln=getComputedStyle(document.documentElement).getPropertyValue('--gris-1').trim()||'#EDEDEB';
    let g='';
    for(let x=0;x<=W;x+=20)g+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${ln}" stroke-width=".6"/>`;
    for(let y=0;y<=H;y+=20)g+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${ln}" stroke-width=".6"/>`;
    let p=rooms.map(([a,b,c,d])=>`<rect x="${a}" y="${b}" width="${c-a}" height="${d-b}" fill="none" stroke="${ac}" stroke-width="1.6"/>`).join('');
    // vanos de puerta
    rooms.forEach(([a,b,c,d],i)=>{if(i===0)return;const w=22,cx=a+(c-a)*(.25+r()*.5);p+=`<rect x="${cx-w/2}" y="${b-3}" width="${w}" height="6" fill="#FFFFFF"/><path d="M${cx-w/2} ${b} a${w} ${w} 0 0 1 ${w} ${w}" fill="none" stroke="${cf}" stroke-width="1.2"/>`;});
    p+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${ac}" stroke-width="4"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}${p}</svg>`;
  }

  window.Portfolio={todos,datos,meta,planta,abrir};
})();
