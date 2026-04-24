class ReadOnlyBolInput {
  constructor() {
    this.onBolChanged = null;
    this.onNavigate = null;
  }

  setScript() {}
  hide() {}
  show() {}
}

class LayakariStudioApp {
  constructor() {
    this.sourceComposition = null;
    this.generatedComposition = null;
    this.currentScript = 'roman';
    this.previewGrid = null;
    this.previewBolInput = new ReadOnlyBolInput();
    this.explanationSections = [];
    this.selectedExplanationIndex = 0;
  }

  init() {
    this.fileInput = document.getElementById('layakari-file-input');
    this.templateTaalSelect = document.getElementById('layakari-template-taal');
    this.scriptSelect = document.getElementById('layakari-script-select');
    this.statusEl = document.getElementById('layakari-status');
    this.sourcePillEl = document.getElementById('layakari-source-pill');
    this.outputPillEl = document.getElementById('layakari-output-pill');
    this.emptyStateEl = document.getElementById('layakari-empty-state');
    this.previewEl = document.getElementById('layakari-preview');
    this.explainEmptyEl = document.getElementById('layakari-explain-empty');
    this.explainContentEl = document.getElementById('layakari-explain-content');
    this.explainSelectorEl = document.getElementById('layakari-explain-selector');
    this.explainCardEl = document.getElementById('layakari-explain-card');

    // Drawer elements
    this.explainFab = document.getElementById('btn-explain-toggle');
    this.explainDrawer = document.getElementById('lk-explain-drawer');
    this.explainOverlay = document.getElementById('lk-explain-overlay');

    this._populateTaalOptions();
    this._bindEvents();
    this._setStatus('Create a theka template or load a composition to begin.');
    this._renderSummaries();
    this._renderExplanationPanel();
  }

  _bindEvents() {
    document.getElementById('btn-layakari-template')?.addEventListener('click', () => this.createTemplate());
    document.getElementById('btn-load-composition')?.addEventListener('click', () => this.fileInput?.click());
    document.getElementById('btn-generate-full-set')?.addEventListener('click', () => this.generateFullSet());
    document.getElementById('btn-download-layakari')?.addEventListener('click', () => this.downloadGeneratedComposition());
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportPDF());
    this.fileInput?.addEventListener('change', (event) => this.loadFromFile(event.target.files?.[0]));
    this.scriptSelect?.addEventListener('change', (event) => {
      this.currentScript = event.target.value || 'roman';
      if (this.previewGrid) {
        this.previewGrid.setScript(this.currentScript);
      }
      if (this.generatedComposition) {
        this.explanationSections = this._buildExplanationSections(this.generatedComposition.toJSON());
      }
      this._renderExplanationPanel();
      
      // Update static UI text
      const isHi = this.currentScript === 'devanagari';
      const fabLabel = document.querySelector('.lk-fab-label');
      if (fabLabel) fabLabel.textContent = isHi ? 'विवरण' : 'Explain';
      
      const drawerTitle = document.querySelector('.lk-drawer-title');
      if (drawerTitle) {
        drawerTitle.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          ${isHi ? 'इस लयकारी का विवरण' : 'Explain This Layakari'}
        `;
      }
    });
    this.explainSelectorEl?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-explain-index]');
      if (!button) return;

      const nextIndex = parseInt(button.dataset.explainIndex, 10);
      if (!Number.isFinite(nextIndex)) return;

      this.selectedExplanationIndex = nextIndex;
      this._renderExplanationPanel();
    });

    // Drawer toggle
    this.explainFab?.addEventListener('click', () => this._openExplainDrawer());
    this.explainOverlay?.addEventListener('click', () => this._closeExplainDrawer());
    document.getElementById('btn-explain-close')?.addEventListener('click', () => this._closeExplainDrawer());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.explainDrawer?.classList.contains('is-open')) {
        this._closeExplainDrawer();
      }
    });
  }

  _openExplainDrawer() {
    this.explainDrawer?.classList.add('is-open');
    this.explainOverlay?.classList.add('is-open');
  }

  _closeExplainDrawer() {
    this.explainDrawer?.classList.remove('is-open');
    this.explainOverlay?.classList.remove('is-open');
  }

  _populateTaalOptions() {
    if (!this.templateTaalSelect) return;

    this.templateTaalSelect.innerHTML = Object.values(TAAL_DATABASE).map(taal =>
      `<option value="${taal.id}" ${taal.id === 'teentaal' ? 'selected' : ''}>${taal.name} (${taal.matras} matras)</option>`
    ).join('');
  }

  createTemplate() {
    const taalId = this.templateTaalSelect?.value || 'teentaal';
    const taal = TAAL_DATABASE[taalId];
    const composition = new Composition(taalId, 'theka');
    composition.title = `${taal.name} Theka`;
    if (composition.sections && composition.sections.length > 0) {
      composition.sections[0].label = 'Theka (Thah)';
    }
    composition.updatedAt = new Date().toISOString();
    this._setSourceComposition(composition);
    this._showToast(`Started a ${taal.name} theka template.`, 'success');
  }

  async loadFromFile(file) {
    if (!file) return;

    try {
      const composition = await Composition.importFromFile(file);
      this._setSourceComposition(composition);
      this._showToast(`Loaded "${composition.title}".`, 'success');
    } catch (err) {
      console.error('Could not load composition:', err);
      this._setStatus(err?.message || 'Could not load the selected file.', 'error');
      this._showToast(err?.message || 'Could not load the selected file.', 'error');
    } finally {
      if (this.fileInput) this.fileInput.value = '';
    }
  }

  _setSourceComposition(composition) {
    this.sourceComposition = composition;
    this.generatedComposition = null;
    this.explanationSections = [];
    this.selectedExplanationIndex = 0;
    this._renderSummaries();
    this._renderPreview();
    this._renderExplanationPanel();
    this._updateButtons();

    if (composition.compositionType === 'theka') {
      this._setStatus(`"${composition.title}" is ready for full-set layakari generation.`);
    } else {
      this._setStatus(
        'This standalone build currently mirrors the editor: full-set generation is enabled for Theka compositions only.',
        'warning'
      );
    }
  }

  _updateButtons() {
    const generateBtn = document.getElementById('btn-generate-full-set');
    const downloadBtn = document.getElementById('btn-download-layakari');
    const exportPdfBtn = document.getElementById('btn-export-pdf');

    if (generateBtn) {
      generateBtn.disabled = !this.sourceComposition || this.sourceComposition.compositionType !== 'theka';
    }
    if (downloadBtn) {
      downloadBtn.disabled = !this.sourceComposition && !this.generatedComposition;
    }
    if (exportPdfBtn) {
      exportPdfBtn.disabled = !this.sourceComposition && !this.generatedComposition;
    }

    if (this.explainFab) {
      if (this.generatedComposition && this.explanationSections.length > 0) {
        this.explainFab.disabled = false;
        this.explainFab.classList.add('has-results');
      } else {
        this.explainFab.disabled = true;
        this.explainFab.classList.remove('has-results');
        this._closeExplainDrawer();
      }
    }
  }

  generateFullSet() {
    if (!this.sourceComposition) return;

    try {
      const generatedData = window.LayakariCore.generateAllLayakariCompositionData(this.sourceComposition.toJSON(), {
        useFirstSection: true
      });
      this.generatedComposition = Composition.fromJSON(generatedData);
      this.explanationSections = this._buildExplanationSections(generatedData);
      this.selectedExplanationIndex = this.explanationSections.length > 1 ? 1 : 0;
      this._renderSummaries();
      this._renderPreview();
      this._renderExplanationPanel();
      this._updateButtons();
      this._setStatus(`Generated ${this.generatedComposition.sections.length} sections for "${this.generatedComposition.title}". Use the explanation tabs to study each writing rule.`, 'success');
      this._showToast('Full layakari set generated.', 'success');
    } catch (err) {
      console.error('Could not generate layakaris:', err);
      this._setStatus(err?.message || 'Could not generate the layakari set.', 'error');
      this._showToast(err?.message || 'Could not generate the layakari set.', 'error');
    }
  }

  downloadGeneratedComposition() {
    const compToDownload = this.generatedComposition || this.sourceComposition;
    if (!compToDownload) return;
    compToDownload.exportToFile();
  }

  exportPDF() {
    const compToRender = this.generatedComposition || this.sourceComposition;
    if (!compToRender) return;
    if (typeof PdfExport !== 'undefined') {
      PdfExport.exportAsPDF(compToRender, this.currentScript, {
        author: 'Layakari Studio',
        watermark: 'bhatkhande.io / layakari'
      });
    } else {
      this._showToast('PDF Export is unavailable.', 'error');
    }
  }

  _renderSummaries() {
    if (this.sourcePillEl) {
      if (this.sourceComposition) {
        const taal = TAAL_DATABASE[this.sourceComposition.taalId];
        const taalName = taal ? taal.name : this.sourceComposition.taalId;
        const title = this.sourceComposition.title || 'Untitled';
        this.sourcePillEl.textContent = `${title} · ${taalName}`;
        this.sourcePillEl.classList.add('has-data');
      } else {
        this.sourcePillEl.textContent = 'No source';
        this.sourcePillEl.classList.remove('has-data');
      }
    }

    if (this.outputPillEl) {
      if (this.generatedComposition) {
        const count = this.generatedComposition.sections.length;
        this.outputPillEl.textContent = `${count} section${count !== 1 ? 's' : ''} generated`;
        this.outputPillEl.classList.add('has-data');
      } else {
        this.outputPillEl.textContent = '—';
        this.outputPillEl.classList.remove('has-data');
      }
    }
  }

  _renderPreview() {
    if (!this.previewEl || !this.emptyStateEl) return;

    const compToRender = this.generatedComposition || this.sourceComposition;

    if (!compToRender) {
      this.previewEl.classList.remove('is-visible');
      this.previewEl.innerHTML = '';
      this.emptyStateEl.hidden = false;
      return;
    }

    this.emptyStateEl.hidden = true;
    this.previewEl.classList.add('is-visible');

    if (!this.previewGrid) {
      this.previewGrid = new NotationGrid(this.previewEl, compToRender, this.previewBolInput);
    }

    this.previewGrid.composition = compToRender;
    this.previewGrid.setScript(this.currentScript);
  }

  _buildExplanationSections(compositionData) {
    const taal = TAAL_DATABASE[compositionData?.taalId];
    const baseSection = compositionData?.sections?.[0];
    if (!taal || !baseSection || !window.LayakariCore?.describeLayakariSectionData) {
      return [];
    }

    const speedOptions = [
      { val: '1', name: 'Thah (1x)' },
      ...(window.LayakariCore.DEFAULT_LAYAKARI_SPEEDS || [])
    ];

    return (compositionData.sections || []).map((section, index) => {
      const speedInfo = speedOptions[index] || { val: '1', name: section.label || `Section ${index + 1}` };
      const explanation = window.LayakariCore.describeLayakariSectionData({
        sourceSection: baseSection,
        generatedSection: section,
        taal,
        compositionType: compositionData.compositionType,
        speed: speedInfo.val,
        speedName: speedInfo.name,
        script: this.currentScript
      });

      return {
        ...explanation,
        sectionLabel: section.label || `Section ${index + 1}`
      };
    });
  }

  _renderExplanationPanel() {
    if (!this.explainEmptyEl || !this.explainContentEl || !this.explainSelectorEl || !this.explainCardEl) return;

    if (!this.generatedComposition || this.explanationSections.length === 0) {
      this.explainEmptyEl.hidden = false;
      this.explainContentEl.hidden = true;
      this.explainSelectorEl.innerHTML = '';
      this.explainCardEl.innerHTML = '';
      return;
    }

    if (this.selectedExplanationIndex >= this.explanationSections.length) {
      this.selectedExplanationIndex = 0;
    }

    const selectedExplanation = this.explanationSections[this.selectedExplanationIndex];
    this.explainEmptyEl.hidden = true;
    this.explainContentEl.hidden = false;

    this.explainSelectorEl.innerHTML = this.explanationSections.map((explanation, index) => `
      <button
        type="button"
        class="layakari-explain-chip ${index === this.selectedExplanationIndex ? 'is-active' : ''}"
        data-explain-index="${index}"
      >
        ${this._escapeHtml(explanation.shortLabel || explanation.title || `Section ${index + 1}`)}
      </button>
    `).join('');

    const detailCardsHtml = (selectedExplanation.detailCards || []).map(card => `
      <article class="layakari-rule-card">
        <div class="layakari-rule-label">${this._escapeHtml(card.label || '')}</div>
        <p>${this._escapeHtml(card.text || '')}</p>
      </article>
    `).join('');

    const exampleRowsHtml = (selectedExplanation.examples || []).map(row => {
      const sourceContent = Array.isArray(row.slotTokens) && row.slotTokens.length > 0
        ? this._formatBolTokenSequenceHtml(row.slotTokens, ' <span class="layakari-separator">|</span> ')
        : this._formatBolUnitSequenceHtml(row.sourceUnits || [], ' <span class="layakari-separator">+</span> ');

      return `
        <tr>
          <td class="layakari-example-index">${row.generatedMatraNumber}</td>
          <td>
            <div class="layakari-example-source-ref">${this._escapeHtml(row.sourceRef || '')}</div>
            <div class="layakari-example-notation">${sourceContent}</div>
          </td>
          <td class="layakari-example-result">${this._formatBolTokenSequenceHtml(row.resultTokens || [], '')}</td>
        </tr>
      `;
    }).join('');

    const isHi = this.currentScript === 'devanagari';

    this.explainCardEl.innerHTML = `
      <div class="layakari-explain-heading">
        <div class="layakari-explain-topline">${isHi ? 'चयनित भाग' : 'Selected Section'}</div>
        <h3>${this._escapeHtml(selectedExplanation.sectionLabel || selectedExplanation.title || 'Layakari')}</h3>
        <div class="layakari-explain-speed">${this._escapeHtml(selectedExplanation.title || '')}</div>
      </div>

      <p class="layakari-explain-summary">${this._escapeHtml(selectedExplanation.summary || '')}</p>

      <div class="layakari-rule-grid">
        ${detailCardsHtml}
      </div>

      <section class="layakari-example-block">
        <div class="layakari-example-header">
          <h4>${isHi ? 'मात्रा मानचित्रण' : 'Step Mapping'}</h4>
          <p>${isHi ? 'पहली चार निर्मित मात्राएं' : 'First four generated matras'}</p>
        </div>
        <table class="layakari-example-table">
          <thead>
            <tr>
              <th>${isHi ? 'मात्रा' : 'Matra'}</th>
              <th>${isHi ? 'स्रोत' : 'Built From'}</th>
              <th>${isHi ? 'परिणाम' : 'Result'}</th>
            </tr>
          </thead>
          <tbody>
            ${exampleRowsHtml}
          </tbody>
        </table>
      </section>

      <section class="layakari-practice-block">
        <h4>${isHi ? 'अभ्यास संकेत' : 'Practice Prompt'}</h4>
        <p>${this._escapeHtml(selectedExplanation.practicePrompt || '')}</p>
      </section>
    `;
  }

  _setStatus(message, tone = 'info') {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone;
  }

  _showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  _formatBolUnitSequenceHtml(units, separatorHtml) {
    return (units || []).map(unit => {
      const display = typeof getBolDisplay === 'function'
        ? getBolDisplay(unit || 'S', this.currentScript)
        : (unit || 'S');
      return this._escapeHtml(display || 'S');
    }).join(separatorHtml);
  }

  _formatBolTokenSequenceHtml(tokens, separatorHtml) {
    return (tokens || []).map(token => {
      const display = typeof getBolDisplay === 'function'
        ? getBolDisplay(token || 'S', this.currentScript)
        : (token || 'S');
      return this._escapeHtml(display || 'S');
    }).join(separatorHtml);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new LayakariStudioApp();
  app.init();
  window.layakariStudioApp = app;
});
