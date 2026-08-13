(function(){
'use strict';
var DEF_PWD='andro1234';
var DEF_KEY='$2a$10$YaCG.b4SMEWXxOATugwQZepjVZe6SWIe6T5EEqa6veNvtP7VRPZa6';
var DEF_BIN='6a4e5dd5da38895dfe40dfff';
var accounts=[],settings={},isTesting=false,isValidating=false;
var sb=document.getElementById('sb');

function status(msg,t,dur){
  sb.textContent=msg; sb.className='show '+(t||'inf');
  clearTimeout(sb._t); sb._t=setTimeout(function(){sb.className='';},dur||3500);
}

function getPwd(){return localStorage.getItem('sv_pwd')||DEF_PWD;}
function isUnlocked(){return sessionStorage.getItem('sv_ok')==='1';}
function getKey(){return settings.apiKey||DEF_KEY;}
function getBin(){return settings.binId||DEF_BIN;}

// ---- AUTH ----
document.getElementById('loginBtn').addEventListener('click',function(){
  var pwd=document.getElementById('pwdIn').value;
  if(pwd===getPwd()){
    sessionStorage.setItem('sv_ok','1');
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('mainScreen').style.display='block';
    init();
  }else{
    var err=document.getElementById('lerr'); err.textContent='Incorrect password';
    setTimeout(function(){err.textContent='';},2000);
  }
});
document.getElementById('pwdIn').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('loginBtn').click();});
if(isUnlocked()){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('mainScreen').style.display='block';
}

// ---- TABS ----
document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
    tab.classList.add('active');
    document.getElementById('panel-'+tab.dataset.tab).classList.add('active');
    if(tab.dataset.tab==='accounts')renderAccounts();
    if(tab.dataset.tab==='overview')renderOverview();
  });
});

var DEF_GH_REPO = 'MoGLCL/streamvault-data';
var DEF_GH_TOKEN = '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';
var OLD_GH_TOKEN = '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';

function getGithubGistId(){return settings.githubGistId||'';}
function getGithubRepo(){
  if (!settings.githubRepo || settings.githubRepo === 'andromodern2/streamvault') return DEF_GH_REPO;
  return settings.githubRepo;
}
function getGithubToken(){
  if (!settings.githubToken || settings.githubToken === OLD_GH_TOKEN) return DEF_GH_TOKEN;
  return settings.githubToken;
}
function isGistConfigured(){return !!(getGithubGistId()&&getGithubToken());}
function isGithubConfigured(){return !!(getGithubRepo()&&getGithubToken());}

async function fetchOnline(){
  return new Promise(function(resolve,reject){
    chrome.runtime.sendMessage({
      action:'loadOnlineData',
      githubGistId:getGithubGistId(),
      githubRepo:getGithubRepo(),
      githubToken:getGithubToken(),
      apiKey:settings.apiKey||'',
      binId:settings.binId||''
    },function(r){
      if(chrome.runtime.lastError)return reject(new Error(chrome.runtime.lastError.message));
      if(r&&r.success)resolve(r.data||{});
      else reject(new Error(r&&r.error||'Sync failed'));
    });
  });
}
async function pushToGist(data){
  return new Promise(function(resolve,reject){
    chrome.runtime.sendMessage({
      action:'pushToGist',
      githubToken:getGithubToken(),
      githubGistId:getGithubGistId(),
      data:data
    },function(r){
      if(chrome.runtime.lastError)return reject(new Error(chrome.runtime.lastError.message));
      if(r&&r.success){
        if(r.gistId && r.gistId !== getGithubGistId()){
          settings.githubGistId = r.gistId;
          localStorage.setItem('sv_settings',JSON.stringify(settings));
          var el = document.getElementById('sGithubGistId');
          if(el) el.value = r.gistId;
        }
        resolve();
      }
      else reject(new Error(r&&r.error||'Gist push failed'));
    });
  });
}
async function pushToGitHub(data){
  return new Promise(function(resolve,reject){
    chrome.runtime.sendMessage({
      action:'pushToGitHub',
      githubToken:getGithubToken(),
      githubRepo:getGithubRepo(),
      data:data
    },function(r){
      if(chrome.runtime.lastError)return reject(new Error(chrome.runtime.lastError.message));
      if(r&&r.success)resolve();
      else reject(new Error(r&&r.error||'Push failed'));
    });
  });
}
async function saveOnline(data){
  // Always save to GitHub Repository (pre-configured in background.js)
  await pushToGitHub(data);
}
function loadLocal(){accounts=JSON.parse(localStorage.getItem('sv_accounts')||'[]');}
function saveLocal(){
  localStorage.setItem('sv_accounts',JSON.stringify(accounts));
  chrome.storage.local.set({ cached_accounts: accounts });
}
var saveOnlineTimeout = null;
async function saveAll(forceOnlineNow){
  saveLocal();
  
  if (forceOnlineNow === true) {
    clearTimeout(saveOnlineTimeout);
    await performOnlineSave();
  } else {
    status('Saved locally (cloud sync pending...)','inf');
    clearTimeout(saveOnlineTimeout);
    saveOnlineTimeout = setTimeout(async function(){
      status('Syncing with cloud...','inf');
      try {
        await performOnlineSave();
      } catch(e) {
        status('Cloud sync failed: ' + e.message, 'err');
      }
    }, 4000); // 4 seconds debounce
  }
}

async function performOnlineSave(){
  var data={accounts:accounts,updatedAt:new Date().toISOString()};
  try {
    await saveOnline(data);
    status('Auto-pushed to GitHub Repo!','ok');
  } catch(e) {
    status('Saved locally only: '+e.message,'err');
    throw e;
  }
}

// ---- INIT ---- (NO auto-testing, NO auto-expired toasts)
async function init(){
  settings=JSON.parse(localStorage.getItem('sv_settings')||'{}');
  if(settings.apiKey)document.getElementById('sApiKey').value=settings.apiKey;
  if(settings.binId)document.getElementById('sBinId').value=settings.binId;
  if(settings.githubGistId)document.getElementById('sGithubGistId').value=settings.githubGistId;
  if(settings.githubRepo)document.getElementById('sGithubRepo').value=settings.githubRepo;
  if(settings.githubToken)document.getElementById('sGithubToken').value=settings.githubToken;
  
  // Show/hide GitHub status indicator
  var statusEl = document.getElementById('ghStatus');
  if(getGithubGistId() && getGithubToken()){
    statusEl.textContent='✅ GitHub Gist Sync active (auto-push ON)';
    statusEl.style.background='#0d2b1a'; statusEl.style.color='#4ade80';
  } else if(isGithubConfigured()){
    statusEl.textContent='✅ GitHub Repo Sync active (auto-push ON)';
    statusEl.style.background='#0d2b1a'; statusEl.style.color='#4ade80';
  } else if(getGithubToken() && !getGithubGistId() && !getGithubRepo()){
    statusEl.textContent='⚡ Gist Auto-Creation ready (will create Gist on first Save)';
    statusEl.style.background='#1e1b4b'; statusEl.style.color='#a5b4fc';
  } else {
    statusEl.textContent='⚠️ GitHub/Gist not configured (using JSONBin)';
    statusEl.style.background='#2a1a0c'; statusEl.style.color='#fcd34d';
  }

  loadLocal();
  buildPlatformSelects();
  renderOverview();
  renderAccounts();
  // Silent cloud sync - no individual account status toasts
  try{
    var data=await fetchOnline();
    if(Array.isArray(data.accounts)&&data.accounts.length>0){
      // Merge: cloud wins if more accounts, but NEVER auto-test or show per-account toasts
      if(data.accounts.length>=accounts.length){
        accounts=data.accounts;
        saveLocal();
        renderOverview();
        renderAccounts();
      }
      status('Synced — '+accounts.length+' accounts loaded','ok');
    } else {
      status('Ready — '+accounts.length+' local accounts','inf');
    }
  }catch(e){
    status('Offline — using local data','inf');
  }
}

function buildPlatformSelects(){
  var sel1=document.getElementById('addPlatform');
  var sel2=document.getElementById('fpf');
  sel2.innerHTML='<option value="">All Platforms</option>';
  Object.values(PLATFORMS).forEach(function(p){
    var o1=document.createElement('option'); o1.value=p.id; o1.textContent=p.emoji+' '+p.name; sel1.appendChild(o1);
    var o2=document.createElement('option'); o2.value=p.id; o2.textContent=p.emoji+' '+p.name; sel2.appendChild(o2);
  });
}

// ---- OVERVIEW ----
function renderOverview(){
  var total=accounts.length;
  var working=accounts.filter(function(a){return a.isWorking===true;}).length;
  var active=new Set(accounts.filter(function(a){return a.isWorking===true;}).map(function(a){return a.platform;})).size;
  document.getElementById('ov-t').textContent=total;
  document.getElementById('ov-w').textContent=working;
  document.getElementById('ov-p').textContent=active;
  document.getElementById('tcnt').textContent=total;
  var grid=document.getElementById('povGrid'); grid.innerHTML='';
  Object.values(PLATFORMS).forEach(function(p){
    var pw=accounts.filter(function(a){return a.platform===p.id&&a.isWorking===true;}).length;
    var pa=accounts.filter(function(a){return a.platform===p.id;}).length;
    var c=document.createElement('div'); c.className='pov-card';
    c.style.borderColor=pw>0?p.color+'33':'';
    c.innerHTML='<div class="pov-icon" style="color:'+p.color+'">'+p.icon+'</div><div class="pov-info"><div class="pov-name">'+p.name+'</div><div class="pov-count">'+pa+' accounts</div></div><div class="pov-badge '+(pw>0?'has':'none')+'">'+pw+' ✅</div>';
    grid.appendChild(c);
  });
}

// ---- ACCOUNTS ----
function renderAccounts(){
  var fp=document.getElementById('fpf').value;
  var fs=document.getElementById('fps').value;
  var fq=(document.getElementById('fsearch').value||'').toLowerCase();
  var list=document.getElementById('acctList');
  var filtered=accounts.filter(function(a){
    if(fp&&a.platform!==fp)return false;
    if(fs==='w'&&a.isWorking!==true)return false;
    if(fs==='e'&&a.isWorking!==false)return false;
    if(fs==='u'&&a.isWorking!==null&&a.isWorking!==undefined)return false;
    if(fq&&!(a.name||'').toLowerCase().includes(fq))return false;
    return true;
  });
  if(filtered.length===0){
    list.innerHTML='<div class="empty-state"><div class="empty-icon" style="display: flex; align-items: center; justify-content: center; margin-bottom: 12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px; color: var(--muted);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg></div><div>No accounts found</div><div style="font-size:11px;margin-top:5px">Add accounts in the ‘Add Account’ tab or import a .txt file</div></div>';
    return;
  }
  list.innerHTML='';
  filtered.forEach(function(acct){
    var p=PLATFORMS[acct.platform]||{};
    var sc=acct.isWorking===true?'w':acct.isWorking===false?'e':'u';
    var sl=acct.isWorking===true?'Working':acct.isWorking===false?'Expired':'Unknown';
    var c=document.createElement('div'); c.className='ac';
    c.innerHTML='<div class="ac-dot" style="background:'+esc(p.color||'#6c63ff')+';box-shadow:0 0 6px '+esc(p.color||'#6c63ff')+'66"></div>'
      +'<div class="ac-info"><div class="ac-name">'+esc(acct.name||'Unnamed')+'</div><div class="ac-meta"><span>'+(p.icon||'<span style="font-size:10px">❓</span>')+' '+(p.name||acct.platform||'?')+'</span>'+(acct.lastTested?'<span>Tested: '+new Date(acct.lastTested).toLocaleDateString()+'</span>':'')+'</div></div>'
      +'<div class="stp '+sc+'">'+sl+'</div>'
      +'<div class="ac-btns">'
        +'<button class="ibtn cp" data-id="'+acct.id+'" style="display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 11px; height: 11px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button>'
        +'<button class="ibtn tst" data-id="'+acct.id+'" style="display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 11px; height: 11px;"><path d="M10 2v7.31L3.89 19.3a2 2 0 0 0 1.66 2.7h13a2 2 0 0 0 1.66-2.7L14 9.31V2h-4z"/></svg>Test</button>'
        +'<button class="ibtn del" data-id="'+acct.id+'" style="display: inline-flex; align-items: center; justify-content: center; padding: 5px 8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
      +'</div>';
    list.appendChild(c);
  });
  list.querySelectorAll('.ibtn.cp').forEach(function(btn){
    btn.addEventListener('click',function(){
      var acct = accounts.find(function(a){return a.id === btn.dataset.id;});
      if(acct) {
        navigator.clipboard.writeText(acct.cookies);
        status('Copied to clipboard','ok');
      }
    });
  });
  list.querySelectorAll('.ibtn.tst').forEach(function(btn){
    btn.addEventListener('click',function(){testAccount(btn.dataset.id,btn);});
  });
  list.querySelectorAll('.ibtn.del').forEach(function(btn){
    btn.addEventListener('click',function(){deleteAccount(btn.dataset.id);});
  });
}

['fpf','fps'].forEach(function(id){document.getElementById(id).addEventListener('change',renderAccounts);});
document.getElementById('fsearch').addEventListener('input',renderAccounts);

// ============================================
// COOKIE AUTO-DETECT PARSER
// Handles ALL formats automatically
// ============================================

// ============================================================
// SUPER SMART COOKIE DETECTOR v2 — all 9 streaming platforms
// Scans EVERY token in the file regardless of format/order
// ============================================================

// Known cookie names per platform (used to boost confidence)
var PLATFORM_COOKIE_NAMES = {
  netflix:   ['NetflixId','SecureNetflixId','nfvdid','memclid','profilesNewSession','nfgw','flwssn','LOG_COOKIE','AK_bmsc','bm_sv','bm_sz'],
  prime:     ['session-id','session-id-time','session-token','ubid-main','x-main','at-main','sess-at-main','lc-main','i18n-prefs','sp-cdn','csm-hit','aws-ubid-main','ubid-acbus','sess-at-acbus','ubid-tv','at-acbus','x-acbus','ad-id','apn-user-id','s_fid','ubid-us'],
  max:       ['access_token','refresh_token','hbo_profile_id','hboToken','max_session_token','hbomax-access','hbomax-refresh','datadome','hbo_session','provider_id'],
  disney:    ['SWID','bamguid','account_token','device_token','subscriber_token','BAM-token','id_token','sessionId','DisneyId','disneyid_access_token'],
  paramount: ['_authToken','_refreshToken','par_session','visitor_id','accountId','auth_token','cbs_user_token','cbsid','cbs_session'],
  hulu:      ['_hulu_session','hulu_ssid','USER_SESSION','HULU_USER_SESSION','_hulu_ab','_hulu_pm','_hulu_uid','_hulu_language'],
  appletv:   ['media-user-token','itspod','X-Dsid','acn01','myacinfo','DSID','dqsid','pldflt','geo'],
  peacock:   ['ajs_user_id','_pctx','_pcid','s_vi','mbox','peacocktv_session','aam_uuid','demdex','dpm'],
  crunchyroll:['etp_rt','session_id','c_visitor','session_expire','ssid','_fwb','hhcookie']
};

// Keys that are definitely NOT cookie names (ignore during raw scan)
var NON_COOKIE_KEYS = new Set([
  'href','src','class','id','style','type','action','method','http','https',
  'data','path','domain','expires','max-age','samesite','secure','httponly',
  'charset','content','lang','dir','alt','title','rel','media','role',
  'width','height','fill','stroke','xmlns','var','let','const','return',
  'function','import','export','from','true','false','null','undefined',
  'new','this','if','else','for','while','do','try','catch','throw',
  'the','and','for','not','you','that','with','from','have','this',
  'version','date','time','user','pass','password','email','username'
]);

function detectAndParseCookies(raw) {
  if (!raw || typeof raw !== 'string') return { cookies: {}, format: 'unknown', count: 0 };
  var text = raw.trim();
  var out = {};
  var bestFormat = 'unknown';
  var methodHits = {};

  // === METHOD 1: JSON array (Cookie-Editor / EditThisCookie / DevTools) ===
  var jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      var arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr)) {
        arr.forEach(function(c) {
          if (c && c.name && c.value !== undefined) { out[c.name] = String(c.value); methodHits.json = (methodHits.json||0)+1; }
        });
        if (methodHits.json) bestFormat = 'json';
      }
    } catch(e) {}
  }
  // Also try JSON object with cookies key
  try {
    var obj = JSON.parse(text);
    if (obj && obj.cookies && Array.isArray(obj.cookies)) {
      obj.cookies.forEach(function(c) {
        if (c && c.name && c.value !== undefined) { out[c.name] = String(c.value); methodHits.json = (methodHits.json||0)+1; }
      });
    }
  } catch(e) {}

  // === METHOD 2: Netscape tab-delimited ===
  // Works even if file has other content mixed in
  text.split('\n').forEach(function(line) {
    var t = line.trim();
    if (!t || t.startsWith('#')) return;
    var parts = t.split('\t');
    if (parts.length >= 7) {
      var name = parts[5]; var value = parts[6];
      if (name && name.length > 1 && !/\s/.test(name)) {
        out[name] = value || '';
        methodHits.netscape = (methodHits.netscape||0)+1;
      }
    }
  });
  if (methodHits.netscape) bestFormat = 'netscape';

  // === METHOD 3: HTTP Cookie header style (key=v; key2=v2) ===
  // Handle any line that looks like a cookie header
  text.split('\n').forEach(function(line) {
    var t = line.trim().replace(/^[Cc]ookie\s*:\s*/,'');
    if (!t || !t.includes('=')) return;
    var semis = (t.match(/;/g)||[]).length;
    if (semis >= 1) {
      t.split(';').forEach(function(pair) {
        var eq = pair.indexOf('=');
        if (eq > 0) {
          var k = pair.slice(0,eq).trim();
          var v = pair.slice(eq+1).trim();
          if (k && v && k.length>=2 && k.length<=60 && !/\s/.test(k) && !NON_COOKIE_KEYS.has(k.toLowerCase())) {
            out[k] = v;
            methodHits.http = (methodHits.http||0)+1;
          }
        }
      });
      if (methodHits.http && bestFormat==='unknown') bestFormat='http-header';
    }
  });

  // === METHOD 4: One-per-line key=value ===
  text.split('\n').forEach(function(line) {
    var t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('//') || t.startsWith('<')) return;
    // Skip lines with spaces before the = (likely sentences)
    var eq = t.indexOf('=');
    if (eq < 1) return;
    var k = t.slice(0,eq).trim();
    var v = t.slice(eq+1).trim();
    if (k && v && k.length>=2 && k.length<=60 && !/\s/.test(k) && !NON_COOKIE_KEYS.has(k.toLowerCase())) {
      out[k] = v;
      methodHits.kv = (methodHits.kv||0)+1;
    }
  });
  if (methodHits.kv && bestFormat==='unknown') bestFormat='key-value';

  // === METHOD 5: RAW FULL-TEXT SCAN (NUCLEAR OPTION) ===
  // Scans the ENTIRE file for any cookieName=cookieValue pattern
  // This catches cookies that are randomly placed anywhere in the text
  var rawPattern = /(?:^|[\s;,\n\r\t|#])([A-Za-z_][A-Za-z0-9_\-\.]{1,59})\s*=\s*([^\s;,\n\r\t"'<>(){}[\]\\]{2,4096})/gm;
  var match;
  while ((match = rawPattern.exec(text)) !== null) {
    var k = match[1].trim();
    var v = match[2].trim();
    if (!k || !v || k.length<2 || k.length>60) continue;
    if (NON_COOKIE_KEYS.has(k.toLowerCase())) continue;
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) continue;
    if (v.includes('<') || v.includes('>')) continue;
    // Only overwrite if we don\'t have it yet (previous methods had higher confidence)
    if (!out[k]) {
      out[k] = v;
      methodHits.raw = (methodHits.raw||0)+1;
    }
  }
  if (methodHits.raw && bestFormat==='unknown') bestFormat='raw-scan';

  // === CLEANUP: remove obvious non-cookie artifacts ===
  Object.keys(out).forEach(function(k) {
    var v = out[k];
    if (!v) { delete out[k]; return; }
    if (v.startsWith('http') || v.includes('://')) { delete out[k]; return; }
    if (v.includes('<') || v.includes('>')) { delete out[k]; return; }
  });

  var count = Object.keys(out).length;
  return { cookies: out, format: bestFormat, count: count };
}

function cleanCookiesText(rawText) {
  var parsed = detectAndParseCookies(rawText);
  var outLines = [];
  for (var name in parsed.cookies) {
    outLines.push(name + '=' + parsed.cookies[name]);
  }
  return outLines.join('\n');
}


// Extract account info from a text file block
function extractAccountFromText(text) {
  var lines = text.split('\n');
  var name = '';
  var platform = '';
  var email = '';
  var cookieStart = -1;
  var cookieSection = '';

  // Look for metadata lines
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim().toLowerCase();
    if (!name && (l.startsWith('name:') || l.startsWith('account:'))) {
      name = lines[i].trim().split(':').slice(1).join(':').trim();
    }
    if (!email && (l.startsWith('email:') || l.startsWith('username:'))) {
      email = lines[i].trim().split(':').slice(1).join(':').trim();
    }
    if (!platform) {
      Object.keys(PLATFORMS).forEach(function(pid) {
        var pname = PLATFORMS[pid].name.toLowerCase();
        if (l.includes(pname) || l.includes(pid)) platform = pid;
      });
    }
    // Find cookie section start
    if (l.includes('cookie') && (l.includes(':') || l.includes('#') || l.includes('='))) {
      cookieStart = i;
    }
  }

  // Extract cookie content - everything after cookie header or try whole text
  if (cookieStart >= 0) {
    // Get lines after the cookie marker
    cookieSection = lines.slice(cookieStart).join('\n');
  } else {
    cookieSection = text; // Try whole thing
  }

  var parsed = detectAndParseCookies(cookieSection);

  // Fallback name
  if (!name) {
    name = email || ('Account ' + (accounts.length + 1));
  }

  return {
    name: name,
    platform: platform,
    email: email,
    cookieText: cookieSection,
    cookies: parsed.cookies,
    format: parsed.format,
    cookieCount: Object.keys(parsed.cookies).length
  };
}

// Parse multi-account TXT file (separated by ---, ===, or blank lines)
function parseMultiAccountFile(text, defaultPlatform) {
  var results = [];

  // Try splitting by common separators
  var blocks;
  if (text.includes('---') || text.includes('===') || text.includes('###')) {
    blocks = text.split(/^[-=]{3,}|^#{3,}/m);
  } else {
    // Single account
    blocks = [text];
  }

  blocks.forEach(function(block, i) {
    var b = block.trim();
    if (!b) return;
    var info = extractAccountFromText(b);
    if (!info.platform && defaultPlatform) info.platform = defaultPlatform;
    if (info.cookieCount === 0) return; // Skip blocks with no cookies
    results.push({
      id: Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5),
      name: info.name,
      platform: info.platform || defaultPlatform || '',
      cookies: cleanCookiesText(b), // Clean cookies text
      isWorking: null,
      addedAt: new Date().toISOString(),
      lastTested: null,
      cookieFormat: info.format
    });
  });

  return results;
}

// ---- SHARED FILE IMPORT AND CLEANER LOGIC ----
function handleFiles(files) {
  if (!files || files.length === 0) return;
  var platform = document.getElementById('addPlatform').value;
  var preview = document.getElementById('filePreview');
  var importInfo = document.getElementById('importInfo');
  
  if (files.length === 1) {
    // Single file
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = ev.target.result;
      // Clean only cookies from the file (ignores all other text, emails, headers)
      var cleanText = cleanCookiesText(text);
      var parsed = detectAndParseCookies(cleanText);
      
      if (parsed.count > 0) {
        var name = file.name.replace(/\.(txt|json|log|cookie|cookies)$/i,'').replace(/[-_]/g,' ').trim();
        document.getElementById('addName').value = name;
        document.getElementById('addCookies').value = cleanText;
        importInfo.innerHTML = 'Detected <strong>' + parsed.count + ' cookies</strong> in <strong>' + parsed.format + '</strong> format';
        importInfo.className = 'import-info ok';
        preview.style.display = 'block';
        document.getElementById('importAllBtn').style.display = 'none';
        
        // Auto-select platform if detected
        var info = extractAccountFromText(text);
        if (info.platform) {
          document.getElementById('addPlatform').value = info.platform;
        }
      } else {
        // Try multi-account parse
        var multiAccounts = parseMultiAccountFile(text, platform);
        if (multiAccounts.length > 0) {
          // clean each multi block
          multiAccounts.forEach(function(a) {
            a.cookies = cleanCookiesText(a.cookies);
          });
          document.getElementById('addCookies').value = text;
          importInfo.innerHTML = 'Found <strong>' + multiAccounts.length + ' account blocks</strong> — click <strong>Import All</strong>';
          importInfo.className = 'import-info info';
          preview.dataset.multi = JSON.stringify(multiAccounts);
          document.getElementById('importAllBtn').style.display = 'inline-flex';
          preview.style.display = 'block';
        } else {
          importInfo.innerHTML = 'Could not detect cookies. Try pasting manually.';
          importInfo.className = 'import-info err';
          preview.style.display = 'block';
        }
      }
    };
    reader.readAsText(file);
  } else {
    // Multiple files: batch import
    importInfo.innerHTML = 'Reading ' + files.length + ' files...';
    importInfo.className = 'import-info info';
    preview.style.display = 'block';
    var allAccounts = [];
    var processed = 0;
    
    files.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var text = ev.target.result;
        // Clean only cookies from the file (ignores all other text, emails, headers)
        var cleanText = cleanCookiesText(text);
        var parsed = detectAndParseCookies(cleanText);
        
        if (parsed.count > 0) {
          var name = file.name.replace(/\.(txt|json|log|cookie|cookies)$/i,'').replace(/[-_]/g,' ').trim() || ('Account ' + (allAccounts.length + 1));
          allAccounts.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + processed,
            name: name,
            platform: platform || 'netflix', // fallback if empty
            cookies: cleanText,
            isWorking: null,
            addedAt: new Date().toISOString(),
            lastTested: null,
            cookieFormat: parsed.format
          });
        } else {
          // Try multi-account blocks within this file
          var multiBlocks = parseMultiAccountFile(text, platform);
          if (multiBlocks.length > 0) {
            multiBlocks.forEach(function(a) {
              a.cookies = cleanCookiesText(a.cookies);
              if (a.cookies.length > 0) {
                allAccounts.push(a);
              }
            });
          }
        }
        
        processed++;
        if (processed === files.length) {
          if (allAccounts.length > 0) {
            preview.dataset.multi = JSON.stringify(allAccounts);
            importInfo.innerHTML = '<strong>' + allAccounts.length + ' accounts</strong> found across ' + files.length + ' files — click <strong>Import All</strong>';
            importInfo.className = 'import-info ok';
            document.getElementById('importAllBtn').style.display = 'inline-flex';
          } else {
            importInfo.innerHTML = 'No cookies detected in any of the ' + files.length + ' files';
            importInfo.className = 'import-info err';
            document.getElementById('importAllBtn').style.display = 'none';
          }
        }
      };
      reader.readAsText(file);
    });
  }
}

// ---- FILE IMPORT HANDLER (multi-select) ----
document.getElementById('fileImportInput').addEventListener('change', function(e) {
  var files = Array.from(e.target.files);
  handleFiles(files);
  e.target.value = ''; // Reset for re-use
});

// Drag and drop on textarea
var addCookiesTA = document.getElementById('addCookies');
addCookiesTA.addEventListener('dragover', function(e) { e.preventDefault(); addCookiesTA.style.borderColor='#6c63ff'; });
addCookiesTA.addEventListener('dragleave', function() { addCookiesTA.style.borderColor=''; });
addCookiesTA.addEventListener('drop', function(e) {
  e.preventDefault();
  addCookiesTA.style.borderColor='';
  var files = Array.from(e.dataTransfer.files);
  handleFiles(files);
});

// Auto-detect cookies as user types/pastes
addCookiesTA.addEventListener('input', function() {
  var val = this.value.trim();
  if (val.length < 5) return;
  var info = extractAccountFromText(val);
  var parsed = detectAndParseCookies(val);
  var n = Object.keys(parsed.cookies).length;
  var infoEl = document.getElementById('importInfo');
  var preview = document.getElementById('filePreview');
  if (n > 0) {
    var platformMsg = info.platform ? ' | Auto-detected: <strong>' + PLATFORMS[info.platform].name + '</strong>' : '';
    infoEl.innerHTML = 'Detected <strong>' + n + ' cookies</strong> in <strong>' + parsed.format + '</strong> format' + platformMsg;
    infoEl.className = 'import-info ok';
    preview.style.display = 'block';
    if (info.platform) {
      document.getElementById('addPlatform').value = info.platform;
    }
    var nameInput = document.getElementById('addName');
    if (!nameInput.value.trim() && info.name) {
      nameInput.value = info.name;
    }
  }
});

// Import All (multi-account file)
document.getElementById('importAllBtn').addEventListener('click', async function() {
  var preview = document.getElementById('filePreview');
  var multi = preview.dataset.multi;
  if (!multi) return;
  var toAdd;
  try { toAdd = JSON.parse(multi); } catch(e) { status('Parse error', 'err'); return; }
  if (!toAdd || toAdd.length === 0) { status('No accounts to import', 'err'); return; }
  var platform = document.getElementById('addPlatform').value;
  toAdd.forEach(function(a) {
    if (!a.platform && platform) a.platform = platform;
    if (!a.platform) return; // Skip if no platform
    accounts.push(a);
  });
  await saveAll();
  renderOverview();
  document.getElementById('addCookies').value = '';
  document.getElementById('addName').value = '';
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('importAllBtn').style.display = 'none';
  document.getElementById('importInfo').innerHTML = '';
  status('Imported ' + toAdd.length + ' accounts', 'ok');
});

// ---- ADD SINGLE ACCOUNT ----
document.getElementById('addBtn').addEventListener('click', async function(){
  var name=document.getElementById('addName').value.trim();
  var platform=document.getElementById('addPlatform').value;
  var cookies=document.getElementById('addCookies').value.trim();
  if(!name){status('Enter account name','err');return;}
  if(!platform){status('Select platform','err');return;}
  if(!cookies){status('Paste cookies or import a file','err');return;}
  var cleanText = cleanCookiesText(cookies);
  var parsed = detectAndParseCookies(cleanText);
  var n = Object.keys(parsed.cookies).length;
  if (n === 0) { status('Could not detect any cookies — check format', 'err'); return; }
  var a={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:name,platform:platform,cookies:cleanText,isWorking:null,addedAt:new Date().toISOString(),lastTested:null,cookieFormat:parsed.format};
  accounts.push(a);
  await saveAll();
  renderOverview();
  document.getElementById('addName').value='';
  document.getElementById('addCookies').value='';
  document.getElementById('filePreview').style.display='none';
  document.getElementById('importAllBtn').style.display='none';
  document.getElementById('importInfo').innerHTML='';
  status('Added: '+name+' (✅ '+n+' cookies detected)','ok');
});
document.getElementById('clearBtn').addEventListener('click',function(){
  document.getElementById('addName').value='';
  document.getElementById('addCookies').value='';
  document.getElementById('filePreview').style.display='none';
  document.getElementById('importAllBtn').style.display='none';
  document.getElementById('importInfo').innerHTML='';
});

// ---- DELETE ----
function deleteAccount(id){
  if(!confirm('Delete this account?'))return;
  accounts=accounts.filter(function(a){return a.id!==id;});
  saveAll(); renderOverview(); renderAccounts();
  status('Deleted','inf');
}
document.getElementById('delAllBtn').addEventListener('click',function(){
  var fp=document.getElementById('fpf').value;
  if(!confirm(fp?'Delete all accounts for this platform?':'Delete ALL accounts?'))return;
  accounts=fp?accounts.filter(function(a){return a.platform!==fp;}):
  [];
  saveAll(); renderOverview(); renderAccounts();
  status('Accounts deleted','inf');
});

// ---- TEST SINGLE ACCOUNT ----
async function testAccount(id,btn){
  if(isTesting){status('Wait for current test to finish','err');return;}
  var acct=accounts.find(function(a){return a.id===id;});
  if(!acct)return;
  var p=PLATFORMS[acct.platform];
  if(!p){status('Unknown platform','err');return;}
  isTesting=true;
  var orig=btn.textContent; btn.textContent='⏳'; btn.disabled=true;
  status('Testing '+acct.name+'...','inf');
  try{
    var r=await fastTest(acct,p);
    acct.isWorking=r.success; acct.lastTested=new Date().toISOString();
    await saveAll(); renderAccounts(); renderOverview();
    // Only show status bar toast, NO popup dialogs
    status(r.success?'✅ '+acct.name+' — WORKING':'❌ '+acct.name+' — Expired',r.success?'ok':'err');
  }catch(e){status('❌ '+e.message,'err');}
  finally{isTesting=false; btn.textContent=orig; btn.disabled=false;}
}

// ---- VALIDATE ALL ----
document.getElementById('valAllBtn').addEventListener('click',async function(){
  if(isValidating){status('Already running','err');return;}
  isValidating=true;
  var log=document.getElementById('valLog');
  var fill=document.getElementById('prog');
  var lbl=document.getElementById('progLbl');
  log.innerHTML=''; fill.style.width='0%';
  var list=accounts.slice();
  if(list.length===0){log.innerHTML='<div class="lin">No accounts to validate</div>';isValidating=false;return;}
  function addLog(msg,cls){var d=document.createElement('div');d.className=cls||'';d.textContent=msg;log.appendChild(d);log.scrollTop=log.scrollHeight;}
  addLog('Starting validation of '+list.length+' accounts...','lin');
  var done=0,ok=0,fail=0;
  for(var i=0;i<list.length;i++){
    var acct=list[i]; var p=PLATFORMS[acct.platform];
    if(!p){done++;continue;}
    lbl.textContent='Testing '+acct.name+' ('+(done+1)+'/'+list.length+')';
    try{
      var r=await fastTest(acct,p);
      acct.isWorking=r.success; acct.lastTested=new Date().toISOString();
      if(r.success){ok++;addLog('✅ '+acct.name+' ('+p.name+') — WORKING','lok');}
      else{fail++;addLog('❌ '+acct.name+' ('+p.name+') — EXPIRED','lfl');}
    }catch(e){fail++;addLog('❌ '+acct.name+' — ERROR: '+e.message,'lfl');}
    done++; fill.style.width=(done/list.length*100)+'%';
    await new Promise(function(res){setTimeout(res,400);});
  }
  await saveAll(); renderAccounts(); renderOverview();
  fill.style.width='100%';
  lbl.textContent='Done! '+ok+' working, '+fail+' expired out of '+list.length;
  addLog('=== DONE: '+ok+'/'+list.length+' working ===','lin');
  isValidating=false;
  // Only ONE summary toast, no per-account spam
  status('✅ Validation complete: '+ok+' working, '+fail+' expired','ok',5000);
});

document.getElementById('markAllBtn').addEventListener('click',async function(){
  if(!confirm('Mark all accounts as working (Unknown → Working)?'))return;
  accounts.forEach(function(a){a.isWorking=true;});
  await saveAll(); renderAccounts(); renderOverview();
  status('All marked as working','ok');
});

// Reset all to Unknown (useful when cloud data has stale states)
document.getElementById('resetStatusBtn').addEventListener('click',async function(){
  if(!confirm('Reset all account statuses to Unknown? (keeps cookies, clears Working/Expired)'))return;
  accounts.forEach(function(a){a.isWorking=null;a.lastTested=null;});
  await saveAll(); renderAccounts(); renderOverview();
  status('All statuses reset to Unknown','inf');
});

// ---- FAST TEST ----
async function fastTest(acct, p) {
  var parsed = detectAndParseCookies(acct.cookies);
  var cookies = parsed.cookies;
  if (Object.keys(cookies).length === 0) return { success: false, reason: 'No cookies parsed' };

  var tab = await chrome.tabs.create({ url: p.baseUrl, active: false });
  var tabId = tab.id;

  // Wait for initial page load via event (more reliable than fixed delay)
  await new Promise(function(resolve) {
    var timeout = setTimeout(function() {
      chrome.tabs.onUpdated.removeListener(onUpdate);
      resolve();
    }, 5000);
    function onUpdate(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpdate);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdate);
  });

  // Clear all existing platform cookies
  for (var dom of p.domains) {
    try {
      var existing = await chrome.cookies.getAll({ domain: dom });
      for (var c of existing) {
        var delUrl = dom.includes('apple') ? 'https://tv.apple.com' : 'https://www.' + dom.replace(/^\./, '');
        try { await chrome.cookies.remove({ url: delUrl, name: c.name }); } catch(e) {}
      }
    } catch(e) {}
  }

  // Inject new cookies
  for (var [name, value] of Object.entries(cookies)) {
    if (!value) continue;
    for (var dom2 of p.domains) {
      var baseUrl = dom2.includes('apple') ? 'https://tv.apple.com' : 'https://www.' + dom2.replace(/^\./, '');
      try {
        await chrome.cookies.set({
          url: baseUrl, name: name, value: value,
          domain: dom2, path: '/', secure: true, sameSite: 'lax'
        });
      } catch(e) {}
    }
  }

  // Reload and wait for COMPLETE load event — not a fixed timer
  var loadDone = new Promise(function(resolve) {
    var timeout = setTimeout(function() {
      chrome.tabs.onUpdated.removeListener(onUpd);
      resolve();
    }, 9000); // max 9s timeout
    function onUpd(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpd);
        // Extra 600ms for JS to settle after page "complete"
        setTimeout(resolve, 600);
      }
    }
    chrome.tabs.onUpdated.addListener(onUpd);
  });
  await chrome.tabs.reload(tabId);
  await loadDone;

  // Run loginChecker with retry
  var loginResult = { success: false, reason: 'timeout' };
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var results = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: loginChecker });
      var r = results[0] && results[0].result;
      if (r && r.success !== null) { loginResult = r; break; }
      await delay(1200);
    } catch(e) {
      await delay(800);
    }
  }

  try { await chrome.tabs.remove(tabId); } catch(e) {}
  return loginResult;
}

function loginChecker() {
  // If page not ready yet, signal retry
  if (document.readyState === 'loading') return { success: null, reason: 'not_ready' };

  var url = window.location.href;
  var hostname = window.location.hostname;

  // === SIGN-IN PAGE INDICATORS ===
  // If ANY of these appear in the URL, the account is definitely expired/invalid
  // because streaming platforms ALWAYS redirect to sign-in when cookies are bad
  var signInBlocks = [
    '/ap/signin', 'amazon.com/ap/', '/gp/sign-in', 'amazon.com/gp/sign',
    '/signin', '/login', 'LoginHelp', '/sign-in', '/sign_in',
    '/register', '/welcome', '/subscribe', '/sign-up', '/signup',
    'appleid.apple.com', 'idmsa.apple.com',
    '/create-account', '/identity/login', '/activate',
    '/checkout', '/account/signin', '/plans',
    'accounts.google.com', 'auth.', '/oauth',
    'id.hulu.com'
  ];
  if (signInBlocks.some(function(s) { return url.toLowerCase().includes(s.toLowerCase()); })) {
    return { success: false, user: null };
  }

  // === PLATFORM DOMAIN CHECK ===
  // Core insight: if cookies were invalid -> platform would have redirected to sign-in.
  // Being on the platform domain (not sign-in) = logged in.
  var platformDomains = [
    'netflix.com', 'primevideo.com', 'max.com', 'hbomax.com',
    'disneyplus.com', 'paramountplus.com', 'hulu.com',
    'tv.apple.com', 'peacocktv.com', 'crunchyroll.com'
  ];
  var onPlatform = platformDomains.some(function(d) { return hostname.includes(d); });

  // Also check we are not on a generic error or maintenance page
  var errorIndicators = ['error', '404', '503', 'maintenance', 'unavailable'];
  var onErrorPage = errorIndicators.some(function(s) { return url.toLowerCase().includes(s); })
    && !url.includes('/watch/') && !url.includes('/series/');

  // === DOM PROFILE ELEMENT CHECK (bonus confirmation) ===
  var profileSelectors = [
    '[data-uia="profile-avatar"]', '[data-uia="header-account-button"]',
    '#nav-link-accountList', '.av-action-profile', '.av-action-avatar',
    '[data-testid="profile-menu-toggle"]', '[class*="ProfileMenu"]',
    '[data-testid="avatar-button"]', '[data-gv2testid="avatar-btn"]',
    '[data-automationid="nav-profile"]', '[data-automationid="user-menu"]',
    '[data-testid="user-account-button"]',
    '[data-t="profile-link"]', '.header-user-menu',
    '[class*="UserDropdown"]', '[data-test="account-nav-item"]',
    '[data-testid="user-menu"]', '.profile-menu-button',
    '.nav-link-accountList', '[aria-label*="Account"]'
  ];
  var foundEl = null;
  for (var i = 0; i < profileSelectors.length; i++) {
    var el = document.querySelector(profileSelectors[i]);
    if (el) { foundEl = el; break; }
  }

  var isLoggedIn = onPlatform && !onErrorPage;
  var user = foundEl ? ((foundEl.getAttribute('aria-label') || foundEl.textContent || '').trim().slice(0, 40) || 'Verified User') : 'Verified User';

  return { success: isLoggedIn, user: isLoggedIn ? user : null };
}

function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ---- SETTINGS ----
document.getElementById('savePwdBtn').addEventListener('click',function(){
  var np=document.getElementById('newPwd').value.trim();
  if(!np||np.length<4){status('Password must be 4+ chars','err');return;}
  localStorage.setItem('sv_pwd',np); document.getElementById('newPwd').value='';
  status('Password updated','ok');
});
document.getElementById('saveApiBtn').addEventListener('click',function(){
  settings.apiKey=document.getElementById('sApiKey').value.trim();
  settings.binId=document.getElementById('sBinId').value.trim();
  settings.githubGistId=document.getElementById('sGithubGistId').value.trim();
  settings.githubRepo=document.getElementById('sGithubRepo').value.trim();
  settings.githubToken=document.getElementById('sGithubToken').value.trim();
  localStorage.setItem('sv_settings',JSON.stringify(settings));
  
  var gistOk = getGithubGistId() && getGithubToken();
  var repoOk = getGithubRepo() && getGithubToken();
  var createOk = getGithubToken() && !getGithubGistId() && !getGithubRepo();
  var statusEl = document.getElementById('ghStatus');
  
  if (gistOk) {
    statusEl.textContent = 'GitHub Gist Sync active (auto-push ON)';
    statusEl.style.background = '#0d2b1a'; statusEl.style.color = '#4ade80';
    status('Settings saved — GitHub Gist sync enabled!','ok');
  } else if (repoOk) {
    statusEl.textContent = 'GitHub Repo Sync active (auto-push ON)';
    statusEl.style.background = '#0d2b1a'; statusEl.style.color = '#4ade80';
    status('Settings saved — GitHub Repo sync enabled!','ok');
  } else if (createOk) {
    statusEl.textContent = 'Gist Auto-Creation ready (will create Gist on first Save)';
    statusEl.style.background = '#1e1b4b'; statusEl.style.color = '#a5b4fc';
    status('Settings saved — Gist will auto-create on first Save','ok');
  } else {
    statusEl.textContent = 'GitHub/Gist not configured (using JSONBin)';
    statusEl.style.background = '#2a1a0c'; statusEl.style.color = '#fcd34d';
    status('Settings saved','inf');
  }
});
document.getElementById('expBtn').addEventListener('click',function(){
  var blob=new Blob([JSON.stringify({accounts:accounts,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='streamvault-backup-'+Date.now()+'.json'; a.click();
});
document.getElementById('wipeBtn').addEventListener('click',async function(){
  if(!confirm('PERMANENTLY DELETE ALL DATA? Cannot be undone!'))return;
  accounts=[]; await saveAll(true); renderOverview(); renderAccounts();
  status('All data wiped','err');
});
document.getElementById('delExpiredBtn').addEventListener('click',async function(){
  var expired = accounts.filter(function(a){return a.isWorking === false;});
  if(expired.length === 0){
    status('No expired accounts to delete','inf');
    return;
  }
  if(!confirm('Delete all ' + expired.length + ' expired accounts?'))return;
  accounts = accounts.filter(function(a){return a.isWorking !== false;});
  await saveAll(true); renderOverview(); renderAccounts();
  status('Deleted ' + expired.length + ' expired accounts','ok');
});
document.getElementById('saveBtn').addEventListener('click',async function(){await saveAll(true);});
document.getElementById('syncBtn').addEventListener('click',async function(){
  status('Syncing...','inf');
  try{
    var data=await fetchOnline();
    if(Array.isArray(data.accounts)){
      accounts=data.accounts;
      saveLocal();
      renderOverview();
      renderAccounts();
      status('Synced: '+accounts.length+' accounts','ok');
    } else {
      saveLocal();
      status('Cloud empty — nothing to sync','inf');
    }
  }catch(e){status('Sync failed: '+e.message,'err');}
});
document.getElementById('lockBtn').addEventListener('click',function(){
  sessionStorage.removeItem('sv_ok'); location.reload();
});

if(isUnlocked())init();
})();
