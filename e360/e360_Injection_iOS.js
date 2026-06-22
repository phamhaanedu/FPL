// ==UserScript==
// @name         E360 Stay for Safari
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  E360 Auto Grader for iOS Safari
// @author       Antigravity
// @match        *://*.poly.edu.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    let reloadTimer = null;

    function init() {
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        // Add Viewport for Mobile Safari to prevent scaling issues
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = "viewport";
            meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
            document.head.appendChild(meta);
        } else {
            document.querySelector('meta[name="viewport"]').content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
        }

        // Only run on CheckIn page
        if (!window.location.href.toLowerCase().includes('/proctor/checkin')) {
            return;
        }

        if (document.body.dataset.e360Injected === "1") return;
        document.body.dataset.e360Injected = "1";

        // 1. Hide unwanted UI and Columns
        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide main layout elements */
            .main-header, .main-sidebar, .content-header, .main-footer { display: none !important; }
            
            /* Maximize space & Enable Scrolling */
            html, body { height: auto !important; min-height: 100% !important; overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch !important; }
            body { padding-top: max(20px, env(safe-area-inset-top)) !important; padding-bottom: 160px !important; margin: 0 !important; background: #f8fafc !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
            .wrapper, .content-wrapper { margin-left: 0 !important; height: auto !important; min-height: 100% !important; overflow: visible !important; background: #f8fafc !important; padding: 0 !important; margin: 0 !important; }
            .box { border-top: none !important; margin-bottom: 0 !important; box-shadow: none !important; border: none !important; margin-top: 10px !important; overflow: visible !important; background: transparent !important; }
            .box-body { padding: 8px !important; overflow: visible !important; }
            .table-responsive { overflow: visible !important; padding: 4px !important; }
            
            /* Hide specific table columns */
            #checkInTable th:nth-child(1), #checkInTable td:nth-child(1),
            #checkInTable th:nth-child(2), #checkInTable td:nth-child(2),
            #checkInTable th:nth-child(5), #checkInTable td:nth-child(5),
            #checkInTable th:nth-child(6), #checkInTable td:nth-child(6),
            #checkInTable th:nth-child(7), #checkInTable td:nth-child(7),
            #checkInTable th:nth-child(9), #checkInTable td:nth-child(9),
            #checkInTable th:nth-child(11), #checkInTable td:nth-child(11) {
                display: none !important;
            }

            /* Adjust remaining table columns */
            #checkInTable { width: 100% !important; font-size: 14px; table-layout: fixed; border-collapse: separate; border-spacing: 0 12px; background: transparent !important; }
            #checkInTable th, #checkInTable td { padding: 8px 4px !important; vertical-align: middle; border: none !important; }
            
            /* Force display hidden columns. We use attribute selectors to target columns that might have 'hidden' classes */
            #checkInTable th, #checkInTable td {
                visibility: visible !important;
            }
            
            /* Column Widths for Desktop */
            #checkInTable th:nth-child(3), #checkInTable td:nth-child(3) { width: 18%; display: table-cell !important; } /* Mã SV */
            #checkInTable th:nth-child(4), #checkInTable td:nth-child(4) { width: 30%; display: table-cell !important; } /* Họ tên */
            #checkInTable th:nth-child(8), #checkInTable td:nth-child(8) { width: 18%; text-align: center; display: table-cell !important; } /* Điểm danh */
            #checkInTable th:nth-child(10), #checkInTable td:nth-child(10) { width: 34%; text-align: center; display: table-cell !important; } /* Nộp bài */

            /* Column Visibility Toggles */
            body.hide-col-3 #checkInTable th:nth-child(3), body.hide-col-3 #checkInTable td:nth-child(3) { display: none !important; }
            body.hide-col-4 #checkInTable th:nth-child(4), body.hide-col-4 #checkInTable td:nth-child(4) { display: none !important; }
            body.hide-col-8 #checkInTable th:nth-child(8), body.hide-col-8 #checkInTable td:nth-child(8) { display: none !important; }
            body.hide-col-10 #checkInTable th:nth-child(10), body.hide-col-10 #checkInTable td:nth-child(10) { display: none !important; }

            /* Desktop Auto Grade UI Styles */
            .e360-score-container { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
            .e360-score-stepper { display: flex; align-items: center; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; }
            .e360-stepper-btn { border: none; background: #f1f5f9; color: #334155; width: 36px; height: 38px; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; user-select: none; transition: background 0.15s; }
            .e360-stepper-btn:active { background: #cbd5e1; }
            .e360-score-input { width: 55px; height: 38px; text-align: center; border: none; padding: 0; font-size: 16px; font-weight: bold; color: #1e293b; background: #fff; -moz-appearance: textfield; }
            .e360-score-input::-webkit-outer-spin-button, .e360-score-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            
            .e360-btn { border: none; border-radius: 8px; height: 38px; padding: 0 14px; font-weight: bold; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .e360-btn-x2 { background: #f59e0b; color: white; }
            .e360-btn-x2:active { background: #d97706; }
            .e360-btn-save { background: #10b981; color: white; min-width: 60px; }
            .e360-btn-save:active { background: #059669; }
            .e360-btn-save:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; }

            .e360-status { font-size: 12px; font-weight: 600; text-align: center; margin-top: 4px; }

            /* Mobile Responsive Cards Design (< 768px) */
            @media (max-width: 767px) {
                #checkInTable { display: block !important; width: 100% !important; border-spacing: 0 !important; }
                #checkInTable thead { display: none !important; }
                #checkInTable tbody { display: block !important; width: 100% !important; }
                #checkInTable tr {
                    display: flex !important;
                    flex-direction: column !important;
                    width: 100% !important;
                    background: #ffffff !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 14px !important;
                    padding: 16px !important;
                    margin-bottom: 14px !important;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02) !important;
                    box-sizing: border-box !important;
                }
                
                #checkInTable td {
                    display: block !important;
                    width: 100% !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    text-align: left !important;
                }

                /* Mã SV - styled as tag badge */
                #checkInTable td:nth-child(3) {
                    order: 1;
                    display: inline-block !important;
                    width: auto !important;
                    align-self: flex-start;
                    background: #e0f2fe !important;
                    color: #0369a1 !important;
                    font-weight: 700 !important;
                    font-size: 13px !important;
                    padding: 4px 10px !important;
                    border-radius: 20px !important;
                    margin-bottom: 6px !important;
                }

                /* Họ tên */
                #checkInTable td:nth-child(4) {
                    order: 2;
                    font-size: 18px !important;
                    font-weight: 700 !important;
                    color: #0f172a !important;
                    margin-bottom: 12px !important;
                    padding-bottom: 4px !important;
                }

                /* Điểm danh */
                #checkInTable td:nth-child(8) {
                    order: 3;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    padding: 10px 0 !important;
                    border-top: 1px dashed #f1f5f9 !important;
                    font-size: 14px !important;
                    color: #475569 !important;
                }
                
                /* Large checkboxes for mobile touch */
                #checkInTable td:nth-child(8) input[type="checkbox"] {
                    transform: scale(1.6) !important;
                    margin: 8px !important;
                }

                /* Nộp bài & Injected Auto Grade UI */
                #checkInTable td:nth-child(10) {
                    order: 4;
                    padding: 12px 0 0 0 !important;
                    border-top: 1px dashed #e2e8f0 !important;
                    margin-top: 4px !important;
                }

                /* Grading Container Mobile styling */
                .e360-score-container {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    gap: 8px !important;
                }
                
                /* Enlarge target sizes for mobile */
                .e360-score-stepper {
                    flex: 1 !important;
                    height: 48px !important;
                    border: 1.5px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                }
                
                .e360-stepper-btn {
                    width: 48px !important;
                    height: 100% !important;
                    font-size: 22px !important;
                    background: #f8fafc !important;
                }
                
                .e360-score-input {
                    flex-grow: 1 !important;
                    height: 100% !important;
                    font-size: 18px !important; /* safe from auto-zoom */
                }

                .e360-btn {
                    height: 48px !important;
                    font-size: 16px !important;
                    border-radius: 10px !important;
                    padding: 0 16px !important;
                }
                
                .e360-btn-x2 {
                    width: 54px !important;
                    padding: 0 !important;
                }

                .e360-btn-save {
                    flex: 1.2 !important;
                }
                
                /* Responsive toggles hiding card sections */
                body.hide-col-3 #checkInTable td:nth-child(3) { display: none !important; }
                body.hide-col-4 #checkInTable td:nth-child(4) { display: none !important; }
                body.hide-col-8 #checkInTable td:nth-child(8) { display: none !important; }
                body.hide-col-10 #checkInTable td:nth-child(10) { display: none !important; }
            }

            .col-toggle-btn { background: #0284c7; border: none; padding: 10px 6px; border-radius: 8px; color: white; font-size: 13px; font-weight: bold; margin-right: 6px; cursor: pointer; opacity: 1; flex: 1; text-align: center; transition: all 0.15s; }
            .col-toggle-btn:last-child { margin-right: 0; }
            .col-toggle-btn.off { background: #cbd5e1; opacity: 0.8; color: #64748b; }

            /* Floating Toolbar - Glassmorphism, Notch support */
            #e360-toolbar {
                position: fixed; bottom: 0; left: 0; right: 0;
                background: rgba(15, 23, 42, 0.85) !important;
                backdrop-filter: blur(16px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
                color: white; border-top: 1px solid rgba(255, 255, 255, 0.1);
                z-index: 999999; padding: 14px 16px; display: flex; flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 -8px 30px rgba(0,0,0,0.15);
                padding-bottom: max(14px, env(safe-area-inset-bottom));
                border-top-left-radius: 16px; border-top-right-radius: 16px;
            }
            #e360-toolbar-top { display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 12px; }
            #e360-toolbar-bottom { display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 4px; }
        `;
        document.head.appendChild(style);

        // 2. Add Floating Toolbar
        const toolbarHTML = `
            <div id="e360-toolbar">
                <div id="e360-toolbar-top">
                    <div style="font-weight: bold;">E360 iOS</div>
                    <div>
                        <label style="margin-right: 10px; font-size: 12px;"><input type="checkbox" id="e360-auto-reload"> Auto</label>
                        <input type="number" id="e360-reload-time" value="10" style="width: 40px; text-align: center; color: black; border-radius: 3px; border:none; padding: 2px;"> s
                    </div>
                </div>
                <div id="e360-toolbar-bottom">
                    <button class="col-toggle-btn" data-col="3">Mã SV</button>
                    <button class="col-toggle-btn" data-col="4">Họ tên</button>
                    <button class="col-toggle-btn" data-col="8">Điểm danh</button>
                    <button class="col-toggle-btn" data-col="10">Nộp bài</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', toolbarHTML);

        const chkAuto = document.getElementById('e360-auto-reload');
        const txtTime = document.getElementById('e360-reload-time');

        function handleAutoReload() {
            if (chkAuto.checked) {
                const secs = parseInt(txtTime.value) || 10;
                reloadTimer = setTimeout(function () { location.reload(); }, secs * 1000);
                localStorage.setItem('e360_autoreload', 'true');
            } else {
                clearTimeout(reloadTimer);
                localStorage.setItem('e360_autoreload', 'false');
            }
        }

        chkAuto.checked = localStorage.getItem('e360_autoreload') === 'true';
        txtTime.value = localStorage.getItem('e360_reloadtime') || '10';

        chkAuto.addEventListener('change', handleAutoReload);
        txtTime.addEventListener('input', function () {
            localStorage.setItem('e360_reloadtime', txtTime.value);
            if (chkAuto.checked) { clearTimeout(reloadTimer); handleAutoReload(); }
        });
        handleAutoReload();

        // Handle Column Toggles
        const toggleBtns = document.querySelectorAll('.col-toggle-btn');
        toggleBtns.forEach(btn => {
            const col = btn.getAttribute('data-col');
            const state = localStorage.getItem('e360_col_' + col) !== 'false'; // true by default

            if (!state) {
                btn.classList.add('off');
                document.body.classList.add('hide-col-' + col);
            }

            btn.addEventListener('click', function () {
                const isOff = btn.classList.contains('off');
                if (isOff) {
                    btn.classList.remove('off');
                    document.body.classList.remove('hide-col-' + col);
                    localStorage.setItem('e360_col_' + col, 'true');
                } else {
                    btn.classList.add('off');
                    document.body.classList.add('hide-col-' + col);
                    localStorage.setItem('e360_col_' + col, 'false');
                }
            });
        });

        // 3. Inject Auto Grade UI into rows
        function injectRowUI() {
            const rows = document.querySelectorAll('#checkInTable tbody tr');
            rows.forEach(function (row) {
                const rowHTML = row.innerHTML;
                const match = rowHTML.match(/InputScore\((\d+)\)/);
                if (!match) return;
                const studentId = match[1];

                let defaultScore = '';
                const asmMatch = rowHTML.match(/ASM:\s*([\d\.]+)/);
                if (asmMatch) defaultScore = asmMatch[1];

                // Find the TD that contains the InputScore link, rather than hardcoding index 9
                const links = row.querySelectorAll('a, button');
                let nopBaiTd = null;
                for (let i = 0; i < links.length; i++) {
                    const onclickStr = links[i].getAttribute('onclick') || '';
                    if (onclickStr.indexOf('InputScore') !== -1) {
                        nopBaiTd = links[i].closest('td');
                        break;
                    }
                }

                // Fallback to index 9 if not found by link
                if (!nopBaiTd && row.cells.length > 9) {
                    nopBaiTd = row.cells[9];
                }

                if (!nopBaiTd) return;

                // Ensure this TD is displayed
                nopBaiTd.style.setProperty('display', 'table-cell', 'important');
                nopBaiTd.style.setProperty('visibility', 'visible', 'important');

                if (nopBaiTd.querySelector('.e360-score-input')) return;

                // Hide the InputScore text/link
                const inputLinks = nopBaiTd.querySelectorAll('a, button');
                inputLinks.forEach(link => {
                    if ((link.getAttribute('onclick') || '').includes('InputScore')) link.style.display = 'none';
                });

                // Remove line breaks to keep ASM and Checkbox on the same line
                const brs = nopBaiTd.querySelectorAll('br');
                brs.forEach(br => br.style.display = 'none');

                // Wrap original content in a flex container
                const originalWrapper = document.createElement('div');
                originalWrapper.style.display = 'flex';
                originalWrapper.style.alignItems = 'center';
                originalWrapper.style.justifyContent = 'center';
                originalWrapper.style.gap = '5px';
                originalWrapper.style.marginBottom = '6px';
                originalWrapper.style.fontSize = '12px';
                
                while(nopBaiTd.firstChild) {
                    originalWrapper.appendChild(nopBaiTd.firstChild);
                }
                nopBaiTd.appendChild(originalWrapper);

                const customUI = document.createElement('div');
                customUI.innerHTML = `
                    <div class="e360-score-container">
                        <div class="e360-score-stepper">
                            <button class="e360-stepper-btn e360-btn-minus" data-id="${studentId}">−</button>
                            <input type="number" class="e360-score-input" data-id="${studentId}" value="${defaultScore}" step="0.5" min="0" max="10">
                            <button class="e360-stepper-btn e360-btn-plus" data-id="${studentId}">+</button>
                        </div>
                        <button class="e360-btn e360-btn-x2" data-id="${studentId}">x2</button>
                        <button class="e360-btn e360-btn-save" data-id="${studentId}">Lưu</button>
                    </div>
                    <div class="e360-status" data-id="${studentId}" style="display: none;"></div>
                `;
                nopBaiTd.appendChild(customUI);
            });
        }

        setTimeout(injectRowUI, 500);
        setInterval(injectRowUI, 2000);

        // 4. Handle Actions
        document.addEventListener('click', function (e) {
            if (e.target.classList.contains('e360-btn-minus')) {
                const id = e.target.getAttribute('data-id');
                const input = document.querySelector('.e360-score-input[data-id="' + id + '"]');
                if (input) {
                    let val = parseFloat(input.value);
                    if (isNaN(val)) val = 0;
                    val = Math.max(0, val - 0.5);
                    input.value = val;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            if (e.target.classList.contains('e360-btn-plus')) {
                const id = e.target.getAttribute('data-id');
                const input = document.querySelector('.e360-score-input[data-id="' + id + '"]');
                if (input) {
                    let val = parseFloat(input.value);
                    if (isNaN(val)) val = 0;
                    val = Math.min(10, val + 0.5);
                    input.value = val;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            if (e.target.classList.contains('e360-btn-x2')) {
                const id = e.target.getAttribute('data-id');
                const input = document.querySelector('.e360-score-input[data-id="' + id + '"]');
                let val = parseFloat(input.value);
                if (!isNaN(val) && val >= 0 && val <= 5) {
                    input.value = val * 2;
                    input.style.backgroundColor = '#dff0d8';
                    setTimeout(function () { input.style.backgroundColor = ''; }, 500);
                } else {
                    alert("Điểm trống hoặc > 5 không thể nhân đôi.");
                }
            }

            if (e.target.classList.contains('e360-btn-save')) {
                const id = e.target.getAttribute('data-id');
                const input = document.querySelector('.e360-score-input[data-id="' + id + '"]');
                const statusDiv = document.querySelector('.e360-status[data-id="' + id + '"]');
                const btn = e.target;

                const score = input.value;
                if (score === '' || isNaN(score) || score < 0 || score > 10) {
                    alert("Điểm không hợp lệ!");
                    return;
                }

                btn.disabled = true;
                btn.innerText = '...';
                statusDiv.style.display = 'block';
                statusDiv.innerText = 'Đang lưu...';
                statusDiv.style.color = 'orange';

                clearTimeout(reloadTimer);

                saveScoreViaIframe(id, score, function (success, msg) {
                    btn.disabled = false;
                    btn.innerText = 'Lưu';
                    if (success) {
                        statusDiv.innerText = '✅ Xong';
                        statusDiv.style.color = 'green';
                        input.style.backgroundColor = '#dff0d8';
                    } else {
                        statusDiv.innerText = '❌ Lỗi: ' + msg;
                        statusDiv.style.color = 'red';
                    }
                    if (chkAuto.checked) handleAutoReload();
                });
            }
        });

        // 5. Same-Origin Iframe Logic (Runs in Background)
        function saveScoreViaIframe(studentId, score, callback) {
            const iframe = document.createElement('iframe');
            iframe.src = "/Proctor/InputScore?sssID=" + studentId;
            iframe.style.cssText = "position: absolute; width: 1px; height: 1px; top: -9999px; left: -9999px; opacity: 0; pointer-events: none;";
            document.body.appendChild(iframe);

            let isDone = false;
            let loadCount = 0;
            let saveTimer = null;

            const cleanup = () => {
                isDone = true;
                if (saveTimer) clearTimeout(saveTimer);
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            };

            const timeout = setTimeout(function () {
                if (!isDone) {
                    cleanup();
                    callback(false, "Timeout (Quá thời gian chờ)");
                }
            }, 20000);

            iframe.addEventListener('load', function () {
                if (isDone) return;
                loadCount++;

                try {
                    const pdoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (!pdoc) return;

                    if (pdoc.location.href === 'about:blank') return;

                    if (loadCount === 1) {
                        // Wait a short bit to ensure dynamic contents are resolved in WebForms
                        setTimeout(function () {
                            if (isDone) return;
                            const inputs = pdoc.querySelectorAll('input[id^="txtScore_"]');
                            if (inputs.length === 0) {
                                cleanup();
                                clearTimeout(timeout);
                                callback(false, "Không tìm thấy ô nhập điểm");
                                return;
                            }

                            inputs.forEach(function (input) {
                                input.value = score;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new Event('blur', { bubbles: true }));
                            });

                            // Inject dialog suppression directly inside the iframe window context
                            try {
                                const win = iframe.contentWindow;
                                if (win) {
                                    win.confirm = function () { return true; };
                                    win.alert = function () { return true; };
                                }
                            } catch (e) {
                                console.warn("Cannot override window dialogs directly:", e);
                            }

                            // Inject fallback script tag inside iframe body
                            const script = pdoc.createElement('script');
                            script.textContent = "window.confirm = function() { return true; }; window.alert = function() { return true; };";
                            pdoc.body.appendChild(script);

                            const saveBtn = pdoc.querySelector('button[onclick*="SaveAllScore"]') || 
                                            pdoc.querySelector('button.btn-primary') || 
                                            pdoc.querySelector('button[type="submit"]');
                            
                            if (saveBtn) {
                                saveBtn.click();
                                
                                // Set a fallback completion timer in case it does not trigger a page load/redirect (e.g. AJAX submission)
                                saveTimer = setTimeout(function () {
                                    if (!isDone) {
                                        cleanup();
                                        clearTimeout(timeout);
                                        callback(true);
                                    }
                                }, 2500);
                            } else {
                                cleanup();
                                clearTimeout(timeout);
                                callback(false, "Không tìm thấy nút Lưu trong trang");
                            }
                        }, 500);
                    } else if (loadCount > 1) {
                        // Success redirection / postback completed
                        cleanup();
                        clearTimeout(timeout);
                        callback(true);
                    }
                } catch(e) {
                    console.error("Iframe error:", e);
                    cleanup();
                    clearTimeout(timeout);
                    callback(false, "Lỗi kết nối iframe: " + e.message);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
