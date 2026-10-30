/* All user-visible text lives here. Add a language by adding a key under STRINGS. */
(function (root) {
  'use strict';
  var STRINGS = {
    en: {
      appTitle: 'Daily Slide',
      loading: 'Loading...',
      tagline: 'A new sliding puzzle every day',
      todayPuzzle: "Today's puzzle",
      todaySolved: "Today's puzzle solved",
      todayInfo: '{size} x {size}, the same puzzle for everyone today',
      todayResume: 'In progress: {moves} moves',
      todayNext: 'Next one in {time}',
      streakLine: 'Daily streak: {n}',
      streakNone: "Solve today's puzzle to start a streak",
      practice: 'Practice',
      stats: 'Stats',
      moves: 'Moves',
      time: 'Time',
      par: 'Par',
      streak: 'Streak',
      undo: 'Undo',
      peek: 'Target',
      peekAria: 'Show target picture',
      numbers: 'Numbers',
      numbersShort: '123',
      menu: 'Home',
      daily: 'Daily {size}x{size}',
      practiceMode: 'Practice {size}x{size}',
      parShort: 'Par {n}',
      solved: 'Solved!',
      solvedAlready: 'Already solved today',
      starsLabel: '{n} of 3 stars',
      nextDaily: 'Next daily puzzle in {time}',
      newDailyReady: "A new daily puzzle is ready",
      playToday: "Play today's puzzle",
      practiceAnother: 'Practice another',
      yourStats: 'Your stats',
      gamesPlayed: 'Games played',
      dailyStreak: 'Daily streak',
      bestStreak: 'Best streak',
      avgMoves: 'Average moves',
      totalStars: 'Daily stars',
      close: 'Close',
      boardLabel: 'Puzzle board, {size} by {size}. Slide tiles into the gap to restore the numbered order. Arrow keys move a tile in that direction.',
      announceStart: '{mode} puzzle, {size} by {size}.',
      announceMove: 'Moved tile {tile}. {moves} moves.',
      announceMoveMany: 'Moved {count} tiles. {moves} moves.',
      announceSolved: 'Solved in {moves} moves, {stars} stars.',
      targetShown: 'Showing the target picture',
      days: '{n} days',
      day: '1 day',
      modeDaily: 'Daily',
      modePractice: 'Practice',
      dailyDoneNote: "That is all of today's daily puzzles. Come back tomorrow, or practice as much as you like.",
      saveNoteFuture: 'Your progress was saved by a newer version. It is shown here but this session will not be saved.',
      saveNoteFailed: 'Saved progress could not be loaded. This session will not be saved.',
      saveNoteReset: 'Saved progress could not be read, so it was reset.',
      sizeBtn: '{size}x{size}',
      practiceLabel: 'Practice',
      peekOn: 'Target picture shown',
      noMovePossible: 'That tile cannot move.'
    }
  };
  function pick(tag) {
    var lang = String(tag || 'en');
    if (STRINGS[lang]) return STRINGS[lang];
    var base = lang.split('-')[0].toLowerCase();
    if (STRINGS[base]) return STRINGS[base];
    return STRINGS.en;
  }
  var active = STRINGS.en, activeTag = 'en', activeKey = 'en';
  var api = {
    STRINGS: STRINGS,
    setLanguage: function (tag) { active = pick(tag); activeTag = String(tag || 'en'); activeKey = (active === STRINGS.en) ? 'en' : (STRINGS[activeTag] ? activeTag : activeTag.split('-')[0].toLowerCase()); },
    resolved: function () { return activeKey; },
    getLanguage: function () { return activeTag; },
    t: function (key, vars) {
      var s = (active[key] !== undefined) ? active[key] : (STRINGS.en[key] !== undefined ? STRINGS.en[key] : key);
      if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
      return s;
    }
  };
  root.I18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
