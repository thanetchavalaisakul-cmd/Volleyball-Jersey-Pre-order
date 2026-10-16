import { state, $, toast, loadCatalog, checkAdmin, currentRoute, layout, closeDialog, db } from './common.js';
import * as Public from './public.js';
import * as Admin from './admin.js';

// Mobile navigation is collapsed at <= 760px and remains keyboard accessible.
function setMobileMenu(open) {
  const expanded = Boolean(open && window.matchMedia('(max-width: 920px)').matches);
  document.body.classList.toggle('mobile-menu-open', expanded);
  const button = $('menu-toggle');
  if (button) {
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'ปิดเมนูนำทาง' : 'เปิดเมนูนำทาง');
  }
}
const pages = { home:Public.renderHome, styles:Public.renderStyles, sizes:Public.renderSizes,
  order:Public.renderOrder, track:Public.renderTrack, admin:Admin.renderAdmin };
let lastRoute='';
function render() {
  const route=currentRoute();
  const page=pages[route] ? route : 'home';
  const content=pages[page]();
  $('app').innerHTML=layout(content);
  setMobileMenu(false);
  lastRoute=page;
  window.scrollTo({top:0,behavior:'instant'});
}
const handlers={
  'toggle-menu':()=>setMobileMenu(!document.body.classList.contains('mobile-menu-open')),
  'add-item':()=>Public.addItem(),
  'remove-item':button=>Public.removeItem(Number(button.dataset.index)),
  'submit-order':()=>Public.submitOrder(),
  'copy-latest':()=>Public.copyLatest(),
  'goto-latest':()=>Public.gotoLatest(),
  'close-dialog':()=>closeDialog(),
  'lookup':()=>Public.lookupOrder(),
  'upload-slip':()=>Public.uploadSlip(),
  'buyer-pdf':()=>Public.buyerPdf(),
  'cancel-order':()=>Public.cancelOrder(),
  'copy-link':()=>Public.copyTrackLink(),
  'admin-login':()=>Admin.login(),
  'logout':()=>Admin.logout(),
  'admin-tab':button=>Admin.changeTab(button.dataset.tab),
  'reload-orders':()=>Admin.reloadOrders(),
  'open-order':button=>Admin.openOrder(button.dataset.id),
  'clear-order-selection':()=>Admin.clearOrderSelection(),
  'archive-selected-orders':()=>Admin.archiveSelectedOrders(),
  'archive-single-order':button=>Admin.archiveSelectedOrders(button.dataset.id),
  'restore-archived-order':button=>Admin.restoreArchivedOrder(button.dataset.id),
  'archived-receipt-pdf':button=>Admin.archivedReceiptPdf(button.dataset.id),
  'bulk-status':()=>Admin.bulkUpdateOrderStatus(),
  'save-payment':button=>Admin.changeOrder(button.dataset.id,'payment'),
  'save-fulfillment':button=>Admin.changeOrder(button.dataset.id,'fulfillment'),
  'open-slip':button=>Admin.openSlip(button.dataset.id),
  'admin-buyer-pdf':button=>Admin.adminBuyerPdf(button.dataset.id),
  'save-settings':()=>Admin.saveSettings(),
  'save-campaign':()=>Admin.saveCampaign(),
  'create-product':()=>Admin.createProduct(),
  'save-product':button=>Admin.saveProduct(button.dataset.id),
  'delete-product':button=>Admin.deleteProduct(button.dataset.id),
  'save-variant':button=>Admin.saveVariant(button.dataset.id),
  'create-variant':button=>Admin.createVariant(button.dataset.id),
  'export-excel':()=>Admin.doExcel(),
  'export-pdf':()=>Admin.doReportPdf(),
};
document.addEventListener('click',event=>{
  if (event.target.closest?.('#primary-nav a, .site-header .brand, .site-header .admin-access')) setMobileMenu(false);
  else if (document.body.classList.contains('mobile-menu-open') && !event.target.closest?.('.site-header')) setMobileMenu(false);
  const target=event.target.closest?.('[data-action]');
  if(!target)return;
  // Checkboxes must keep their native click default; read checked in change instead.
  if(['toggle-order-select','select-visible-orders'].includes(target.dataset.action))return;
  const fn=handlers[target.dataset.action];
  if(!fn)return;
  event.preventDefault();
  if(state.busy)return;
  try{Promise.resolve(fn(target)).catch(error=>toast(error.message||'เกิดข้อผิดพลาด'));}
  catch(error){toast(error.message||'เกิดข้อผิดพลาด');}
});
document.addEventListener('change',event=>{
  const clickAction=event.target.dataset?.action;
  if(clickAction==='toggle-order-select')Admin.toggleOrderSelection(event.target.dataset.id,event.target.checked);
  if(clickAction==='select-visible-orders')Admin.selectVisibleOrders(event.target.checked);
  const action=event.target.dataset?.change;
  if(action==='product')Public.productChanged();
  if(action==='size')Public.sizeChanged();
});
document.addEventListener('input',event=>{
  if(event.target.dataset?.input==='admin-search')Admin.filterOrders();
});
document.addEventListener('keydown',event=>{
  if (event.key==='Escape') {setMobileMenu(false);closeDialog();}
  if(event.key==='Enter'&&event.target.id==='admin-password')Admin.login();
  if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('tr[data-action="open-order"]')){event.preventDefault();Admin.openOrder(event.target.dataset.id);}
});
window.addEventListener('hashchange',()=>{
  const route=currentRoute();
  if(route!==lastRoute || route==='track') {
    state.lookup=route==='track'?state.lookup:null;
    render();
    if(route==='track'&&location.hash.includes('?')) {
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      if(params.has('o')&&params.has('k'))Public.lookupOrder(params.get('o'),params.get('k'));
    }
  }
});
window.addEventListener('resize',()=>{ if(window.innerWidth>920) setMobileMenu(false); });
window.addEventListener('jersey-render',render);
async function start(){
  const timeout=(promise, ms, label)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(`${label} ใช้เวลานานเกินไป (${ms/1000} วินาที)`)),ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  try {
    await timeout(loadCatalog(), 12000, 'เชื่อมต่อฐานข้อมูลสินค้า');
    await timeout(checkAdmin(), 10000, 'ตรวจสอบสถานะผู้ดูแล');
    if(state.admin){await timeout(Admin.loadAdminOrders(), 12000, 'โหลดรายการออเดอร์');Admin.startAdminLiveUpdates();}
    render();
    if(currentRoute()==='track'&&location.hash.includes('?')){
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      if(params.has('o')&&params.has('k'))Public.lookupOrder(params.get('o'),params.get('k'));
    }
  } catch(error) {
    console.error('[Jersey database initialization]', error);
    $('app').innerHTML=`<main class="startup-error" role="alert"><div class="startup-error-card"><h2>ไม่สามารถเชื่อมต่อระบบได้</h2><p>${String(error.message||'เกิดข้อผิดพลาด').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p><p>ตรวจสอบอินเทอร์เน็ต และค่า Supabase ใน config.js แล้วลองอีกครั้ง</p><button class="btn primary" onclick="location.reload()" type="button">ลองโหลดใหม่</button></div></main>`;
  }
}
start();
