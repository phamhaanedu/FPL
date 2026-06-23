// ==UserScript==
// @name         E360 for Safari
// @namespace    http://e360.poly.edu.vn/
// @version      1.8.6.3
// @description  E360 Auto Grader for iOS Safari
// @author       LAPNV6
// @match        *://*.poly.edu.vn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Bypassing alerts & confirms immediately at document-start to prevent any browser blocking
    try {
        window.confirm = function () { return true; };
        window.alert = function () { return true; };
    } catch (e) { }
    try {
        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.confirm = function () { return true; };
            unsafeWindow.alert = function () { return true; };
        }
    } catch (e) { }

    function init() {
        if (!document.body) {
            setTimeout(init, 50);
            return;
        }

        const href = window.location.href.toLowerCase();

        if (href.includes('/proctor/checkin')) {
            initCheckinPage();
        } else if (href.includes('/proctor/inputscore')) {
            initInputScorePage();
        } else if (href.includes('/proctor/index') || href.includes('/proctor/list') || window.location.pathname.toLowerCase() === '/proctor' || window.location.pathname.toLowerCase() === '/proctor/') {
            initIndexPage();
        }
    }

    // ==========================================
    // 1. INPUT SCORE DETAIL PAGE AUTO-FILL & CLOSE
    // ==========================================
    function initInputScorePage() {
        const urlParams = new URLSearchParams(window.location.search);
        const sssID = urlParams.get('sssID');
        const score = urlParams.get('e360Score');
        const isInIframe = (window.parent !== window);

        // Check if we are reloading after a save operation
        if (sssID && sessionStorage.getItem('e360_saving_' + sssID) === 'true') {
            sessionStorage.removeItem('e360_saving_' + sssID);

            // If in iframe, notify parent to close overlay and reload (no blocking overlay)
            if (isInIframe) {
                try {
                    window.parent.postMessage({ type: 'e360-save-done', sssID: sssID }, '*');
                } catch (e) {
                    console.error('--> [Iframe] postMessage failed:', e);
                }
            } else {
                // Fallback: close popup window
                injectPopupCSS();
                showOverlay("✅ Đã lưu điểm thành công!");
                setTimeout(function () {
                    window.close();
                }, 1000);
            }
            return;
        }

        if (!score || !sssID) return; // Not an auto-grade request, let user grade manually

        // Inject mobile-friendly CSS styles
        injectPopupCSS();

        // Show preparation overlay
        showOverlay("⏳ Đang tải trang nhập điểm...");

        // Override confirm/alert dialogs in page context immediately
        const script = document.createElement('script');
        script.textContent = `
            window.confirm = function() { console.log('--> [Popup] Confirm bypassed'); return true; };
            window.alert = function() { console.log('--> [Popup] Alert bypassed'); return true; };
        `;
        document.head.appendChild(script);

        let checkCount = 0;
        function fillAndSetup() {
            const inputs = document.querySelectorAll('input[id^="txtScore_"]');
            if (inputs.length === 0) {
                checkCount++;
                if (checkCount > 100) { // 5s limit
                    console.error("--> [Popup] Inputs not found after 5s");
                    showOverlay("❌ Lỗi: Không tìm thấy ô nhập điểm");
                    return;
                }
                setTimeout(fillAndSetup, 50);
                return;
            }

            // Inputs found, fill the scores
            inputs.forEach(function (input) {
                input.value = score;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            });

            // Remove the loading overlay once the page loads and inputs are pre-filled
            const overlay = document.getElementById('e360-popup-overlay');
            if (overlay) overlay.remove();

            // Find the Save button to attach visual feedback and storage hook
            const saveBtn = document.querySelector('button[onclick*="SaveAllScore"]') ||
                document.querySelector('button.btn-success') ||
                document.querySelector('button[type="submit"]');

            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    // Set session storage flag as backup for page reload detection
                    sessionStorage.setItem('e360_saving_' + sssID, 'true');
                });
            } else {
                console.error("--> [Popup] Save button not found");
            }

            // Watch for Bootstrap success modal ("Lưu điểm thành công") to auto-close
            if (isInIframe) {
                const observer = new MutationObserver(function (mutations) {
                    const modals = document.querySelectorAll('.modal-body');
                    for (let i = 0; i < modals.length; i++) {
                        const text = modals[i].textContent || '';
                        if (text.includes('thành công')) {
                            observer.disconnect();
                            // Wait 2s so user sees the success message, then notify parent
                            setTimeout(function () {
                                try {
                                    window.parent.postMessage({ type: 'e360-save-done', sssID: sssID }, '*');
                                } catch (e) {
                                    console.error('--> [Iframe] postMessage failed:', e);
                                }
                            }, 2000);
                            return;
                        }
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }

            // Auto-click sequence: Lưu điểm -> Chờ 1s -> Xác nhận -> Chờ 1s -> Đóng
            setTimeout(function () {
                if (saveBtn) {
                    console.log("--> [Popup] Auto-clicking Save button");
                    saveBtn.click();

                    // Wait 1s after clicking Save
                    setTimeout(function () {
                        // Find the "Xác nhận" button
                        const confirmBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(btn => {
                            const txt = btn.textContent.trim().toLowerCase();
                            return txt === 'xác nhận' || btn.getAttribute('data-role') === 'ok';
                        });

                        if (confirmBtn) {
                            console.log("--> [Popup] Auto-clicking Confirmation button");
                            confirmBtn.click();

                            // Wait 1s after clicking Confirmation
                            setTimeout(function () {
                                // Find and click the "Đóng" button
                                // We poll for up to 5 seconds to ensure it is visible and loaded
                                let closeCheckCount = 0;
                                function clickCloseBtn() {
                                    const closeBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(btn => {
                                        const txt = btn.textContent.trim().toLowerCase();
                                        return txt === 'đóng';
                                    });

                                    if (closeBtn) {
                                        console.log("--> [Popup] Auto-clicking Close button");
                                        closeBtn.click();
                                    } else {
                                        closeCheckCount++;
                                        if (closeCheckCount < 50) { // 5s max check duration
                                            setTimeout(clickCloseBtn, 100);
                                        } else {
                                            console.warn("--> [Popup] Close button 'Đóng' not found after 5s");
                                        }
                                    }
                                }
                                clickCloseBtn();
                            }, 1000);
                        } else {
                            console.warn("--> [Popup] Confirmation button 'Xác nhận' not found");
                        }
                    }, 1000);
                } else {
                    console.warn("--> [Popup] Save button not found for auto-saving");
                }
            }, 500);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fillAndSetup);
        } else {
            fillAndSetup();
        }
    }

    // Helper to display a fullscreen visual progress overlay inside popup
    function showOverlay(message) {
        let overlay = document.getElementById('e360-popup-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'e360-popup-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 9999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 18px;
                font-weight: bold;
                transition: all 0.3s;
            `;
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `<div style="text-align: center; padding: 20px;"><div style="font-size: 24px; margin-bottom: 12px; font-weight: 800; color: #10b981;">E360 GRADER</div><div style="font-size: 15px; color: #94a3b8; font-weight: 500; max-width: 280px; line-height: 1.5; margin: 0 auto;">${message}</div></div>`;
    }

    function injectPopupCSS() {
        if (document.getElementById('e360-popup-style')) return;
        const style = document.createElement('style');
        style.id = 'e360-popup-style';
        style.innerHTML = `
            .main-header, .main-sidebar, .content-header, .main-footer { display: none !important; }
            html, body { background: #f8fafc !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
            body { padding: 12px !important; margin: 0 !important; }
            .wrapper, .content-wrapper, .content { margin: 0 !important; padding: 0 !important; background: #f8fafc !important; }
            .row { margin: 0 !important; }
            .col-md-12 { padding: 0 !important; }
            .box { border: none !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02) !important; border-radius: 12px !important; margin-bottom: 12px !important; background: #fff !important; overflow: hidden !important; }
            .box-header { display: none !important; }
            .box-info { display: none !important; }
            .box-body, .box-body-score { padding: 12px !important; }
            .box-body-score table { width: 100% !important; border-collapse: collapse !important; font-size: 13px !important; }
            .box-body-score th { display: none !important; }
            .box-body-score td { color: #0f172a !important; font-weight: bold !important; padding: 6px !important; border: 1px solid #e2e8f0 !important; }
            #tblScore { display: block !important; width: 100% !important; border: none !important; }
            #tblScore thead { display: none !important; }
            #tblScore tbody { display: block !important; width: 100% !important; }
            #tblScore tbody tr {
                display: block !important;
                background: #fff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 10px !important;
                padding: 12px 14px !important;
                margin-bottom: 10px !important;
                box-sizing: border-box !important;
            }
            #tblScore tbody tr#trTotalRaw, #tblScore tbody tr#trTotalRounded {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                background: #f8fafc !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 8px !important;
                padding: 12px 14px !important;
                font-size: 14px !important;
            }
            #tblScore tbody tr#trTotalRaw td, #tblScore tbody tr#trTotalRounded td {
                display: block !important;
                padding: 0 !important;
                border: none !important;
            }
            #tblScore tbody tr#trTotalRaw td:first-child, #tblScore tbody tr#trTotalRounded td:first-child {
                text-align: left !important;
                font-weight: bold !important;
                color: #475569 !important;
            }
            #tblScore tbody tr#trTotalRaw td:last-child, #tblScore tbody tr#trTotalRounded td:last-child {
                text-align: right !important;
                font-size: 16px !important;
                font-weight: 800 !important;
            }
            #tblScore tr td {
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                border: none !important;
                text-align: left !important;
                box-sizing: border-box !important;
            }
            #tblScore tr td:nth-child(1), #tblScore tr td:nth-child(2), #tblScore tr td:nth-child(4), #tblScore tr td:nth-child(6) {
                display: none !important;
            }
            #tblScore tr td:nth-child(3) {
                font-weight: 700 !important;
                color: #1e293b !important;
                font-size: 14px !important;
                margin-bottom: 6px !important;
                line-height: 1.3 !important;
            }
            #tblScore tr td:nth-child(5) {
                margin-bottom: 6px !important;
            }
            #tblScore tr td:nth-child(5) input.score-input {
                width: 100% !important;
                height: 48px !important;
                font-size: 18px !important;
                font-weight: bold !important;
                color: #0f172a !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 8px !important;
                text-align: center !important;
                background: #fdfdfd !important;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.05) !important;
            }
            #tblScore tr td:nth-child(5) input.score-input:focus {
                border-color: #10b981 !important;
                background: #fff !important;
                outline: none !important;
            }
            #tblScore tr td:nth-child(7) input.note-input {
                width: 100% !important;
                height: 44px !important;
                font-size: 15px !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 8px !important;
                padding: 0 12px !important;
                box-sizing: border-box !important;
                margin-top: 8px !important;
            }
            label[for="txtGeneralNote"] {
                font-weight: bold !important;
                color: #475569 !important;
                font-size: 13px !important;
                margin-bottom: 4px !important;
                display: block !important;
            }
            #txtGeneralNote {
                width: 100% !important;
                max-width: 100% !important;
                height: 80px !important;
                font-size: 15px !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 8px !important;
                padding: 10px !important;
                box-sizing: border-box !important;
            }
            .btn-success {
                width: 100% !important;
                height: 64px !important;
                font-size: 20px !important;
                font-weight: 800 !important;
                color: #fff !important;
                background: linear-gradient(135deg, #10b981, #059669) !important;
                border: none !important;
                border-radius: 14px !important;
                cursor: pointer !important;
                box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3) !important;
                transition: all 0.15s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 10px !important;
                margin-top: 20px !important;
                letter-spacing: 0.5px !important;
            }
            .btn-success:active {
                background: linear-gradient(135deg, #059669, #047857) !important;
                transform: scale(0.97) !important;
                box-shadow: 0 3px 8px rgba(16, 185, 129, 0.2) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // 2. CHECKIN LIST PAGE MAIN LOGIC & UI
    // ==========================================
    function initCheckinPage() {
        if (document.body.dataset.e360Injected === "1") return;
        document.body.dataset.e360Injected = "1";

        // Add Viewport for Mobile Safari to prevent scaling issues
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = "viewport";
            meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
            document.head.appendChild(meta);
        } else {
            document.querySelector('meta[name="viewport"]').content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
        }

        // 2.1 CSS Injection for Cards on Mobile & Columns on Desktop
        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide main layout elements */
            .main-header, .main-sidebar, .content-header, .main-footer { display: none !important; }
            
            /* Maximize space & Enable Scrolling */
            html, body { height: auto !important; min-height: 100% !important; overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch !important; }
            body { padding-top: max(10px, env(safe-area-inset-top)) !important; padding-bottom: 30px !important; margin: 0 !important; background: #f8fafc !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
            .wrapper, .content-wrapper { margin-left: 0 !important; height: auto !important; min-height: 100% !important; overflow: visible !important; background: #f8fafc !important; padding: 0 !important; margin: 0 !important; }
            .box { border-top: none !important; margin-bottom: 0 !important; box-shadow: none !important; border: none !important; margin-top: 10px !important; overflow: visible !important; background: transparent !important; }
            .box-body { padding: 8px !important; overflow: visible !important; }
            .table-responsive { overflow: visible !important; padding: 4px !important; }
            
            /* Hide specific table columns on Desktop (Attendance/Điểm danh column 8 is visible on Desktop) */
            #checkInTable th:nth-child(1), #checkInTable td:nth-child(1),
            #checkInTable th:nth-child(2), #checkInTable td:nth-child(2),
            #checkInTable th:nth-child(5), #checkInTable td:nth-child(5),
            #checkInTable th:nth-child(6), #checkInTable td:nth-child(6),
            #checkInTable th:nth-child(11), #checkInTable td:nth-child(11) {
                display: none !important;
            }

            /* Adjust remaining table columns on Desktop */
            #checkInTable { width: 100% !important; font-size: 14px; table-layout: fixed; border-collapse: separate; border-spacing: 0 12px; background: transparent !important; }
            #checkInTable th, #checkInTable td { padding: 8px 4px !important; vertical-align: middle; border: none !important; }
            
            /* Force display remaining columns */
            #checkInTable th, #checkInTable td {
                visibility: visible !important;
            }
            
            /* Column Widths for Desktop */
            #checkInTable th:nth-child(3), #checkInTable td:nth-child(3) { width: 18%; display: table-cell !important; } /* Mã SV */
            #checkInTable th:nth-child(4), #checkInTable td:nth-child(4) { width: 30%; display: table-cell !important; } /* Họ tên */
            #checkInTable th:nth-child(8), #checkInTable td:nth-child(8) { width: 18%; text-align: center; display: table-cell !important; } /* Điểm danh */
            #checkInTable th:nth-child(10), #checkInTable td:nth-child(10) { width: 34%; text-align: center; display: table-cell !important; } /* Nộp bài */

            /* Desktop Auto Grade UI Styles */
            .e360-score-container { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
            .e360-score-stepper { display: flex; align-items: center; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; }
            .e360-stepper-btn { border: none; background: #f1f5f9; color: #334155; width: 36px; height: 38px; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; user-select: none; transition: background 0.15s; }
            .e360-stepper-btn:active { background: #cbd5e1; }
            .e360-score-input { width: 55px; height: 38px; text-align: center; border: none; padding: 0; font-size: 16px; font-weight: bold; color: #1e293b; background: #fff; -moz-appearance: textfield; }
            .e360-score-input::-webkit-outer-spin-button, .e360-score-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            
            .e360-btn { border: none; border-radius: 8px; height: 38px; padding: 0 14px; font-weight: bold; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .e360-btn-save { background: #10b981; color: white; min-width: 60px; }
            .e360-btn-save:active { background: #059669; }
            .e360-btn-save:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; }

            .e360-status { font-size: 12px; font-weight: 600; text-align: center; margin-top: 4px; }

            /* Desktop only card header hiding */
            .e360-card-header { display: none; }

            /* Refresh Score/Sign buttons - larger touch targets */
            span[onclick*="RefreshScore"],
            span[onclick*="RefreshSign"] {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-width: 44px !important;
                min-height: 44px !important;
                padding: 8px 12px !important;
                font-size: 16px !important;
                font-weight: 700 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
                user-select: none !important;
                box-sizing: border-box !important;
            }
            span[onclick*="RefreshScore"] {
                background: #eff6ff !important;
                color: #2563eb !important;
                border: 1.5px solid #bfdbfe !important;
            }
            span[onclick*="RefreshScore"]:active {
                background: #dbeafe !important;
                transform: scale(0.95) !important;
            }
            span[onclick*="RefreshSign"] {
                background: #f0fdf4 !important;
                color: #16a34a !important;
                border: 1.5px solid #bbf7d0 !important;
            }
            span[onclick*="RefreshSign"]:active {
                background: #dcfce7 !important;
                transform: scale(0.95) !important;
            }

            /* Attendance cell - horizontal radio layout (desktop + mobile) */
            .e360-diemdanh-cell {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 8px 16px !important;
                padding: 6px 0 !important;
                width: 100% !important;
            }
            .e360-diemdanh-wrapper {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 8px 16px !important;
                width: 100% !important;
            }
            .e360-diemdanh-cell label,
            .e360-diemdanh-cell div,
            .e360-diemdanh-cell span {
                display: inline-flex !important;
                align-items: center !important;
                margin: 0 !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #475569 !important;
                cursor: pointer !important;
                user-select: none !important;
                gap: 4px !important;
            }
            .e360-diemdanh-cell label:not(:last-child)::after {
                content: "-";
                margin-left: 16px;
                color: #cbd5e1;
                font-weight: normal;
            }
            .e360-diemdanh-cell input[type="checkbox"],
            .e360-diemdanh-cell input[type="radio"] {
                transform: scale(1.3) !important;
                margin: 0 4px 0 0 !important;
                cursor: pointer !important;
            }
            .e360-diemdanh-cell br {
                display: none !important;
            }

            /* Attendance Badges and Edit Links */
            .e360-att-badge, .e360-card-att-badge {
                font-size: 11px !important;
                padding: 3px 8px !important;
                border-radius: 12px !important;
                font-weight: bold !important;
                display: inline-flex !important;
                align-items: center !important;
                white-space: nowrap !important;
            }
            .e360-badge-success { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #bbf7d0 !important; }
            .e360-badge-danger { background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; }
            .e360-badge-warning { background: #fef3c7 !important; color: #d97706 !important; border: 1px solid #fde68a !important; }
            .e360-badge-default { background: #f1f5f9 !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }

            .e360-att-badge-container {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                margin-top: 4px !important;
            }

            .e360-att-edit-btn {
                background: none !important;
                border: none !important;
                color: #0284c7 !important;
                font-weight: bold !important;
                font-size: 12px !important;
                cursor: pointer !important;
                padding: 2px 4px !important;
                text-decoration: underline !important;
            }

            .e360-card-att-badge {
                cursor: pointer !important;
            }
            .e360-card-att-badge:after {
                content: ' ✎' !important;
                font-size: 9px !important;
                margin-left: 2px !important;
                opacity: 0.7 !important;
            }

            /* Iframe Overlay for InputScore */
            .e360-iframe-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(15, 23, 42, 0.7) !important;
                backdrop-filter: blur(6px) !important;
                -webkit-backdrop-filter: blur(6px) !important;
                z-index: 99999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 16px !important;
                box-sizing: border-box !important;
            }
            .e360-iframe-container {
                width: 100% !important;
                max-width: 500px !important;
                height: 85vh !important;
                max-height: 700px !important;
                background: #fff !important;
                border-radius: 16px !important;
                overflow: hidden !important;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25) !important;
                display: flex !important;
                flex-direction: column !important;
                position: relative !important;
            }
            .e360-iframe-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 12px 16px !important;
                background: linear-gradient(135deg, #10b981, #059669) !important;
                color: #fff !important;
                flex-shrink: 0 !important;
            }
            .e360-iframe-header-title {
                font-size: 15px !important;
                font-weight: 700 !important;
            }
            .e360-iframe-close-btn {
                background: rgba(255,255,255,0.2) !important;
                border: none !important;
                color: #fff !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                font-size: 18px !important;
                font-weight: bold !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: background 0.15s !important;
            }
            .e360-iframe-close-btn:active {
                background: rgba(255,255,255,0.35) !important;
            }
            .e360-iframe-status {
                padding: 8px 16px !important;
                background: #f0fdf4 !important;
                color: #166534 !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                text-align: left !important;
                flex-shrink: 0 !important;
                border-bottom: 1px solid #dcfce7 !important;
            }
            .e360-iframe-frame {
                flex: 1 !important;
                border: none !important;
                width: 100% !important;
            }

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
                    padding: 14px !important;
                    margin-bottom: 12px !important;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02) !important;
                    box-sizing: border-box !important;
                    position: relative !important;
                }

                /* Mobile Card Header */
                .e360-card-header {
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    width: 100% !important;
                    margin-bottom: 8px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding-bottom: 8px !important;
                }
                .e360-card-name {
                    font-size: 15px !important;
                    font-weight: 700 !important;
                    color: #0f172a !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    flex-wrap: wrap !important;
                }
                .e360-card-meta {
                    font-size: 12px !important;
                    font-weight: 700 !important;
                    color: #0284c7 !important;
                    background: #e0f2fe !important;
                    padding: 2px 8px !important;
                    border-radius: 12px !important;
                    white-space: nowrap !important;
                }

                /* Attendance Check cell on mobile - add border-top separator */
                .e360-diemdanh-cell {
                    border-top: 1px dashed #e2e8f0 !important;
                    margin-top: 4px !important;
                }

                /* Nộp bài cell as Card Body */
                #checkInTable td:nth-child(10) {
                    display: block !important;
                    padding: 0 !important;
                    margin-top: 4px !important;
                    border: none !important;
                }

                /* Grade Input wrappers on mobile */
                .e360-nopbai-wrapper {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: wrap !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    gap: 8px 12px !important;
                    width: 100% !important;
                }

                /* Compact Flex Row for ASM and Ký signatures */
                .e360-original-wrapper {
                    display: inline-flex !important;
                    flex-direction: row !important;
                    flex-wrap: wrap !important;
                    align-items: center !important;
                    width: auto !important;
                    gap: 8px !important;
                    font-weight: 600 !important;
                    font-size: 13px !important;
                    color: #475569 !important;
                    margin: 0 !important;
                    background: #f8fafc !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 10px !important;
                    padding: 6px 10px !important;
                }
                .e360-original-wrapper label,
                .e360-original-wrapper span,
                .e360-original-wrapper div {
                    display: inline-flex !important;
                    align-items: center !important;
                    margin: 0 !important;
                    gap: 4px !important;
                }

                /* Make original signature checkbox easy to tap on mobile */
                .e360-original-wrapper input[type="checkbox"] {
                    transform: scale(1.5) !important;
                    margin: 4px 8px !important;
                    cursor: pointer;
                }

                /* Custom UI container for grading elements */
                .e360-custom-ui-wrapper {
                    display: inline-flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                    width: auto !important;
                    flex-grow: 1 !important;
                }

                /* Grading Container Mobile styling */
                .e360-score-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    width: 100% !important;
                    gap: 8px !important;
                }
                
                /* Enlarge target sizes for mobile */
                .e360-score-stepper {
                    flex: 1.5 !important;
                    height: 40px !important;
                    border: 1.5px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                }
                
                .e360-stepper-btn {
                    width: 38px !important;
                    height: 100% !important;
                    font-size: 18px !important;
                    background: #f8fafc !important;
                }
                
                .e360-score-input {
                    flex-grow: 1 !important;
                    height: 100% !important;
                    font-size: 16px !important; /* safe from auto-zoom */
                }

                .e360-btn {
                    height: 40px !important;
                    font-size: 14px !important;
                    border-radius: 10px !important;
                    padding: 0 14px !important;
                }

                .e360-btn-save {
                    flex: 1 !important;
                }
            }
        `;
        document.head.appendChild(style);

        function checkIsPresent(diemDanhCell) {
            if (!diemDanhCell) return false;
            const hasInputs = diemDanhCell.querySelector('input[type="radio"], input[type="checkbox"]');
            if (hasInputs) {
                const checkbox = diemDanhCell.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    return checkbox.checked;
                }
                const checkedRadio = diemDanhCell.querySelector('input[type="radio"]:checked');
                if (checkedRadio) {
                    let labelText = "";
                    const label = diemDanhCell.querySelector('label[for="' + checkedRadio.id + '"]');
                    if (label) labelText = label.innerText.toLowerCase();
                    const parentText = checkedRadio.parentElement ? checkedRadio.parentElement.innerText.toLowerCase() : "";
                    if (labelText.includes("có mặt") || labelText.includes("comat") ||
                        parentText.includes("có mặt") || parentText.includes("comat") ||
                        checkedRadio.value === "1" || checkedRadio.value === "true") {
                        return true;
                    }
                    return false;
                }
                return false;
            }
            const txt = diemDanhCell.innerText.toLowerCase();
            if (txt.includes("đã điểm danh") || txt.includes("có mặt")) {
                return true;
            }
            return false;
        }

        function checkIsAttendanceDone(diemDanhCell) {
            if (!diemDanhCell) return false;
            const hasInputs = diemDanhCell.querySelector('input[type="radio"], input[type="checkbox"]');
            if (hasInputs) {
                const checkedRadio = diemDanhCell.querySelector('input[type="radio"]:checked');
                if (checkedRadio) return true;
                const checkedCheckbox = diemDanhCell.querySelector('input[type="checkbox"]:checked');
                if (checkedCheckbox) return true;
                return false;
            }
            const txt = diemDanhCell.innerText.toLowerCase();
            if (txt.includes("đã điểm danh") || txt.includes("có mặt") || txt.includes("vắng") || txt.includes("muộn")) {
                return true;
            }
            return false;
        }

        function getCheckedAttendanceLabel(diemDanhCell) {
            if (!diemDanhCell) return "";
            const hasInputs = diemDanhCell.querySelector('input[type="radio"], input[type="checkbox"]');
            if (hasInputs) {
                const checkedRadio = diemDanhCell.querySelector('input[type="radio"]:checked');
                if (checkedRadio) {
                    return checkedRadio.getAttribute('title') || checkedRadio.value || "Đã điểm danh";
                }
                const checkbox = diemDanhCell.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    return "Có mặt";
                }
                return "";
            }
            const txt = diemDanhCell.innerText.toLowerCase();
            if (txt.includes("có mặt")) return "Có mặt";
            if (txt.includes("vắng mặt") || txt.includes("vắng")) return "Vắng mặt";
            if (txt.includes("đến muộn") || txt.includes("muộn")) return "Đến muộn";
            return "Đã điểm danh";
        }

        function updateRowLayout(row, diemDanhColIndex, nopBaiTd, columnsToHide) {
            const cellAtt = row.cells[diemDanhColIndex];
            if (!cellAtt) return;
            const isDone = checkIsAttendanceDone(cellAtt);
            const isEditing = cellAtt.dataset.e360EditingAtt === "true";

            // Get or create wrappers inside cellAtt and nopBaiTd
            let attWrapper = cellAtt.querySelector('.e360-diemdanh-wrapper');
            if (!attWrapper) {
                attWrapper = document.createElement('div');
                attWrapper.className = 'e360-diemdanh-wrapper';

                // Dynamically wrap each radio input and its succeeding text node in a label
                const nodes = Array.from(cellAtt.childNodes);
                let currentLabel = null;
                nodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'INPUT' || node.tagName === 'LABEL')) {
                        currentLabel = document.createElement('label');
                        attWrapper.appendChild(currentLabel);
                        currentLabel.appendChild(node);
                    } else if (node.nodeType === Node.TEXT_NODE && currentLabel) {
                        const txt = node.textContent.trim();
                        if (txt) {
                            currentLabel.appendChild(document.createTextNode(txt));
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
                        attWrapper.appendChild(node);
                    }
                });
                cellAtt.appendChild(attWrapper);
            }

            let nopBaiWrapper = nopBaiTd ? nopBaiTd.querySelector('.e360-nopbai-wrapper') : null;
            if (nopBaiTd && !nopBaiWrapper) {
                nopBaiWrapper = document.createElement('div');
                nopBaiWrapper.className = 'e360-nopbai-wrapper';
                while (nopBaiTd.firstChild) {
                    nopBaiWrapper.appendChild(nopBaiTd.firstChild);
                }
                nopBaiTd.appendChild(nopBaiWrapper);
            }

            // Manage attendance status badge for Desktop view
            let badgeContainer = cellAtt.querySelector('.e360-att-badge-container');
            if (!badgeContainer) {
                badgeContainer = document.createElement('div');
                badgeContainer.className = 'e360-att-badge-container';
                cellAtt.appendChild(badgeContainer);
            }

            if (isDone && !isEditing) {
                // Show badge, hide original options
                const label = getCheckedAttendanceLabel(cellAtt);
                let badgeClass = 'e360-badge-default';
                if (label.includes("Có mặt") || label.includes("comat")) badgeClass = 'e360-badge-success';
                else if (label.includes("Vắng") || label.includes("absent")) badgeClass = 'e360-badge-danger';
                else if (label.includes("Muộn") || label.includes("late")) badgeClass = 'e360-badge-warning';

                badgeContainer.innerHTML = `
                    <span class="e360-att-badge ${badgeClass}">${label}</span>
                    <button type="button" class="e360-att-edit-btn">Sửa</button>
                `;
                badgeContainer.style.display = 'inline-flex';
                attWrapper.style.display = 'none';

                // Add listener to edit button
                const editBtn = badgeContainer.querySelector('.e360-att-edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', function () {
                        cellAtt.dataset.e360EditingAtt = "true";
                        updateRowLayout(row, diemDanhColIndex, nopBaiTd, columnsToHide);
                    });
                }
            } else {
                // Hide badge, show original options
                badgeContainer.style.display = 'none';
                attWrapper.style.display = 'flex';
            }

            // Always display the grade input wrapper
            if (nopBaiWrapper) {
                nopBaiWrapper.style.display = 'flex';
            }

            if (window.innerWidth < 768) {
                // Mobile Card View:
                // If attendance is completed and we're not actively editing, hide the cell to save space
                if (isDone && !isEditing) {
                    cellAtt.style.setProperty('display', 'none', 'important');
                } else {
                    cellAtt.style.setProperty('display', 'flex', 'important');
                    cellAtt.style.setProperty('width', '100%', 'important');
                }

                if (nopBaiTd) {
                    nopBaiTd.style.setProperty('display', 'block', 'important');
                    nopBaiTd.style.setProperty('width', '100%', 'important');
                }
            } else {
                // Desktop Table View:
                // Keep the td cells visible as table-cells, but show/hide their wrappers to avoid misalignment
                cellAtt.style.removeProperty('display');
                cellAtt.style.removeProperty('width');
                if (nopBaiTd) {
                    nopBaiTd.style.removeProperty('display');
                    nopBaiTd.style.removeProperty('width');
                }
            }
        }

        // 2.2 Inject UI Loop
        function injectRowUI() {
            const rows = document.querySelectorAll('#checkInTable tbody tr');
            if (rows.length === 0) return;

            let diemDanhColIndex = 7;
            let thietBiColIndex = 4;
            let maSVColIndex = 2;
            let hoTenColIndex = 3;
            const columnsToHide = [];

            const headers = document.querySelectorAll('#checkInTable th');
            headers.forEach(function (th, idx) {
                const txt = th.innerText.toLowerCase();
                if ((txt.includes('điểm danh') || txt.includes('attendance')) && !txt.includes('ghi chú') && !txt.includes('note')) {
                    diemDanhColIndex = idx;
                }
                if (txt.includes('thiết bị') || txt.includes('device')) thietBiColIndex = idx;
                if (txt.includes('mã sv') || txt.includes('mssv') || txt.includes('mã sinh viên') || txt.includes('code')) maSVColIndex = idx;
                if (txt.includes('họ tên') || txt.includes('tên sinh viên') || txt.includes('name')) hoTenColIndex = idx;

                if (txt.includes('ghi chú') || txt.includes('note')) {
                    columnsToHide.push(idx);
                    th.style.setProperty('display', 'none', 'important');
                }
            });

            rows.forEach(function (row) {
                // Dynamically hide Ghi chú columns
                columnsToHide.forEach(function (idx) {
                    if (row.cells[idx]) {
                        row.cells[idx].style.setProperty('display', 'none', 'important');
                    }
                });

                // Skip rows that are already fully processed
                if (row.getAttribute('data-e360-processed') === 'true') return;

                const rowHTML = row.innerHTML;
                const match = rowHTML.match(/InputScore\((\d+)\)/) ||
                    rowHTML.match(/CheckOutSectionNoScore\((\d+)/) ||
                    rowHTML.match(/RefreshSign\((\d+)\)/) ||
                    rowHTML.match(/RefreshScore\((\d+)\)/) ||
                    rowHTML.match(/scoreWrap_(\d+)/) ||
                    rowHTML.match(/signWrap_(\d+)/) ||
                    rowHTML.match(/ChooseAnswerCheckIn\((\d+)/) ||
                    rowHTML.match(/ChooseNoteCheckIn\((\d+)/) ||
                    rowHTML.match(/name="answer_(\d+)"/) ||
                    rowHTML.match(/data-checkin-item-id="(\d+)"/) ||
                    rowHTML.match(/id="[^"]*(\d+)"/);
                if (!match) return;
                const studentId = match[1];

                const isSigned = !rowHTML.includes('InputScore(') || rowHTML.includes('Đã ký:');

                // Find the Nộp bài / Ký nộp bài cell (which is column index 9)
                let nopBaiTd = null;
                const links = row.querySelectorAll('a, button, i, span, input');
                for (let i = 0; i < links.length; i++) {
                    const onclickStr = links[i].getAttribute('onclick') || '';
                    if (onclickStr.indexOf('InputScore') !== -1 ||
                        onclickStr.indexOf('CheckOutSectionNoScore') !== -1 ||
                        onclickStr.indexOf('RefreshSign') !== -1 ||
                        onclickStr.indexOf('RefreshScore') !== -1) {
                        nopBaiTd = links[i].closest('td');
                        break;
                    }
                }

                if (!nopBaiTd && row.cells.length > 9) {
                    nopBaiTd = row.cells[9];
                }

                if (!nopBaiTd) return;

                // Mark as processed so we don't run this loop continuously
                row.setAttribute('data-e360-processed', 'true');

                // Ensure Nộp Bài TD is displayed
                nopBaiTd.style.setProperty('display', 'table-cell', 'important');
                nopBaiTd.style.setProperty('visibility', 'visible', 'important');

                // Add e360-diemdanh-cell class and change listener
                const cellAtt = row.cells[diemDanhColIndex];
                if (cellAtt) {
                    cellAtt.classList.add('e360-diemdanh-cell');
                    if (!cellAtt.dataset.e360ListenerAdded) {
                        cellAtt.dataset.e360ListenerAdded = "1";
                        cellAtt.addEventListener('change', function () {
                            cellAtt.dataset.e360EditingAtt = "false";
                            row.removeAttribute('data-e360-processed');
                            injectRowUI();
                        });
                    }
                }

                // Hide the original InputScore text/link
                const inputLinks = nopBaiTd.querySelectorAll('a, button, i');
                inputLinks.forEach(link => {
                    const onclickStr = link.getAttribute('onclick') || '';
                    if (onclickStr.includes('InputScore')) {
                        link.style.display = 'none';
                    }
                });

                // Remove line breaks to prevent vertical wrapping
                const brs = nopBaiTd.querySelectorAll('br');
                brs.forEach(br => br.style.display = 'none');

                // Wrap original cell content in a clean flex wrapper
                const originalWrapper = document.createElement('div');
                originalWrapper.className = 'e360-original-wrapper';

                while (nopBaiTd.firstChild) {
                    originalWrapper.appendChild(nopBaiTd.firstChild);
                }

                if (originalWrapper.childNodes.length > 0) {
                    nopBaiTd.appendChild(originalWrapper);

                    if (isSigned) {
                        // Hide checkbox
                        const cb = originalWrapper.querySelector('input[type="checkbox"]');
                        if (cb) cb.style.display = 'none';

                        // Clean and style signWrap
                        const signWrap = originalWrapper.querySelector('[id^="signWrap_"]');
                        if (signWrap) {
                            signWrap.style.fontSize = '14px';
                            signWrap.style.fontWeight = 'bold';
                            signWrap.style.color = '#10b981';

                            const font = signWrap.querySelector('font');
                            if (font) {
                                font.style.color = '#10b981';
                            }
                        }

                        // Style originalWrapper as a success banner
                        originalWrapper.style.cssText = `
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: center !important;
                            justify-content: center !important;
                            gap: 6px !important;
                            padding: 10px !important;
                            background: #f0fdf4 !important;
                            border: 1px solid #bbf7d0 !important;
                            border-radius: 10px !important;
                            margin: 4px 0 0 0 !important;
                            font-size: 14px !important;
                            color: #166534 !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        `;

                        // Handle refresh icon position
                        const refreshSpan = originalWrapper.querySelector('span[onclick*="RefreshSign"]');
                        if (refreshSpan) {
                            refreshSpan.style.marginLeft = '6px';
                            refreshSpan.style.cursor = 'pointer';
                            refreshSpan.style.display = 'inline-block';
                        }
                    } else {
                        // Unsigned student layout
                        let defaultScore = '';
                        const asmMatch = rowHTML.match(/ASM:\s*([\d\.]+)/);
                        if (asmMatch) defaultScore = asmMatch[1];

                        // Make original signature checkbox easy to tap on mobile
                        const cb = originalWrapper.querySelector('input[type="checkbox"]');
                        if (cb) {
                            cb.style.setProperty('transform', 'scale(1.5)', 'important');
                            cb.style.setProperty('margin', '4px 8px', 'important');
                            cb.style.setProperty('cursor', 'pointer', 'important');
                        }

                        // Append custom grading UI in its wrapper
                        const customUI = document.createElement('div');
                        customUI.className = 'e360-custom-ui-wrapper';
                        customUI.innerHTML = `
                            <div class="e360-score-container">
                                <div class="e360-score-stepper">
                                    <button class="e360-stepper-btn e360-btn-minus" data-id="${studentId}">−</button>
                                    <input type="number" class="e360-score-input" data-id="${studentId}" value="${defaultScore}" step="0.5" min="0" max="10">
                                    <button class="e360-stepper-btn e360-btn-plus" data-id="${studentId}">+</button>
                                </div>
                                <button class="e360-btn e360-btn-save" data-id="${studentId}">Nhập điểm</button>
                            </div>
                            <div class="e360-status" data-id="${studentId}" style="display: none;"></div>
                        `;
                        nopBaiTd.appendChild(customUI);
                    }
                }

                // Initial layout update
                updateRowLayout(row, diemDanhColIndex, nopBaiTd, columnsToHide);

                // HIDE OTHER UNWANTED COLUMNS ON MOBILE IN JS
                if (window.innerWidth < 768) {
                    for (let i = 0; i < row.cells.length; i++) {
                        const cell = row.cells[i];
                        if (i !== diemDanhColIndex && cell !== nopBaiTd) {
                            cell.style.setProperty('display', 'none', 'important');
                        }
                    }
                } else {
                    for (let i = 0; i < row.cells.length; i++) {
                        if (!columnsToHide.includes(i)) {
                            row.cells[i].style.display = '';
                        }
                    }
                }

                // Parse Student Code, Student Name, Device, and STT
                let studentCode = '';
                if (row.cells && row.cells.length > maSVColIndex) {
                    studentCode = row.cells[maSVColIndex].innerText.trim().split('\n')[0];
                }

                let studentName = '';
                if (row.cells && row.cells.length > hoTenColIndex) {
                    studentName = row.cells[hoTenColIndex].innerText.trim();
                }

                let device = '';
                if (row.cells && row.cells.length > thietBiColIndex) {
                    device = row.cells[thietBiColIndex].innerText.trim();
                }

                let stt = '';
                if (row.cells && row.cells.length > 0) {
                    stt = row.cells[0].innerText.trim();
                }
                stt = stt.replace(/\s+/g, ' ');

                // Inject Card Header for Mobile Card Layout
                let cardHeader = row.querySelector('.e360-card-header');
                let deviceBadge = '';
                if (device) {
                    const isUsb = device.toLowerCase().includes('usb');
                    deviceBadge = `<span class="e360-device-badge" style="margin-left: 8px; font-size: 11px; padding: 2px 6px; border-radius: 6px; font-weight: bold; background: ${isUsb ? '#dcfce7' : '#f1f5f9'}; color: ${isUsb ? '#15803d' : '#475569'}; border: 1px solid ${isUsb ? '#bbf7d0' : '#e2e8f0'};">${device}</span>`;
                }

                if (!cardHeader) {
                    cardHeader = document.createElement('div');
                    cardHeader.className = 'e360-card-header';
                    row.insertBefore(cardHeader, row.firstChild);
                }

                // Get attendance label for card header badge
                let attBadgeHTML = '';
                const isAttDone = checkIsAttendanceDone(cellAtt);
                if (isAttDone) {
                    const label = getCheckedAttendanceLabel(cellAtt);
                    let badgeClass = 'e360-badge-default';
                    if (label.includes("Có mặt") || label.includes("comat")) badgeClass = 'e360-badge-success';
                    else if (label.includes("Vắng") || label.includes("absent")) badgeClass = 'e360-badge-danger';
                    else if (label.includes("Muộn") || label.includes("late")) badgeClass = 'e360-badge-warning';

                    attBadgeHTML = `<span class="e360-card-att-badge ${badgeClass}" data-student-id="${studentId}">${label}</span>`;
                }

                cardHeader.innerHTML = `
                    <div class="e360-card-name" style="display: flex; align-items: center; gap: 4px;">
                        <span>${studentName}</span>
                    </div>
                    <div class="e360-card-meta">${stt} - ${studentCode}</div>
                `;

                // Add click listener to mobile card header badge to edit attendance
                const cardHeaderBadge = cardHeader.querySelector('.e360-card-att-badge');
                if (cardHeaderBadge && !cardHeaderBadge.dataset.listenerAdded) {
                    cardHeaderBadge.dataset.listenerAdded = "1";
                    cardHeaderBadge.addEventListener('click', function () {
                        if (cellAtt) {
                            cellAtt.dataset.e360EditingAtt = "true";
                            updateRowLayout(row, diemDanhColIndex, nopBaiTd, columnsToHide);
                        }
                    });
                }
            });
        }

        setTimeout(injectRowUI, 500);
        setInterval(injectRowUI, 2000);

        // 2.3 Handle Steppers & Actions
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
                statusDiv.innerText = 'Đang mở trang nhập điểm...';
                statusDiv.style.color = 'orange';

                saveScoreViaPopup(id, score, function (success, msg) {
                    btn.disabled = false;
                    btn.innerText = 'Nhập điểm';
                    if (success) {
                        input.style.backgroundColor = '#dff0d8';
                        reloadStudentRow(id);
                    } else {
                        statusDiv.innerText = '❌ Lỗi: ' + msg;
                        statusDiv.style.color = '#ef4444';
                    }
                });
            }
        });

        // 2.4 Iframe Overlay Grading Flow (no timeout, no popup blocker issues)
        function saveScoreViaPopup(studentId, score, callback) {
            try {
                sessionStorage.removeItem('e360_saving_' + studentId);
            } catch (e) { }

            const url = "/Proctor/InputScore?sssID=" + studentId + "&e360Score=" + score;

            // Create fullscreen overlay with iframe
            const overlay = document.createElement('div');
            overlay.className = 'e360-iframe-overlay';
            overlay.id = 'e360-iframe-overlay-' + studentId;
            overlay.innerHTML = `
                <div class="e360-iframe-container">
                    <div class="e360-iframe-header">
                        <span class="e360-iframe-header-title">📝 Nhập điểm</span>
                        <button class="e360-iframe-close-btn" id="e360-iframe-close-${studentId}">✕</button>
                    </div>
                    <div class="e360-iframe-status" id="e360-iframe-status-${studentId}">⏳ Đang tải trang nhập điểm...</div>
                    <iframe class="e360-iframe-frame" id="e360-iframe-${studentId}" src="${url}"></iframe>
                </div>
            `;
            document.body.appendChild(overlay);

            // Prevent body scroll while overlay is open
            document.body.style.overflow = 'hidden';

            const iframe = document.getElementById('e360-iframe-' + studentId);
            const statusBar = document.getElementById('e360-iframe-status-' + studentId);
            const closeBtn = document.getElementById('e360-iframe-close-' + studentId);

            // Track load count to detect redirects
            let iframeLoadCount = 0;
            iframe.addEventListener('load', function () {
                iframeLoadCount++;
                // Check if iframe loaded the correct InputScore page
                try {
                    const iframeUrl = iframe.contentWindow.location.href;
                    if (iframeUrl && !iframeUrl.toLowerCase().includes('/inputscore')) {
                        // Wrong page loaded (e.g., redirected to exam plan list)
                        statusBar.textContent = '⚠️ Trang không đúng — đang thử lại...';
                        statusBar.style.background = '#fef3c7';
                        statusBar.style.color = '#92400e';
                        // Auto-retry by reloading the correct URL
                        if (iframeLoadCount <= 3) {
                            setTimeout(function () {
                                iframe.src = url;
                            }, 500);
                        } else {
                            statusBar.textContent = '❌ Không thể mở trang nhập điểm. Thử đóng và mở lại.';
                            statusBar.style.background = '#fee2e2';
                            statusBar.style.color = '#991b1b';
                        }
                        return;
                    }
                } catch (e) {
                    // Cross-origin - can't check URL, assume it's correct
                }
                statusBar.textContent = '✅ Sẵn sàng — Bấm Lưu điểm.';
                statusBar.style.background = '#ecfdf5';
                statusBar.style.color = '#166534';
            });

            // Close button handler
            function closeOverlay() {
                overlay.remove();
                document.body.style.overflow = '';
            }

            closeBtn.addEventListener('click', function () {
                closeOverlay();
                callback(false, 'Đã đóng mà chưa lưu');
            });

            // Click outside iframe container to close
            overlay.addEventListener('click', function (evt) {
                if (evt.target === overlay) {
                    closeOverlay();
                    callback(false, 'Đã đóng mà chưa lưu');
                }
            });

            // Listen for postMessage from iframe (sent after successful save)
            function onMessage(evt) {
                if (evt.data && evt.data.type === 'e360-save-done' && evt.data.sssID === studentId) {
                    window.removeEventListener('message', onMessage);
                    statusBar.textContent = '✅ Đã lưu điểm thành công! Đang đóng...';
                    statusBar.style.background = '#dcfce7';
                    statusBar.style.color = '#15803d';
                    setTimeout(function () {
                        closeOverlay();
                        callback(true);
                    }, 800);
                }
            }
            window.addEventListener('message', onMessage);
        }

        // 2.5 Dynamic Score & Signature Cell Syncing
        function reloadStudentRow(studentId) {
            const statusDiv = document.querySelector('.e360-status[data-id="' + studentId + '"]');
            if (statusDiv) {
                statusDiv.innerText = 'Đang đồng bộ...';
                statusDiv.style.color = '#3b82f6';
            }

            fetch(window.location.href)
                .then(function (response) {
                    if (!response.ok) throw new Error("Mất kết nối mạng");
                    return response.text();
                })
                .then(function (html) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    const rows = doc.querySelectorAll('#checkInTable tbody tr');
                    let matchedRow = null;
                    for (let i = 0; i < rows.length; i++) {
                        const rowHTML = rows[i].innerHTML;
                        if (rowHTML.includes('InputScore(' + studentId + ')') ||
                            rowHTML.includes('CheckOutSectionNoScore(' + studentId) ||
                            rowHTML.includes('RefreshSign(' + studentId + ')') ||
                            rowHTML.includes('RefreshScore(' + studentId + ')')) {
                            matchedRow = rows[i];
                            break;
                        }
                    }

                    if (matchedRow) {
                        const targetRows = document.querySelectorAll('#checkInTable tbody tr');
                        let targetRow = null;
                        for (let i = 0; i < targetRows.length; i++) {
                            const rowHTML = targetRows[i].innerHTML;
                            if (rowHTML.includes('data-id="' + studentId + '"') ||
                                rowHTML.includes('InputScore(' + studentId + ')') ||
                                rowHTML.includes('CheckOutSectionNoScore(' + studentId) ||
                                rowHTML.includes('RefreshSign(' + studentId + ')') ||
                                rowHTML.includes('RefreshScore(' + studentId + ')')) {
                                targetRow = targetRows[i];
                                break;
                            }
                        }

                        if (targetRow) {
                            // Reset the row content and allow injectRowUI to reprocess it
                            targetRow.innerHTML = matchedRow.innerHTML;
                            targetRow.removeAttribute('data-e360-processed');

                            // Remove any injected card headers to prevent duplicates
                            const cardHeader = targetRow.querySelector('.e360-card-header');
                            if (cardHeader) cardHeader.remove();

                            // Re-run the injection
                            injectRowUI();

                            const newStatusDiv = targetRow.querySelector('.e360-status[data-id="' + studentId + '"]');
                            if (newStatusDiv) {
                                newStatusDiv.style.display = 'block';
                                newStatusDiv.innerText = '✅ Xong';
                                newStatusDiv.style.color = '#10b981';
                            }
                        }
                    }
                })
                .catch(function (err) {
                    console.error("Lỗi đồng bộ điểm:", err);
                    if (statusDiv) {
                        statusDiv.innerText = '❌ Lỗi đồng bộ: ' + err.message;
                        statusDiv.style.color = '#ef4444';
                    }
                });
        }
    }

    function initIndexPage() {
        if (document.body.dataset.e360IndexInjected === "1") return;
        document.body.dataset.e360IndexInjected = "1";

        // Viewport config
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = "viewport";
            meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
            document.head.appendChild(meta);
        }

        // Inject Stylesheet
        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide sidebar, headers and footers on mobile index page */
            @media (max-width: 767px) {
                .main-header, .main-sidebar, .main-footer { display: none !important; }
                .wrapper, .content-wrapper { margin-left: 0 !important; padding: 0 !important; background: #f8fafc !important; }
                .content { padding: 8px !important; }
                .box { border: none !important; box-shadow: none !important; background: transparent !important; margin: 0 !important; }
                .box-body { padding: 0 !important; }
                .dataTables_wrapper { padding: 0 !important; }
                .datatable-menu-title { display: none !important; }
                
                #scheduleTable_wrapper .row:first-child,
                #scheduleTable_wrapper .row:last-child {
                    display: none !important; /* Hide datatable headers/footers entries text */
                }

                #scheduleTable {
                    display: block !important;
                    width: 100% !important;
                    border: none !important;
                    background: transparent !important;
                }
                #scheduleTable thead { display: none !important; }
                #scheduleTable tbody { display: block !important; width: 100% !important; }
                #scheduleTable tbody tr {
                    display: flex !important;
                    flex-direction: column !important;
                    background: #fff !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 12px !important;
                    padding: 12px !important;
                    margin-bottom: 12px !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important;
                    box-sizing: border-box !important;
                }

                .e360-index-card {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    text-align: left;
                }
                .e360-index-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 6px;
                    margin-bottom: 2px;
                }
                .e360-index-card-class {
                    font-size: 15px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .e360-index-card-room {
                    font-size: 13px;
                    font-weight: 700;
                    color: #0284c7;
                    background: #e0f2fe;
                    padding: 2px 8px;
                    border-radius: 12px;
                }
                .e360-index-card-subject {
                    font-size: 14px;
                    font-weight: 700;
                    color: #334155;
                }
                .e360-index-card-time {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                }
                .e360-index-card-plan {
                    font-size: 12px;
                    color: #94a3b8;
                    font-family: monospace;
                }
                .e360-index-card-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 2px;
                }
                .e360-index-card-badges span {
                    display: inline-block !important;
                    padding: 4px 8px !important;
                    border-radius: 6px !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                }
                .e360-index-card-action {
                    margin-top: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .e360-index-card-action .btn,
                .e360-index-card-action span {
                    width: 100% !important;
                    height: 42px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 14px !important;
                    font-weight: bold !important;
                    border-radius: 8px !important;
                    margin: 0 !important;
                }
                .e360-index-card-action span.lbl-warning,
                .e360-index-card-action span.lbl-danger {
                    background: #fef3c7 !important;
                    color: #d97706 !important;
                    border: 1px solid #fde68a !important;
                }
                .e360-index-card-action span.lbl-danger {
                    background: #fee2e2 !important;
                    color: #dc2626 !important;
                    border: 1px solid #fca5a5 !important;
                }

                /* Header controls mobile view */
                .content-header {
                    padding: 12px !important;
                    background: #fff !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                }
                .content-header h1 {
                    font-size: 16px !important;
                    font-weight: bold !important;
                    margin: 0 !important;
                    color: #0f172a !important;
                }
                .main-action {
                    display: flex !important;
                    gap: 6px !important;
                    width: 100% !important;
                }
                .main-action input[type="search"] {
                    flex-grow: 1 !important;
                    height: 38px !important;
                    border: 1.5px solid #cbd5e1 !important;
                    border-radius: 8px !important;
                    padding: 0 10px !important;
                    font-size: 14px !important;
                    background: #fff !important;
                }
                .main-action .btn {
                    height: 38px !important;
                    padding: 0 12px !important;
                    font-weight: bold !important;
                    font-size: 13px !important;
                    border-radius: 8px !important;
                }
            }
        `;
        document.head.appendChild(style);

        // Run card injection loop
        function injectIndexRowUI() {
            const table = document.getElementById('scheduleTable');
            if (!table) return;
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(function (row) {
                if (row.querySelector('.dataTables_empty')) return;
                if (row.getAttribute('data-e360-processed') === 'true') return;
                if (row.cells.length < 11) return;

                const cell0 = row.cells[0]; // STT
                const cell1 = row.cells[1]; // Kế hoạch thi / Code text
                const cell2 = row.cells[2]; // GT
                const cell3 = row.cells[3]; // Lớp
                const cell4 = row.cells[4]; // Mã môn
                const cell5 = row.cells[5]; // Tên môn
                const cell6 = row.cells[6]; // T/g bđ
                const cell7 = row.cells[7]; // T/g kt
                const cell8 = row.cells[8]; // Phòng
                const cell9 = row.cells[9]; // Ghi chú
                const cell10 = row.cells[10]; // Action

                if (window.innerWidth < 768) {
                    row.setAttribute('data-e360-processed', 'true');

                    const classCode = cell3.innerText.trim();
                    const subject = cell5.innerText.trim() + " (" + cell4.innerText.trim() + ")";
                    const timeRange = cell6.innerText.trim() + " - " + cell7.innerText.trim();
                    const room = cell8.innerText.trim();
                    const proctor = cell2.innerText.trim();

                    const planLines = cell1.innerText.split('\n');
                    const planCode = planLines[0].trim();

                    const planBadges = Array.from(cell1.querySelectorAll('.lbl-warning, .lbl-danger, .lbl-success, span'))
                        .map(el => el.outerHTML)
                        .join(' ');

                    const actionHTML = cell10.innerHTML;

                    // Hide cells 0 to 9 programmatically
                    for (let i = 0; i < 10; i++) {
                        row.cells[i].style.setProperty('display', 'none', 'important');
                    }
                    cell10.style.setProperty('display', 'block', 'important');
                    cell10.style.setProperty('width', '100%', 'important');

                    // Inject custom card into cell 10
                    cell10.innerHTML = `
                        <div class="e360-index-card">
                            <div class="e360-index-card-header">
                                <span class="e360-index-card-class">${classCode}</span>
                                <span class="e360-index-card-room">Phòng: ${room}</span>
                            </div>
                            <div class="e360-index-card-subject">${subject}</div>
                            <div class="e360-index-card-time">🕒 Ca thi: ${timeRange} | GT: ${proctor}</div>
                            <div class="e360-index-card-plan">Mã ca: ${planCode}</div>
                            ${planBadges ? `<div class="e360-index-card-badges">${planBadges}</div>` : ''}
                            <div class="e360-index-card-action">${actionHTML}</div>
                        </div>
                    `;
                }
            });
        }

        setTimeout(injectIndexRowUI, 300);
        setInterval(injectIndexRowUI, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
