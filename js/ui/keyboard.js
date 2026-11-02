/* ui/keyboard.js — реакция на системную клавиатуру: на время ввода скрываем
   плавающие кнопки и нижнюю навигацию (класс keyboard-open на <body>). */
'use strict';

const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let keyboardRestoreTimer = null;
let baseViewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;

function isTextEntryField(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    if (el.tagName === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        return ['text', 'number', 'search', 'email', 'url', 'tel', 'password'].indexOf(type) !== -1;
    }
    return false;
}
function setKeyboardOpen(open) { document.body.classList.toggle('keyboard-open', !!open); }

document.addEventListener('focusin', function (e) {
    if (!isTouchDevice) return;
    if (isTextEntryField(e.target)) {
        if (keyboardRestoreTimer) { clearTimeout(keyboardRestoreTimer); keyboardRestoreTimer = null; }
        setKeyboardOpen(true);
    }
});
document.addEventListener('focusout', function (e) {
    if (!isTouchDevice) return;
    if (isTextEntryField(e.target)) {
        keyboardRestoreTimer = setTimeout(function () {
            keyboardRestoreTimer = null;
            if (!isTextEntryField(document.activeElement)) setKeyboardOpen(false);
        }, 120);
    }
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
        if (!isTouchDevice) return;
        const h = window.visualViewport.height;
        if (!document.body.classList.contains('keyboard-open')) {
            if (h > baseViewportHeight) baseViewportHeight = h;
            return;
        }
        if (h >= baseViewportHeight - 60) setKeyboardOpen(false);
    });
}

document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && state.currentScreen === 'workout' && state.activeWorkout) startTimer(); });
