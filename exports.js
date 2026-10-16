import { state, currency, escapeHtml as e, dateTH, orderStatus, payStatus, paymentMethods, reportHeader, exportPdf, downloadBlob } from './common.js';
import { compareSizes } from './sizes.js';

function filteredOrders(filter='all') {
  return state.orders.filter(order => order.order_status !== 'cancelled' && (
    filter === 'all' ||
    (filter === 'paid' && order.payment_status === 'paid') ||
    (filter === 'production' && ['processing','production','ready'].includes(order.order_status))
  ));
}
function productionItems(orders) {
  return orders.flatMap(order => (order.order_items || []).map(item => ({
    order_no: order.order_no, product: item.product_name,
    jersey_name: item.jersey_name, jersey_number: String(item.jersey_number),
    size: item.size_label, qty: Number(item.quantity),
  }))).sort((a,b) => a.product.localeCompare(b.product,'th') || compareSizes(a.size,b.size) || a.order_no.localeCompare(b.order_no,'en',{numeric:true}));
}
function summarize(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.product}\u0000${item.size}`;
    const rec = map.get(key) || { product:item.product, size:item.size, qty:0 };
    rec.qty += item.qty; map.set(key,rec);
  }
  return Array.from(map.values()).sort((a,b) => a.product.localeCompare(b.product,'th') || compareSizes(a.size,b.size));
}
function styleSheet(sheet) {
  sheet.getRow(1).height = 26;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold:true, color:{argb:'FFFFFFFF'} };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF123C83'} };
    cell.alignment = { vertical:'middle', horizontal:'center' };
  });
  sheet.views = [{ state:'frozen', ySplit:1 }];
  sheet.autoFilter = { from:{row:1,column:1}, to:{row:Math.max(sheet.rowCount,2),column:sheet.columnCount} };
  sheet.eachRow((row,index) => {
    if(index>1 && index%2===0)row.eachCell(cell => { cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FC'}}; });
  });
}
export async function downloadExcel(filter='all',type='factory') {
  if(!window.ExcelJS)throw Error('ยังโหลด ExcelJS ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรช');
  const orders=filteredOrders(filter),items=productionItems(orders);
  const workbook=new window.ExcelJS.Workbook();
  workbook.creator='Volleyball Jersey Pre-order';workbook.created=new Date();
  const sheet=workbook.addWorksheet('รายการผลิต');
  sheet.columns=[
    {header:'ลำดับ',key:'index',width:9},
    {header:'เลขคำสั่งซื้อ',key:'order_no',width:23},
    {header:'แบบเสื้อ',key:'product',width:31},
    {header:'ชื่อหลังเสื้อ',key:'jersey_name',width:28},
    {header:'เบอร์เสื้อ',key:'jersey_number',width:17},
    {header:'ไซส์',key:'size',width:12},
    {header:'จำนวน (ตัว)',key:'qty',width:16},
  ];
  items.forEach((item,index) => {
    const row=sheet.addRow({index:index+1,...item});
    row.getCell('jersey_number').numFmt='@';
    row.getCell('jersey_number').value=String(item.jersey_number);
    row.getCell('jersey_name').numFmt='@';
  });
  styleSheet(sheet);
  const summary=workbook.addWorksheet('สรุปไซส์');
  summary.columns=[{header:'แบบเสื้อ',key:'product',width:32},{header:'ไซส์',key:'size',width:15},{header:'จำนวนรวม (ตัว)',key:'qty',width:20}];
  summarize(items).forEach(x=>summary.addRow(x));
  summary.addRow({product:'รวมทั้งหมด',qty:items.reduce((sum,item)=>sum+item.qty,0)});
  styleSheet(summary);
  if(type==='admin') {
    const finance=workbook.addWorksheet('การชำระเงิน (แอดมิน)');
    finance.columns=[{header:'เลขออเดอร์',key:'no',width:24},{header:'ชื่อผู้สั่ง',key:'buyer',width:25},{header:'ช่องทางติดต่อ',key:'contact',width:29},{header:'วิธีชำระ',key:'method',width:15},{header:'สถานะชำระ',key:'status',width:23},{header:'ยอดเงิน (บาท)',key:'total',width:18},{header:'สถานะในระบบ',key:'archive',width:24}];
    // Financial records include archived orders; production sheets do not.
    const allFinancial=[...state.orders,...(state.archivedOrders||[])];
    allFinancial.forEach(o=>finance.addRow({no:o.order_no,buyer:o.buyer_name,contact:o.buyer_contact,method:paymentMethods[o.payment_method],status:payStatus[o.payment_status],total:Number(o.total_amount),archive:o.archived_at?'ลบออกจากรายการหลัก':'ปกติ'}));
    finance.getColumn('total').numFmt='#,##0.00';styleSheet(finance);
  }
  const buffer=await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Jersey-Production-${new Date().toISOString().slice(0,10)}.xlsx`);
}
export async function downloadProductionPdf(filter='all') {
  const orders=filteredOrders(filter),items=productionItems(orders),total=items.reduce((sum,x)=>sum+x.qty,0);
  const chunks=[];
  const rowsPerPage=10; // Landscape A4, readable text size and predictable row widths.
  for(let i=0;i<items.length;i+=rowsPerPage)chunks.push(items.slice(i,i+rowsPer));
  const pages=chunks.map((chunk,pageIndex)=>`${reportHeader('รายการผลิตเสื้อวอลเลย์บอล',`${state.campaign?.name||''} • ${dateTH(new Date())}`)}
    <p class="pdf-caption">รายการที่ ${pageIndex*rowsPerPage+1}–${Math.min((pageIndex+1)*rowsPerPage,items.length)} จาก ${items.length} • หน้า ${pageIndex+1}</p>
    <table class="pdf-table production-pdf-table"><thead><tr><th style="width:6%">ลำดับ</th><th style="width:19%">เลขออเดอร์</th><th style="width:30%">แบบเสื้อ</th><th style="width:22%">ชื่อหลังเสื้อ</th><th style="width:8%">เบอร์</th><th style="width:8%">ไซส์</th><th style="width:7%">จำนวน</th></tr></thead><tbody>${chunk.map((x,j)=>`<tr><td>${pageIndex*rowsPerPage+j+1}</td><td>${e(x.order_no)}</td><td>${e(x.product)}</td><td><b>${e(x.jersey_name)}</b></td><td>${e(x.jersey_number)}</td><td>${e(x.size)}</td><td>${x.qty}</td></tr>`).join('')}</tbody></table>`);
  const summary=summarize(items);
  for(let i=0;i<Math.max(1,Math.ceil(summary.length/16));i++){
    const subset=summary.slice(i*16,(i+1)*16);
    pages.push(`${reportHeader('สรุปจำนวนตามไซส์',state.campaign?.name||'')}
      <p class="pdf-caption">จัดเรียงตามไซส์ XS ถึง 6XL</p>
      <table class="pdf-table"><thead><tr><th>แบบเสื้อ</th><th>ไซส์</th><th>จำนวน</th></tr></thead><tbody>${subset.map(x=>`<tr><td>${e(x.product)}</td><td>${e(x.size)}</td><td>${x.qty}</td></tr>`).join('')}</tbody></table>${i===Math.max(1,Math.ceil(summary.length/16))-1?`<div class="pdf-total">จำนวนเสื้อทั้งหมด ${total} ตัว</div>`:''}`);
  }
  await exportPdf(pages,`Jersey-Production-${new Date().toISOString().slice(0,10)}.pdf`,true);
}
