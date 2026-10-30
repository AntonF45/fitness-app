/* core/utils.js — экранирование HTML, генерация id, доменные словари, валидация веса/повторений.
   Базовый слой: не знает ни о UI, ни о хранилище, ни о Telegram. */
'use strict';

function escHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('`', '&#96;');
}
function escAttr(value) { return escHtml(value); }
function esc(str) { return escHtml(str); }
function createId() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }

const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const WEEKDAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DEFAULT_MUSCLE_GROUPS = ['Грудь','Спина','Ноги','Плечи','Руки'];

const WEIGHT_MIN = 0, WEIGHT_MAX = 1000, REPS_MIN = 0, REPS_MAX = 100;
function parseWeight(value) { if (value === '' || value === null || value === undefined) return 0; const n = Number(value); if (!isFinite(n) || isNaN(n)) return null; if (n < WEIGHT_MIN || n > WEIGHT_MAX) return null; return Math.round(n * 10) / 10; }
function parseReps(value) { if (value === '' || value === null || value === undefined) return 0; const n = parseInt(value, 10); if (isNaN(n) || !isFinite(n)) return null; if (n < REPS_MIN || n > REPS_MAX) return null; return n; }
function adjustWeight(current, delta) { const base = Number(current) || 0; return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Math.round((base + delta) * 10) / 10)); }
function adjustReps(current, delta) { const base = parseInt(current, 10) || 0; return Math.max(REPS_MIN, Math.min(REPS_MAX, base + delta)); }
