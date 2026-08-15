(function(){
'use strict';
var allAccounts=[],curPid=null,pidxs={},pused={},busy=false;
var toast=document.getElementById('toast');

function showToast(msg,t){
  toast.textContent=msg;
  toast.className='toast '+(t||'inf')+' show';
  clearTimeout(toast._t);
  toast._t=setTimeout(function(){toast.classList.remove('show');},3200);
}

function loadData(){
  return new Promise(function(res){
    var s=JSON.parse(localStorage.getItem('sv_settings')||'{}');
    if (s.githubToken === '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' || s.githubRepo === 'andromodern2/streamvault') {
      delete s.githubToken;
      delete s.githubRepo;
      localStorage.setItem('sv_settings', JSON.stringify(s));
    }
    chrome.runtime.sendMessage({
      action:'loadOnlineData',
      githubGistId:s.githubGistId||'',
      githubRepo:s.githubRepo||'',
      githubToken:s.githubToken||'',
      apiKey:s.apiKey||'',
      binId:s.binId||''
    },function(r){
      if(chrome.runtime.lastError||!r||!r.success){res({});return;}
      res(r.data||{});
    });
  });
}

function working(pid){
  return allAccounts.filter(function(a){return a.platform===pid&&a.isWorking!==false;});
}

// =============================================
// THEME ENGINE — changes entire popup color
// =============================================
function applyTheme(p){
  var root=document.documentElement;
  if(!p){
    root.style.removeProperty('--theme-color');
    root.style.removeProperty('--theme-dark');
    root.style.removeProperty('--theme-glow');
    root.style.removeProperty('--theme-glow2');
    document.body.className='';
    return;
  }
  root.style.setProperty('--theme-color', p.color);
  root.style.setProperty('--theme-dark',  p.colorDark);
  root.style.setProperty('--theme-glow',  p.color+'33');
  root.style.setProperty('--theme-glow2', p.color+'18');
  document.body.className='themed';
  // Update dynamic glow BG
  var bg=document.getElementById('glowBg');
  if(bg)bg.style.background='radial-gradient(ellipse at 20% 10%, '+p.color+'28 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, '+p.colorDark+'22 0%, transparent 55%)';
}

function buildGrid(){
  var grid=document.getElementById('grid');
  grid.innerHTML='';
  var tw=0,ta=0,ap=0;
  Object.values(PLATFORMS).forEach(function(p){
    var w=working(p.id);
    var all=allAccounts.filter(function(a){return a.platform===p.id;});
    tw+=w.length; ta+=all.length;
    if(w.length>0)ap++;
    var c=document.createElement('div');
    var isEmpty=w.length===0;
    c.className='pc'+(isEmpty?' empty':'');
    c.setAttribute('data-pid',p.id);
    c.style.setProperty('--pc',p.color);
    c.style.setProperty('--ps',p.color+'33');
    c.style.setProperty('--pd',p.colorDark);
    c.innerHTML=
      '<div class="pe">'+p.icon+'</div>'+
      '<div class="pn">'+p.name+'</div>'+
      '<div class="pk '+(w.length>0?'has':'none')+'">'+(w.length>0?'<div class="pp"></div>'+w.length+' ready':'empty')+'</div>';
    // ALL cards clickable — empty ones show "no accounts" message
    c.addEventListener('click',function(){
      openPlatform(p.id);
    });
    // Hover glow preview
    c.addEventListener('mouseenter',function(){
      if(!curPid) document.getElementById('glowBg').style.background=
        'radial-gradient(ellipse at 30% 20%, '+p.color+'20 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, '+p.colorDark+'18 0%, transparent 50%)';
    });
    c.addEventListener('mouseleave',function(){
      if(!curPid) document.getElementById('glowBg').style.background=
        'radial-gradient(ellipse at 25% 15%, rgba(108,99,255,.08) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(0,168,225,.06) 0%, transparent 55%)';
    });
    grid.appendChild(c);
  });
  document.getElementById('tw').textContent=tw;
  document.getElementById('ta').textContent=ta;
  document.getElementById('tp').textContent=ap;
}

function openPlatform(pid){
  curPid=pid;
  var p=PLATFORMS[pid];
  if(!p)return;
  // Apply full color theme
  applyTheme(p);
  // Highlight selected card
  document.querySelectorAll('.pc').forEach(function(c){
    c.classList.toggle('selected', c.getAttribute('data-pid')===pid);
  });
  document.getElementById('homeView').style.display='none';
  var pv=document.getElementById('platformView');
  pv.style.display='block';
  pv.style.setProperty('--pc',p.color);
  pv.style.setProperty('--ps',p.color+'33');
  var btn=document.getElementById('connectBtn');
  btn.style.background=p.gradient;
  btn.style.setProperty('--ps',p.color+'55');
  ['pvTotal','pvWorking','pvUsed'].forEach(function(id){
    document.getElementById(id).style.color=p.color;
  });
  document.getElementById('pvIcon').innerHTML=p.icon;
  document.getElementById('pvName').textContent=p.name;
  // Animated glow ring on icon
  document.getElementById('pvIcon').style.boxShadow='0 0 24px '+p.color+'88, 0 0 48px '+p.color+'33';
  document.getElementById('pvIcon').style.borderColor=p.color;
  refreshPV(pid);
}

function refreshPV(pid){
  var p=PLATFORMS[pid];
  var w=working(pid);
  var all=allAccounts.filter(function(a){return a.platform===pid;});
  var used=pused[pid]||0;
  var idx=pidxs[pid]||0;
  var btn=document.getElementById('connectBtn');
  var copyBtn=document.getElementById('copyBtn');
  var ib=document.getElementById('infoBox');
  document.getElementById('pvTotal').textContent=all.length;
  document.getElementById('pvWorking').textContent=w.length;
  document.getElementById('pvUsed').textContent=used;
  if(w.length===0){
    document.getElementById('ibTitle').textContent='No accounts available';
    document.getElementById('ibSub').textContent='Add accounts in the Admin panel first';
    document.getElementById('ibHi').textContent='';
    document.getElementById('nextLbl').innerHTML='';
    btn.disabled=true;
    btn.classList.remove('ok','loading');
    btn.querySelector('.lbl').textContent='No Accounts';
    btn.style.background='';
    btn.style.backgroundImage='none';
    btn.style.opacity='0.4';
    copyBtn.disabled=true;
    copyBtn.style.opacity='0.4';
    ib.classList.remove('active');
  }else{
    var next=w[idx%w.length];
    document.getElementById('ibTitle').textContent='Ready to Connect';
    document.getElementById('ibSub').textContent=w.length+' working account'+(w.length>1?'s':'')+' available';
    document.getElementById('ibHi').textContent='Next: '+(next&&next.name||'Account');
    document.getElementById('nextLbl').innerHTML='<span>'+(next&&next.name||'Account')+'</span> is up next';
    btn.disabled=false;
    btn.classList.remove('ok','loading');
    btn.querySelector('.lbl').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Connect Now';
    btn.style.background=p?p.gradient:'';
    btn.style.opacity='1';
    copyBtn.disabled=false;
    copyBtn.style.opacity='1';
    ib.classList.add('active');
    ib.style.borderColor=p?p.color:'';
    ib.style.boxShadow=p?'0 0 14px '+p.color+'22':'';
  }
  
  var netflixLinks = document.getElementById('netflixLinks');
  if (netflixLinks) {
    if (pid === 'netflix' && w.length > 0) {
      netflixLinks.style.display = 'block';
    } else {
      netflixLinks.style.display = 'none';
    }
  }
}

// =============================================
// LOGIN CHECKER — injected into streaming tab
// =============================================
function loginChecker(){
  if(document.readyState==='loading')return{success:null,reason:'not_ready'};
  var url=window.location.href;
  var hostname=window.location.hostname;
  var signInBlocks=['/ap/signin','amazon.com/ap/','/gp/sign-in','amazon.com/gp/sign',
    '/signin','/login','LoginHelp','/sign-in','/sign_in','/register','/welcome',
    '/subscribe','/sign-up','/signup','appleid.apple.com','idmsa.apple.com',
    '/create-account','/identity/login','/activate','/checkout','/account/signin',
    '/plans','accounts.google.com','id.hulu.com','auth.'];
  if(signInBlocks.some(function(s){return url.toLowerCase().includes(s.toLowerCase());})){
    return{success:false,user:null};
  }
  var platformDomains=['netflix.com','primevideo.com','max.com','hbomax.com',
    'disneyplus.com','paramountplus.com','hulu.com','tv.apple.com','peacocktv.com','crunchyroll.com'];
  var onPlatform=platformDomains.some(function(d){return hostname.includes(d);});
  var errorIndicators=['404','503','maintenance','unavailable'];
  var onError=errorIndicators.some(function(s){return url.toLowerCase().includes(s);})
    &&!url.includes('/watch/')&&!url.includes('/series/');
  var sels=['[data-uia="profile-avatar"]','[data-uia="header-account-button"]',
    '#nav-link-accountList','.av-action-profile','.av-action-avatar',
    '[data-testid="profile-menu-toggle"]','[class*="ProfileMenu"]',
    '[data-testid="avatar-button"]','[data-gv2testid="avatar-btn"]',
    '[data-automationid="nav-profile"]','[data-automationid="user-menu"]',
    '[data-testid="user-account-button"]','[data-t="profile-link"]',
    '.header-user-menu','[class*="UserDropdown"]','[data-test="account-nav-item"]',
    '[data-testid="user-menu"]','.profile-menu-button'];
  var found=null;
  for(var i=0;i<sels.length;i++){
    var el=document.querySelector(sels[i]);
    if(el){found=el;break;}
  }
  var ok=onPlatform&&!onError;
  var user=found?((found.getAttribute('aria-label')||found.textContent||'').trim().slice(0,40)||'Verified User'):'Verified User';
  return{success:ok,user:ok?user:null};
}

function parseCookies(d){
  if(d&&typeof d==='object'&&!Array.isArray(d))return d;
  if(typeof d!=='string')return{};
  var out={};
  d.split('\n').forEach(function(line){
    var t=line.trim();
    if(!t||t[0]==='#')return;
    if(t.indexOf('\t')>-1){var p=t.split('\t');if(p.length>=7&&p[5]&&p[6])out[p[5]]=p[6];}
    else{var eq=t.indexOf('=');if(eq>0)out[t.slice(0,eq).trim()]=t.slice(eq+1).trim();}
  });
  return out;
}

function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}

async function doLogin(account,p){
  var cookies=parseCookies(account.cookies);
  if(Object.keys(cookies).length===0)return{success:false,reason:'No cookies parsed'};
  var tabs=await chrome.tabs.query({active:true,currentWindow:true});
  var tab=tabs[0];
  var onPlatform=p.matchUrls.some(function(u){return tab&&tab.url&&tab.url.includes(u);});
  if(!onPlatform){
    await chrome.tabs.update(tab.id,{url:p.baseUrl});
    await new Promise(function(resolve){
      var timeout=setTimeout(function(){
        chrome.tabs.onUpdated.removeListener(onUpd);
        resolve();
      },6000);
      function onUpd(id,info){
        if(id===tab.id&&info.status==='complete'){
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(onUpd);
          setTimeout(resolve,400);
        }
      }
      chrome.tabs.onUpdated.addListener(onUpd);
    });
  }
  for(var domain of p.domains){
    var existing=await chrome.cookies.getAll({domain:domain});
    for(var c of existing){
      try{await chrome.cookies.remove({url:'https://www.'+domain.replace(/^\./,''),name:c.name});}catch(e){}
    }
  }
  for(var [name,value] of Object.entries(cookies)){
    if(!value)continue;
    for(var dom of p.domains){
      var baseUrl2=dom.includes('apple')?'https://tv.apple.com':'https://www.'+dom.replace(/^\./,'');
      try{
        await chrome.cookies.set({url:baseUrl2,name:name,value:value,domain:dom,path:'/',secure:true,sameSite:'lax'});
      }catch(e){}
    }
  }
  var cur=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
  var reloadDone=new Promise(function(resolve){
    var timeout=setTimeout(function(){
      chrome.tabs.onUpdated.removeListener(onUpd2);
      resolve();
    },8000);
    function onUpd2(id,info){
      if(id===cur.id&&info.status==='complete'){
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpd2);
        setTimeout(resolve,600);
      }
    }
    chrome.tabs.onUpdated.addListener(onUpd2);
  });
  await chrome.tabs.reload(cur.id);
  await reloadDone;
  var loginResult={success:false,reason:'timeout'};
  for(var attempt=0;attempt<3;attempt++){
    try{
      var results=await chrome.scripting.executeScript({target:{tabId:cur.id},func:loginChecker});
      var r=results[0]&&results[0].result;
      if(r&&r.success!==null){loginResult=r;break;}
      await delay(1200);
    }catch(e){await delay(800);}
  }
  return loginResult;
}

async function connect(){
  if(busy||!curPid)return;
  var pid=curPid,p=PLATFORMS[pid],w=working(pid);
  if(w.length===0){showToast('No accounts available for '+p.name,'err');return;}
  busy=true;
  var btn=document.getElementById('connectBtn');
  btn.disabled=true;
  btn.classList.add('loading');
  document.getElementById('ibTitle').textContent='Connecting...';
  
  var startIdx = pidxs[pid] || 0;
  var successAccount = null;
  var finalIdx = startIdx;
  
  for (var i = 0; i < w.length; i++) {
    var attemptIdx = (startIdx + i) % w.length;
    var account = w[attemptIdx];
    
    document.getElementById('ibSub').textContent = 'Injecting ' + account.name + ' (' + (i + 1) + '/' + w.length + ')';
    showToast('Trying ' + account.name + '... (' + (i + 1) + '/' + w.length + ')', 'inf');
    
    try {
      var result = await doLogin(account, p);
      if (result.success) {
        successAccount = account;
        finalIdx = (attemptIdx + 1) % w.length;
        
        pused[pid] = (pused[pid] || 0) + 1;
        pidxs[pid] = finalIdx;
        chrome.storage.local.set({pidxs:pidxs, pused:pused});
        
        document.getElementById('ibTitle').textContent = 'Connected!';
        document.getElementById('ibSub').textContent = 'Signed in as ' + (result.user || 'User');
        document.getElementById('ibHi').textContent = account.name + ' is active';
        document.getElementById('pvUsed').textContent = pused[pid];
        
        btn.classList.remove('loading');
        btn.classList.add('ok');
        btn.querySelector('.lbl').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>Connected!';
        btn.disabled = false;
        showToast('Connected: ' + account.name, 'ok');
        setTimeout(function(){btn.classList.remove('ok'); refreshPV(pid);}, 3000);
        break;
      } else {
        showToast('🗑️ ' + account.name + ' expired & auto-deleted!', 'err');
        allAccounts = allAccounts.filter(function(a){ return a.id !== account.id; });
        chrome.storage.local.set({ cached_accounts: allAccounts });
        chrome.runtime.sendMessage({
          action: 'pushToGitHub',
          data: { accounts: allAccounts, updatedAt: new Date().toISOString() }
        });
        buildGrid();
      }
    } catch(err) {
      showToast('🗑️ ' + account.name + ' error & auto-deleted: ' + err.message, 'err');
      allAccounts = allAccounts.filter(function(a){ return a.id !== account.id; });
      chrome.storage.local.set({ cached_accounts: allAccounts });
      chrome.runtime.sendMessage({
        action: 'pushToGitHub',
        data: { accounts: allAccounts, updatedAt: new Date().toISOString() }
      });
      buildGrid();
    }
  }
  
  if (!successAccount) {
    pidxs[pid] = (startIdx + 1) % w.length;
    chrome.storage.local.set({pidxs:pidxs});
    
    document.getElementById('ibTitle').textContent = 'Connection Failed';
    document.getElementById('ibSub').textContent = 'Tried all ' + w.length + ' accounts, none succeeded.';
    document.getElementById('ibHi').textContent = '';
    showToast('All accounts failed!', 'err');
    
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.querySelector('.lbl').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>Try Again';
  }
  
  busy = false;
}

async function init(){
  // Load cached accounts instantly so the popup loads in under 5ms, then fetch updates in the background
  chrome.storage.local.get(['cached_accounts','pidxs','pused'], async function(r){
    allAccounts = r.cached_accounts || [];
    pidxs = r.pidxs || {};
    pused = r.pused || {};
    
    if (!curPid) {
      document.getElementById('homeView').style.display = 'block';
    } else {
      document.getElementById('homeView').style.display = 'none';
    }
    buildGrid();
    
    try {
      var data = await loadData();
      var fresh = Array.isArray(data.accounts) ? data.accounts : [];
      chrome.storage.local.set({ cached_accounts: fresh });
      allAccounts = fresh;
      buildGrid();
      if (curPid) refreshPV(curPid);
    } catch(e) {
      console.warn('Background sync failed:', e);
    }
  });
}

document.getElementById('adminBtn').addEventListener('click',function(){chrome.runtime.openOptionsPage();});
document.getElementById('adminLink').addEventListener('click',function(e){e.preventDefault();chrome.runtime.openOptionsPage();});
document.getElementById('pvAdminLink').addEventListener('click',function(e){e.preventDefault();chrome.runtime.openOptionsPage();});
document.getElementById('backBtn').addEventListener('click',function(){
  document.getElementById('platformView').style.display='none';
  document.getElementById('homeView').style.display='block';
  curPid=null;
  busy=false;
  applyTheme(null);
  document.querySelectorAll('.pc').forEach(function(c){c.classList.remove('selected');});
});
document.getElementById('connectBtn').addEventListener('click',connect);

// New Feature: Copy Cookies to clipboard
async function copyCookies(){
  if(!curPid)return;
  var w=working(curPid);
  if(w.length===0)return;
  var idx=pidxs[curPid]||0;
  var account=w[idx%w.length];
  try {
    await navigator.clipboard.writeText(account.cookies);
    showToast('Cookies copied to clipboard!','ok');
  } catch(e) {
    showToast('Copy failed: '+e.message,'err');
  }
}
document.getElementById('copyBtn').addEventListener('click',copyCookies);

// New Feature: Platform Search Input
document.getElementById('platformSearch').addEventListener('input', function() {
  var query = this.value.toLowerCase();
  document.querySelectorAll('.pc').forEach(function(card) {
    var pid = card.getAttribute('data-pid');
    var p = PLATFORMS[pid];
    var matches = p.name.toLowerCase().includes(query) || p.shortName.toLowerCase().includes(query);
    card.style.display = matches ? 'flex' : 'none';
  });
});



// Netflix Link Generator logic
function extractNetflixId(cookiesString) {
  if (!cookiesString) return null;
  var cookies = parseCookies(cookiesString);
  var nfId = cookies['NetflixId'] || cookies['SecureNetflixId'];
  if (nfId) return nfId.trim();
  
  var m = cookiesString.match(/NetflixId\s+([^\s;\r\n]+)/i);
  if (m) return m[1].trim();
  var m2 = cookiesString.match(/NetflixId=([^;]+)/i);
  if (m2) return m2[1].trim();
  
  return null;
}

async function fetchNetflixAutoLoginToken(netflixId) {
  var url = 'https://ios.prod.ftl.netflix.com/iosui/user/15.48';
  var params = {
    "appVersion": "15.48.1",
    "config": '{"gamesInTrailersEnabled":"false","isTrailersEvidenceEnabled":"false","cdsMyListSortEnabled":"true","kidsBillboardEnabled":"true","addHorizontalBoxArtToVideoSummariesEnabled":"false","skOverlayTestEnabled":"false","homeFeedTestTVMovieListsEnabled":"false","baselineOnIpadEnabled":"true","trailersVideoIdLoggingFixEnabled":"true","postPlayPreviewsEnabled":"false","bypassContextualAssetsEnabled":"false","roarEnabled":"false","useSeason1AltLabelEnabled":"false","disableCDSSearchPaginationSectionKinds":["searchVideoCarousel"],"cdsSearchHorizontalPaginationEnabled":"true","searchPreQueryGamesEnabled":"true","kidsMyListEnabled":"true","billboardEnabled":"true","useCDSGalleryEnabled":"true","contentWarningEnabled":"true","videosInPopularGamesEnabled":"true","avifFormatEnabled":"false","sharksEnabled":"true"}',
    "device_type": "NFAPPL-02-",
    "esn": "NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
    "idiom": "phone",
    "iosVersion": "15.8.5",
    "isTablet": "false",
    "languages": "en-US",
    "locale": "en-US",
    "maxDeviceWidth": "375",
    "model": "saget",
    "modelType": "IPHONE8-1",
    "odpAware": "true",
    "path": '["account","token","default"]',
    "pathFormat": "graph",
    "pixelDensity": "2.0",
    "progressive": "false",
    "responseFormat": "json"
  };
  
  var queryString = Object.keys(params).map(function(key) {
    if (key === 'esn') {
      return 'esn=NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200';
    }
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
  
  var requestUrl = url + '?' + queryString;
  
  var headers = {
    "User-Agent": "Argo/15.48.1 (iPhone; iOS 15.8.5; Scale/2.00)",
    "x-netflix.request.attempt": "1",
    "x-netflix.request.client.user.guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
    "x-netflix.context.profile-guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
    "x-netflix.request.routing": '{"path":"/nq/mobile/nqios/~15.48.0/user","control_tag":"iosui_argo"}',
    "x-netflix.context.app-version": "15.48.1",
    "x-netflix.argo.translated": "true",
    "x-netflix.context.form-factor": "phone",
    "x-netflix.context.sdk-version": "2012.4",
    "x-netflix.client.appversion": "15.48.1",
    "x-netflix.context.max-device-width": "375",
    "x-netflix.context.ab-tests": "",
    "x-netflix.tracing.cl.useractionid": "4DC655F2-9C3C-4343-8229-CA1B003C3053",
    "x-netflix.client.type": "argo",
    "x-netflix.client.ftl.esn": "NFAPPL-02-IPHONE8=1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
    "x-netflix.context.locales": "en-US",
    "x-netflix.context.top-level-uuid": "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
    "x-netflix.client.iosversion": "15.8.5",
    "accept-language": "en-US;q=1",
    "x-netflix.argo.abtests": "",
    "x-netflix.context.os-version": "15.8.5",
    "x-netflix.request.client.context": '{"appState":"foreground"}',
    "x-netflix.context.ui-flavor": "argo",
    "x-netflix.argo.nfnsm": "9",
    "x-netflix.context.pixel-density": "2.0",
    "x-netflix.request.toplevel.uuid": "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
    "x-netflix.request.client.timezoneid": "Asia/Dhaka",
    "Cookie": "NetflixId=" + netflixId
  };
  
  var response = await fetch(requestUrl, {
    method: 'GET',
    headers: headers
  });
  
  if (!response.ok) {
    throw new Error('Netflix API returned HTTP ' + response.status);
  }
  
  var data = await response.json();
  var tokenData = ((((data || {}).value || {}).account || {}).token || {}).default || {};
  var token = tokenData.token;
  if (!token) {
    throw new Error('No login token found in API response. Cookies might be expired.');
  }
  return token;
}

document.getElementById('copyPcLinkBtn').addEventListener('click', async function() {
  if (!curPid) return;
  var w = working(curPid);
  if (w.length === 0) return;
  var idx = pidxs[curPid] || 0;
  var account = w[idx % w.length];
  var netflixId = extractNetflixId(account.cookies);
  if (!netflixId) {
    showToast('NetflixId not found in cookies!', 'err');
    return;
  }
  
  var btn = document.getElementById('copyPcLinkBtn');
  var origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="color: var(--accent); font-weight: bold; margin-right: 6px;">⏳</span> Generating Link...';
  
  try {
    var token = await fetchNetflixAutoLoginToken(netflixId);
    var link = 'https://netflix.com/?nftoken=' + encodeURIComponent(token);
    await navigator.clipboard.writeText(link);
    showToast('PC Login Link copied!', 'ok');
  } catch(e) {
    showToast('Failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
});

document.getElementById('copyPhoneLinkBtn').addEventListener('click', async function() {
  if (!curPid) return;
  var w = working(curPid);
  if (w.length === 0) return;
  var idx = pidxs[curPid] || 0;
  var account = w[idx % w.length];
  var netflixId = extractNetflixId(account.cookies);
  if (!netflixId) {
    showToast('NetflixId not found in cookies!', 'err');
    return;
  }
  
  var btn = document.getElementById('copyPhoneLinkBtn');
  var origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="color: var(--accent); font-weight: bold; margin-right: 6px;">⏳</span> Generating Link...';
  
  try {
    var token = await fetchNetflixAutoLoginToken(netflixId);
    var link = 'https://netflix.com/unsupported?nftoken=' + encodeURIComponent(token);
    await navigator.clipboard.writeText(link);
    showToast('Phone Login Link copied!', 'ok');
  } catch(e) {
    showToast('Failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
});

document.getElementById('openTvLinkBtn').addEventListener('click', function() {
  chrome.tabs.create({ url: 'https://www.netflix.com/tv2' });
});

document.getElementById('syncPopupBtn').addEventListener('click', async function() {
  var btn = document.getElementById('syncPopupBtn');
  var origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="color: var(--accent); font-weight: bold; margin-right: 6px;">⏳</span> Syncing...';
  
  showToast('Fetching fresh accounts data...', 'inf');
  try {
    var data = await loadData();
    var fresh = Array.isArray(data.accounts) ? data.accounts : [];
    chrome.storage.local.set({ cached_accounts: fresh });
    allAccounts = fresh;
    buildGrid();
    if (curPid) refreshPV(curPid);
    showToast('Accounts synced successfully!', 'ok');
  } catch(e) {
    showToast('Sync failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
});

init();
})();
