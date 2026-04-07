/**
 * bhatkhande.io — Composition Model
 * Data model for Tabla compositions with save/load and undo/redo.
 */

class Composition {
  static LEGACY_BUILT_IN_TITLE = 'Built-in Dilli Kayda';
  static LEGACY_BUILT_IN_NOTE = 'Starter Dilli kayda loaded as a built-in example composition.';

  constructor(taalId = 'teentaal', compositionType = 'theka') {
    this.id = this._generateId();
    this.title = 'Untitled Composition';
    this.taalId = taalId;
    this.compositionType = typeof normalizeCompositionTypeId === 'function'
      ? normalizeCompositionTypeId(compositionType)
      : compositionType;
    this.laya = 'madhya';
    this.gharana = '';
    this.guru = '';
    this.notes = '';
    this.sections = [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();

    this._undoStack = [];
    this._redoStack = [];
    this._maxHistory = 50;

    this._initDefault();
  }

  _initDefault() {
    const taal = TAAL_DATABASE[this.taalId];
    if (!taal) return;
    const defaultSection = typeof getDefaultSectionBlueprintForCompositionType === 'function'
      ? getDefaultSectionBlueprintForCompositionType(this.compositionType)
      : { type: 'custom', label: 'Section' };

    if (this.compositionType === 'theka') {
      this.addSection(defaultSection.type, defaultSection.label);
      const avartan = createThekaAvartan(taal);
      this.sections[0].avartans = [avartan];
    } else {
      this.addSection(defaultSection.type, defaultSection.label);
    }
  }

  _generateId() {
    return 'comp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  getTaal() {
    return TAAL_DATABASE[this.taalId] || null;
  }

  addSection(type = 'custom', label = 'New Section') {
    const taal = this.getTaal();
    if (!taal) return -1;
    const section = { type, label, avartans: [createEmptyAvartan(taal)] };
    this.sections.push(section);
    this._markUpdated();
    return this.sections.length - 1;
  }

  removeSection(sectionIdx) {
    if (this.sections.length <= 1) return false;
    this._saveUndoState();
    this.sections.splice(sectionIdx, 1);
    this._markUpdated();
    return true;
  }

  updateSectionLabel(sectionIdx, label) {
    if (this.sections[sectionIdx]) {
      this.sections[sectionIdx].label = label;
      this._markUpdated();
    }
  }

  updateSectionType(sectionIdx, type) {
    if (this.sections[sectionIdx]) {
      this.sections[sectionIdx].type = type;
      this._markUpdated();
    }
  }

  _isGenericPrimarySectionLabel(label) {
    const clean = String(label || '').trim().toLowerCase();
    return [
      'main', 'mukh', 'theme', 'theka', 'tihai', 'custom', 'section',
      'मुख', 'ठेका', 'तिहाई', 'अन्य'
    ].includes(clean);
  }

  _normalizeSectionsForCompositionType() {
    if (!Array.isArray(this.sections) || this.sections.length === 0) return;

    const defaultSection = typeof getDefaultSectionBlueprintForCompositionType === 'function'
      ? getDefaultSectionBlueprintForCompositionType(this.compositionType)
      : { type: 'custom', label: 'Section' };
    const expandable = typeof isExpandableCompositionType === 'function'
      ? isExpandableCompositionType(this.compositionType)
      : false;

    this.sections = this.sections.map((section, sectionIdx) => {
      if (!section) return section;

      const normalized = {
        ...section,
        type: section.type || 'custom',
        label: section.label || ''
      };

      if (!expandable) {
        if (normalized.type === 'mukh') {
          normalized.type = sectionIdx === 0 ? defaultSection.type : 'custom';
        }

        if (sectionIdx === 0 && this._isGenericPrimarySectionLabel(normalized.label)) {
          normalized.label = defaultSection.label;
        }
      } else if (sectionIdx === 0 && normalized.type === 'custom' && this._isGenericPrimarySectionLabel(normalized.label)) {
        normalized.type = 'mukh';
        normalized.label = 'Main';
      }

      return normalized;
    });
  }

  addAvartan(sectionIdx) {
    const taal = this.getTaal();
    const section = this.sections[sectionIdx];
    if (section && taal) {
      this._saveUndoState();
      section.avartans.push(createEmptyAvartan(taal));
      this._markUpdated();
      return section.avartans.length - 1;
    }
    return -1;
  }

  removeAvartan(sectionIdx, avartanIdx) {
    const section = this.sections[sectionIdx];
    if (section && section.avartans.length > 1) {
      this._saveUndoState();
      section.avartans.splice(avartanIdx, 1);
      this._markUpdated();
      return true;
    }
    return false;
  }

  duplicateAvartan(sectionIdx, avartanIdx) {
    const section = this.sections[sectionIdx];
    if (section && section.avartans[avartanIdx]) {
      this._saveUndoState();
      const clone = JSON.parse(JSON.stringify(section.avartans[avartanIdx]));
      section.avartans.splice(avartanIdx + 1, 0, clone);
      this._markUpdated();
      return avartanIdx + 1;
    }
    return -1;
  }

  setBol(sectionIdx, avartanIdx, matraIdx, bols) {
    const section = this.sections[sectionIdx];
    if (!section) return;
    const avartan = section.avartans[avartanIdx];
    if (!avartan) return;
    const matra = avartan.matras[matraIdx];
    if (!matra) return;

    this._saveUndoState();
    matra.bols = bols;
    this._markUpdated();
  }

  getBol(sectionIdx, avartanIdx, matraIdx) {
    try {
      return this.sections[sectionIdx].avartans[avartanIdx].matras[matraIdx].bols || [];
    } catch {
      return [];
    }
  }

  _isTihaiSection(section) {
    if (!section) return false;
    if (this.compositionType === 'tihai' || section.type === 'tihai') return true;
    return /(tihai|तिहाई)/i.test(section.label || '');
  }

  getLastFilledMatraIndex(sectionIdx, avartanIdx) {
    const section = this.sections[sectionIdx];
    const avartan = section && section.avartans ? section.avartans[avartanIdx] : null;
    if (!avartan || !Array.isArray(avartan.matras)) return -1;

    let lastFilled = -1;
    avartan.matras.forEach((matra, matraIdx) => {
      if (this._getMeaningfulBols(matra).length > 0) {
        lastFilled = matraIdx;
      }
    });
    return lastFilled;
  }

  _isRestBol(bol) {
    const clean = String(bol || '').trim().toLowerCase();
    return !clean || clean === 's' || clean === '-';
  }

  _getMeaningfulBols(matra) {
    if (!matra || !Array.isArray(matra.bols)) return [];
    return matra.bols.filter(bol => !this._isRestBol(bol));
  }

  _shouldCollapseToSingleSamDha(avartan) {
    if (!avartan || !Array.isArray(avartan.matras) || avartan.matras.length === 0) return false;

    const firstMeaningfulBols = this._getMeaningfulBols(avartan.matras[0]);
    if (firstMeaningfulBols.length !== 1) return false;
    if (String(firstMeaningfulBols[0]).trim().toLowerCase() !== 'dha') return false;

    return avartan.matras.slice(1).every(matra => this._getMeaningfulBols(matra).length === 0);
  }

  getRenderedMatraCount(sectionIdx, avartanIdx) {
    const taal = this.getTaal();
    const section = this.sections[sectionIdx];
    const avartan = section && section.avartans ? section.avartans[avartanIdx] : null;
    if (!taal || !section || !avartan) return 0;

    if (this._shouldCollapseToSingleSamDha(avartan)) {
      return 1;
    }

    const lastFilled = this.getLastFilledMatraIndex(sectionIdx, avartanIdx);
    const isTrimmedTihaiEnding = this._isTihaiSection(section) &&
      avartanIdx === section.avartans.length - 1 &&
      lastFilled >= 0 &&
      lastFilled < taal.matras - 1;

    return isTrimmedTihaiEnding ? lastFilled + 1 : taal.matras;
  }

  clearAvartan(sectionIdx, avartanIdx) {
    const section = this.sections[sectionIdx];
    if (!section) return;
    const avartan = section.avartans[avartanIdx];
    if (!avartan) return;

    this._saveUndoState();
    avartan.matras.forEach(m => { m.bols = []; });
    this._markUpdated();
  }

  generateLayakariSection(sectionIdx, speed = '1', speedName = '') {
    const taal = this.getTaal();
    const sourceSection = this.sections[sectionIdx];
    if (!sourceSection || !taal) return;

    this._saveUndoState();

    let N = 1, D = 1;
    if (typeof speed === 'string' && speed.includes('/')) {
      const parts = speed.split('/');
      N = parseInt(parts[0]);
      D = parseInt(parts[1]);
    } else {
      N = parseInt(speed);
      D = 1;
    }

    // Fractional layakaris are allowed for any section inside a Theka composition.
    if (D !== 1 && this.compositionType !== 'theka') {
      return -1;
    }

    // Extract raw matras linearly
    let sourceMatras = [];
    sourceSection.avartans.forEach(avartan => {
      avartan.matras.forEach(matra => {
        sourceMatras.push({ bols: [...(matra.bols || [])] });
      });
    });

    // Check if section is completely empty, fallback exactly to taal.theka
    const isEmpty = sourceMatras.every(m => m.bols.length === 0);
    if (isEmpty) {
      sourceMatras = taal.theka.map(b => ({ bols: [b] }));
      // Pad to fill avartan strictly if theka is shorter than avartan (e.g. rare generic cases)
      while (sourceMatras.length < taal.matras) sourceMatras.push({ bols: [] });
    }

    let resultMatras = [];

    if (D === 1) {
      // Repeat source matras N times
      let repeatedMatras = [];
      for (let n = 0; n < N; n++) {
        sourceMatras.forEach(m => repeatedMatras.push({ bols: [...m.bols] }));
      }

      // Chunk back into mathematically correct groups by N
      for (let i = 0; i < repeatedMatras.length; i += N) {
        let chunkBols = [];
        for (let j = 0; j < N; j++) {
           if (i + j < repeatedMatras.length) {
              const m = repeatedMatras[i + j];
              // If empty matra, add a rest to represent the space proportionately
              if (m.bols.length === 0) {
                 chunkBols.push('S');
              } else {
                 chunkBols.push(...m.bols);
              }
           }
        }
        resultMatras.push({ bols: chunkBols });
      }
    } else {
      // Existing math logic for fractions (Theka only)
      let flatBols = [];
      sourceMatras.forEach(m => {
        if (m.bols.length === 0) flatBols.push('S');
        else flatBols.push(...m.bols);
      });
      let numBolsNeeded = Math.ceil((taal.matras / D) * N);
      while(flatBols.length < numBolsNeeded) flatBols.push(...flatBols);
      flatBols = flatBols.slice(0, numBolsNeeded);

      const totalSubBeats = taal.matras * N;
      const subBeatsArray = new Array(totalSubBeats).fill('S');

      for (let i = 0; i < flatBols.length; i++) {
        const targetIndex = i * D;
        if (targetIndex < totalSubBeats) {
          subBeatsArray[targetIndex] = flatBols[i];
        }
      }

      for (let i = 0; i < taal.matras; i++) {
        const chunk = subBeatsArray.slice(i * N, (i + 1) * N);
        resultMatras.push({ bols: chunk });
      }
    }

    // Block into Avartans based on taal.matras
    let newAvartans = [];
    for (let i = 0; i < resultMatras.length; i += taal.matras) {
      let chunk = resultMatras.slice(i, i + taal.matras);
      while (chunk.length < taal.matras) {
        chunk.push({ bols: [] });
      }
      newAvartans.push({ matras: chunk });
    }

    const cleanLabel = sourceSection.label.split(' (')[0]; // Strip old speed name if compounding
    const newSection = {
      type: sourceSection.type,
      label: `${cleanLabel} (${speedName})`,
      avartans: newAvartans
    };

    // Insert new section explicitly after the source section
    this.sections.splice(sectionIdx + 1, 0, newSection);
    
    this._markUpdated();
    return sectionIdx + 1;
  }

  applyQuickEntry(sectionIdx, avartanIdx, startMatraIdx, bolEntries) {
    const section = this.sections[sectionIdx];
    if (!section) return { avartansFilled: 0, bolsPlaced: 0 };

    const taal = this.getTaal();
    if (!taal) return { avartansFilled: 0, bolsPlaced: 0 };

    this._saveUndoState();

    let currentAIdx = avartanIdx;
    let currentMIdx = startMatraIdx;
    let bolsPlaced = 0;
    const startingAvartans = section.avartans.length;

    for (let i = 0; i < bolEntries.length; i++) {
      if (currentMIdx >= taal.matras) {
        currentMIdx = 0;
        currentAIdx++;

        if (currentAIdx >= section.avartans.length) {
          section.avartans.push(createEmptyAvartan(taal));
        }
      }

      section.avartans[currentAIdx].matras[currentMIdx].bols = bolEntries[i];
      currentMIdx++;
      bolsPlaced++;
    }

    this._markUpdated();

    const avartansFilled = currentAIdx - avartanIdx + 1;
    const avartansCreated = section.avartans.length - startingAvartans;
    return { avartansFilled, avartansCreated, bolsPlaced };
  }

  changeTaal(newTaalId) {
    if (!TAAL_DATABASE[newTaalId]) return;
    this._saveUndoState();
    this.taalId = newTaalId;
    const newTaal = this.getTaal();

    this.sections.forEach(section => {
      section.avartans.forEach(avartan => {
        if (avartan.matras.length < newTaal.matras) {
          while (avartan.matras.length < newTaal.matras) {
            avartan.matras.push({ bols: [] });
          }
        } else if (avartan.matras.length > newTaal.matras) {
          avartan.matras = avartan.matras.slice(0, newTaal.matras);
        }
      });
    });

    this._markUpdated();
  }

  _saveUndoState() {
    const state = JSON.stringify(this.sections);
    this._undoStack.push(state);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  undo() {
    if (this._undoStack.length === 0) return false;
    this._redoStack.push(JSON.stringify(this.sections));
    this.sections = JSON.parse(this._undoStack.pop());
    this._markUpdated();
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;
    this._undoStack.push(JSON.stringify(this.sections));
    this.sections = JSON.parse(this._redoStack.pop());
    this._markUpdated();
    return true;
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  _markUpdated() {
    this.updatedAt = new Date().toISOString();
  }

  updateMetadata(data) {
    if (data.title !== undefined) this.title = data.title;
    if (data.compositionType !== undefined) {
      this.compositionType = typeof normalizeCompositionTypeId === 'function'
        ? normalizeCompositionTypeId(data.compositionType)
        : data.compositionType;
      this._normalizeSectionsForCompositionType();
    }
    if (data.laya !== undefined) this.laya = data.laya;
    if (data.gharana !== undefined) this.gharana = data.gharana;
    if (data.guru !== undefined) this.guru = data.guru;
    if (data.notes !== undefined) this.notes = data.notes;
    this._markUpdated();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      taalId: this.taalId,
      compositionType: this.compositionType,
      laya: this.laya,
      gharana: this.gharana,
      guru: this.guru,
      notes: this.notes,
      sections: JSON.parse(JSON.stringify(this.sections)),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(data) {
    const comp = new Composition(data.taalId || 'teentaal', data.compositionType || 'theka');
    comp.id = data.id || comp.id;
    comp.title = data.title || 'Untitled';
    comp.laya = data.laya || 'madhya';
    comp.gharana = data.gharana || '';
    comp.guru = data.guru || '';
    comp.notes = data.notes || '';

    comp.sections = (data.sections && data.sections.length > 0) ? data.sections : null;
    if (!comp.sections) {
      comp.sections = [];
      comp._initDefault();
    } else {
      comp._normalizeSectionsForCompositionType();
    }

    comp.createdAt = data.createdAt || comp.createdAt;
    comp.updatedAt = data.updatedAt || comp.updatedAt;
    return comp;
  }

  static STORAGE_KEY = 'bhatkhande_io_compositions';

  static _isLegacyBuiltIn(data) {
    return !!data &&
      data.title === Composition.LEGACY_BUILT_IN_TITLE &&
      data.notes === Composition.LEGACY_BUILT_IN_NOTE &&
      data.gharana === 'Delhi';
  }

  static _isPristineUntitledData(data) {
    if (
      !data ||
      data.title !== 'Untitled Composition' ||
      data.laya !== 'madhya' ||
      data.gharana !== '' ||
      data.guru !== '' ||
      data.notes !== ''
    ) {
      return false;
    }

    const baseline = new Composition(data.taalId || 'teentaal', data.compositionType || 'theka');
    return JSON.stringify(data.sections || []) === JSON.stringify(baseline.sections);
  }

  static _sanitizeSavedList(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(item =>
      !Composition._isLegacyBuiltIn(item) &&
      !Composition._isPristineUntitledData(item)
    );
  }

  isPristineDefault() {
    if (
      this.title !== 'Untitled Composition' ||
      this.laya !== 'madhya' ||
      this.gharana !== '' ||
      this.guru !== '' ||
      this.notes !== ''
    ) {
      return false;
    }

    const baseline = new Composition(this.taalId, this.compositionType);
    return JSON.stringify(this.sections) === JSON.stringify(baseline.sections);
  }

  static async _writeSavedList(list) {
    try {
      localStorage.setItem(Composition.STORAGE_KEY, JSON.stringify(list));
      
      const response = await fetch('/api/compositions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list),
        signal: AbortSignal.timeout(2000) // Don't hang forever on slow/dead connections
      });
      return response.ok;
    } catch (e) {
      console.warn('Sync Server unavailable, using local storage only.');
      return false;
    }
  }

  async save(force = false) {
    const data = this.toJSON();
    if (Composition._isLegacyBuiltIn(data)) {
      localStorage.removeItem('bhatkhande_io_last_active_id');
      return false;
    }
    if (Composition._isPristineUntitledData(data)) {
      return false;
    }
    if (!force && this.isPristineDefault()) {
      return false;
    }

    const all = Composition._sanitizeSavedList(await Composition.listSaved());
    const idx = all.findIndex(c => c.id === this.id);
    if (idx >= 0) {
      all[idx] = data;
    } else {
      all.push(data);
    }
    try {
      await Composition._writeSavedList(all);
      localStorage.setItem('bhatkhande_io_last_active_id', this.id);
    } catch (e) {
      console.warn('Failed to save to Cloud API:', e);
    }
    return true;
  }

  static async load(id) {
    const all = await Composition.listSaved();
    const data = all.find(c => c.id === id);
    return data ? Composition.fromJSON(data) : null;
  }

  static async deleteSaved(id) {
    let all = await Composition.listSaved();
    all = all.filter(c => c.id !== id);
    await Composition._writeSavedList(all);
  }

  static async listSaved() {
    try {
      const response = await fetch('/api/compositions', { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const data = await response.json();
        const sanitized = Composition._sanitizeSavedList(data);
        
        // Parallel sync to localStorage for offline redundancy
        localStorage.setItem(Composition.STORAGE_KEY, JSON.stringify(sanitized));
        
        if (sanitized.length !== data.length) {
          await Composition._writeSavedList(sanitized);
        }
        return sanitized;
      }
    } catch (e) {
      // Fallback handled below
    }

    // API failed or timed out - use LocalStorage
    const local = localStorage.getItem(Composition.STORAGE_KEY);
    return local ? Composition._sanitizeSavedList(JSON.parse(local)) : [];
  }

  fillWithTheka(sectionIdx, avartanIdx, options = {}) {
    const section = this.sections[sectionIdx];
    if (!section) return;
    const avartan = section.avartans[avartanIdx];
    if (!avartan) return;

    const { saveHistory = true } = options;
    if (saveHistory) this._saveUndoState();
    const taal = this.getTaal();
    const thekaBols = taal.theka || [];
    
    for (let m = 0; m < avartan.matras.length; m++) {
      avartan.matras[m].bols = thekaBols[m] ? [thekaBols[m]] : [];
    }
    this._markUpdated();
  }

  fillAllAvartansWithTheka() {
    this.sections.forEach((section, sIdx) => {
      section.avartans.forEach((_, aIdx) => {
        this.fillWithTheka(sIdx, aIdx, { saveHistory: false });
      });
    });
    this._markUpdated();
  }

  exportToFile() {
    const data = JSON.stringify(this.toJSON(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.title.replace(/\s+/g, '_')}_${this.taalId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const comp = Composition.fromJSON(data);
          resolve(comp);
        } catch (err) {
          reject(new Error('Invalid composition file: ' + err.message + '\n' + err.stack));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
