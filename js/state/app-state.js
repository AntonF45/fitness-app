/* state/app-state.js — единый mutable-стейт приложения: текущий экран/вкладка, фильтры
   статистики, редактируемая программа, активная тренировка. Единственный источник истины. */
'use strict';

let state = { currentScreen: 'programs', currentTab: 'programs', activeWorkout: null, editingProgram: null, workoutTimer: null, selectedMuscleGroup: 'Грудь', selectedExercise: null, supersetActiveId: null, selectedPeriod: 'all', selectedMonthKey: null, selectedExerciseMetric: 'weight' };
