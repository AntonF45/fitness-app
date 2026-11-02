/* core/navigation.js — маршрутизация между экранами и вкладками, состояние TabBar,
   кнопка «Назад». Не знает деталей рендеринга — только вызывает render*-функции экранов. */
'use strict';

function updateTabUI(activeTab) { ['stats','programs','history'].forEach(function (tab) { const b = document.getElementById('tab-' + tab); if (!b) return; if (tab === activeTab) { b.classList.remove('text-tgHint'); b.classList.add('text-tgLink'); b.setAttribute('aria-selected', 'true'); } else { b.classList.remove('text-tgLink'); b.classList.add('text-tgHint'); b.setAttribute('aria-selected', 'false'); } }); }
function openProgramsScreen() { state.currentTab = 'programs'; state.currentScreen = 'programs'; updateTabUI('programs'); updateBackButton(false); clearMainButton(); renderPrograms(); }
function navigateToTab(tab) { state.currentTab = tab; updateTabUI(tab); navigate(tab); }
function switchTab(tab) { if (state.currentScreen === 'workout' && state.activeWorkout && tab !== 'workout') { promptWorkoutExit(tab); return; } haptic('light'); navigateToTab(tab); }
function navigateBack() { if (state.currentScreen === 'workout' && state.activeWorkout) { promptWorkoutExit('programs'); return; } haptic('light'); const tabMap = { program_edit: 'programs', history_detail: 'history', workout: 'programs' }; navigateToTab(tabMap[state.currentScreen] || state.currentTab || 'programs'); }
function navigate(screen, data) {
    data = data || {};
    haptic('light'); stopWorkoutTimer();
    state.currentScreen = screen; state.supersetActiveId = null;
    if (data.programId !== undefined) state.editingProgram = data.programId ? DataAPI.getProgramById(data.programId) : { name: '', exercises: [] };
    updateBackButton(['program_edit','history_detail','workout'].indexOf(screen) !== -1);
    clearMainButton();
    if (screen === 'stats') renderStats();
    else if (screen === 'programs') renderPrograms();
    else if (screen === 'program_edit') renderProgramEdit();
    else if (screen === 'workout') renderWorkout();
    else if (screen === 'history') renderHistory();
    else if (screen === 'history_detail') renderHistoryDetail(data.entryId);
}
