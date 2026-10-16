import { db, state, $, v, toast, setBusy, escapeHtml as e, safeImage, currency as money, dateTH, checkAdmin, loadCatalog, orderStatus, payStatus, paymentMethods, titleSection, exportPdf, openDialog, closeDialog, currentRoute } from './common.js';
import { buyerPdfMarkup } from './public.js';
import { downloadExcel, downloadProductionPdf } from './exports.js';
import { SIZE_ORDER, sortOrderItems } from './sizes.js';
import { canAdminArchive } from './order-actions.js';
const selectedOrders = new Set();

export async function loadAdminOrders() {
  if (!state.admin) return;
  const [active,archived]=await Promise.all([
    db.from('orders').select('*,order_items(*),payment_submissions(*)').is('archived_at',null).order('created_at',{ascending:false}).limit(1000),
    db.from('orders').select('*,order_items(*),payment_submissions(*)').not('archived_at','is',null).order('archived_at',{ascending:false}).limit(1000),
  ]);
  if(active.error||archived.error)throw active.error||archived.error;
  state.orders=active.data||[];
  state.archivedOrders=archived.data||[];
  const valid = new Set(state.orders.filter(canAdminArchive).map(o=>o.id));
  for (const id of selectedOrders) if(!valid.has(id))selectedOrders.delete(id);
}
function tabs() {
  const opts=[['orders','📋 คำสั่งซื้อ'],['archive','🗄️ ประวัติออเดอร์ที่ลบ'],['catalog','👕 แบบเสื้อและไซส์'],['reports','📊 Excel / PDF'],['settings','⚙️ ตั้งค่า']];
  return `<div class="admin-tabs">${opts.map(([id,name])=>`<button class="${id===state.adminTab?'selected':''}" data-action="admin-tab" data-tab="${id}">${name}</button>`).join('')}</div>`;
}
export function renderAdmin() {
  if(!state.admin) return `<div class="shell small-shell">${titleSection('ADMIN ACCESS','เข้าสู่ระบบผู้ดูแล','เฉพาะผู้ที่ได้รับสิทธิ์ใน Supabase เท่านั้น')}<section class="panel login-panel"><div class="login-icon">🔐</div><div class="field"><label>อีเมลผู้ดูแล</label><input type="email" id="admin-email" autocomplete="username" placeholder="admin@example.com"></div><div class="field"><label>รหัสผ่าน</label><input type="password" id="admin-password" autocomplete="current-password"></div><button data-action="admin-login" class="btn navy full-btn">เข้าสู่ระบบแอดมิน</button><p class="muted tiny">ไม่มีการสมัครบัญชีแอดมินสาธารณะ เจ้าของระบบเป็นผู้กำหนดสิทธิ์เท่านั้น</p></section></div>`;
  const orders=state.orders;
  const paid=[...orders,...state.archivedOrders].filter(o=>o.payment_status==='paid');
  const pieces=orders.filter(o=>o.order_status!=='cancelled').reduce((t,o)=>t+(o.order_items||[]).reduce((s,i)=>s+i.quantity,0),0);
  return `<div class="shell">${titleSection('CONTROL CENTER','ระบบจัดการคำสั่งซื้อ','ผู้ดูแล: '+state.admin.display_name)}<div class="flex-between admin-welcome"><span class="tag good">● ADMIN VERIFIED</span><button data-action="logout" class="btn light small">ออกจากระบบ</button></div><div class="metrics"><div class="metric"><small>ออเดอร์ทั้งหมด</small><strong>${orders.length}</strong></div><div class="metric"><small>จำนวนเสื้อที่สั่ง</small><strong>${pieces}</strong></div><div class="metric"><small>รอตรวจสลิป</small><strong>${orders.filter(o=>o.payment_status==='under_review').length}</strong></div><div class="metric"><small>ยอดรับที่ยืนยัน (รวมรายการลบ)</small><strong>${money(paid.reduce((s,o)=>s+Number(o.total_amount),0))}</strong></div></div>${tabs()}<div id="admin-panel">${renderAdminPanel()}</div></div>`;
}
function renderAdminPanel() {
  if(state.adminTab==='orders')return renderOrderList();
  if(state.adminTab==='archive')return renderArchiveHistory();
  if(state.adminTab==='catalog')return renderCatalog();
  if(state.adminTab==='settings')return renderSettings();
  if(state.adminTab==='reports')return renderReports();
  return '';
}
export function changeTab(tab) {state.adminTab=tab; if($('admin-panel'))$('admin-panel').innerHTML=renderAdminPanel();document.querySelectorAll('.admin-tabs button').forEach(n=>n.classList.toggle('selected',n.dataset.tab===tab));}
// A compact master list keeps the editing controls in a separate details dialog.
function renderOrderList() {
  const eligible=state.orders.filter(o=>!['cancelled','collected'].includes(o.order_status)).length;
  return `<section class="panel order-master"><div class="order-toolbar"><div class="note warning">🗑️ ลบได้ทุกสถานะ รวมถึงโอนเงินแล้ว: ระบบซ่อนจากรายการผลิต แต่ไม่ลบสลิป ใบเสร็จ หรือประวัติเงินที่รับ</div>
    <div class="toolbar order-search-row"><input id="admin-search" class="input" data-input="admin-search" placeholder="ค้นหาชื่อ ผู้สั่ง เบอร์เสื้อ หรือเลขออเดอร์" aria-label="ค้นหาคำสั่งซื้อ"><span class="live-indicator" id="order-live-indicator" aria-live="polite">● อัปเดตอัตโนมัติ</span><button data-action="reload-orders" class="btn light small" type="button">↻ รีเฟรช</button></div>
    <div class="order-bulk"><div><b>อัปเดตสถานะการผลิตพร้อมกัน</b><p class="muted tiny">ใช้กับทุกออเดอร์ที่ยังไม่ปิด (${eligible} ออเดอร์) ไม่แก้สถานะชำระเงิน</p></div><label class="control-label">เปลี่ยนเป็น
      <select id="bulk-status" aria-label="สถานะการผลิตที่ต้องการ">${Object.entries(orderStatus).filter(([key])=>key!=='cancelled').map(([key,label])=>`<option value="${key}">${e(label)}</option>`).join('')}</select></label><button type="button" class="btn navy small" data-action="bulk-status" ${eligible?'':'disabled'}>อัปเดตทุกออเดอร์ที่ยังไม่ปิด</button></div>
    <div class="order-delete-tools" aria-label="เลือกจัดการออเดอร์">
      <label class="order-check-all"><input id="select-all-orders" type="checkbox" data-action="select-visible-orders" aria-label="เลือกออเดอร์ที่กำลังแสดงอยู่"> เลือกทั้งหมดที่แสดง</label>
      <span id="selected-order-count" class="muted tiny">เลือกแล้ว 0 รายการ</span>
      <button type="button" class="btn light small" data-action="clear-order-selection">ล้างการเลือก</button>
      <button type="button" class="btn small danger-button" data-action="archive-selected-orders" id="archive-selected-button" disabled>🗑️ ลบออเดอร์ที่เลือก</button>
    </div>
  </div><div id="order-list" class="table-overflow order-table-scroll">${orderTable(state.orders)}</div><p class="muted tiny">คลิก “ดูรายละเอียด” เพื่อดูแบบเสื้อ ชื่อสกรีน เบอร์ ไซส์ สลิป และแก้สถานะรายออเดอร์ • แสดงล่าสุดสูงสุด 1,000 รายการ</p></section>`;
}
function orderTable(orders) {
  if(!orders.length)return '<div class="empty">ยังไม่มีคำสั่งซื้อ</div>';
  return `<table class="order-summary-table"><thead><tr><th class="check-cell">เลือก</th><th>เลขออเดอร์</th><th>ชื่อผู้สั่ง</th><th>วันที่สั่ง</th><th>จำนวนเสื้อ</th><th>ยอดเงิน</th><th>สถานะชำระเงิน</th><th>สถานะผลิต / รับเสื้อ</th><th>รายละเอียด</th></tr></thead><tbody>${orders.map(o=>{
    const search=[o.order_no,o.buyer_name,o.buyer_contact,...(o.order_items||[]).map(i=>`${i.jersey_name} ${i.jersey_number} ${i.size_label}`)].join(' ').toLowerCase();
    const qty=(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity),0);
    return `<tr tabindex="0" role="button" data-action="open-order" data-id="${o.id}" data-order-row data-search="${e(search)}" aria-label="ดูรายละเอียด ${e(o.order_no)}"><td class="check-cell"><input type="checkbox" data-action="toggle-order-select" data-id="${o.id}" aria-label="เลือกลบ ${e(o.order_no)}" ${canAdminArchive(o)?'':'disabled'} ${selectedOrders.has(o.id)?'checked':''}></td><td><strong>${e(o.order_no)}</strong></td><td>${e(o.buyer_name)}</td><td>${dateTH(o.created_at)}</td><td class="numeric">${qty}</td><td class="numeric"><b>${money(o.total_amount)}</b></td><td><span class="tag ${o.payment_status==='paid'?'good':'warn'}">${e(payStatus[o.payment_status]||o.payment_status)}</span></td><td><span class="tag ${o.order_status==='collected'?'good':'blue'}">${e(orderStatus[o.order_status]||o.order_status)}</span></td><td><button type="button" class="btn light small" data-action="open-order" data-id="${o.id}" aria-label="ดูรายละเอียด ${e(o.order_no)}">ดูรายละเอียด →</button></td></tr>`;
  }).join('')}</tbody></table>`;
}
// Retained paid orders stay available to admins even after removal from the active queue.
function renderArchiveHistory() {
  const rows=state.archivedOrders||[];
  const paid=rows.filter(o=>o.payment_status==='paid');
  return `<section class="panel order-master"><div class="order-toolbar"><div class="flex-between"><div><h2>🗄️ ประวัติออเดอร์ที่ลบ</h2><p class="muted tiny">เก็บหลักฐานการรับเงิน ใบเสร็จ สลิป และสามารถกู้คืนรายการได้ ไม่ใช่การคืนเงินโดยอัตโนมัติ</p></div><button class="btn light small" data-action="reload-orders">↻ อัปเดตรายการ</button></div><div class="note">ซ่อนอยู่ ${rows.length} รายการ • เคยรับชำระแล้ว ${paid.length} รายการ (${money(paid.reduce((n,o)=>n+Number(o.total_amount),0))})</div></div>
  <div class="table-overflow order-table-scroll"><table class="order-summary-table"><thead><tr><th>เลขออเดอร์</th><th>ชื่อผู้สั่ง</th><th>วันที่ลบ</th><th>ยอดเงิน</th><th>สถานะจ่าย</th><th>สถานะงาน</th><th>จัดการ</th></tr></thead><tbody>${rows.map(o=>`<tr><td><b>${e(o.order_no)}</b></td><td>${e(o.buyer_name)}</td><td>${dateTH(o.archived_at)}</td><td class="numeric">${money(o.total_amount)}</td><td>${e(payStatus[o.payment_status]||o.payment_status)}</td><td>${e(orderStatus[o.order_status]||o.order_status)}</td><td><div class="toolbar"><button class="btn light small" data-action="restore-archived-order" data-id="${o.id}">↶ คืนออเดอร์</button><button class="btn light small" data-action="archived-receipt-pdf" data-id="${o.id}">📄 เอกสาร</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">ยังไม่มีรายการที่ลบ</td></tr>'}</tbody></table></div><p class="muted tiny">แสดงประวัติล่าสุดสูงสุด 1,000 รายการ</p></section>`;
}
export async function restoreArchivedOrder(id) {
  if(state.busy)return;
  const item=state.archivedOrders.find(o=>o.id===id);
  if(!item)return toast('ไม่พบรายการในประวัติ');
  if(!confirm(`กู้คืนคำสั่งซื้อ ${item.order_no} ให้กลับมาแสดงในตารางหลัก?\nข้อมูลรับเงินและสถานะเดิมจะคงอยู่`))return;
  setBusy(true);
  try {
    const {data,error}=await db.rpc('restore_jersey_orders',{p_ids:[id]});
    if(error)throw error;
    if(data?.restored!==1)throw new Error('ออเดอร์อาจถูกกู้คืนไปแล้ว กรุณารีเฟรช');
    setBusy(false);
    await refreshAdminOrders({quiet:true});
    toast(`กู้คืน ${item.order_no} เรียบร้อย`);
  }catch(err){setBusy(false);toast('กู้คืนไม่สำเร็จ: '+err.message);}finally{setBusy(false);}
}
export async function archivedReceiptPdf(id) {
  const item=state.archivedOrders.find(o=>o.id===id);
  if(!item)return toast('ไม่พบออเดอร์');
  await exportPdf(buyerPdfMarkup({...item,items:item.order_items}),`${item.payment_status==='paid'?'Receipt':'Order'}-${item.order_no}.pdf`);
}
export function filterOrders() {
  const search=v('admin-search').toLowerCase();
  document.querySelectorAll('[data-order-row]').forEach(node=>{node.hidden=!node.dataset.search.includes(search);});
  updateSelectionControls();
}
export function openOrder(id) {
  const o=state.orders.find(row=>row.id===id);if(!o)return toast('ไม่พบออเดอร์');
  const items=sortOrderItems(o.order_items||[]);
  openDialog(`<div class="order-detail-header"><div><p class="eyebrow dark">ORDER DETAILS</p><h2 style="margin:0">${e(o.order_no)}</h2><p class="muted tiny">${dateTH(o.created_at)} · ${e(o.buyer_name)} · ${e(o.buyer_contact)} · ${e(paymentMethods[o.payment_method])}</p></div><button data-action="close-dialog" class="btn light small" type="button" aria-label="ปิดรายละเอียด">✕ ปิด</button></div><div class="detail-tags"><span class="tag ${o.payment_status==='paid'?'good':'warn'}">${e(payStatus[o.payment_status])}</span><span class="tag blue">${e(orderStatus[o.order_status])}</span><strong class="detail-total">${money(o.total_amount)}</strong></div>
   <div class="table-overflow"><table class="detail-items"><thead><tr><th>แบบเสื้อ</th><th>ชื่อสกรีน</th><th>เบอร์</th><th>ไซส์</th><th>จำนวน</th><th>ราคา</th></tr></thead><tbody>${items.map(i=>`<tr><td>${e(i.product_name)}</td><td>${e(i.jersey_name)}</td><td>${e(i.jersey_number)}</td><td>${e(i.size_label)}</td><td>${i.quantity}</td><td>${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div>
   <div class="detail-controls"><div class="field"><label>สถานะการชำระเงิน</label><select id="payment-${o.id}">${Object.entries(payStatus).map(([k,n])=>`<option value="${k}" ${o.payment_status===k?'selected':''}>${e(n)}</option>`).join('')}</select><button data-action="save-payment" data-id="${o.id}" class="btn navy small">บันทึกการชำระเงิน</button></div><div class="field"><label>สถานะการผลิต / รับเสื้อ</label><select id="fulfillment-${o.id}">${Object.entries(orderStatus).map(([k,n])=>`<option value="${k}" ${o.order_status===k?'selected':''}>${e(n)}</option>`).join('')}</select><button data-action="save-fulfillment" data-id="${o.id}" class="btn navy small">บันทึกสถานะ</button></div></div>
   <div class="toolbar">${canAdminArchive(o)?`<button class="btn light small danger-button" data-action="archive-single-order" data-id="${o.id}">🗑️ ลบออเดอร์นี้</button>`:''}${o.payment_submissions?.length?`<button class="btn light small" data-action="open-slip" data-id="${o.id}">🧾 ดูสลิป (${o.payment_submissions.length})</button>`:''}<button class="btn light small" data-action="admin-buyer-pdf" data-id="${o.id}">📄 PDF ใบเสร็จ / ใบสั่งซื้อ</button></div><p class="muted tiny">การตรวจรับเงินยังคงแยกจากสถานะผลิต เพื่อไม่ให้ทุกออเดอร์ถูกอนุมัติจ่ายเงินโดยอัตโนมัติ</p>`);
  const overlay=document.querySelector('.dialog-shade');
  if(overlay){overlay.setAttribute('role','presentation');overlay.addEventListener('click',ev=>{if(ev.target===overlay)closeDialog()});}
}

export function toggleOrderSelection(id, checked) {
  const o=state.orders.find(o=>o.id===id);
  if(!canAdminArchive(o)) return;
  if(checked)selectedOrders.add(id);else selectedOrders.delete(id);
  updateSelectionControls();
}
export function selectVisibleOrders(checked) {
  for(const tr of document.querySelectorAll('[data-order-row]')) {
    if(tr.hidden)continue;
    const checkbox=tr.querySelector('input[data-action="toggle-order-select"]');
    if(!checkbox || checkbox.disabled)continue;
    checkbox.checked=checked;
    if(checked)selectedOrders.add(checkbox.dataset.id);else selectedOrders.delete(checkbox.dataset.id);
  }
  updateSelectionControls();
}
export function clearOrderSelection() {
  selectedOrders.clear();
  document.querySelectorAll('input[data-action="toggle-order-select"]').forEach(el=>{el.checked=false;});
  updateSelectionControls();
}
function updateSelectionControls() {
  const label=$('selected-order-count'),button=$('archive-selected-button');
  if(label)label.textContent=`เลือกแล้ว ${selectedOrders.size} รายการ`;
  if(button)button.disabled=selectedOrders.size===0;
  const visible=[...document.querySelectorAll('[data-order-row]')].filter(row=>!row.hidden)
    .map(row=>row.querySelector('input[data-action="toggle-order-select"]')).filter(ch=>ch&&!ch.disabled);
  const all=$('select-all-orders');
  if(all) {all.checked=visible.length>0&&visible.every(ch=>ch.checked);all.indeterminate=visible.some(ch=>ch.checked)&&!all.checked;}
}
export async function archiveSelectedOrders(singleId=null) {
  if(state.busy)return;
  const ids=singleId?[singleId]:Array.from(selectedOrders);
  if(!ids.length)return toast('กรุณาเลือกออเดอร์ก่อน');
  if(state.orders.length>=1000)return toast('รายการครบ 1,000 ออเดอร์ กรุณาจัดการหลังเพิ่มระบบแบ่งหน้า');
  const eligible=ids.filter(id=>canAdminArchive(state.orders.find(o=>o.id===id)));
  if(!eligible.length)return toast('ไม่พบออเดอร์ที่เลือก หรือออเดอร์ถูกนำออกจากรายการแล้ว');
  const selected=eligible.map(id=>state.orders.find(o=>o.id===id)).filter(Boolean);
  const paid=selected.filter(o=>o.payment_status==='paid').length;
  const started=selected.filter(o=>['processing','production','ready','collected'].includes(o.order_status)).length;
  if(!confirm(`นำ ${eligible.length} ออเดอร์ออกจากรายการหลัก?\nมีออเดอร์ที่ยืนยันรับเงินแล้ว ${paid} รายการ และอยู่ระหว่าง/ผ่านการผลิต ${started} รายการ\n\nข้อมูลสลิป ใบเสร็จ และประวัติรับเงินยังอยู่ครบ สามารถดูและคืนรายการจากแท็บประวัติออเดอร์ที่ลบได้\nการลบนี้ไม่ใช่การคืนเงิน และไม่ได้ยกเลิกงานกับร้านผลิตอัตโนมัติ`))return;
  if(paid>0&&!confirm(`โปรดยืนยันอีกครั้ง: จะนำออเดอร์ที่ชำระแล้ว ${paid} รายการออกจากหน้ารายการหลัก\nเงินที่เคยได้รับยังต้องอยู่ในรายงานการเงิน และถ้ามีการคืนเงินต้องดำเนินการแยกต่างหาก`))return;
  setBusy(true);
  try {
    let count=0,skipped=0;
    for(let start=0;start<eligible.length;start+=100){
      const {data,error}=await db.rpc('archive_jersey_orders',{p_ids:eligible.slice(start,start+100)});
      if(error)throw error;
      count+=Number(data?.archived||0);skipped+=Number(data?.skipped||0);
    }
    closeDialog();selectedOrders.clear();setBusy(false);
    await refreshAdminOrders({quiet:true});
    toast(`นำออกจากรายการหลัก ${count} ออเดอร์${skipped?` (ข้าม ${skipped} รายการที่ไม่เข้าเงื่อนไข)`:''}`);
  } catch(err) {setBusy(false);await refreshAdminOrders({quiet:true});toast('ลบรายการไม่สำเร็จ: '+err.message);}
  finally {setBusy(false);}
}
export async function bulkUpdateOrderStatus() {
  if(state.busy)return;
  const target=v('bulk-status');
  if(!Object.hasOwn(orderStatus,target)||target==='cancelled')return toast('เลือกสถานะการผลิตให้ถูกต้อง');
  // Do not reopen cancelled or already-collected orders, and skip rows already at target state.
  const eligible=state.orders.filter(o=>!['cancelled','collected'].includes(o.order_status)&&o.order_status!==target);
  if(!eligible.length)return toast('ทุกออเดอร์ที่ยังไม่ปิดอยู่ในสถานะนี้แล้ว');
  if(state.orders.length>=1000)return toast('รายการเกิน 1,000 ออเดอร์ ยังไม่อนุญาตให้ปรับทั้งหมดจนกว่าจะมีระบบแบ่งหน้า');
  if(!confirm(`เปลี่ยนสถานะการผลิตของ ${eligible.length} ออเดอร์เป็น “${orderStatus[target]}” พร้อมกันหรือไม่?\n\nไม่เปลี่ยนสถานะการชำระเงิน และไม่เปลี่ยนออเดอร์ที่ยกเลิกหรือรับเสื้อแล้ว`))return;
  if(target==='collected'&&!confirm('ยืนยันอีกครั้งว่าได้ส่งมอบเสื้อให้ผู้สั่งทั้ง '+eligible.length+' ออเดอร์แล้วจริงหรือไม่?'))return;
  setBusy(true);
  let done=0;
  try{
    for(let k=0;k<eligible.length;k+=75){
      const chunk=eligible.slice(k,k+75);const ids=chunk.map(o=>o.id);
      const {data,error}=await db.from('orders').update({order_status:target}).in('id',ids).not('order_status','in','(cancelled,collected)').is('archived_at',null).select('id');
      if(error)throw error;
      if(!data||data.length!==ids.length)throw Error('บันทึกได้เพียงบางรายการ โปรดตรวจสอบสิทธิ์และรีเฟรชข้อมูล');
      done+=data.length;
    }
    setBusy(false);await refreshAdminOrders({quiet:true});
    toast(`อัปเดตสถานะเรียบร้อย ${done} ออเดอร์`);
  }catch(err){setBusy(false);await refreshAdminOrders({quiet:true});toast(`สำเร็จ ${done}/${eligible.length} ออเดอร์ — ${err.message||'มีข้อผิดพลาด'}`);}
  finally{setBusy(false);}
}
export async function login() {
  const email=v('admin-email'), password=v('admin-password');
  if(!email||!password)return toast('กรอกอีเมลและรหัสผ่าน');
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error)return toast('เข้าสู่ระบบไม่สำเร็จ: '+error.message);
  await checkAdmin();
  if(!state.admin){await db.auth.signOut();return toast('บัญชีนี้ไม่ได้รับสิทธิ์แอดมิน');}
  try{await loadAdminOrders();startAdminLiveUpdates();window.dispatchEvent(new Event('jersey-render'));}catch(err){toast('โหลดคำสั่งซื้อไม่สำเร็จ: '+err.message);}
}
export async function logout() {stopAdminLiveUpdates();await db.auth.signOut();state.admin=null;state.orders=[];state.archivedOrders=[];location.hash='home';}
// Keep the search field and open details stable while refreshing in the background.
let fetchingOrders=false;
let adminChannel=null;
let pollTimer=null;
let debounceTimer=null;
export async function refreshAdminOrders({quiet=true}={}) {
  if(fetchingOrders||!state.admin||state.busy&&quiet)return;
  fetchingOrders=true;
  const search=v('admin-search'),bulkTarget=v('bulk-status');
  const searchFocused=document.activeElement?.id==='admin-search';
  const caret=searchFocused?document.activeElement.selectionStart:0;
  try{
    await loadAdminOrders();
    if(currentRoute()==='admin'){
      if(state.adminTab==='orders'&&$('admin-panel')){
        $('admin-panel').innerHTML=renderOrderList();
        if($('admin-search')){$('admin-search').value=search;filterOrders();
          if(searchFocused){$('admin-search').focus();$('admin-search').setSelectionRange(caret,caret);}}
        if($('bulk-status') && bulkTarget && Object.hasOwn(orderStatus,bulkTarget))$('bulk-status').value=bulkTarget;
        updateSelectionControls();
      }
      if(state.adminTab==='archive'&&$('admin-panel'))$('admin-panel').innerHTML=renderArchiveHistory();
      // Keep any unsaved edits in other admin tabs untouched.
      const nums=document.querySelectorAll('.metric strong');
      if(nums.length===4){
        nums[0].textContent=state.orders.length;
        nums[1].textContent=state.orders.filter(o=>o.order_status!=='cancelled').reduce((sum,o)=>sum+(o.order_items||[]).reduce((q,i)=>q+Number(i.quantity),0),0);
        nums[2].textContent=state.orders.filter(o=>o.payment_status==='under_review').length;
        nums[3].textContent=money([...state.orders,...state.archivedOrders].filter(o=>o.payment_status==='paid').reduce((sum,o)=>sum+Number(o.total_amount),0));
      }
    }
    const indicator=$('order-live-indicator');if(indicator){indicator.textContent='● อัปเดต '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
    if(!quiet)toast('อัปเดตข้อมูลล่าสุดแล้ว');
  }catch(err){if(!quiet)toast('โหลดข้อมูลไม่สำเร็จ: '+err.message);}
  finally{fetchingOrders=false;}
}
export async function reloadOrders(){await refreshAdminOrders({quiet:false});}
export function startAdminLiveUpdates(){
  if(!state.admin||pollTimer)return;
  // Realtime notification + 12-second polling as a fallback if publication is not enabled.
  try{
    adminChannel=db.channel('jersey-admin-order-updates')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{
        clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>refreshAdminOrders(),400);
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'payment_submissions'},()=>{
        clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>refreshAdminOrders(),400);
      }).subscribe();
  }catch(err){console.warn('Realtime unavailable; automatic polling remains active',err);}
  pollTimer=setInterval(()=>{if(!document.hidden&&currentRoute()==='admin'&&state.admin)refreshAdminOrders();},12000);
  document.addEventListener('visibilitychange',onVisibilityChange);
}
function onVisibilityChange(){if(!document.hidden&&state.admin&&currentRoute()==='admin')refreshAdminOrders();}
export function stopAdminLiveUpdates(){
  clearInterval(pollTimer);pollTimer=null;clearTimeout(debounceTimer);
  if(adminChannel){db.removeChannel(adminChannel);adminChannel=null;}
  document.removeEventListener('visibilitychange',onVisibilityChange);
}
export async function changeOrder(id, kind) {
  const order=state.orders.find(o=>o.id===id);if(!order)return;
  const key=kind==='payment'?'payment_status':'order_status';
  const value=v(`${kind==='payment'?'payment':'fulfillment'}-${id}`);
  if(key==='payment_status'&&value==='paid' && !confirm('ยืนยันว่าได้รับเงินเข้าบัญชีจริง ตรวจสอบยอดและชื่อบัญชีแล้ว ใช่หรือไม่?'))return;
  if(key==='order_status'&&value==='collected'&&!confirm('ยืนยันว่าผู้สั่งได้รับเสื้อแล้วใช่หรือไม่?'))return;
  setBusy(true);
  try{
    const {data,error}=await db.from('orders').update({[key]:value}).eq('id',id).is('archived_at',null).neq('order_status','cancelled').select('id');
    if(error)throw error;
    if(!data?.length)throw Error('ออเดอร์นี้ถูกยกเลิกหรือลบออกจากรายการแล้ว กรุณาโหลดข้อมูลใหม่');
    closeDialog();setBusy(false);await refreshAdminOrders({quiet:true});toast('บันทึกสถานะแล้ว');
  }catch(err){toast('บันทึกไม่สำเร็จ: '+err.message);}finally{setBusy(false);}
}
export async function openSlip(id) {
  const o=state.orders.find(o=>o.id===id);const slip=[...(o?.payment_submissions||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
  if(!slip)return toast('ยังไม่มีสลิป');
  const tab=window.open('about:blank','_blank');
  const {data,error}=await db.storage.from('jersey-slips').createSignedUrl(slip.storage_path,120);
  if(error){if(tab)tab.close();return toast('เปิดสลิปไม่สำเร็จ: '+error.message);}
  if(tab)tab.location.assign(data.signedUrl);else toast('โปรดเปิดอนุญาตป๊อปอัป');
}
export async function adminBuyerPdf(id) {
  const o=state.orders.find(o=>o.id===id);if(!o)return;
  const full={...o,items:o.order_items};
  await exportPdf(buyerPdfMarkup(full),`${o.payment_status==='paid'?'Receipt':'Order'}-${o.order_no}.pdf`);
}
async function uploadPublicMedia(inputId) {
  const file=$(inputId)?.files?.[0]; if(!file)return null;
  if(file.size>10*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('รูปต้องเป็น PNG/JPG/WEBP และขนาดไม่เกิน 10 MB');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`team/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from('jersey-media').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return db.storage.from('jersey-media').getPublicUrl(path).data.publicUrl;
}
function renderSettings() {
  const s=state.settings||{},c=state.campaign||{};
  return `<div class="admin-columns"><section class="panel"><h2>⚙️ ตั้งค่าทีมและการชำระเงิน</h2>${field('team-name','ชื่อทีม / ร้าน',s.team_name)}${field('team-subtitle','คำโปรยเว็บไซต์',s.site_subtitle)}${field('bank-name','ธนาคาร',s.bank_name)}${field('bank-holder','ชื่อบัญชี',s.bank_account_name)}${field('bank-no','เลขที่บัญชี',s.bank_account_no)}${field('pickup-location','สถานที่รับเสื้อ',s.pickup_location)}${field('team-contact','ช่องทางติดต่อทีม',s.support_contact)}<div class="field"><label>โลโก้ทีม (PNG/JPG/WEBP)</label><input id="team-logo" type="file" accept="image/png,image/jpeg,image/webp">${s.logo_url?`<img class="preview-small" src="${safeImage(s.logo_url)}" alt="โลโก้">`:''}</div><div class="field"><label>QR Code สำหรับชำระเงิน</label><input id="bank-qr" type="file" accept="image/png,image/jpeg,image/webp">${s.payment_qr_url?`<img class="preview-small" src="${safeImage(s.payment_qr_url)}" alt="QR Code">`:''}</div><button data-action="save-settings" class="btn navy">บันทึกตั้งค่าทีม</button></section><section class="panel"><h2>📆 ตั้งค่ารอบพรีออเดอร์</h2>${field('campaign-name','ชื่อรอบสั่งซื้อ',c.name)}<div class="field"><label>วันปิดรับ (เว้นว่างได้)</label><input type="datetime-local" id="campaign-close" value="${c.order_deadline?new Date(new Date(c.order_deadline).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></div><div class="field"><label>วันคาดว่าจะได้รับสินค้า</label><input type="date" id="campaign-pickup" value="${e(c.pickup_date||'')}"></div><div class="field"><label>สถานะการเปิดรับ</label><select id="campaign-open"><option value="false" ${!c.is_open?'selected':''}>🔴 ปิดรับคำสั่งซื้อ</option><option value="true" ${c.is_open?'selected':''}>🟢 เปิดรับคำสั่งซื้อ</option></select></div><div class="note warning">ระบบตั้งต้นปิดการสั่งซื้อ ตรวจสอบราคา รูปเสื้อ และช่องทางรับเงินให้ครบก่อนเปิดรับจริง</div><button class="btn gold" data-action="save-campaign">บันทึกรอบพรีออเดอร์</button></section></div>`;
}
function field(id,label,value) {return `<div class="field"><label>${e(label)}</label><input id="${id}" value="${e(value||'')}" maxlength="140"></div>`;}
export async function saveSettings() {
  if(state.busy)return;setBusy(true);
  try {
    const payload={team_name:v('team-name'),site_subtitle:v('team-subtitle'),bank_name:v('bank-name'),bank_account_name:v('bank-holder'),bank_account_no:v('bank-no'),pickup_location:v('pickup-location'),support_contact:v('team-contact')};
    if(!payload.team_name)throw Error('กรุณาระบุชื่อทีม');
    const logo=await uploadPublicMedia('team-logo'),qr=await uploadPublicMedia('bank-qr');
    if(logo)payload.logo_url=logo;if(qr)payload.payment_qr_url=qr;
    const {error}=await db.from('site_settings').update(payload).eq('id',1);if(error)throw error;
    await loadCatalog();window.dispatchEvent(new Event('jersey-render'));toast('บันทึกข้อมูลทีมแล้ว');
  }catch(err){toast('บันทึกไม่สำเร็จ: '+err.message);}finally{setBusy(false);}
}
export async function saveCampaign() {
  const isOpen=v('campaign-open')==='true';
  if(isOpen&&(!state.settings?.bank_name||!state.settings?.bank_account_name||!state.settings?.bank_account_no||!state.settings?.payment_qr_url))return toast('ต้องตั้งค่าธนาคารและ QR Code ให้ครบก่อนเปิดรอบ');
  const deadline=v('campaign-close');
  if(isOpen&&!state.products.some(p=>p.is_active&&state.variants.some(x=>x.product_id===p.id&&x.is_active)))return toast('ต้องกำหนดแบบเสื้อและราคาอย่างน้อยหนึ่งไซส์');
  const payload={name:v('campaign-name'),is_open:isOpen,order_deadline:deadline?new Date(deadline).toISOString():null,pickup_date:v('campaign-pickup')||null};
  const {error}=await db.from('campaigns').update(payload).eq('id',state.campaign.id);
  if(error)return toast(error.message);
  await loadCatalog();window.dispatchEvent(new Event('jersey-render'));toast('บันทึกรอบสั่งซื้อแล้ว');
}
function renderCatalog() {
  const products=state.products;
  return `<div class="panel"><h2>👕 เพิ่มแบบเสื้อใหม่</h2><div class="toolbar"><input id="new-product" class="input" placeholder="ชื่อแบบเสื้อ / รุ่น"><button class="btn navy" data-action="create-product">+ เพิ่มแบบเสื้อ</button></div></div>${products.map(p=>`<section class="panel catalog-panel"><h2>${e(p.name)}</h2><div class="form-grid">${field(`product-name-${p.id}`,'ชื่อรุ่น',p.name)}${field(`product-desc-${p.id}`,'รายละเอียด',p.description)}<div class="field"><label>ภาพด้านหน้า</label><input type="file" id="front-${p.id}" accept="image/png,image/jpeg,image/webp"></div><div class="field"><label>ภาพด้านหลัง</label><input type="file" id="back-${p.id}" accept="image/png,image/jpeg,image/webp"></div><div class="field"><label>ภาพแขนเสื้อ</label><input type="file" id="sleeve-${p.id}" accept="image/png,image/jpeg,image/webp"></div><div class="field"><label>สถานะสินค้า</label><select id="product-active-${p.id}"><option value="true" ${p.is_active?'selected':''}>แสดงสินค้า</option><option value="false" ${!p.is_active?'selected':''}>ซ่อนสินค้า</option></select></div></div><div class="toolbar product-actions"><button class="btn navy small" data-action="save-product" data-id="${p.id}">บันทึกชื่อ รูป และแบบเสื้อ</button><button class="btn light small danger-button" data-action="delete-product" data-id="${p.id}">🗑️ ลบแบบเสื้อ</button></div><p class="muted tiny">หากแบบเสื้อนี้มีรายการสั่งซื้อแล้ว ระบบจะซ่อนจากหน้าร้านแทนการลบ เพื่อรักษาประวัติออเดอร์และเอกสารการผลิต</p><h3>ไซส์และราคา</h3><div class="table-overflow responsive-table"><table class="mobile-stack variant-table"><thead><tr><th>ไซส์</th><th>ราคา (บาท)</th><th>รอบอก (ซม.)</th><th>ยาว (ซม.)</th><th>บันทึก</th></tr></thead><tbody>${state.variants.filter(x=>x.product_id===p.id).map(x=>`<tr><td data-label="ไซส์"><b>${e(x.size_label)}</b></td><td data-label="ราคา (บาท)"><input class="cell-input" id="price-${x.id}" type="number" min="0" value="${x.price}"></td><td data-label="รอบอก (ซม.)"><input class="cell-input" id="chest-${x.id}" type="number" min="0" value="${x.chest_cm??''}"></td><td data-label="ยาว (ซม.)"><input class="cell-input" id="length-${x.id}" type="number" min="0" value="${x.length_cm??''}"></td><td data-label="จัดการ"><button class="btn light small" data-action="save-variant" data-id="${x.id}">บันทึก</button></td></tr>`).join('')}</tbody></table></div><div class="toolbar"><input class="input compact" id="size-new-${p.id}" list="standard-jersey-sizes-${p.id}" placeholder="ไซส์ เช่น 4XL"><input class="input compact" id="price-new-${p.id}" type="number" min="0" placeholder="ราคา"><button class="btn small navy" data-action="create-variant" data-id="${p.id}">+ เพิ่มไซส์</button></div><datalist id="standard-jersey-sizes-${p.id}">${SIZE_ORDER.map(size=>`<option value="${size}"></option>`).join('')}</datalist></section>`).join('')}`;
}
export async function createProduct() {
  const name=v('new-product');if(!name)return toast('กรอกชื่อแบบเสื้อ');
  const {error}=await db.from('products').insert({name});if(error)return toast(error.message);
  await loadCatalog();changeTab('catalog');toast('เพิ่มแบบเสื้อแล้ว');
}
export async function saveProduct(id) {
  if(state.busy)return;setBusy(true);
  try {
    const payload={name:v(`product-name-${id}`),description:v(`product-desc-${id}`),is_active:v(`product-active-${id}`)==='true'};
    for(const [formKey,column] of [['front','front_image_url'],['back','back_image_url'],['sleeve','sleeve_image_url']]) {
      const path=await uploadPublicMedia(`${formKey}-${id}`);if(path)payload[column]=path;
    }
    const {error}=await db.from('products').update(payload).eq('id',id);if(error)throw error;
    await loadCatalog();changeTab('catalog');toast('บันทึกแบบเสื้อแล้ว');
  } catch(err){toast(err.message);}finally{setBusy(false);}
}
/**
 * Delete a product only if it has never appeared in an order.
 * A product already in an order is archived (is_active = false), because
 * order_items reference products/variants and must remain available for
 * historical receipts and production reports.
 * RLS also checks the authenticated admin on the server.
 */
export async function deleteProduct(id) {
  if(state.busy)return;
  const product=state.products.find(p=>p.id===id);
  if(!product)return toast('ไม่พบแบบเสื้อที่เลือก');
  setBusy(true);
  try {
    // Check across *all* orders in the database, not just the latest 1,000
    // loaded in the admin list.
    const {count,error:countError}=await db.from('order_items')
      .select('id',{count:'exact',head:true}).eq('product_id',id);
    if(countError)throw countError;
    if(count===null)throw Error('ไม่สามารถตรวจสอบประวัติการสั่งซื้อได้');

    if(count>0){
      if(!confirm(`แบบเสื้อ "${product.name}" มีรายการสั่งซื้อ ${count} รายการ\n\nไม่สามารถลบถาวรได้ เพราะต้องเก็บชื่อ เบอร์ และไซส์สำหรับผลิตและออกเอกสาร\n\nต้องการซ่อนแบบเสื้อนี้จากหน้าร้านแทนหรือไม่?`))return;
      const {data,error}=await db.from('products')
        .update({is_active:false}).eq('id',id).select('id');
      if(error)throw error;
      if(!data?.length)throw Error('ไม่มีสิทธิ์แก้ไขแบบเสื้อ กรุณาตรวจสอบบัญชีแอดมิน');
      await loadCatalog();changeTab('catalog');
      toast('ซ่อนแบบเสื้อจากหน้าร้านแล้ว โดยคงประวัติคำสั่งซื้อไว้');
      return;
    }

    if(!confirm(`ยืนยันลบแบบเสื้อ "${product.name}" อย่างถาวร?\n\nไซส์และราคาของแบบนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนผ่านเว็บไซต์ได้`))return;
    // PostgreSQL FKs are the final defense against deleting items that get
    // linked to an order between the history check and the DELETE.
    const {data,error}=await db.from('products').delete().eq('id',id).select('id');
    if(error){
      if(error.code==='23503')throw Error('แบบเสื้อนี้ถูกใช้ในออเดอร์แล้ว โปรดเลือกซ่อนสินค้าจากหน้าร้านแทน');
      throw error;
    }
    if(!data?.length)throw Error('ลบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์แอดมิน');
    await loadCatalog();changeTab('catalog');
    toast('ลบแบบเสื้อและไซส์ที่ยังไม่มีออเดอร์เรียบร้อยแล้ว');
  }catch(err){toast('ไม่สามารถลบแบบเสื้อ: '+(err.message||'เกิดข้อผิดพลาด'));}
  finally{setBusy(false);}
}

export async function saveVariant(id) {
  const price=Number(v(`price-${id}`));if(!Number.isFinite(price)||price<0)return toast('ราคาต้องไม่ติดลบ');
  const payload={price,chest_cm:v(`chest-${id}`)?Number(v(`chest-${id}`)):null,length_cm:v(`length-${id}`)?Number(v(`length-${id}`)):null};
  const {error}=await db.from('product_variants').update(payload).eq('id',id);if(error)return toast(error.message);
  await loadCatalog();changeTab('catalog');toast('บันทึกราคาและขนาดแล้ว');
}
export async function createVariant(id) {
  const size=v(`size-new-${id}`).toUpperCase(),price=Number(v(`price-new-${id}`));
  if(!size||!Number.isFinite(price)||price<0)return toast('กรุณาระบุไซส์และราคา');
  const {error}=await db.from('product_variants').insert({product_id:id,size_label:size,price});
  if(error)return toast(error.message);
  await loadCatalog();changeTab('catalog');toast('เพิ่มไซส์แล้ว');
}
function renderReports() {
  return `<div class="panel"><h2>📊 ส่งออกรายการให้ร้านผลิต</h2><p class="muted">Excel แยกคอลัมน์ชื่อสกรีน เบอร์เสื้อ ไซส์ จำนวน และรวมจำนวนแต่ละไซส์ เบอร์เช่น 07 จะคงเลขศูนย์ไว้ได้</p><div class="field"><label>รายการที่ต้องการส่งออก</label><select id="report-filter"><option value="all">ทั้งหมด ยกเว้นยกเลิก</option><option value="paid">เฉพาะชำระแล้ว</option><option value="production">เฉพาะกำลังผลิต / พร้อมรับ</option></select></div><div class="field"><label>ชนิดไฟล์ Excel</label><select id="excel-type"><option value="factory">สำหรับร้านผลิต (ไม่แสดงข้อมูลส่วนตัว)</option><option value="admin">สำหรับแอดมิน (เพิ่มชีตการชำระเงิน)</option></select></div><div class="toolbar"><button data-action="export-excel" class="btn navy">📗 ดาวน์โหลด Excel (.xlsx)</button><button data-action="export-pdf" class="btn gold">📄 ดาวน์โหลด PDF รายการผลิต</button></div><div class="note">รายงานส่งร้านไม่รวมออเดอร์ที่นำออกจากรายการหลัก แต่ Excel ฉบับแอดมินจะยังเก็บข้อมูลรับเงินย้อนหลัง รวมรายการที่ลบไว้ด้วย โปรดตรวจความถูกต้องก่อนส่งร้านผลิต</div></div>`;
}
export async function doExcel() {try{await downloadExcel(v('report-filter'),v('excel-type'));toast('ดาวน์โหลด Excel แล้ว');}catch(err){toast(err.message);}}
export async function doReportPdf() {try{await downloadProductionPdf(v('report-filter'));}catch(err){toast(err.message);}}
