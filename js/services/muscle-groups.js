/* services/muscle-groups.js — хранение настраиваемого списка групп мышц пользователя. */
'use strict';

function getMuscleGroups() { try { const saved = localStorage.getItem('twa_fitness_muscle_groups_' + USER_ID); return saved ? JSON.parse(saved) : [...DEFAULT_MUSCLE_GROUPS]; } catch (e) { return [...DEFAULT_MUSCLE_GROUPS]; } }
function saveMuscleGroups(groups) { try { localStorage.setItem('twa_fitness_muscle_groups_' + USER_ID, JSON.stringify(groups)); } catch (e) {} }
