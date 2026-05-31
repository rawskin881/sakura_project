class AppState {
  constructor() {
    this.data = {
      user: {
        id: 'main',
        xp: 0,
        level: 1,
        streak: 0,
        lastActive: null,
        dailyGoal: 20, // XP target per hari
        todayXP: 0
      },
      stats: {
        wordsLearned: 0,
        quizzesTaken: 0,
        gamesPlayed: 0,
        totalStudyTime: 0 // minutes
      },
      progress: {
        kana: { hiragana: new Set(), katakana: new Set() },
        vocab: { mastered: new Set(), learning: new Set(), seen: new Set() },
        grammar: { completed: new Set() }
      },
      session: {
        currentTab: 'chat',
        currentKanaSet: 'Hiragana',
        currentVocabCat: 'Salam',
        currentFlashcardCat: 'Salam',
        flashcardIdx: 0,
        flashcardFlipped: false,
        chatHistory: []
      },
      settings: {
        ttsRate: 0.85,
        ttsPitch: 1.15,
        autoPlayAudio: false,
        darkMode: true
      }
    };
    
    this.listeners = new Map();
    this.db = db;
  }

  // Subscribe ke perubahan state
  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  // Notify listeners
  _notify(key, value) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(value));
    }
  }

  // Get state (immutable copy)
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.data);
  }

  // Set state dengan persistence
  async set(path, value) {
    const keys = path.split('.');
    let target = this.data;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    
    const lastKey = keys[keys.length - 1];
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    this._notify(path, value);
    
    // Persist ke IndexedDB untuk data kritis
    if (path.startsWith('user.') || path.startsWith('stats.') || path === 'progress') {
      await this._persist();
    }
    
    return value;
  }

  // Update object secara partial
  async update(path, updater) {
    const current = this.get(path);
    const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    return this.set(path, updated);
  }

  async _persist() {
    await this.db.put('user', {
      id: 'main',
      user: this.data.user,
      stats: this.data.stats,
      progress: this._serializeProgress(this.data.progress),
      settings: this.data.settings,
      updatedAt: Date.now()
    });
  }

  async load() {
    const saved = await this.db.get('user', 'main');
    if (saved) {
      this.data.user = { ...this.data.user, ...saved.user };
      this.data.stats = { ...this.data.stats, ...saved.stats };
      this.data.progress = this._deserializeProgress(saved.progress || {});
      this.data.settings = { ...this.data.settings, ...saved.settings };
    }
    
    // Hitung streak
    this._checkStreak();
    
    return this.data;
  }

  _serializeProgress(progress) {
    return {
      kana: {
        hiragana: Array.from(progress.kana.hiragana),
        katakana: Array.from(progress.kana.katakana)
      },
      vocab: {
        mastered: Array.from(progress.vocab.mastered),
        learning: Array.from(progress.vocab.learning),
        seen: Array.from(progress.vocab.seen)
      },
      grammar: {
        completed: Array.from(progress.grammar.completed)
      }
    };
  }

  _deserializeProgress(saved) {
    return {
      kana: {
        hiragana: new Set(saved.kana?.hiragana || []),
        katakana: new Set(saved.kana?.katakana || [])
      },
      vocab: {
        mastered: new Set(saved.vocab?.mastered || []),
        learning: new Set(saved.vocab?.learning || []),
        seen: new Set(saved.vocab?.seen || [])
      },
      grammar: {
        completed: new Set(saved.grammar?.completed || [])
      }
    };
  }

  _checkStreak() {
    const today = new Date().toDateString();
    const last = this.data.user.lastActive;
    
    if (!last) {
      this.data.user.streak = 1;
    } else {
      const diff = Math.floor((new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        // Streak continues
      } else if (diff > 1) {
        this.data.user.streak = 0; // Broken streak
      }
    }
    
    if (last !== today) {
      this.data.user.todayXP = 0;
      this.data.user.lastActive = today;
    }
  }

  // Helper: Track item exposure
  async markSeen(type, itemId) {
    if (type === 'vocab') {
      await this.update('progress.vocab.seen', (set) => {
        set.add(itemId);
        return set;
      });
    }
  }

  // Helper: Track mastery
  async markMastered(type, itemId) {
    if (type === 'vocab') {
      await this.update('progress.vocab.mastered', (set) => {
        set.add(itemId);
        return set;
      });
      await this.update('progress.vocab.learning', (set) => {
        set.delete(itemId);
        return set;
      });
    }
  }
}

const state = new AppState();
