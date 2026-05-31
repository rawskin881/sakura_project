class ChatEngine {
  constructor() {
    this.context = {
      lastTopic: null,
      lastIntent: null,
      history: [], // { role: 'user'|'bot', text: string, timestamp }
      userLevel: 'beginner' // beginner | intermediate | advanced
    };
    
    this.intents = this._buildIntentMap();
  }

  _buildIntentMap() {
    const intents = new Map();
    
    // Mapping: intent -> { patterns: RegExp[], handler: fn, followUp: string[] }
    
    intents.set('greeting', {
      patterns: [/^(halo|hai|hey|hello|kon(nichiwa|banwa)|ohayou)/i],
      handler: () => this._greetingResponse(),
      followUp: ['meaning', 'practice', 'lesson']
    });
    
    intents.set('meaning', {
      patterns: [
        /apa arti(nya)?\s+(.+)/i,
        /arti\s+(.+)/i,
        /(.+)\s+(artinya apa|berarti apa)/i,
        /translate\s+(.+)/i
      ],
      handler: (match, raw) => this._meaningResponse(match, raw),
      followUp: ['example', 'pronunciation', 'related']
    });
    
    intents.set('grammar', {
      patterns: [
        /(partikel|particle)\s+(.+)/i,
        /(pola|pattern)\s+(.+)/i,
        /bagaimana\s+(cara|bentuk)/i,
        /(wa|ga|o|ni|de|to|ka|mo|no)\s+(penggunaan|guna)/i
      ],
      handler: (match, raw) => this._grammarResponse(match, raw),
      followUp: ['example', 'practice', 'compare']
    });
    
    intents.set('practice', {
      patterns: [
        /(latihan|practice|drill|uji)/i,
        /(quiz|kuis|tes)/i,
        /(coba|test)\s+saya/i
      ],
      handler: () => this._practiceResponse(),
      followUp: ['grammar', 'vocab', 'meaning']
    });
    
    intents.set('lesson', {
      patterns: [
        /(pelajaran|lesson|belajar|materi)\s+(.+)/i,
        /(ajari|teach)\s+saya/i,
        /mulai\s+dari\s+(mana|awal)/i
      ],
      handler: (match, raw) => this._lessonResponse(match, raw),
      followUp: ['practice', 'meaning', 'grammar']
    });
    
    intents.set('vocab_category', {
      patterns: [
        /(kosakata|vocab|kata)\s+(tentang|ttg|mengenai)?\s*(.+)/i,
        /kata\s+(.+)/i
      ],
      handler: (match, raw) => this._vocabCategoryResponse(match, raw),
      followUp: ['meaning', 'practice', 'example']
    });
    
    intents.set('compare', {
      patterns: [
        /(beda(nya)?|perbedaan|compare)\s+(antara\s+)?(.+)\s+dan\s+(.+)/i,
        /(.+)\s+vs\s+(.+)/i
      ],
      handler: (match, raw) => this._compareResponse(match, raw),
      followUp: ['example', 'practice']
    });
    
    // Fallback
    intents.set('unknown', {
      patterns: [/.*/],
      handler: (match, raw) => this._fallbackResponse(raw),
      followUp: ['lesson', 'practice', 'greeting']
    });
    
    return intents;
  }

  async process(input) {
    const normalized = input.toLowerCase().trim();
    
    // Update history
    this.context.history.push({ role: 'user', text: input, timestamp: Date.now() });
    if (this.context.history.length > 10) this.context.history.shift();
    
    // Cari intent
    let matchedIntent = 'unknown';
    let matchResult = null;
    
    for (const [intent, data] of this.intents) {
      if (intent === 'unknown') continue;
      for (const pattern of data.patterns) {
        const match = normalized.match(pattern);
        if (match) {
          matchedIntent = intent;
          matchResult = match;
          break;
        }
      }
      if (matchedIntent !== 'unknown') break;
    }
    
    // Context-aware: jika tidak ada match, cek follow-up dari intent sebelumnya
    if (matchedIntent === 'unknown' && this.context.lastIntent) {
      const lastIntentData = this.intents.get(this.context.lastIntent);
      if (lastIntentData?.followUp) {
        // Cek apakah input cocok dengan follow-up patterns
        for (const followUp of lastIntentData.followUp) {
          const fuData = this.intents.get(followUp);
          for (const pattern of fuData.patterns) {
            const match = normalized.match(pattern);
            if (match) {
              matchedIntent = followUp;
              matchResult = match;
              break;
            }
          }
        }
      }
    }
    
    const intentData = this.intents.get(matchedIntent);
    const response = await intentData.handler(matchResult, input);
    
    this.context.lastIntent = matchedIntent;
    this.context.lastTopic = this._extractTopic(input);
    
    // Simpan response ke history
    this.context.history.push({ role: 'bot', text: response.text, timestamp: Date.now() });
    
    return {
      text: response.text,
      expr: response.expr || 'thinking',
      quickReplies: this._generateQuickReplies(matchedIntent),
      suggestedAction: response.action || null
    };
  }

  _extractTopic(input) {
    // Ekstrak kata kunci Jepang atau topik utama
    const jpMatch = input.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/);
    if (jpMatch) return jpMatch[0];
    
    const topicWords = ['arigatou', 'sumimasen', 'konnichiwa', 'ohayou', 'sayonara', 
      'wa', 'ga', 'o', 'ni', 'de', 'kata kerja', 'angka', 'waktu'];
    for (const word of topicWords) {
      if (input.toLowerCase().includes(word)) return word;
    }
    return null;
  }

  _generateQuickReplies(intent) {
    const replies = {
      greeting: ['Apa arti arigatou?', 'Ajari saya partikel は', 'Mulai latihan'],
      meaning: ['Contoh penggunaan', 'Pengucapan', 'Kata terkait'],
      grammar: ['Contoh kalimat', 'Perbedaan dengan が', 'Latihan soal'],
      practice: ['Quiz kata', 'Quiz grammar', 'Flashcard'],
      lesson: ['Pelajaran salam', 'Pelajaran angka', 'Pelajaran kata kerja'],
      compare: ['Contoh は', 'Contoh が', 'Latihan partikel'],
      unknown: ['Pelajaran dasar', 'Kosakata umum', 'Tata bahasa']
    };
    return replies[intent] || replies.unknown;
  }

  // --- Response Generators ---

  _greetingResponse() {
    const hour = new Date().getHours();
    let greeting = 'こんにちは';
    let timeGreeting = 'Selamat siang';
    
    if (hour < 11) { greeting = 'おはようございます'; timeGreeting = 'Selamat pagi'; }
    else if (hour >= 18) { greeting = 'こんばんは'; timeGreeting = 'Selamat malam'; }
    
    return {
      text: `${greeting}! ${timeGreeting}!\n\nHari ini kita bisa belajar:\n• Kosakata baru\n• Tata bahasa dasar\n• Atau latihan dengan quiz\n\nMau mulai dari mana?`,
      expr: 'happy'
    };
  }

  _meaningResponse(match, raw) {
    // Extract kata yang ditanyakan
    const keyword = match[2] || match[1] || match[0];
    
    // Cari di database
    const found = this._searchInDatabase(keyword);
    
    if (found) {
      return {
        text: `**${found.jp}** (${found.rom})\n\nArti: ${found.id}\n\n${found.context ? `Konteks: ${found.context}` : ''}`,
        expr: 'happy',
        action: { type: 'speak', text: found.jp }
      };
    }
    
    // Coba fuzzy search
    const fuzzy = this._fuzzySearch(keyword);
    if (fuzzy) {
      return {
        text: `Mungkin maksudmu **${fuzzy.jp}**? (${fuzzy.rom})\n\nArtinya: ${fuzzy.id}\n\nKetik "ya" untuk detail lebih.`,
        expr: 'thinking'
      };
    }
    
    return {
      text: `Maaf, aku belum mengenal kata "${keyword}".\n\nCoba cari di menu Kosakata, atau tanyakan kata lain seperti "arigatou" atau "sumimasen".`,
      expr: 'sad'
    };
  }

  _grammarResponse(match, raw) {
    const particle = (match[2] || match[1] || '').toLowerCase();
    
    const grammarDB = {
      'wa': { pattern: 'AはBです', meaning: 'A adalah B', explain: 'Partikel は menandai topik kalimat. Baca "wa" meski tulisannya は.' },
      'ga': { pattern: 'AがBです', meaning: 'A (subjek) adalah B', explain: 'が menandai subjek baru atau informasi yang belum diketahui pendengar.' },
      'o': { pattern: 'AをBます', meaning: 'Melakukan B terhadap A', explain: 'を menandai objek langsung kata kerja. Baca "o".' },
      'ni': { pattern: 'AにB', meaning: 'Ke/Di A', explain: 'に untuk arah (pergi ke) atau keberadaan (ada di).' },
      'de': { pattern: 'AでB', meaning: 'Melakukan B di A', explain: 'で untuk tempat terjadinya aksi.' }
    };
    
    const g = grammarDB[particle];
    if (g) {
      return {
        text: `**Partikel ${particle}**\n\nPola: ${g.pattern}\nArti: ${g.meaning}\n\n${g.explain}\n\nMau lihat contoh kalimat?`,
        expr: 'thinking'
      };
    }
    
    return {
      text: `Partikel yang tersedia:\n• **は** (wa) - topik\n• **が** (ga) - subjek\n• **を** (o) - objek\n• **に** (ni) - arah/tempat\n• **で** (de) - tempat aksi\n\nTanyakan salah satu untuk detail!`,
      expr: 'thinking'
    };
  }

  _practiceResponse() {
    return {
      text: `Mau latihan apa?\n\n🎯 **Quiz** - Pilih jawaban benar\n🃏 **Flashcard** - Balik kartu untuk belajar\n🎮 **Speed Match** - Cocokkan kana dengan cepat\n\nPilih dari menu atas atau ketik "quiz" / "flashcard"!`,
      expr: 'happy'
    };
  }

  _lessonResponse(match, raw) {
    const topic = (match[2] || '').toLowerCase();
    
    const lessons = {
      'salam': { title: 'Salam Dasar', items: ['おはよう', 'こんにちは', 'こんばんは', 'さようなら'] },
      'angka': { title: 'Angka 1-10', items: ['いち', 'に', 'さん', 'よん', 'ご'] },
      'kata kerja': { title: 'Kata Kerja Dasar', items: ['食べる', '飲む', '行く', '来る', '見る'] }
    };
    
    const lesson = lessons[topic];
    if (lesson) {
      return {
        text: `**${lesson.title}**\n\n${lesson.items.map((item, i) => `${i+1}. ${item}`).join('\n')}\n\nKetik nomor untuk arti dan pengucapan!`,
        expr: 'happy'
      };
    }
    
    return {
      text: `Pelajaran yang tersedia:\n• Salam Dasar\n• Angka 1-10\n• Kata Kerja Dasar\n• Partikel は・が\n\nKetik "pelajaran [nama]" untuk memulai!`,
      expr: 'thinking'
    };
  }

  _compareResponse(match, raw) {
    const a = (match[4] || '').toLowerCase();
    const b = (match[5] || '').toLowerCase();
    
    if ((a === 'wa' || a === 'は') && (b === 'ga' || b === 'が')) {
      return {
        text: `**は (wa) vs が (ga)**\n\n**は** = Topik yang sudah diketahui\n→ 私は学生です (Saya [topik] mahasiswa)\n\n**が** = Subjek baru/fokus\n→ 誰が学生ですか (Siapa [fokus] yang mahasiswa?)\n\nRule of thumb: が jawab pertanyaan "siapa/apa", は jawab "bagaimana/tentang apa".`,
        expr: 'thinking'
      };
    }
    
    return {
      text: `Perbandingan yang bisa aku jelaskan:\n• は vs が (topik vs subjek)\n• に vs で (arah vs tempat aksi)\n• ます vs です (kata kerja vs kopula)\n\nKetik "beda [A] dan [B]"!`,
      expr: 'thinking'
      };
  }

  _fallbackResponse(raw) {
    const hasJP = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(raw);
    
    if (hasJP) {
      return {
        text: `Aku melihat karakter Jepang! Untuk sekarang, coba tanyakan:\n• "Apa arti [kata]?" untuk terjemahan\n• Atau kunjungi menu Kosakata untuk daftar lengkap`,
        expr: 'thinking'
      };
    }
    
    return {
      text: `Maaf, aku belum paham "${raw.substring(0, 30)}...".\n\nCoba ketik:\n• "Apa arti [kata]"\n• "Pelajaran salam"\n• "Partikel は"\n• "Latihan"`,
      expr: 'sad'
    };
  }

  // --- Database Search Helpers ---

  _searchInDatabase(keyword) {
    const allVocab = Object.values(APP_DATA.vocabulary).flat();
    const allPhrases = APP_DATA.phrases;
    
    const searchIn = (arr) => arr.find(item => 
      item.jp.includes(keyword) ||
      item.rom.toLowerCase().includes(keyword.toLowerCase()) ||
      item.id.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return searchIn(allVocab) || searchIn(allPhrases);
  }

  _fuzzySearch(keyword) {
    // Implementasi sederhana: cari substring match
    const allItems = [...Object.values(APP_DATA.vocabulary).flat(), ...APP_DATA.phrases];
    return allItems.find(item => 
      item.rom.toLowerCase().includes(keyword.toLowerCase().substring(0, 3)) ||
      item.id.toLowerCase().includes(keyword.toLowerCase().substring(0, 3))
    );
  }
}

const chatEngine = new ChatEngine();
