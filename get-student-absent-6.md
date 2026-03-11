/**
 * Chạy trực tiếp trong Console tại trang lớp học.
 * Mở Lớp của tôi, chọn một lớp cụ thể
 * Lọc SV có số buổi nghỉ >= MIN_ABSENCES và kèm thông tin Email/SĐT
 */ 
 
(function () {

const MIN_ABSENCES = 2;
const TAB = "\t";
const clean = s => (s || "").replace(/\s+/g, " ").trim();

/* --- LẤY THÔNG TIN LỚP --- */

let className="N/A", courseCode="N/A", courseName="N/A";

const infoTable=document.querySelector("div.kt-section table");

if(infoTable){
  const rows=infoTable.querySelectorAll("tr");
  if(rows.length>=3){
    className=clean(rows[0].querySelectorAll("td")[1]?.textContent);
    courseCode=clean(rows[1].querySelectorAll("td")[1]?.textContent);
    courseName=clean(rows[2].querySelectorAll("td")[1]?.textContent);
  }
}

console.log(`Lớp=${className} | Mã=${courseCode} | Môn=${courseName}`);


/* --- MAP EMAIL / PHONE --- */

const studentInfo=new Map();

document.querySelectorAll("div.tab-pane table tbody tr").forEach(tr=>{
  const td=tr.querySelectorAll("td");
  if(td.length>=5){
    const id=clean(td[1].textContent);
    if(id && !studentInfo.has(id)){
      studentInfo.set(id,{
        email:clean(td[3].textContent)||"N/A",
        phone:clean(td[4].textContent)||"N/A"
      });
    }
  }
});

console.log(`Map thông tin: ${studentInfo.size} SV`);


/* --- BẢNG ĐIỂM DANH --- */

const table=document.querySelector("#attendance table.table");

if(!table){
  alert("Không tìm thấy bảng điểm danh");
  return;
}

const result=[];

table.querySelectorAll("tbody tr").forEach(tr=>{

  const td=tr.querySelectorAll("td");
  if(td.length<4) return;

  const id=clean(td[1].textContent);
  const name=clean(td[2].textContent);

  const summary=clean(td[td.length-2].textContent);
  const abs=parseInt(summary.split("/")[0],10);

  if(!isNaN(abs) && abs>=MIN_ABSENCES){

    const info=studentInfo.get(id)||{email:"N/A",phone:"N/A"};

    result.push({
      id,name,
      email:info.email,
      phone:info.phone,
      abs
    });

  }

});


/* --- XUẤT KẾT QUẢ --- */

const raw=result.map(s =>
`${s.id}${TAB}${s.name}${TAB}${s.email}${TAB}${s.phone}${TAB}${className}${TAB}${courseCode}${TAB}${TAB}${courseName}${TAB}${s.abs}`
).join("\n");


document.open();

document.write(`
<style>
body{font-family:Arial;padding:20px}
textarea{width:100%;height:320px;font-family:Consolas}
button{padding:6px 10px;margin-bottom:10px}
</style>

<h2>Kết quả lọc SV nghỉ >= ${MIN_ABSENCES}</h2>

<div>
<b>Lớp:</b> ${className}<br>
<b>Mã môn:</b> ${courseCode}<br>
<b>Tên môn:</b> ${courseName}
</div>

<p>Tổng SV: <b>${result.length}</b></p>

<button id="copyBtn">Copy toàn bộ</button>

<textarea readonly>${raw}</textarea>
`);

document.close();


/* --- COPY BUTTON --- */

document.getElementById("copyBtn").onclick=async ()=>{
  try{
    await navigator.clipboard.writeText(raw);
    alert("Đã copy");
  }catch{
    alert("Không copy được");
  }
};

console.log(`Hoàn tất. SV đạt điều kiện: ${result.length}`);

})();