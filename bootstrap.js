/**
 * Reliable browser boot: the static starter is always replaced with an error message
 * if Supabase CDN, app imports, or config fail. Works in VS Code Live Server and Vercel.
 * The app itself still does all database authentication/permission checks.
 */
(() => {
  'use strict';
  const node = document.getElementById('app');
  const endpoints = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2.57.0/dist/umd/supabase.js'
  ];
  const htmlEscape = (value) => String(value || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let started = false;
  let failed = false;
  function fail(error) {
    if (failed) return;
    failed = true;
    console.error('[Jersey startup error]', error);
    const msg = error?.message || String(error) || 'ไม่ทราบสาเหตุ';
    node.innerHTML = `<main class="startup-error" role="alert">
      <div class="startup-error-card">
      <h1>⚠️ ไม่สามารถโหลดระบบสั่งเสื้อได้</h1>
      <p>ระบบพบข้อผิดพลาดขณะเริ่มทำงาน แทนการแสดงหน้าว่าง</p>
      <pre>${htmlEscape(msg)}</pre>
      <p>ตรวจสอบอินเทอร์เน็ต แล้วลองโหลดใหม่ หากยังไม่ได้ให้กด F12 → Console เพื่อดูข้อความผิดพลาด</p>
      <button class="btn primary" type="button" onclick="location.reload()">ลองโหลดใหม่</button>
      </div></main>`;
  }
  function loadScript(url, limitMs = 7500) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let done = false;
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else resolve();
      };
      const timer = setTimeout(() => finish(Error('CDN โหลดไม่ทัน: ' + new URL(url).host)), limitMs);
      script.src = url;
      script.async = true;
      script.onload = () => finish(null);
      script.onerror = () => finish(Error('โหลดไลบรารีไม่ได้: ' + new URL(url).host));
      document.head.appendChild(script);
    });
  }
  async function start() {
    if (started) return;
    started = true;
    try {
      if (!window.JERSEY_CONFIG?.supabaseUrl || !window.JERSEY_CONFIG?.supabasePublishableKey)
        throw Error('ไม่พบการตั้งค่า Supabase ในไฟล์ config.js');
      for (const endpoint of endpoints) {
        if (window.supabase?.createClient) break;
        try { await loadScript(endpoint); } catch (error) { console.warn(error.message); }
      }
      if (!window.supabase?.createClient)
        throw Error('โหลด Supabase SDK จาก CDN ทั้งสองแห่งไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือส่วนขยายที่บล็อก CDN');
      await import('./main.js');
    } catch (error) { fail(error); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
