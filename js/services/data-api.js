/* services/data-api.js — единственный слой доступа к персистентным данным (localStorage).
   Знает схему данных и нормализует её при чтении; UI не работает с localStorage напрямую. */
'use strict';

const DataAPI = {
    _key(type) { return 'twa_fitness_' + type + '_' + USER_ID; },
    _safeRead(type, fallback) {
        try {
            const raw = localStorage.getItem(this._key(type));
            if (!raw) return fallback || [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : (fallback || []);
        } catch (err) { console.warn('DataAPI: corrupted ' + type, err); return fallback || []; }
    },
    _safeWrite(type, data) { try { localStorage.setItem(this._key(type), JSON.stringify(data)); return true; } catch (err) { console.error('DataAPI write failed', err); return false; } },
    getPrograms() {
        return this._safeRead('programs', []).map(function (p) {
            if (!p || typeof p !== 'object') return null;
            const prog = {
                id: p.id || createId(),
                name: String(p.name || ''),
                exercises: Array.isArray(p.exercises) ? p.exercises.map(function (ex) {
                    return {
                        id: (ex && ex.id) || createId(),
                        name: String((ex && ex.name) || ''),
                        muscleGroup: String((ex && ex.muscleGroup) || 'Другое'),
                        exerciseType: (ex && ex.exerciseType === 'bodyweight') ? 'bodyweight' : 'weighted',
                        supersetId: (ex && ex.supersetId) || null,
                        targetSets: Math.max(1, parseInt(ex && ex.targetSets, 10) || 3),
                        targetReps: Math.max(1, parseInt(ex && ex.targetReps, 10) || 10)
                    };
                }) : []
            };
            normalizeSupersets(prog.exercises);
            return prog;
        }).filter(function (p) { return p !== null; });
    },
    savePrograms(data) { this._safeWrite('programs', data); },
    getHistory() { return this._safeRead('history', []).filter(function (e) { return e && typeof e === 'object' && e.id && e.date; }); },
    saveHistory(data) { this._safeWrite('history', data); },
    getProgramById(id) { return this.getPrograms().find(function (p) { return p.id === id; }); },
    getHistoryEntryById(id) { return this.getHistory().find(function (e) { return e.id === id; }); },
    getUserExercises() {
        const map = new Map();
        const add = function (ex) { if (!ex || !ex.name) return; const name = String(ex.name).trim(); if (!name || map.has(name)) return; map.set(name, { name: name, muscleGroup: String(ex.muscleGroup || 'Другое'), exerciseType: ex.exerciseType === 'bodyweight' ? 'bodyweight' : 'weighted' }); };
        this.getPrograms().forEach(function (p) { (p.exercises || []).forEach(add); });
        this.getHistory().forEach(function (e) { (e.exercises || []).forEach(add); });
        return Array.from(map.values());
    },
    getExerciseHistory(exerciseName) {
        if (!exerciseName) return [];
        const results = [];
        this.getHistory().forEach(function (entry) {
            if (!entry || !Array.isArray(entry.exercises)) return;
            entry.exercises.forEach(function (ex) {
                if (!ex || ex.name !== exerciseName || !Array.isArray(ex.sets)) return;
                ex.sets.forEach(function (set) {
                    if (!set || typeof set !== 'object') return;
                    const w = Number(set.weight), r = Number(set.reps);
                    if (!isFinite(w) || !isFinite(r)) return;
                    results.push({ date: entry.date, weight: Math.max(0, w), reps: Math.max(0, Math.floor(r)) });
                });
            });
        });
        return results.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    }
};
