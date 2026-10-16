Volleyball Jersey Pre-order v1.6 - Flat deploy edition

ไฟล์ทุกไฟล์อยู่ที่ Root ใน ZIP โดยไม่มี src/ assets/ หรือโฟลเดอร์ครอบอีกชั้น
ใช้สำหรับ Upload files ตรงไปยัง GitHub repo และเชื่อม Vercel

ไฟล์สำคัญ: index.html, bootstrap.js, config.js, styles.css, main.js, common.js, public.js, admin.js, exports.js, order-actions.js, sizes.js, jersey.svg, volleyball.svg

ขั้นตอน: GitHub repo > Add file > Upload files > เลือกไฟล์ทั้งหมดใน ZIP > Commit changes > Vercel > Add New Project > Import repo > Framework Other > Deploy
หรือ VS Code Terminal > npx vercel --prod เพื่อ Deploy โดยไม่ต้องใช้ GitHub

หากค้างโหลดระบบ: v1.6 แสดงข้อความแจ้งสาเหตุแทนหน้าว่างโดยอัตโนมัติ; F12 > Console เพื่อดูรายละเอียด

คำเตือน: อย่าเพิ่ม secret/service_role key ลงใน config.js หรือ GitHub
โปรเจกต์นี้เชื่อม Supabase ของระบบสั่งเสื้อโดยเฉพาะ
