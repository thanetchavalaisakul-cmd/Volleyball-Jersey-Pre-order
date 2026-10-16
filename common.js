// Shared configuration, state, Supabase client, formatting and export helpers.
import { sortVariants } from './sizes.js';
const config = window.JERSEY_CONFIG;
if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
  throw new Error('ตั้งค่า Supabase URL และ Publishable key ใน config.js ก่อนใช้งาน');
}
if (!window.supabase?.createClient) {
  throw new Error('โหลด Supabase JavaScript SDK ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต');
}
export const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
export { config };
export const state = {
  settings: null, campaign: null, products: [], variants: [], admin: null,
  orders: [], archivedOrders: [], cart: [], lookup: null, latest: null, adminTab: 'orders', busy: false,
};

export const $ = (id) => document.getElementById(id);
export const v = (id) => String($(id)?.value ?? '').trim();
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
export const currency = (value) => `${Number(value ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`;
export const dateTH = (value) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const safeImage = (value) => typeof value === 'string' && /^https:\/\//i.test(value) ? escapeHtml(value) : '';
export const payStatus = { pending: 'รอชำระเงิน', under_review: 'รอตรวจสลิป', paid: 'ชำระแล้ว', rejected: 'ต้องส่งสลิปใหม่' };
export const orderStatus = { submitted: 'รับออเดอร์', processing: 'รวบรวมยอด', production: 'กำลังผลิต', ready: 'พร้อมรับเสื้อ', collected: 'รับเสื้อแล้ว', cancelled: 'ยกเลิก' };
export const paymentMethods = { cash: 'เงินสด', transfer: 'โอนเงิน' };
let toastTimer;
export function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 4200);
}
export function setBusy(flag) { state.busy = Boolean(flag); }
export function openDialog(markup) { $('dialog-root').innerHTML = `<div class="dialog-shade"><div class="dialog-card">${markup}</div></div>`; }
export function closeDialog() { $('dialog-root').innerHTML = ''; }
export function navigate(route) { window.location.hash = route; }
export function currentRoute() { return window.location.hash.slice(1).split('?')[0] || 'home'; }
export function titleSection(eyebrow, title, subtitle) {
  return `<div class="page-heading"><span class="eyebrow dark">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>`;
}
export function layout(body) {
  const s = state.settings || {};
  const brand = s.logo_url ? `<img src="${safeImage(s.logo_url)}" class="header-logo" alt="โลโก้ทีม" />` : '<img src="/volleyball.svg" class="header-logo" alt="ลูกวอลเลย์บอล" />';
  const route = currentRoute();
  const nav = [['home', 'หน้าแรก'], ['styles', 'แบบเสื้อ'], ['sizes', 'ตารางไซส์'], ['order', 'สั่งซื้อเสื้อ'], ['track', 'ติดตามออเดอร์']];
  return `<header class="site-header"><div class="shell header-inner"><a class="brand" href="#home">${brand}<span><strong>${escapeHtml(s.team_name || 'VOLLEYBALL JERSEY')}</strong><small>PRE-ORDER SYSTEM</small></span></a><div class="header-actions"><a class="admin-access ${route === 'admin' ? 'active' : ''}" href="#admin">⚙️ ผู้ดูแล</a><button class="menu-toggle" id="menu-toggle" type="button" data-action="toggle-menu" aria-controls="primary-nav" aria-expanded="false" aria-label="เปิดเมนูนำทาง"><span></span><span></span><span></span></button></div><nav id="primary-nav" aria-label="เมนูหลัก">${nav.map(([r,t]) => `<a class="${route === r ? 'active' : ''}" href="#${r}" ${route === r ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div></header><main id="main">${body}</main><footer class="site-footer"><div class="shell flex-between"><span>🏐 ${escapeHtml(s.team_name || 'VOLLEYBALL JERSEY')} — TEAM SPIRIT</span><span>Jersey Pre-order System · Supabase</span></div></footer>`;
}
export async function loadCatalog() {
  const [settings, campaigns, products, variants] = await Promise.all([
    db.from('site_settings').select('*').eq('id', 1).single(),
    db.from('campaigns').select('*').order('created_at', { ascending: false }).limit(1),
    db.from('products').select('*').order('created_at', { ascending: false }),
    db.from('product_variants').select('*').order('size_label'),
  ]);
  const error = [settings, campaigns, products, variants].find((result) => result.error)?.error;
  if (error) throw error;
  state.settings = settings.data;
  state.campaign = campaigns.data?.[0] || null;
  state.products = products.data || [];
  state.variants = sortVariants(variants.data || []);
}
export function activeCampaign() {
  return Boolean(state.campaign?.is_open && (!state.campaign.order_deadline || new Date(state.campaign.order_deadline) > new Date()));
}
export async function checkAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { state.admin = null; return null; }
  const { data, error } = await db.from('admin_profiles').select('id,display_name').eq('id', session.user.id).maybeSingle();
  state.admin = error ? null : data;
  return state.admin;
}
export function productPrice(productId) {
  const prices = state.variants.filter(x => x.product_id === productId && x.is_active).map(x => Number(x.price));
  return prices.length ? Math.min(...prices) : null;
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}
/**
 * Browser-side Thai PDF generation. Each `.pdf-paper` is rendered while visible
 * (the old far-off-screen wrapper produced blank PDFs), and each canvas is
 * fitted to one A4 page (the old html2pdf pagebreaking clipped tables).
 * Supply an array of page markup for reports with repeatable headers.
 */
function splitReceiptPages(markup) {
  const holder=document.createElement('div');holder.innerHTML=markup;
  const table=holder.querySelector('table.pdf-table');
  if(!table||holder.querySelectorAll('table.pdf-table').length!==1)return [markup];
  const rows=Array.from(table.tBodies[0]?.rows||[]);
  // The short cash confirmation will always render in a single full page.
  if(rows.length<=7)return [markup];
  const prefix=Array.from(holder.children).filter(node=>node!==table);
  const firstPrefix=prefix.filter(node=>node.compareDocumentPosition(table)&Node.DOCUMENT_POSITION_FOLLOWING).map(node=>node.outerHTML).join('');
  const suffix=prefix.filter(node=>node.compareDocumentPosition(table)&Node.DOCUMENT_POSITION_PRECEDING).map(node=>node.outerHTML).join('');
  const head=table.tHead?.outerHTML||'';
  const brandedHeader=holder.querySelector('.pdf-header')?.outerHTML||'';
  const pages=[];
  for(let i=0;i<rows.length;i+=7){
    const end=Math.min(i+7,rows.length);
    const body=`<table class="pdf-table"><thead>${head.replace(/^<thead>|<\/thead>$/g,'')}</thead><tbody>${rows.slice(i,end).map(row=>row.outerHTML).join('')}</tbody></table>`;
    pages.push(`${i===0?firstPrefix:brandedHeader+'<p class="pdf-caption">รายการต่อจากหน้าก่อน</p>'}${body}${end===rows.length?suffix:''}`);
  }
  return pages;
}
export async function exportPdf(markup, filename, landscape = false) {
  const rawPages=Array.isArray(markup)?markup:splitReceiptPages(String(markup));
  if(!rawPages.length)throw Error('เอกสารไม่มีข้อมูล');
  const stage=document.createElement('div');
  stage.className='pdf-render-stage';
  stage.setAttribute('aria-live','polite');
  stage.innerHTML='<p class="pdf-render-message">กำลังสร้างเอกสาร PDF… โปรดรอสักครู่</p>';
  document.body.append(stage);
  const width=landscape?1030:730;
  try {
    await document.fonts.ready;
    // If the CDN is unreachable, use Chrome/Edge native printing instead.
    if(typeof window.html2canvas!=='function'||!window.jspdf?.jsPDF) {
      const tab=window.open('','_blank');
      if(!tab)throw Error('โหลดตัวสร้าง PDF ไม่สำเร็จ และเบราว์เซอร์บล็อกหน้าต่างพิมพ์');
      tab.document.write(`<html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title><link rel="stylesheet" href="${location.origin}/styles.css"><style>@page{size:A4 ${landscape?'landscape':'portrait'};margin:10mm}body{background:white}.pdf-paper{page-break-after:always;margin:auto}</style></head><body>${rawPages.map(page=>`<div class="pdf-paper">${page}</div>`).join('')}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
      tab.document.close();toast('โปรดเลือก Save as PDF จากหน้าพิมพ์');return;
    }
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});
    const pageW=landscape?297:210,pageH=landscape?210:297;
    const margin=10,contentW=pageW-2*margin,contentH=pageH-2*margin;
    for(let index=0;index<rawPages.length;index++) {
      const page=document.createElement('section');
      page.className='pdf-paper';page.style.width=width+'px';
      page.innerHTML=rawPages[index];
      stage.appendChild(page);
      await Promise.all(Array.from(page.querySelectorAll('img')).map(image=>image.complete?Promise.resolve():new Promise(resolve=>{
        image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});setTimeout(resolve,5000);
      })));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const canvas=await window.html2canvas(page,{scale:2,useCORS:true,allowTaint:false,logging:false,backgroundColor:'#ffffff',scrollX:0,scrollY:0,windowWidth:Math.max(width+50,window.innerWidth)});
      if(canvas.width===0||canvas.height===0)throw Error('ไม่สามารถวาดข้อมูลลง PDF ได้');
      // Fit full content. Never discard the bottom of a table or use heuristic pagebreak.
      let drawW=contentW,drawH=canvas.height/canvas.width*drawW;
      if(drawH>contentH){const scale=contentH/drawH;drawW*=scale;drawH*=scale;}
      const x=(pageW-drawW)/2;
      if(index>0)pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',x,margin,drawW,drawH,undefined,'FAST');
      pdf.setFontSize(9);pdf.setTextColor(118,128,144);
      pdf.text(`${index+1} / ${rawPages.length}`,pageW-margin,pageH-5,{align:'right'});
      page.remove();
    }
    pdf.save(filename);
  } finally {stage.remove();}
}
export function reportHeader(title, subtitle = '') {
  const s = state.settings || {};
  return `<div class="pdf-header">${s.logo_url ? `<img alt="โลโก้" src="${safeImage(s.logo_url)}" />` : ''}<div><h1>${escapeHtml(s.team_name || 'VOLLEYBALL JERSEY')}</h1><h2>${escapeHtml(title)}</h2><small>${escapeHtml(subtitle)}</small></div></div>`;
}
