/* services/muscle-groups.js — хранение настраиваемого списка групп мышц пользователя. */
'use strict';

function getMuscleGroups() { try { const saved = localStorage.getItem('twa_fitness_muscle_groups_' + USER_ID); const groups = saved ? JSON.parse(saved) : [...DEFAULT_MUSCLE_GROUPS];
    /* Дефолтные группы догоняются автоматически: старый сохранённый список
       пользователя не содержит новых групп по умолчанию (например «Пресс») —
       без этого они не появлялись ни в управлении группами, ни в автоподсказках. */
    let changed = false;
    DEFAULT_MUSCLE_GROUPS.forEach(function (g) { if (!groups.some(function (x) { return String(x).toLowerCase() === g.toLowerCase(); })) { groups.push(g); changed = true; } });
    if (changed) saveMuscleGroups(groups);
    return groups; } catch (e) { return [...DEFAULT_MUSCLE_GROUPS]; } }
function saveMuscleGroups(groups) { try { localStorage.setItem('twa_fitness_muscle_groups_' + USER_ID, JSON.stringify(groups)); } catch (e) {} }
