/* state/active-workout-storage.js — сохранение/восстановление незавершённой тренировки.
   Это «черновик» текущей сессии (состояние), а не архивные данные. */
'use strict';

const ACTIVE_KEY = 'twa_fitness_active_workout_' + USER_ID;
function saveActiveWorkout() { try { if (state.activeWorkout && typeof state.activeWorkout === 'object') localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.activeWorkout)); else localStorage.removeItem(ACTIVE_KEY); } catch (e) { console.error('saveActiveWorkout failed', e); } }
function restoreActiveWorkout() {
    try {
        const saved = localStorage.getItem(ACTIVE_KEY);
        if (!saved) return false;
        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.startTime || !Array.isArray(parsed.exercises)) { localStorage.removeItem(ACTIVE_KEY); return false; }
        state.activeWorkout = parsed;
        return true;
    } catch (e) { console.error('restoreActiveWorkout failed', e); localStorage.removeItem(ACTIVE_KEY); return false; }
}
