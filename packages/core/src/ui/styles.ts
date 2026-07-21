/**
 * All widget styles. ~4KB minified, injected only when the UI actually renders.
 * Every color/size is a `--cl-*` token, overridable via `ui.tokens` or page CSS.
 * Everything is position:fixed → the host page never shifts (CLS = 0).
 */
export const CSS = `
.cl-root{
  --cl-font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,sans-serif;
  --cl-bg:#ffffff;
  --cl-fg:#18181b;
  --cl-muted:#6b6b76;
  --cl-border:rgba(9,9,11,.1);
  --cl-border-w:1px;
  --cl-accent:#18181b;
  --cl-accent-fg:#ffffff;
  --cl-btn-bg:#f2f2f4;
  --cl-btn-fg:#18181b;
  --cl-switch-on:var(--cl-accent);
  --cl-switch-off:#d4d4d8;
  --cl-overlay:rgba(9,9,11,.42);
  --cl-focus:#2563eb;
  --cl-radius:16px;
  --cl-btn-radius:calc(var(--cl-radius)*.625);
  --cl-shadow:0 12px 48px rgba(9,9,11,.16),0 2px 8px rgba(9,9,11,.05);
  --cl-text:14px;
  --cl-width:24.5rem;
  --cl-gap:16px;
  --cl-pad:20px;
  --cl-z:2147483000;
  font-family:var(--cl-font);font-size:var(--cl-text);line-height:1.55;color:var(--cl-fg);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.cl-root[data-theme=dark]{
  --cl-bg:#1c1c21;--cl-fg:#f4f4f5;--cl-muted:#9d9da8;--cl-border:rgba(255,255,255,.11);
  --cl-accent:#f4f4f5;--cl-accent-fg:#18181b;--cl-btn-bg:#2b2b31;--cl-btn-fg:#f4f4f5;
  --cl-switch-off:#47474f;--cl-overlay:rgba(0,0,0,.55);
  --cl-shadow:0 12px 48px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3);
}
@media (prefers-color-scheme:dark){
  .cl-root[data-theme=auto]{
    --cl-bg:#1c1c21;--cl-fg:#f4f4f5;--cl-muted:#9d9da8;--cl-border:rgba(255,255,255,.11);
    --cl-accent:#f4f4f5;--cl-accent-fg:#18181b;--cl-btn-bg:#2b2b31;--cl-btn-fg:#f4f4f5;
    --cl-switch-off:#47474f;--cl-overlay:rgba(0,0,0,.55);
    --cl-shadow:0 12px 48px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3);
  }
}
.cl-root *,.cl-root *::before,.cl-root *::after{box-sizing:border-box;margin:0;padding:0}
.cl-root button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.cl-root :focus-visible{outline:2px solid var(--cl-focus);outline-offset:2px}
.cl-root .cl-banner:focus,.cl-root .cl-prefs:focus{outline:none}
.cl-root a{color:inherit}

/* ---- layers ------------------------------------------------------------ */
.cl-layer{
  position:fixed;inset:0;z-index:var(--cl-z);display:flex;padding:var(--cl-gap);
  padding-bottom:max(var(--cl-gap),env(safe-area-inset-bottom));
  pointer-events:none;visibility:hidden;transition:visibility 0s linear .26s;
}
.cl-layer.cl-on{visibility:visible;transition:none}

/* banner positions via flex alignment */
.cl-banner-layer{align-items:flex-end;justify-content:flex-end}
[data-position^=top] .cl-banner-layer{align-items:flex-start}
[data-position=middle-center] .cl-banner-layer{align-items:center}
[data-position$=left] .cl-banner-layer{justify-content:flex-start}
[data-position$=center] .cl-banner-layer{justify-content:center}

/* ---- banner card ------------------------------------------------------- */
.cl-banner{
  pointer-events:auto;background:var(--cl-bg);border:var(--cl-border-w) solid var(--cl-border);
  border-radius:var(--cl-radius);box-shadow:var(--cl-shadow);
  width:100%;max-width:var(--cl-width);padding:var(--cl-pad);
  opacity:0;transform:translateY(10px);
  transition:opacity .18s ease,transform .24s cubic-bezier(.2,.9,.3,1.2);
}
[data-position^=top] .cl-banner{transform:translateY(-10px)}
.cl-on .cl-banner{opacity:1;transform:none}
.cl-title{font-size:15px;font-weight:600;letter-spacing:-.01em}
.cl-desc{color:var(--cl-muted);margin-top:6px}
.cl-links{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;margin-top:10px}
.cl-links a{color:var(--cl-muted);font-size:12.5px;text-decoration:underline;text-underline-offset:2px}
.cl-links a:hover{color:var(--cl-fg)}
.cl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:calc(var(--cl-pad)*.8)}
.cl-root .cl-btn{
  flex:1 1 auto;min-height:38px;padding:8px 14px;border-radius:var(--cl-btn-radius);
  background:var(--cl-btn-bg);color:var(--cl-btn-fg);font-weight:500;white-space:nowrap;
  transition:filter .12s ease,transform .06s ease;
}
.cl-root .cl-btn:hover{filter:brightness(.95)}
.cl-root[data-theme=dark] .cl-btn:hover{filter:brightness(1.15)}
.cl-root .cl-btn:active{transform:scale(.985)}
.cl-root .cl-btn.cl-primary{background:var(--cl-accent);color:var(--cl-accent-fg)}
.cl-root .cl-btn.cl-ghost{background:transparent;color:var(--cl-muted);flex-grow:0}
.cl-root .cl-btn.cl-ghost:hover{color:var(--cl-fg);filter:none}
.cl-brand{display:block;margin-top:12px;font-size:11px;color:var(--cl-muted);opacity:.75;text-decoration:none}
.cl-brand:hover{opacity:1}
.cl-brand b{font-weight:600}
.cl-links .cl-brand{display:inline;margin:0;font-size:11.5px;text-decoration:none}

/* cloud: one horizontal pill */
[data-layout=cloud] .cl-banner{max-width:46rem;display:flex;align-items:center;gap:20px;padding:calc(var(--cl-pad)*.7) calc(var(--cl-pad)*.7) calc(var(--cl-pad)*.7) calc(var(--cl-pad)*1.1);border-radius:calc(var(--cl-radius)*1.5)}
[data-layout=cloud] .cl-banner-body{flex:1 1 auto;min-width:0}
[data-layout=cloud] .cl-title{font-size:14px}
[data-layout=cloud] .cl-desc{margin-top:2px;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
[data-layout=cloud] .cl-actions{margin-top:0;flex-wrap:nowrap}
[data-layout=cloud] .cl-btn{flex:0 0 auto}
[data-layout=cloud] .cl-links{margin-top:5px;gap:4px 12px}
[data-layout=cloud] .cl-links a{font-size:11.5px}

/* bar: full-width strip */
[data-layout=bar] .cl-banner-layer{padding:0}
[data-layout=bar] .cl-banner{max-width:none;border-radius:0;border-left:0;border-right:0;display:flex;align-items:center;gap:24px;padding:calc(var(--cl-pad)*.7) clamp(16px,4vw,40px)}
[data-layout=bar] .cl-banner-body{flex:1 1 auto}
[data-layout=bar] .cl-desc{margin-top:2px}
[data-layout=bar] .cl-actions{margin-top:0;flex-wrap:nowrap}
[data-layout=bar] .cl-btn{flex:0 0 auto}
[data-layout=bar][data-position^=bottom] .cl-banner{border-bottom:0}
[data-layout=bar][data-position^=top] .cl-banner{border-top:0}
[data-layout=bar] .cl-links{margin-top:5px}

/* ---- preferences ------------------------------------------------------- */
.cl-prefs-layer{align-items:center;justify-content:center}
.cl-overlay{position:absolute;inset:0;background:var(--cl-overlay);opacity:0;transition:opacity .2s ease}
.cl-on .cl-overlay{opacity:1;pointer-events:auto}
.cl-prefs{
  position:relative;pointer-events:auto;display:flex;flex-direction:column;
  background:var(--cl-bg);border:var(--cl-border-w) solid var(--cl-border);border-radius:var(--cl-radius);
  box-shadow:var(--cl-shadow);width:100%;max-width:34rem;max-height:min(85vh,44rem);
  opacity:0;transform:translateY(14px) scale(.98);
  transition:opacity .18s ease,transform .24s cubic-bezier(.2,.9,.3,1.2);
}
.cl-on .cl-prefs{opacity:1;transform:none}
[data-prefs=drawer] .cl-prefs-layer{justify-content:flex-end;padding:0}
[data-prefs=drawer] .cl-prefs{height:100%;max-height:none;max-width:27rem;border-radius:0;border-top:0;border-bottom:0;border-right:0;transform:translateX(24px)}
[data-prefs=drawer] .cl-on .cl-prefs{transform:none}
.cl-prefs-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(var(--cl-pad)*.9) var(--cl-pad) 0}
.cl-prefs-head .cl-title{font-size:16px}
.cl-root .cl-x{width:32px;height:32px;border-radius:calc(var(--cl-radius)*.5);color:var(--cl-muted);display:grid;place-items:center;flex:0 0 auto}
.cl-root .cl-x:hover{background:var(--cl-btn-bg);color:var(--cl-fg)}
.cl-prefs>.cl-desc{padding:6px var(--cl-pad) 0}
.cl-cats{overflow-y:auto;padding:calc(var(--cl-pad)*.8) var(--cl-pad);display:flex;flex-direction:column;gap:calc(var(--cl-pad)*.5);overscroll-behavior:contain}
.cl-cat{border:var(--cl-border-w) solid var(--cl-border);border-radius:calc(var(--cl-radius)*.75);padding:calc(var(--cl-pad)*.7) calc(var(--cl-pad)*.8)}
.cl-cat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.cl-cat-title{font-size:14px;font-weight:600}
.cl-cat-desc{color:var(--cl-muted);font-size:13px;margin-top:2px}
.cl-always{font-size:12px;font-weight:500;color:var(--cl-muted);white-space:nowrap;padding-top:3px}
.cl-svcs{margin-top:10px;border-top:1px solid var(--cl-border);padding-top:4px}
.cl-svcs summary{cursor:pointer;font-size:12.5px;color:var(--cl-muted);padding:6px 0;list-style:none;display:flex;align-items:center;gap:6px}
.cl-svcs summary::-webkit-details-marker{display:none}
.cl-svcs summary::before{content:"";width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s ease}
.cl-svcs[open] summary::before{transform:rotate(45deg)}
.cl-svc{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px}
.cl-prefs-foot{display:flex;flex-wrap:wrap;gap:8px;padding:calc(var(--cl-pad)*.7) var(--cl-pad) calc(var(--cl-pad)*.9);border-top:1px solid var(--cl-border)}
.cl-prefs-foot .cl-btn.cl-primary{flex:2 1 auto}
.cl-legal{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;padding:0 var(--cl-pad) calc(var(--cl-pad)*.7);font-size:11.5px}
.cl-legal a{color:var(--cl-muted);text-decoration:underline;text-underline-offset:2px}
.cl-legal a:hover{color:var(--cl-fg)}
.cl-legal .cl-brand{display:inline;margin:0;margin-inline-start:auto;font-size:11px;text-decoration:none}

/* ---- switch ------------------------------------------------------------ */
.cl-root .cl-switch{
  flex:0 0 auto;width:40px;height:24px;border-radius:calc(var(--cl-radius)*62);background:var(--cl-switch-off);
  position:relative;transition:background .16s ease;
}
.cl-root .cl-switch::after{
  content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:calc(var(--cl-radius)*62);
  background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .16s ease;
}
.cl-root .cl-switch[aria-checked=true]{background:var(--cl-switch-on)}
.cl-root .cl-switch[aria-checked=true]::after{transform:translateX(16px)}
.cl-root .cl-switch:disabled{opacity:.55;cursor:not-allowed}
.cl-root[data-theme=dark] .cl-switch[aria-checked=true]::after{background:var(--cl-accent-fg)}

/* ---- floating button --------------------------------------------------- */
.cl-fab-layer{align-items:flex-end;justify-content:flex-start}
.cl-root .cl-fab{
  pointer-events:auto;width:44px;height:44px;border-radius:calc(var(--cl-radius)*62);display:grid;place-items:center;
  background:var(--cl-bg);color:var(--cl-fg);border:var(--cl-border-w) solid var(--cl-border);box-shadow:var(--cl-shadow);
  opacity:0;transform:scale(.85);transition:opacity .18s ease,transform .18s ease;
}
.cl-on .cl-fab{opacity:1;transform:none}
.cl-root .cl-fab:hover{transform:scale(1.06)}
.cl-fab svg{width:20px;height:20px}

/* ---- mobile ------------------------------------------------------------ */
@media (max-width:640px){
  .cl-root{--cl-gap:10px}
  .cl-banner-layer{align-items:flex-end!important;justify-content:center!important}
  [data-position^=top] .cl-banner-layer{align-items:flex-start!important}
  .cl-banner{max-width:none}
  [data-layout=cloud] .cl-banner,[data-layout=bar] .cl-banner{display:block;padding:18px}
  [data-layout=cloud] .cl-actions,[data-layout=bar] .cl-actions{margin-top:14px}
  [data-layout=cloud] .cl-desc{display:block;-webkit-line-clamp:none}
  .cl-prefs-layer{padding:0;align-items:flex-end}
  .cl-prefs{max-width:none;max-height:92vh;border-radius:var(--cl-radius) var(--cl-radius) 0 0;border-bottom:0}
  [data-prefs=drawer] .cl-prefs{height:auto;max-height:92vh;border:var(--cl-border-w) solid var(--cl-border);border-bottom:0}
  .cl-btn{min-height:42px}
}

/* ---- motion / transitions off ------------------------------------------ */
@media (prefers-reduced-motion:reduce){
  .cl-root *{transition:none!important}
}
.cl-root[data-anim=off] *{transition:none!important}
`;
