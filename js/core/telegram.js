/* core/telegram.js — обёртка над Telegram WebApp SDK: инициализация, полноэкранный режим,
   haptic-отклик, нативные диалоги, кнопки Back/Main. */
'use strict';

const tg = window.Telegram.WebApp;
const TG_PLATFORM = String(tg.platform || '').toLowerCase();
const IS_MOBILE = (TG_PLATFORM === 'android' || TG_PLATFORM === 'ios');
let appFullscreen = false;

try {
    tg.ready();
    tg.expand();
    // Отключаем вертикальное масштабирование: пока включён pull-to-refresh,
    // свайп сверху вниз сворачивает приложение даже в полноэкранном режиме.
    if (tg.disableVerticalSwipes) { try { tg.disableVerticalSwipes(); } catch (e) {} }
    if (tg.setHeaderColor) tg.setHeaderColor('bg_color');
    if (tg.setBackgroundColor) tg.setBackgroundColor('bg_color');
} catch (e) { console.warn('Telegram init error:', e); }

// Полноэкранный режим — ТОЛЬКО на смартфонах
function enterMobileFullscreen() {
    if (!IS_MOBILE || !tg.requestFullscreen) return;
    try {
        const p = tg.requestFullscreen();
        if (p && p.then) {
            p.then(function () { appFullscreen = true; applySafeAreaInsets(); })
             .catch(function () { appFullscreen = false; });
        } else { appFullscreen = true; applySafeAreaInsets(); }
    } catch (e) { appFullscreen = false; }
    // После входа в fullscreen ещё раз гасим вертикальные свайпы (гарантия порядка вызовов).
    if (tg.disableVerticalSwipes) { try { tg.disableVerticalSwipes(); } catch (e) {} }
}
// Страховка: если хост-клиент сбросил флаг (например, после ресizer/перехода), восстанавливаем.
try {
    if (tg.onEvent) {
        tg.onEvent('resize', function () {
            if (tg.disableVerticalSwipes) { try { tg.disableVerticalSwipes(); } catch (e) {} }
        });
    }
} catch (e) {}
function currentFullscreen() {
    if (typeof tg.isFullscreen === 'boolean') return tg.isFullscreen;
    return appFullscreen;
}

const USER_ID = tg.initDataUnsafe?.user?.id || 'local_test_user_' + Math.random().toString(36).substr(2, 9);

function haptic(type) { try { if (type === 'success' || type === 'error' || type === 'warning') tg.HapticFeedback?.notificationOccurred(type); else tg.HapticFeedback?.impactOccurred(type || 'light'); } catch (e) {} }
function showAlert(message) { try { tg.showAlert(message); } catch (e) { alert(message); } }
function showConfirm(message, callback) { try { tg.showConfirm(message, callback); } catch (e) { callback(confirm(message)); } }
try { tg.BackButton.onClick(function () { navigateBack(); }); } catch (e) {}
function updateBackButton(isSubScreen) { try { if (isSubScreen) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) {} }
function clearMainButton() { try { tg.MainButton.hide(); } catch (e) {} }
