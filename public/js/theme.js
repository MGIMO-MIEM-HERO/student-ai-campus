// Apply the saved theme before styles load; switching never rebuilds page content.
(() => {
  const key='campusTheme',root=document.documentElement;
  const moon='<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>';
  const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  function apply(value,persist=false){
    const dark=value==='dark';
    root.dataset.theme=dark?'dark':'light';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=dark?'#11151b':'#ffffff';
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
      const label=dark?'Включить светлую тему':'Включить тёмную тему';
      button.setAttribute('aria-label',label);button.setAttribute('title',label);
      button.setAttribute('aria-pressed',String(dark));
      button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark?sun:moon}</svg>`;
    });
    if(persist)try{localStorage.setItem(key,root.dataset.theme);}catch{}
  }
  let saved='light';try{saved=localStorage.getItem(key)||'light';}catch{}
  apply(saved);
  function install(){
    const app=document.querySelector('#app');if(!app)return;
    function mount(){
      if(app.querySelector('[data-theme-toggle]'))return;
      const header=app.querySelector('.topbar-in');
      const button=document.createElement('button');
      button.type='button';button.dataset.themeToggle='';
      button.className=`theme-toggle${header?'':' theme-floating'}`;
      (header||app).append(button);apply(root.dataset.theme);
    }
    mount();new MutationObserver(mount).observe(app,{childList:true});
    document.addEventListener('click',event=>{
      if(!event.target.closest?.('[data-theme-toggle]'))return;
      event.preventDefault();apply(root.dataset.theme==='dark'?'light':'dark',true);
    });
    window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
