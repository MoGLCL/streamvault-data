// Andro StreamVault - Background Service Worker v1.7
const CFG = {
  API_KEY: '$2a$10$YaCG.b4SMEWXxOATugwQZepjVZe6SWIe6T5EEqa6veNvtP7VRPZa6',
  BIN_ID:  '6a4e5dd5da38895dfe40dfff',
  BASE:    'https://api.jsonbin.io/v3/b',
  // Hardcoded GitHub Repository Sync settings (allows 5000 requests/hr and up to 100MB+)
  GITHUB_REPO:  'MoGLCL/streamvault-data',
  GITHUB_TOKEN: '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'
};

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  var OLD_TOKEN = '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';
  var OLD_REPO  = 'andromodern2/streamvault';

  // ---- LOAD DATA ----
  // Tries GitHub Repository Contents API directly (real-time, up to 100MB), fallback to JSONBin
  if (req.action === 'loadOnlineData') {
    var githubRepo   = (req.githubRepo && req.githubRepo !== OLD_REPO) ? req.githubRepo : CFG.GITHUB_REPO;
    var githubToken  = (req.githubToken && req.githubToken !== OLD_TOKEN) ? req.githubToken : CFG.GITHUB_TOKEN;
    var key = req.apiKey || CFG.API_KEY;
    var bin = req.binId  || CFG.BIN_ID;

    // Fetch from GitHub (API 1)
    var p1 = Promise.resolve({ accounts: [] });
    if (githubRepo) {
      var repoUrl = 'https://api.github.com/repos/' + githubRepo + '/contents/accounts.json';
      var headers = { 'Accept': 'application/vnd.github.v3.raw' };
      if (githubToken) headers['Authorization'] = 'Bearer ' + githubToken;
      p1 = fetch(repoUrl, { cache: 'no-store', headers: headers })
        .then(r => {
          if (!r.ok) {
            if (r.status === 404) return { accounts: [] };
            throw new Error('GitHub returned ' + r.status);
          }
          return r.json();
        })
        .catch(err => {
          console.warn('GitHub fetch failed:', err.message);
          return { accounts: [] };
        });
    }

    // Fetch from Secondary Source (API 2: Custom API URL or JSONBin)
    var p2 = Promise.resolve({ accounts: [] });
    if (bin) {
      if (bin.startsWith('http://') || bin.startsWith('https://')) {
        p2 = fetch(bin, { cache: 'no-store' })
          .then(r => {
            if (!r.ok) throw new Error('Custom API returned ' + r.status);
            return r.json();
          })
          .then(d => {
            if (Array.isArray(d)) return { accounts: d };
            return d || { accounts: [] };
          })
          .catch(err => {
            console.warn('Custom API fetch failed:', err.message);
            return { accounts: [] };
          });
      } else {
        p2 = fetch(CFG.BASE + '/' + bin + '/latest', { headers: { 'X-Master-Key': key } })
          .then(r => {
            if (!r.ok) throw new Error('JSONBin returned ' + r.status);
            return r.json();
          })
          .then(d => d.record || { accounts: [] })
          .catch(err => {
            console.warn('JSONBin fetch failed:', err.message);
            return { accounts: [] };
          });
      }
    }

    Promise.all([p1, p2]).then(async results => {
      var githubData = results[0] || {};
      var secondaryData = results[1] || {};

      var mergedAccounts = [];
      var seen = new Set();

      function add(list) {
        if (Array.isArray(list)) {
          list.forEach(a => {
            var key = a.id || (a.name + '|' + a.platform);
            if (!seen.has(key)) {
              seen.add(key);
              mergedAccounts.push(a);
            }
          });
        }
      }

      // Merge accounts from both APIs
      add(githubData.accounts);
      add(secondaryData.accounts);

      // Fallback: If no accounts found from network, load bundled local accounts.json
      if (mergedAccounts.length === 0) {
        try {
          var localUrl = chrome.runtime.getURL('accounts.json');
          var localRes = await fetch(localUrl);
          if (localRes.ok) {
            var localData = await localRes.json();
            if (Array.isArray(localData.accounts)) {
              add(localData.accounts);
            }
          }
        } catch (e) {
          console.warn('Local fallback error:', e);
        }
      }

      // Resolve newest updatedAt
      var time1 = githubData.updatedAt ? new Date(githubData.updatedAt).getTime() : 0;
      var time2 = secondaryData.updatedAt ? new Date(secondaryData.updatedAt).getTime() : 0;
      var newestTime = time1 > time2 ? (githubData.updatedAt || new Date().toISOString()) : (secondaryData.updatedAt || new Date().toISOString());

      sendResponse({
        success: true,
        data: {
          accounts: mergedAccounts,
          updatedAt: newestTime
        }
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });

    return true;
  }

  // ---- PUSH TO GITHUB REPO ----
  if (req.action === 'pushToGitHub') {
    var githubRepo   = (req.githubRepo && req.githubRepo !== OLD_REPO) ? req.githubRepo : CFG.GITHUB_REPO;
    var githubToken  = (req.githubToken && req.githubToken !== OLD_TOKEN) ? req.githubToken : CFG.GITHUB_TOKEN;
    var data         = req.data;

    if (!githubToken || !githubRepo) {
      sendResponse({ success: false, error: 'GitHub not configured' });
      return true;
    }

    var apiUrl = 'https://api.github.com/repos/' + githubRepo + '/contents/accounts.json';
    var authHeaders = {
      'Authorization': 'Bearer ' + githubToken,
      'Accept':        'application/vnd.github+json',
      'Content-Type':  'application/json'
    };

    // First fetch file metadata to get the latest commit SHA (required to update a file)
    fetch(apiUrl, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(existing => {
        var json = JSON.stringify(data, null, 2);
        var encoded = btoa(unescape(encodeURIComponent(json)));
        var body = {
          message: '⚡ StreamVault update ' + new Date().toISOString().slice(0,16).replace('T',' '),
          content: encoded
        };
        if (existing && existing.sha) body.sha = existing.sha;

        return fetch(apiUrl, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(body)
        });
      })
      .then(r => {
        if (!r.ok) return r.text().then(t => { throw new Error('GitHub Repo push failed ' + r.status + ': ' + t); });
        return r.json();
      })
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // ---- SAVE TO JSONBIN (legacy fallback) ----
  if (req.action === 'saveOnlineData') {
    var key = req.apiKey || CFG.API_KEY;
    var bin = req.binId  || CFG.BIN_ID;
    
    // Check if bin is a full API URL
    if (bin && (bin.startsWith('http://') || bin.startsWith('https://'))) {
      fetch(bin, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.data)
      })
        .then(r => {
          if (!r.ok) throw new Error('API URL save error ' + r.status);
          return r.json();
        })
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    fetch(CFG.BASE + '/' + bin, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify(req.data)
    })
      .then(r => r.json())
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

});

