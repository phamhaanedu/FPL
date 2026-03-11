/**
 * Chạy trực tiếp trong Console tại trang lớp học.
 * Lọc SV có số buổi nghỉ >= MIN_ABSENCES và kèm thông tin Email/SĐT
 * từ bảng trong div.tab-pane (cột 1=MSV, cột 4=Email, cột 5=SĐT).
 * từ bảng trong div.kt-section () lấy số buổi nghỉ
 * 
 */

(function () {
  // --- CẤU HÌNH ---
  const MIN_ABSENCES = 2; // Ngưỡng lọc
  const TAB = '\t';

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // --- TRÍCH XUẤT THÔNG TIN LỚP HỌC ---
  let className = 'N/A';
  let courseCode = 'N/A';
  let courseName = 'N/A';

  const classInfoTable = document.querySelector('div.kt-section table');
  if (classInfoTable) {
    const infoRows = classInfoTable.querySelectorAll('tr');
    if (infoRows.length >= 3) {
      try {
        className  = clean(infoRows[0].querySelectorAll('td')[1]?.textContent) || 'N/A';
        courseCode = clean(infoRows[1].querySelectorAll('td')[1]?.textContent) || 'N/A';
        courseName = clean(infoRows[2].querySelectorAll('td')[1]?.textContent) || 'N/A';
        console.log(`✅ Lớp=${className}, Mã=${courseCode}, Tên=${courseName}`);
      } catch (e) {
        console.error('Lỗi trích xuất thông tin lớp:', e);
      }
    } else {
      console.warn('Không đủ hàng để trích xuất Lớp/Môn.');
    }
  } else {
    console.warn('Không tìm thấy bảng thông tin lớp (div.kt-section table).');
  }

  // --- LẬP MAP THÔNG TIN EMAIL / SĐT TỪ div.tab-pane ---
  /** Kỳ vọng: trong mỗi bảng ở .tab-pane
   *  - cột 1 (index 0): Mã SV
   *  - cột 4 (index 3): Email
   *  - cột 5 (index 4): Số điện thoại
   */
  const studentInfoById = new Map();

  const tabPaneTables = document.querySelectorAll('div.tab-pane table');
  if (tabPaneTables.length === 0) {
    console.warn('⚠️ Không tìm thấy bảng nào trong div.tab-pane. Sẽ xuất Email/SĐT = N/A.');
  } else {
    tabPaneTables.forEach((tbl, ti) => {
      try {
        const trs = tbl.querySelectorAll('tbody tr');
        trs.forEach((tr, ri) => {
          const tds = tr.querySelectorAll('td');
          if (tds.length >= 5) {
            const id    = clean(tds[1].textContent);
            const email = clean(tds[3].textContent);
            const phone = clean(tds[4].textContent);
            if (id) {
              // Ưu tiên bảng xuất hiện trước; nếu trùng MSSV, không ghi đè thông tin đã có (tránh rác)
              if (!studentInfoById.has(id)) {
                studentInfoById.set(id, {
                  email: email || 'N/A',
                  mobilephone: phone || 'N/A',
                  __src: `tab-pane[${ti}] row[${ri}]`,
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('Lỗi khi đọc bảng trong tab-pane:', e);
      }
    });
    console.log(`🔎 Đã lập map Email/SĐT cho ~${studentInfoById.size} MSSV từ div.tab-pane.`);
  }

  // --- TRÍCH XUẤT DỮ LIỆU TỪ BẢNG ĐIỂM DANH ---
  const table = document.querySelector('#attendance table.table');
  if (!table) {
    document.open();
    document.write('<div style="font-family: Arial, sans-serif; color: #dc3545; padding: 15px; border: 1px solid #dc3545; background-color: #f8d7da; border-radius: 6px; margin: 20px;">⚠️ Không tìm thấy bảng dữ liệu điểm danh (#attendance table.table). Hãy đảm bảo bạn đang ở đúng trang.</div>');
    document.close();
    console.error('Không tìm thấy bảng điểm danh.');
    return;
  }

  const eligibleStudents = [];
  const rows = table.querySelectorAll('tbody tr');
  if (rows.length === 0) {
    document.open();
    document.write('<div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px; color: #ffc107; font-size: 1.2rem; background-color: #fff3cd; padding: 15px; border-radius: 6px; border: 1px solid #ffc107;">Không tìm thấy dữ liệu sinh viên nào trong bảng điểm danh.</div>');
    document.close();
    console.warn('Không có hàng dữ liệu trong bảng điểm danh.');
    return;
  }

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) {
      console.warn(`Hàng ${index + 1} bỏ qua: Không đủ ô dữ liệu.`);
      return;
    }
    try {
      const studentId = clean(cells[1].textContent); // cột 2: Mã SV
      const studentName = clean(cells[2].textContent); // cột 3: Tên SV
      const summaryCell = cells[cells.length - 2];
      const summaryText = clean(summaryCell.textContent);
      const absencePart = (summaryText.split('/')[0] || '').trim();
      const absenceCount = parseInt(absencePart, 10);

      if (!isNaN(absenceCount) && absenceCount >= MIN_ABSENCES) {
        const info = studentInfoById.get(studentId) || { email: 'N/A', mobilephone: 'N/A' };
        eligibleStudents.push({
          id: studentId,
          name: studentName,
          email: info.email,
          mobilephone: info.mobilephone,
          absences: absenceCount,
        });
      }
    } catch (e) {
      console.error(`Lỗi xử lý hàng ${index + 1} (${cells[1]?.textContent?.trim() || 'Unknown ID'}):`, e);
    }
  });

  // --- HIỂN THỊ KẾT QUẢ ---
  document.open();

  const rawTextOutput = eligibleStudents.map((student) => {
    // Định dạng theo yêu cầu:
    // id [TAB] name [TAB] email [TAB] mobilephone [TAB] className [TAB] courseCode [TAB][TAB] courseName [TAB] absences
    return `${student.id}${TAB}${student.name}${TAB}${student.email}${TAB}${student.mobilephone}${TAB}${className}${TAB}${courseCode}${TAB}${TAB}${courseName}${TAB}${student.absences}`;
  }).join('\n');

  if (eligibleStudents.length > 0) {
    const outputHtml = `
      <style>
        .result-container { font-family: Arial, sans-serif; padding: 16px; }
        .result-container h1 { margin: 0 0 8px; font-size: 20px; }
        .meta { color: #555; margin: 8px 0 12px; }
        textarea {
          width: 100%;
          min-height: 320px;
          padding: 10px;
          box-sizing: border-box;
          font-family: Consolas, monospace;
          font-size: 13px;
          line-height: 1.5;
          border: 1px solid #ccc;
          border-radius: 6px;
          white-space: pre;
          overflow: auto;
        }
        .note { font-size: 12px; color: #666; margin-top: 6px; }
      </style>
      <div class="result-container">
        <h1>📝 Kết Quả Lọc Điểm Danh</h1>
        <div>
          <div><strong>Thông tin Lớp học:</strong></div>
          <div>Tên Lớp: <strong>${className}</strong></div>
          <div>Mã Môn: <strong>${courseCode}</strong></div>
          <div>Tên Môn: <strong>${courseName}</strong></div>
        </div>
        <div class="meta">
          Đã tìm thấy <strong>${eligibleStudents.length}</strong> sinh viên có số buổi nghỉ từ ${MIN_ABSENCES} buổi trở lên.
        </div>
        <textarea readonly>${rawTextOutput}</textarea>
        <div class="note">Định dạng: MSSV [TAB] Họ tên [TAB] Email [TAB] SĐT [TAB] Tên lớp [TAB] Mã môn [TAB][TAB] Tên môn [TAB] Số buổi nghỉ</div>
      </div>
    `;
    document.write(outputHtml);
  } else {
    document.write('<div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px; color: #28a745; font-size: 1.2rem; background-color: #d4edda; padding: 15px; border-radius: 6px; border: 1px solid #28a745;">🎉 Không có sinh viên nào có số buổi nghỉ từ 2 buổi trở lên.</div>');
  }

// --- Thêm Nút copy đơn giản dùng trực tiếp rawTextOutput ---
const copyBtn = document.createElement('button');
copyBtn.textContent = '📋 Copy toàn bộ';
copyBtn.style = `
  padding: 6px 10px;
  margin: 10px 0;
  border: 1px solid #888;
  border-radius: 6px;
  background: #f4f4f4;
  cursor: pointer;
`;

copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(rawTextOutput);
    copyBtn.textContent = '✅ Đã copy!';
    setTimeout(() => (copyBtn.textContent = '📋 Copy toàn bộ'), 2000);
  } catch (e) {
    console.error(e);
    alert('Không copy được vào clipboard.');
  }
};
document.body.prepend(copyBtn);

  document.close();

  console.log(`✅ Hoàn tất. SV đủ điều kiện: ${eligibleStudents.length}.`);
  console.log('Danh sách đã hiển thị trong textarea.');
})();
