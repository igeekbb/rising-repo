// Standalone script to fetch BigQuery data and save to db.json
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const serviceKey = process.env.GOOGLE_SERVICE_KEY;
if (!serviceKey) { console.log('No GOOGLE_SERVICE_KEY, skipping'); process.exit(0); }

const key = JSON.parse(
  Buffer.from(serviceKey, 'base64').toString().replace(/\n/g, '')
);

async function getToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/bigquery',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now
  };
  const b64url = s => Buffer.from(s).toString('base64url');
  const si = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const sign = crypto.createSign('RSA-SHA256'); sign.update(si);
  const jwt = si + '.' + sign.sign(key.private_key, 'base64url');
  
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString();
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => { let b=''; res.on('data',c=>b+=c); res.on('end', ()=>resolve(JSON.parse(b).access_token)); });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function bigQuery(token, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql, useLegacySql: false });
    const req = https.request({
      hostname: 'bigquery.googleapis.com',
      path: '/bigquery/v2/projects/' + key.project_id + '/queries', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    }, res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>{
      const r = JSON.parse(b);
      if (r.error) reject(r.error);
      else resolve((r.rows||[]).map(r=>({repoName:r.f[0].v,addedStars:parseInt(r.f[1].v)})));
    })});
    req.on('error', reject); req.write(data); req.end();
  });
}

function getRepo(repoName, token) {
  return new Promise(resolve => {
    const opts = { hostname:'api.github.com', path:'/repos/'+repoName,
      headers:{'User-Agent':'rising-repo','Accept':'application/vnd.github.v3+json'} };
    if (token) opts.headers['Authorization'] = 'token '+token;
    https.get(opts, res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>{
      try{const r=JSON.parse(b);resolve(r.message?null:r);}catch(e){resolve(null);}
    })}).on('error',()=>resolve(null));
  });
}

async function main() {
  console.log('Getting OAuth token...');
  const token = await getToken();
  console.log('Token OK');

  const day = new Date();
  day.setDate(day.getDate() - 1);
  const dateStr = day.toISOString().slice(0,10).replace(/-/g,'');
  
  console.log('Querying BigQuery for', dateStr);
  const rankList = await bigQuery(token,
    `SELECT repo.name AS repoName, COUNT(*) AS addedStars FROM \`githubarchive.day.${dateStr}\` WHERE type = "WatchEvent" GROUP BY repoName ORDER BY addedStars DESC LIMIT 200`
  );
  console.log('Got', rankList.length, 'repos');

  const repoInfoList = [];
  for (let i = 0; i < Math.min(rankList.length, 200); i++) {
    const item = rankList[i];
    const repo = await getRepo(item.repoName, process.env.MY_GITHUB_TOKEN);
    repoInfoList.push({
      repoName: item.repoName, addedStars: item.addedStars,
      language: repo?.language||null, ownerAvatar: repo?.owner?.avatar_url||'',
      ownerLogin: repo?.owner?.login||'', description: repo?.description||'',
      createdAt: repo?.created_at||'', topics: repo?.topics||[]
    });
    if ((i+1)%30===0) console.log('  GH info',i+1,'/',rankList.length);
    await new Promise(r=>setTimeout(r,120));
  }

  fs.writeFileSync('db.json', JSON.stringify({ repoInfoList }, null, 2));
  console.log('Saved', repoInfoList.length, 'items to db.json');
}
main().catch(e => { console.log('FATAL:', e.message); process.exit(1); });
