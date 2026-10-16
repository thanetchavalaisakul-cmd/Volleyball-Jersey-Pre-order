import { canBuyerCancel } from './order-actions.js';
import { sortOrderItems } from './sizes.js';
import { config, db, state, $, v, toast, setBusy, openDialog, closeDialog, navigate, escapeHtml as e, safeImage, currency as money, dateTH, payStatus, orderStatus, paymentMethods, titleSection, activeCampaign, productPrice, reportHeader, exportPdf } from './common.js';

const pending = () => state.cart.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
export function renderHome() {
  return `<section class="hero"><div class="shell hero-grid"><div><div class="eyebrow">OFFICIAL TEAM JERSEY · PRE-ORDER</div><h1>PLAY WITH<br>YOUR <em>NAME.</em><br>YOUR <em>NUMBER.</em></h1><p>เสื้อวอลเลย์บอลที่เป็นตัวคุณ เลือกไซส์ สกรีนชื่อและเบอร์หลังเสื้อ ชำระเงิน พร้อมติดตามสถานะได้โดยไม่ต้องสมัครสมาชิก</p><div class="hero-buttons"><a class="btn gold" href="#order">🛒 สั่งเสื้อเลย</a><a class="btn ghost" href="#styles">ชมแบบเสื้อ →</a></div><div class="hero-state">${activeCampaign() ? '🟢 เปิดรับพรีออเดอร์แล้ว' : '🟡 เตรียมเปิดรับพรีออเดอร์'}</div></div><div class="hero-media"><div class="hero-circle"></div><img src="/jersey.svg" class="hero-jersey" alt="ตัวอย่างเสื้อวอลเลย์บอล"><img src="/volleyball.svg" class="hero-ball" alt="ลูกวอลเลย์บอล"></div></div></section>
  <section class="shell features"><a href="#styles" class="feature"><span>👕</span><strong>ดูแบบเสื้อ</strong><small>หน้า · หลัง · แขนเสื้อ</small></a><a href="#sizes" class="feature"><span>📏</span><strong>ตารางไซส์</strong><small>ขนาดและราคาแต่ละไซส์</small></a><a href="#order" class="feature"><span>🏐</span><strong>สั่งซื้อเสื้อ</strong><small>สกรีนชื่อ เบอร์ และไซส์</small></a><a href="#track" class="feature"><span>📦</span><strong>เช็กสถานะ</strong><small>ชำระเงิน · ผลิต · รับสินค้า</small></a></section>
  <section class="shell section"><div class="section-title"><div><span class="eyebrow dark">JERSEY COLLECTION</span><h2>แบบเสื้อประจำทีม</h2><p>${e(state.campaign?.name || 'คอลเลกชันของเรา')}</p></div><a class="btn light" href="#styles">ชมทั้งหมด →</a></div><div class="product-grid">${state.products.filter(x=>x.is_active).map(productCard).join('') || '<div class="panel">กำลังเตรียมแบบเสื้อ</div>'}</div></section>
  <section class="shell section"><div class="callout"><div><h2>สั่งแล้วอย่าลืมบันทึกเลขออเดอร์ 📸</h2><p>ทุกคำสั่งซื้อจะมีเลขออเดอร์และรหัสติดตามเฉพาะสำหรับกลับมาเช็กสถานะได้ตลอด</p></div><a class="btn gold" href="#track">ติดตามคำสั่งซื้อ →</a></div></section>`;
}
function photo(p) { return p.front_image_url ? `<img src="${safeImage(p.front_image_url)}" alt="ภาพด้านหน้า ${e(p.name)}" loading="lazy">` : '<img src="/jersey.svg" alt="ภาพเสื้อตัวอย่าง">'; }
function productCard(p) { const price = productPrice(p.id); return `<article class="product-card"><div class="product-picture">${photo(p)}<span class="small-pill">TEAM EDITION</span></div><div class="product-content"><h3>${e(p.name)}</h3><p>${e(p.description || 'เสื้อวอลเลย์บอลสกรีนชื่อและเบอร์')}</p><div class="flex-between"><strong class="price">${price === null ? 'รอระบุราคา' : `เริ่ม ${money(price)}`}</strong><a href="#order" class="btn small">สั่งซื้อ →</a></div></div></article>`; }
export function renderStyles() {
  return `<div class="shell">${titleSection('JERSEY DESIGN', 'แบบเสื้อวอลเลย์บอล', 'แสดงแบบเสื้อจากข้อมูลที่แอดมินอัปโหลด สามารถเลือกสั่งได้ทันที')}<div class="product-grid">${state.products.filter(p=>p.is_active).map(p=>`<article class="panel design-item"><h2>${e(p.name)}</h2><p class="muted">${e(p.description || '')}</p><div class="design-images"><div><label>ด้านหน้า</label>${p.front_image_url ? `<img src="${safeImage(p.front_image_url)}" alt="เสื้อด้านหน้า">` : '<img src="/jersey.svg" alt="รอรูปด้านหน้า">'}</div><div><label>ด้านหลัง</label>${p.back_image_url ? `<img src="${safeImage(p.back_image_url)}" alt="เสื้อด้านหลัง">` : '<div class="media-empty">รอภาพด้านหลัง</div>'}</div>${p.sleeve_image_url ? `<div><label>แขนเสื้อ</label><img src="${safeImage(p.sleeve_image_url)}" alt="แขนเสื้อ"></div>` : ''}</div><div class="flex-between"><span class="price">${productPrice(p.id) === null ? 'รอระบุราคา' : money(productPrice(p.id))}</span><a class="btn gold" href="#order">สั่งเสื้อรุ่นนี้ →</a></div></article>`).join('') || '<div class="panel">ยังไม่มีแบบเสื้อ</div>'}</div></div>`;
}
export function renderSizes() {
  return `<div class="shell">${titleSection('SIZE & PRICE GUIDE', 'ตารางไซส์และราคา', 'ข้อมูลที่แสดงตรงกับราคาที่แอดมินตั้งค่าในระบบ')}<div class="panel">${state.products.filter(p=>p.is_active).map(p=>`<h2>${e(p.name)}</h2><div class="table-overflow responsive-table"><table class="mobile-stack"><thead><tr><th>ไซส์</th><th>รอบอก (ซม.)</th><th>ความยาว (ซม.)</th><th>ราคา</th></tr></thead><tbody>${state.variants.filter(x=>x.product_id===p.id&&x.is_active).map(x=>`<tr><td data-label="ไซส์"><b>${e(x.size_label)}</b></td><td data-label="รอบอก (ซม.)">${x.chest_cm ?? 'รอระบุ'}</td><td data-label="ความยาว (ซม.)">${x.length_cm ?? 'รอระบุ'}</td><td data-label="ราคา">${money(x.price)}</td></tr>`).join('')}</tbody></table></div>`).join('')}<div class="note">📏 ควรเทียบขนาดกับเสื้อจริงที่ใส่สบายก่อนสั่ง เนื่องจากเป็นงานผลิตตามออเดอร์</div><a class="btn gold" href="#order">เลือกไซส์และสั่งซื้อ</a></div></div>`;
}
function selectOptions(products = state.products.filter(p=>p.is_active)) { return products.map(p=>`<option value="${p.id}">${e(p.name)}</option>`).join(''); }
function sizeOptions(productId) { return state.variants.filter(x=>x.product_id===productId&&x.is_active).map(x=>`<option value="${x.id}">${e(x.size_label)} — ${money(x.price)}</option>`).join(''); }
function cartMarkup() {
  return `<div class="cart-list">${state.cart.length ? state.cart.map((item, i) => `<div class="cart-item"><div><b>${e(item.jersey_name)} · #${e(item.jersey_number)}</b><small>${e(item.product_name)} · ${e(item.size_label)} · ${item.quantity} ตัว</small></div><div><strong>${money(item.quantity * item.unit_price)}</strong><button class="text-danger" data-action="remove-item" data-index="${i}">ลบ</button></div></div>`).join('') : '<p class="muted center">ยังไม่ได้เพิ่มเสื้อ</p>'}</div><div class="total"><span>ยอดรวม</span><strong>${money(pending())}</strong></div>`;
}
export function renderOrder() {
  const products = state.products.filter(p=>p.is_active);
  const first = products[0];
  return `<div class="shell">${titleSection('ORDER YOUR JERSEY', 'สั่งซื้อเสื้อวอลเลย์บอล', 'หนึ่งออเดอร์สามารถมีหลายตัวและแต่ละตัวมีชื่อหรือเบอร์ต่างกันได้')}<div class="order-grid"><section class="panel"><h2>01 <span>เลือกแบบเสื้อและสกรีน</span></h2><div class="form-grid"><div class="field full"><label>แบบเสื้อ</label><select id="selected-product" data-change="product">${selectOptions(products)}</select></div><div class="field"><label>ไซส์</label><select id="selected-size" data-change="size">${sizeOptions(first?.id)}</select></div><div class="field"><label>จำนวน (ตัว)</label><input id="selected-qty" type="number" min="1" max="20" value="1"></div><div class="field"><label>ชื่อที่ติดหลังเสื้อ</label><input id="selected-name" maxlength="20" placeholder="เช่น APIWXN.X2"></div><div class="field"><label>หมายเลขเสื้อ</label><input id="selected-number" maxlength="3" inputmode="numeric" placeholder="เช่น 07"></div></div><div class="flex-between selection-price"><div><small>ราคาต่อเสื้อ 1 ตัว</small><strong id="unit-price">${money(state.variants.find(x=>x.product_id===first?.id)?.price || 0)}</strong></div><button data-action="add-item" class="btn navy">+ เพิ่มรายการเสื้อ</button></div><div class="note">ระบบบันทึกเบอร์เสื้อเป็นข้อความ เช่น 07 เพื่อไม่ให้เลขศูนย์ข้างหน้าหายไปใน Excel</div></section>
  <section class="panel"><h2>02 <span>ยืนยันการสั่งซื้อ</span></h2><div id="cart-view">${cartMarkup()}</div><div class="field"><label>ชื่อผู้สั่ง (ชื่อจริงหรือชื่อเล่นก็ได้)</label><input id="buyer-name" maxlength="120" placeholder="ชื่อผู้สั่งซื้อ"></div><div class="field"><label>ช่องทางติดต่อ (เบอร์โทร / LINE / Facebook)</label><input id="buyer-contact" maxlength="120" placeholder="ช่องทางติดต่อกลับ"></div><div class="field"><label>วิธีชำระเงิน</label><select id="payment-choice"><option value="transfer">โอนเงินผ่าน QR Code</option><option value="cash">ชำระด้วยเงินสด</option></select></div><div class="field"><label>หมายเหตุ</label><textarea id="order-notes" maxlength="400" rows="2" placeholder="ถ้ามี"></textarea></div>${activeCampaign() ? '' : '<div class="note warning">ขณะนี้ปิดรับพรีออเดอร์ ระบบยังไม่รับคำสั่งซื้อจริง</div>'}<button data-action="submit-order" class="btn gold full-btn" ${activeCampaign() ? '' : 'disabled'}>ยืนยันคำสั่งซื้อ →</button></section></div></div>`;
}
export function productChanged() {
  const id = v('selected-product'); const control = $('selected-size');
  if (control) control.innerHTML = sizeOptions(id);
  sizeChanged();
}
export function sizeChanged() {
  const variant = state.variants.find(x=>x.id===v('selected-size'));
  if ($('unit-price')) $('unit-price').textContent = money(variant?.price || 0);
}
export function addItem() {
  const variant = state.variants.find(x=>x.id===v('selected-size'));
  const product = state.products.find(p=>p.id===variant?.product_id);
  const name = v('selected-name'); const number = v('selected-number'); const quantity = Number(v('selected-qty'));
  if (!variant || !product) return toast('กรุณาเลือกไซส์');
  if (name.length < 1 || name.length > 20) return toast('กรุณาใส่ชื่อหลังเสื้อ 1–20 ตัวอักษร');
  if (!/^[0-9]{1,3}$/.test(number)) return toast('เบอร์เสื้อต้องเป็นตัวเลข 1–3 หลัก เช่น 07');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || state.cart.length >= 20) return toast('จำนวนไม่ถูกต้อง หรือเพิ่มครบ 20 รายการแล้ว');
  state.cart.push({ variant_id: variant.id, product_name: product.name, size_label: variant.size_label, unit_price: Number(variant.price), jersey_name: name, jersey_number: number, quantity });
  $('cart-view').innerHTML = cartMarkup();
  $('selected-name').value = ''; $('selected-number').value = '';
  toast('เพิ่มเสื้อในออเดอร์แล้ว');
}
export function removeItem(index) { state.cart.splice(index,1); $('cart-view').innerHTML=cartMarkup(); }
export async function submitOrder() {
  if (state.busy) return;
  const buyer=v('buyer-name'); const contact=v('buyer-contact');const method=v('payment-choice');
  if (!state.cart.length) return toast('กรุณาเพิ่มเสื้อก่อนยืนยัน');
  if (!buyer || contact.length<3) return toast('กรุณาระบุชื่อผู้สั่งและช่องทางติดต่อ');
  if (!activeCampaign()) return toast('ยังไม่เปิดรับคำสั่งซื้อ');
  setBusy(true);
  const payload = state.cart.map(item=>({ variant_id:item.variant_id, qty:item.quantity, jersey_name:item.jersey_name, jersey_number:item.jersey_number }));
  const { data,error } = await db.rpc('place_jersey_order', { p_buyer_name:buyer, p_contact:contact, p_method:method, p_items:payload, p_notes:v('order-notes')||null });
  setBusy(false);
  if (error) return toast(`สั่งซื้อไม่สำเร็จ: ${error.message}`);
  state.latest = data; state.cart=[];
  localStorage.setItem('jersey-last-order',JSON.stringify({order_no:data.order_no,tracking_code:data.tracking_code}));
  openDialog(`<div class="success-icon">✓</div><h2>สั่งซื้อสำเร็จ!</h2><p>ระบบได้รับคำสั่งซื้อของคุณแล้ว</p><div class="note ${method==='cash'?'warning':''}">${method==='cash'?'💵 เลือกจ่ายเงินสด — โปรดชำระกับผู้ดูแล และรอการยืนยัน':'💳 เลือกโอนเงิน — ไปหน้าชำระและส่งสลิปเพื่อให้ผู้ดูแลตรวจสอบ'}</div><div class="order-code">${e(data.order_no)}</div><p>รหัสติดตามส่วนตัว: <b>${e(data.tracking_code)}</b></p><div class="note"><b>📸 โปรดแคปหน้าจอหรือบันทึกเลขคำสั่งซื้อและรหัสติดตามไว้</b><br>เพื่อใช้ตรวจสอบสถานะการชำระเงิน การผลิต และการรับเสื้อในภายหลัง</div><div class="dialog-buttons"><button class="btn navy" data-action="copy-latest">คัดลอกเลขและรหัส</button><button class="btn gold" data-action="goto-latest">${method==='cash'?'ดูใบยืนยันและสถานะ →':'ไปหน้าชำระเงิน →'}</button></div>`);
}
export function gotoLatest() { closeDialog(); navigate('track'); const a=state.latest; if(a)setTimeout(()=>lookupOrder(a.order_no,a.tracking_code),100); }
export async function copyLatest() {
  if (!state.latest) return;
  await navigator.clipboard.writeText(`เลขคำสั่งซื้อ: ${state.latest.order_no}\nรหัสติดตาม: ${state.latest.tracking_code}`);
  toast('คัดลอกแล้ว กรุณาเก็บรหัสนี้ไว้');
}
export function renderTrack() {
  let last=null;try { last=JSON.parse(localStorage.getItem('jersey-last-order')||'null'); }catch{}
  const p=new URLSearchParams(location.hash.split('?')[1]||'');
  const number=p.get('o')||state.latest?.order_no||last?.order_no||'';
  const code=p.get('k')||state.latest?.tracking_code||last?.tracking_code||'';
  return `<div class="shell">${titleSection('TRACK YOUR JERSEY', 'ติดตามคำสั่งซื้อ', 'ใช้เลขออเดอร์และรหัสติดตามส่วนตัวที่ได้รับหลังสั่งซื้อ')}<div class="track-grid"><section class="panel"><h2>ค้นหารายการ</h2><div class="field"><label>เลขคำสั่งซื้อ</label><input id="track-no" value="${e(number)}" placeholder="JER-2026-00001"></div><div class="field"><label>รหัสติดตามส่วนตัว</label><input id="track-code" value="${e(code)}" placeholder="รหัส 14 ตัวอักษร"></div><button data-action="lookup" class="btn navy full-btn">🔎 ตรวจสอบสถานะ</button><div class="note">🔐 ระบบต้องใช้เลขออเดอร์พร้อมรหัสติดตาม เพื่อป้องกันบุคคลอื่นเข้าดูข้อมูลของคุณ</div></section><section class="panel" id="tracking-result">${state.lookup ? trackingDetails(state.lookup) : '<div class="empty">📦<p>ผลการติดตามจะแสดงตรงนี้</p></div>'}</section></div></div>`;
}
export async function lookupOrder(number=null,code=null) {
  const no=number||v('track-no'),token=code||v('track-code');
  if (!no || !token) return toast('กรอกเลขออเดอร์และรหัสติดตาม');
  const node=$('tracking-result'); if(node)node.innerHTML='<div class="empty">กำลังค้นหา...</div>';
  const {data,error}=await db.rpc('lookup_jersey_order',{p_order_no:no,p_tracking_code:token});
  if(error || !data) {state.lookup=null;if(node)node.innerHTML='<div class="note warning">ไม่พบรายการ โปรดตรวจสอบเลขออเดอร์และรหัสติดตาม</div>';return;}
  state.lookup={...data,tracking_code:token};
  localStorage.setItem('jersey-last-order',JSON.stringify({order_no:no,tracking_code:token}));
  if(node)node.innerHTML=trackingDetails(state.lookup);
}
function trackingDetails(order) {
  const s=state.settings||{};
  const steps=['submitted','processing','production','ready','collected'];
  const done=steps.indexOf(order.order_status);
  const canPay=!order.archived_at&&order.payment_method==='transfer'&&order.payment_status!=='paid'&&order.order_status!=='cancelled';
  const cancelAllowed=canBuyerCancel(order);
  return `<div class="flex-between"><b>${e(order.order_no)}</b><span class="tag ${order.payment_status==='paid'?'good':'warn'}">${e(payStatus[order.payment_status]||'')}</span></div><h2>${e(order.buyer_name)}</h2><p class="muted">${dateTH(order.created_at)} · ${e(paymentMethods[order.payment_method])}</p><div class="steps">${steps.map((item,i)=>`<div class="step ${i<=done?'done':''}"><i>${i<=done?'✓':i+1}</i><span>${e(orderStatus[item])}</span></div>`).join('')}</div><div class="table-overflow responsive-table"><table class="mobile-stack"><thead><tr><th>ชื่อหลัง</th><th>เบอร์</th><th>ไซส์</th><th>จำนวน</th></tr></thead><tbody>${sortOrderItems(order.items||[]).map(item=>`<tr><td data-label="ชื่อหลัง">${e(item.jersey_name)}</td><td data-label="เบอร์">${e(item.jersey_number)}</td><td data-label="ไซส์">${e(item.size_label)}</td><td data-label="จำนวน">${item.quantity}</td></tr>`).join('')}</tbody></table></div><div class="total"><span>ยอดรวม</span><strong>${money(order.total_amount)}</strong></div>${order.order_status==='ready' ? `<div class="note">📍 จุดรับเสื้อ: ${e(s.pickup_location||'โปรดติดต่อแอดมิน')}</div>`:''}
  ${canPay?`<div class="payment-box"><h3>💳 ข้อมูลชำระเงิน</h3>${s.payment_qr_url?`<img class="payment-qr" src="${safeImage(s.payment_qr_url)}" alt="QR Code ชำระเงิน">`:'<div class="note warning">ยังไม่ได้เพิ่ม QR Code รับเงิน</div>'}<p><b>${e(s.bank_name||'รอข้อมูลธนาคาร')}</b><br>${e(s.bank_account_name||'ชื่อบัญชีรอตั้งค่า')}<br><b>${e(s.bank_account_no||'เลขบัญชีรอตั้งค่า')}</b></p><div class="field"><label>อัปโหลดสลิป JPG / PNG / WEBP (ไม่เกิน 5 MB)</label><input id="slip-file" type="file" accept="image/png,image/jpeg,image/webp"></div><button data-action="upload-slip" class="btn navy full-btn">แนบสลิปเพื่อรอตรวจสอบ</button><p class="muted tiny">สลิปที่ส่งแล้วต้องรอแอดมินตรวจสอบยอดเงินเข้าจริงก่อน จึงถือว่าชำระสำเร็จ</p></div>`:''}
  ${order.archived_at?'<div class="note warning">ℹ️ รายการนี้ถูกนำออกจากออเดอร์ที่กำลังดำเนินการแล้ว แต่ข้อมูลการชำระเงินและใบเสร็จยังคงอยู่ หากต้องการคืนเงินหรือสอบถามการผลิต โปรดติดต่อผู้ดูแล</div>':''}
  ${order.order_status==='cancelled'?'<div class="note warning">❌ ออเดอร์นี้ถูกยกเลิกแล้ว ไม่มีการผลิตหรือรับชำระเพิ่ม หากชำระเงินไปแล้วกรุณาติดต่อแอดมิน</div>':''}
  ${order.payment_method==='cash' && order.payment_status!=='paid' && order.order_status!=='cancelled' ? '<div class="note warning">💵 โปรดชำระเงินสดตามจุดที่ผู้ดูแลกำหนด และรอแอดมินยืนยัน</div>' : ''}<div class="actions"><button data-action="buyer-pdf" class="btn gold">📄 ${order.payment_status==='paid'?'ดาวน์โหลดใบเสร็จ PDF':'ใบยืนยันคำสั่งซื้อ PDF'}</button><button data-action="copy-link" class="btn light">🔗 คัดลอกลิงก์ติดตาม</button>${cancelAllowed?'<button data-action="cancel-order" class="btn light danger-button">✕ ยกเลิกคำสั่งซื้อ</button>':''}</div>${!cancelAllowed && order.order_status!=='cancelled' ? '<p class="muted tiny">หากชำระเงินแล้ว ส่งสลิป หรือเริ่มผลิตแล้ว โปรดติดต่อแอดมินเพื่อขอยกเลิกหรือคืนเงิน</p>':''}`;
}
export async function cancelOrder() {
  if(state.busy||!state.lookup)return;
  const order=state.lookup;
  if(!canBuyerCancel(order))return toast('ออเดอร์นี้ไม่สามารถยกเลิกเองได้ กรุณาติดต่อแอดมิน');
  if(!confirm(`ยืนยันยกเลิกออเดอร์ ${order.order_no}?\n\nเมื่อยกเลิกแล้วจะไม่สามารถกู้คืนออเดอร์นี้หรือใช้ชำระเงินได้ ต้องสั่งใหม่หากเปลี่ยนใจ`))return;
  setBusy(true);
  try{
    const {data,error}=await db.rpc('cancel_jersey_order',{p_order_no:order.order_no,p_tracking_code:order.tracking_code});
    if(error)throw error;
    if(data?.order_status!=='cancelled')throw Error('ระบบยังไม่ยืนยันการยกเลิก');
    state.lookup={...state.lookup,order_status:'cancelled'};
    const el=$('tracking-result');if(el)el.innerHTML=trackingDetails(state.lookup);
    toast('ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว');
  }catch(err){toast('ยกเลิกไม่สำเร็จ: '+err.message);await lookupOrder(order.order_no,order.tracking_code);}
  finally{setBusy(false);}
}
export async function uploadSlip() {
  if (state.busy || !state.lookup) return;
  const file=$('slip-file')?.files?.[0];if(!file)return toast('กรุณาแนบรูปสลิป');
  if(file.size>5*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))return toast('รูปสลิปต้องเป็น JPG PNG WEBP ไม่เกิน 5 MB');
  const form=new FormData();form.append('order_no',state.lookup.order_no);form.append('tracking_code',state.lookup.tracking_code);form.append('slip',file);
  setBusy(true);
  try {
    const response=await fetch(`${config.supabaseUrl}/functions/v1/${config.slipFunction}`,{method:'POST',headers:{apikey:config.supabasePublishableKey},body:form});
    const payload=await response.json();
    if (!response.ok) throw new Error(payload.error || 'ส่งสลิปไม่สำเร็จ');
    toast('อัปโหลดสลิปสำเร็จ รอแอดมินตรวจสอบ');
    await lookupOrder(state.lookup.order_no,state.lookup.tracking_code);
  } catch(error) {toast(error.message);} finally {setBusy(false);}
}
export async function copyTrackLink() {
  const o=state.lookup;if(!o)return;
  const url=`${location.origin}${location.pathname}#track?o=${encodeURIComponent(o.order_no)}&k=${encodeURIComponent(o.tracking_code)}`;
  try { await navigator.clipboard.writeText(url);toast('คัดลอกลิงก์ติดตามแล้ว'); } catch {toast('โปรดคัดลอกเลขออเดอร์และรหัสติดตามด้วยตนเอง');}
}
export function buyerPdfMarkup(order) {
  const paid=order.payment_status==='paid';
  return `${reportHeader(paid?'ใบเสร็จรับเงิน':'ใบยืนยันคำสั่งซื้อ',paid?`เลขใบเสร็จ ${order.receipt_no||'—'}`:'เอกสารยืนยันรายการ ไม่ใช่หลักฐานรับเงิน')}<div class="pdf-kv"><div>เลขออเดอร์: <b>${e(order.order_no)}</b></div><div>วันที่สั่ง: ${dateTH(order.created_at)}</div><div>ผู้สั่ง: ${e(order.buyer_name)}</div><div>วิธีชำระ: ${e(paymentMethods[order.payment_method])}</div><div>สถานะ: ${e(payStatus[order.payment_status])}</div>${paid?`<div>วันที่ยืนยันการชำระ: ${dateTH(order.paid_at)}</div>`:''}</div><table class="pdf-table"><thead><tr><th>สินค้า</th><th>ชื่อหลังเสื้อ</th><th>เบอร์</th><th>ไซส์</th><th>จำนวน</th><th>จำนวนเงิน</th></tr></thead><tbody>${sortOrderItems(order.items||[]).map(item=>`<tr><td>${e(item.product_name)}</td><td>${e(item.jersey_name)}</td><td>${e(item.jersey_number)}</td><td>${e(item.size_label)}</td><td>${item.quantity}</td><td>${money(item.line_total)}</td></tr>`).join('')}</tbody></table><div class="pdf-total">ยอดรวมทั้งสิ้น ${money(order.total_amount)}</div>${order.order_status==='cancelled'?'<p class="pdf-caption"><b>คำสั่งซื้อนี้ถูกยกเลิกแล้ว</b></p>':''}<p class="pdf-footer">${paid?'ชำระเงินเรียบร้อยแล้ว':'กรุณาตรวจสอบรายการและชำระเงินตามวิธีที่เลือก'}<br>เลขคำสั่งซื้อ: ${e(order.order_no)} | รหัสติดตาม: ${e(order.tracking_code)}</p>`;
}
export async function buyerPdf() {
  const order=state.lookup;if(!order)return;
  const name=order.payment_status==='paid'?'Receipt':'Order-Confirmation';
  await exportPdf(buyerPdfMarkup(order),`${name}-${order.order_no}.pdf`);
}
