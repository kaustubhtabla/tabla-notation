/**
 * bhatkhande.io — PDF Export
 * Generates a clean, downloadable PDF with Bhatkhande notation layout.
 * Uses a popup window + browser print-to-PDF for perfect Devanagari rendering.
 */

const PDF_PAGE_OPTIONS = [
  { id: 'A5', label: 'A5', cssName: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'A4', label: 'A4', cssName: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A3', label: 'A3', cssName: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'Letter', label: 'Letter', cssName: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'Legal', label: 'Legal', cssName: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  { id: 'Tabloid', label: 'Tabloid', cssName: 'Tabloid', widthMm: 279.4, heightMm: 431.8 }
];

const PDF_FONT_SIZE_OPTIONS = [
  { id: '9', label: '9 pt', notationPt: 9 },
  { id: '10', label: '10 pt', notationPt: 10 },
  { id: '11', label: '11 pt', notationPt: 11 },
  { id: '12', label: '12 pt', notationPt: 12 },
  { id: '13', label: '13 pt', notationPt: 13 }
];

function getPdfPageOption(pageSizeId) {
  return PDF_PAGE_OPTIONS.find(option => option.id === pageSizeId) || PDF_PAGE_OPTIONS.find(option => option.id === 'A4') || PDF_PAGE_OPTIONS[0];
}

function getPdfFontSizeOption(fontSizeId) {
  const normalizedFontSizeId = String(fontSizeId || '');
  return PDF_FONT_SIZE_OPTIONS.find(option => option.id === normalizedFontSizeId)
    || PDF_FONT_SIZE_OPTIONS.find(option => option.id === '10')
    || PDF_FONT_SIZE_OPTIONS[0];
}

class PdfExport {

  static exportAsPDF(composition, script, options = {}) {
    const taal = composition.getTaal();
    if (!taal) return;

    const labels = PdfExport._labels(script);
    const storedPageSize = options.pageSize || localStorage.getItem('bhatkhande_io_pdf_page_size') || 'A4';
    const storedFontSize = options.fontSize || localStorage.getItem('bhatkhande_io_pdf_font_size') || '10';
    const pageOption = getPdfPageOption(storedPageSize);
    const fontOption = getPdfFontSizeOption(storedFontSize);
    const html = PdfExport._buildPrintHtml(composition, taal, script, pageOption, fontOption);
    const pdfWindow = window.open('', '_blank', 'width=900,height=700');
    if (!pdfWindow) {
      alert(labels.popupBlocked);
      return;
    }

    pdfWindow.document.write(html);
    pdfWindow.document.close();
    pdfWindow.onload = async () => {
      try {
        if (pdfWindow.document.fonts && pdfWindow.document.fonts.ready) {
          await Promise.race([
            pdfWindow.document.fonts.ready,
            new Promise(resolve => setTimeout(resolve, 2500))
          ]);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      } catch (err) {
        console.warn('PDF font readiness wait skipped:', err);
      }
      pdfWindow.focus();
    };
  }

  static _buildPrintHtml(composition, taal, script, pageOption, fontOption) {
    const labels = PdfExport._labels(script);
    const taalName = script === 'devanagari' ? taal.nameDevanagari : taal.name;
    const compType = typeof getCompositionTypeInfo === 'function'
      ? getCompositionTypeInfo(composition.compositionType)
      : COMPOSITION_TYPES.find(t => t.id === composition.compositionType);
    const compTypeName = compType ? (script === 'devanagari' ? compType.nameDevanagari : compType.name) : '';
    const layaInfo = LAYA_TYPES.find(l => l.id === composition.laya);
    const layaName = layaInfo ? (script === 'devanagari' ? layaInfo.nameDevanagari : layaInfo.name) : '';
    const titleText = PdfExport._localizeText(composition.title || labels.untitledTitle, script, labels.untitledTitle);
    const notesText = PdfExport._localizeText(composition.notes, script);

    let sectionsHtml = '';
    composition.sections.forEach((section, sIdx) => {
      sectionsHtml += PdfExport._buildSectionHtml(composition, section, sIdx, taal, script, pageOption, fontOption);
    });

    const matraText = script === 'devanagari'
      ? `${PdfExport._formatNumber(taal.matras, script)} ${labels.matras}`
      : `${taal.matras} ${labels.matras}`;

    const pageSizeOptions = PdfExport._buildPageSizeOptions(pageOption);
    const fontSizeOptions = PdfExport._buildFontSizeOptions(fontOption);
    const pageSizeStyle = PdfExport._buildPageSizeCss(pageOption);
    const fontSizeStyle = PdfExport._buildFontSizeCss(fontOption);
    const previewScript = PdfExport._buildPreviewScript(pageOption, fontOption);

    return `<!DOCTYPE html>
<html lang="${labels.lang}">
<head>
  <meta charset="UTF-8">
  <title>${PdfExport._escapeHtml(titleText)} — ${PdfExport._escapeHtml(labels.brand)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --pdf-notation-size: 10pt;
      --pdf-body-size: 10.5pt;
      --pdf-save-hint-size: 9.4pt;
      --pdf-meta-size: 10.2pt;
      --pdf-notes-size: 10pt;
      --pdf-section-size: 12.5pt;
      --pdf-footer-size: 8.5pt;
      --pdf-grid-gap: 12px;
      --pdf-vibhaag-gap: 8px;
      --pdf-text-baseline-offset: 10px;
      --pdf-matra-min-height: 27pt;
      --pdf-marker-min-height: 18pt;
      --pdf-grouped-padding-bottom: 7px;
      --pdf-word-curve-height: 7px;
      --pdf-word-curve-border-width: 1.35px;
      --pdf-word-curve-radius: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
      color: #1f1a15;
      padding: 18mm 14mm;
      font-size: var(--pdf-body-size);
      line-height: 1.55;
      background: white;
    }
    .pdf-shell {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .save-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #d6cfbf;
      background: #f8f4ea;
      color: #4d4235;
      font-size: var(--pdf-save-hint-size);
    }
    .save-hint-text {
      flex: 1 1 280px;
    }
    .pdf-preview-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pdf-preview-label {
      font-size: 9pt;
      font-weight: 600;
      color: #4d4235;
      white-space: nowrap;
    }
    .pdf-preview-select {
      min-width: 90px;
      padding: 6px 28px 6px 10px;
      border-radius: 8px;
      border: 1px solid #d6cfbf;
      background-color: #fffdfa;
      color: #2a2119;
      font: inherit;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23645444' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
    }
    .pdf-preview-button {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #2a2119;
      background: #2a2119;
      color: white;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .pdf-preview-button:hover {
      background: #44362b;
      border-color: #44362b;
    }
    .pdf-header {
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #2a2119;
    }
    .pdf-meta {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 18px;
      color: #54463a;
      font-size: var(--pdf-meta-size);
    }
    .pdf-meta-item {
      display: inline-flex;
      gap: 6px;
      align-items: baseline;
    }
    .pdf-meta-label {
      font-weight: 700;
      color: #2a2119;
    }
    .pdf-notes {
      padding: 10px 14px;
      border-radius: 10px;
      background: #fbf8f1;
      border: 1px solid #e3dccd;
      color: #584b3d;
      font-size: var(--pdf-notes-size);
      text-align: center;
    }
    .pdf-section {
      page-break-inside: avoid;
    }
    .pdf-section-header {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .pdf-section-label {
      font-size: var(--pdf-section-size);
      font-weight: 700;
      color: #2a2119;
    }
    .pdf-avartan {
      border: 1px solid #e3dccd;
      border-radius: 12px;
      padding: 14px 14px 12px;
      background: #fffdfa;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .pdf-avartan-row {
      display: grid;
      gap: var(--pdf-grid-gap);
      margin-bottom: 12px;
      align-items: stretch;
      max-width: 100%;
    }
    .pdf-avartan-row:last-child {
      margin-bottom: 0;
    }
    .pdf-vibhaag-cell {
      position: relative;
      min-width: 0;
      padding-right: 16px;
      display: flex;
      align-items: stretch;
    }
    .pdf-vibhaag-grid {
      display: grid;
      gap: var(--pdf-vibhaag-gap);
      align-items: end;
      width: 100%;
    }
    .pdf-grid-cell {
      position: relative;
      min-width: 0;
      overflow: visible;
    }
    .pdf-matra-group {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: visible;
    }
    .pdf-matra-group.marker-under-first {
      width: 100%;
      max-width: none;
      margin: 0;
      align-items: stretch;
    }
    .pdf-matra-group.marker-under-first .pdf-matra-words {
      width: 100%;
      padding-left: 2px;
      padding-right: 2px;
    }
    .pdf-matra-group.marker-under-first .pdf-matra-chinh {
      justify-content: flex-start;
      padding-left: 2px;
    }
    .pdf-matra-words {
      width: 100%;
      min-height: var(--pdf-matra-min-height);
      overflow: visible;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-top: 2px;
      padding-bottom: var(--pdf-text-baseline-offset);
      color: #17110c;
      font-weight: 500;
      text-align: left;
    }
    .pdf-matra-words.grouped {
      align-items: flex-start;
    }
    .pdf-word-shell {
      position: relative;
      width: 100%;
      min-width: 0;
      overflow: visible;
    }
    .pdf-word-shell.grouped {
      width: fit-content;
      max-width: calc(100% - 10px);
      align-self: flex-start;
      padding-bottom: var(--pdf-grouped-padding-bottom);
    }
    .pdf-word-text {
      display: block;
      white-space: nowrap;
      overflow: visible;
      text-align: left;
      font-size: var(--pdf-notation-size);
      line-height: 1.14;
      min-width: 0;
      padding: 2px 1px 0;
      letter-spacing: 0;
    }

    .word-curve {
      position: absolute;
      left: 0;
      right: auto;
      bottom: 0;
      width: 100%;
      height: var(--pdf-word-curve-height);
      border: var(--pdf-word-curve-border-width) solid #645444;
      border-top: none;
      border-radius: 0 0 var(--pdf-word-curve-radius) var(--pdf-word-curve-radius);
    }
    .pdf-matra-chinh {
      min-height: var(--pdf-marker-min-height);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
      padding-left: 2px;
      font-size: var(--pdf-notation-size);
      line-height: 1.1;
      font-weight: 600;
      color: #564636;
    }
    .pdf-vibhaag-divider {
      position: absolute;
      right: 5px;
      top: 0;
      bottom: 0;
      width: 0;
      border-right: 1.5px solid #2a2119;
    }
    /* Fix: last vibhaag cell in each row had 16px of dead space after the divider */
    .pdf-avartan-row > .pdf-vibhaag-cell:last-child {
      padding-right: 0;
    }
    .pdf-avartan-row > .pdf-vibhaag-cell:last-child > .pdf-vibhaag-divider {
      right: 0;
    }
    .empty-bol-rest {
      color: #8a7764;
      font-weight: 400;
      font-size: var(--pdf-notation-size);
      line-height: 1;
    }
    .pdf-footer {
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid #dfd7c7;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: var(--pdf-footer-size);
      color: #85715f;
    }
  </style>
  <style id="pdf-page-size-style">${pageSizeStyle}</style>
  <style id="pdf-font-size-style">${fontSizeStyle}</style>
</head>
<body>
  <div class="pdf-shell">
    <div class="save-hint">
      <div class="save-hint-text">${PdfExport._escapeHtml(labels.saveHint)}</div>
      <div class="pdf-preview-controls">
        <label class="pdf-preview-label" for="pdf-preview-page-size">${PdfExport._escapeHtml(labels.pageSize)}</label>
        <select id="pdf-preview-page-size" class="pdf-preview-select">${pageSizeOptions}</select>
        <label class="pdf-preview-label" for="pdf-preview-font-size">${PdfExport._escapeHtml(labels.fontSize)}</label>
        <select id="pdf-preview-font-size" class="pdf-preview-select">${fontSizeOptions}</select>
        <button type="button" id="pdf-preview-print" class="pdf-preview-button">${PdfExport._escapeHtml(labels.printAction)}</button>
      </div>
    </div>
    <div class="pdf-header">
      <div class="pdf-meta">
        <div class="pdf-meta-item"><span class="pdf-meta-label">${PdfExport._escapeHtml(`${labels.meta.taal}:`)}</span><span>${PdfExport._escapeHtml(`${taalName} (${matraText})`)}</span></div>
        ${compTypeName ? `<div class="pdf-meta-item"><span class="pdf-meta-label">${PdfExport._escapeHtml(`${labels.meta.type}:`)}</span><span>${PdfExport._escapeHtml(compTypeName)}</span></div>` : ''}
        ${layaName ? `<div class="pdf-meta-item"><span class="pdf-meta-label">${PdfExport._escapeHtml(`${labels.meta.laya}:`)}</span><span>${PdfExport._escapeHtml(layaName)}</span></div>` : ''}
      </div>
    </div>
    ${notesText ? `<div class="pdf-notes">${PdfExport._escapeHtml(notesText)}</div>` : ''}
    ${sectionsHtml}
    <div class="pdf-footer">
      <span>${PdfExport._escapeHtml(`${titleText} • ${taalName}`)}</span>
      <span>${PdfExport._escapeHtml(labels.footer)}</span>
    </div>
  </div>
  <script>
    ${previewScript}
  </script>
</body>
</html>`;
  }

  static _buildPageSizeOptions(selectedOption) {
    return PDF_PAGE_OPTIONS.map(option =>
      `<option value="${PdfExport._escapeHtml(option.id)}" ${option.id === selectedOption.id ? 'selected' : ''}>${PdfExport._escapeHtml(option.label)}</option>`
    ).join('');
  }

  static _buildFontSizeOptions(selectedOption) {
    return PDF_FONT_SIZE_OPTIONS.map(option =>
      `<option value="${PdfExport._escapeHtml(option.id)}" ${option.id === selectedOption.id ? 'selected' : ''}>${PdfExport._escapeHtml(option.label)}</option>`
    ).join('');
  }

  static _buildPageSizeCss(pageOption) {
    return `@media print {
      body { padding: 11mm 10mm; }
      .save-hint { display: none; }
      @page { size: ${pageOption.cssName}; margin: 10mm; }
    }
    @media screen {
      body {
        max-width: ${pageOption.widthMm}mm;
        margin: 0 auto;
      }
    }`;
  }

  static _buildFontSizeCss(fontOption) {
    const notationPt = Math.max(8, Number(fontOption && fontOption.notationPt) || 10);
    const scale = notationPt / 10;
    const round = value => Number(value.toFixed(2));

    return `:root {
      --pdf-notation-size: ${round(notationPt)}pt;
      --pdf-body-size: ${round(10.5 * scale)}pt;
      --pdf-save-hint-size: ${round(9.4 * scale)}pt;
      --pdf-meta-size: ${round(10.2 * scale)}pt;
      --pdf-notes-size: ${round(10 * scale)}pt;
      --pdf-section-size: ${round(12.5 * scale)}pt;
      --pdf-footer-size: ${round(8.5 * scale)}pt;
      --pdf-text-baseline-offset: ${round(10 * scale)}px;
      --pdf-matra-min-height: ${round(27 * scale)}pt;
      --pdf-marker-min-height: ${round(18 * scale)}pt;
      --pdf-grouped-padding-bottom: ${round(7 * scale)}px;
      --pdf-word-curve-height: ${round(7 * scale)}px;
      --pdf-word-curve-border-width: ${round(1.35 * scale)}px;
      --pdf-word-curve-radius: ${round(12 * scale)}px;
    }`;
  }

  static _buildPreviewScript(pageOption, fontOption) {
    const pageOptionsJson = JSON.stringify(PDF_PAGE_OPTIONS);
    const fontOptionsJson = JSON.stringify(PDF_FONT_SIZE_OPTIONS);
    const initialPageId = JSON.stringify(pageOption.id);
    const initialFontId = JSON.stringify(fontOption.id);
    return `
      (function () {
        const PAGE_OPTIONS = ${pageOptionsJson};
        const FONT_SIZE_OPTIONS = ${fontOptionsJson};
        const pageSizeSelect = document.getElementById('pdf-preview-page-size');
        const fontSizeSelect = document.getElementById('pdf-preview-font-size');
        const printButton = document.getElementById('pdf-preview-print');
        const pageSizeStyle = document.getElementById('pdf-page-size-style');
        const fontSizeStyle = document.getElementById('pdf-font-size-style');

        function buildPageSizeCss(option) {
          return \`@media print {
            body { padding: 11mm 10mm; }
            .save-hint { display: none; }
            @page { size: \${option.cssName}; margin: 10mm; }
          }
          @media screen {
            body {
              max-width: \${option.widthMm}mm;
              margin: 0 auto;
            }
          }\`;
        }

        function buildFontSizeCss(option) {
          const notationPt = Math.max(8, Number(option && option.notationPt) || 10);
          const scale = notationPt / 10;
          const round = value => Number(value.toFixed(2));

          return \`:root {
            --pdf-notation-size: \${round(notationPt)}pt;
            --pdf-body-size: \${round(10.5 * scale)}pt;
            --pdf-save-hint-size: \${round(9.4 * scale)}pt;
            --pdf-meta-size: \${round(10.2 * scale)}pt;
            --pdf-notes-size: \${round(10 * scale)}pt;
            --pdf-section-size: \${round(12.5 * scale)}pt;
            --pdf-footer-size: \${round(8.5 * scale)}pt;
            --pdf-text-baseline-offset: \${round(10 * scale)}px;
            --pdf-matra-min-height: \${round(27 * scale)}pt;
            --pdf-marker-min-height: \${round(18 * scale)}pt;
            --pdf-grouped-padding-bottom: \${round(7 * scale)}px;
            --pdf-word-curve-height: \${round(7 * scale)}px;
            --pdf-word-curve-border-width: \${round(1.35 * scale)}px;
            --pdf-word-curve-radius: \${round(12 * scale)}px;
          }\`;
        }

        function getOption(pageSizeId) {
          return PAGE_OPTIONS.find(option => option.id === pageSizeId) || PAGE_OPTIONS.find(option => option.id === 'A4') || PAGE_OPTIONS[0];
        }

        function getFontSizeOption(fontSizeId) {
          return FONT_SIZE_OPTIONS.find(option => option.id === String(fontSizeId || ''))
            || FONT_SIZE_OPTIONS.find(option => option.id === '10')
            || FONT_SIZE_OPTIONS[0];
        }

        function applyPageSize(pageSizeId) {
          const option = getOption(pageSizeId);
          pageSizeStyle.textContent = buildPageSizeCss(option);
          if (pageSizeSelect) pageSizeSelect.value = option.id;
          try {
            localStorage.setItem('bhatkhande_io_pdf_page_size', option.id);
          } catch (err) {
            console.warn('Could not persist PDF page size:', err);
          }
        }

        function applyFontSize(fontSizeId) {
          const option = getFontSizeOption(fontSizeId);
          fontSizeStyle.textContent = buildFontSizeCss(option);
          if (fontSizeSelect) fontSizeSelect.value = option.id;
          try {
            localStorage.setItem('bhatkhande_io_pdf_font_size', option.id);
          } catch (err) {
            console.warn('Could not persist PDF font size:', err);
          }
        }

        async function printPreview() {
          try {
            if (document.fonts && document.fonts.ready) {
              await Promise.race([
                document.fonts.ready,
                new Promise(resolve => setTimeout(resolve, 2500))
              ]);
            }
          } catch (err) {
            console.warn('Preview font readiness wait skipped:', err);
          }
          window.print();
        }

        if (pageSizeSelect) {
          pageSizeSelect.addEventListener('change', () => applyPageSize(pageSizeSelect.value));
        }

        if (fontSizeSelect) {
          fontSizeSelect.addEventListener('change', () => applyFontSize(fontSizeSelect.value));
        }

        if (printButton) {
          printButton.addEventListener('click', () => printPreview());
        }

        document.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            printPreview();
          }
        });

        applyPageSize(${initialPageId});
        applyFontSize(${initialFontId});
      })();
    `;
  }

  static _buildSectionHtml(composition, section, sIdx, taal, script, pageOption, fontOption) {
    const sectionLabel = PdfExport._getSectionLabel(composition, section, script);

    let html = `<div class="pdf-section">
      <div class="pdf-section-header">
        <span class="pdf-section-label">${PdfExport._escapeHtml(sectionLabel)}</span>
      </div>`;

    section.avartans.forEach((avartan, aIdx) => {
      const renderedMatraCount = composition.getRenderedMatraCount(sIdx, aIdx) || taal.matras;
      const vibhaags = PdfExport._getVibhaagsForAvartan(avartan, taal, renderedMatraCount);
      const rowSizes = PdfExport._getRowSizesForAvartan(avartan, taal, script, renderedMatraCount, pageOption, fontOption);
      let start = 0;

      html += `<div class="pdf-avartan">`;

      rowSizes.forEach(vibhaagCount => {
        const rowVibhaags = vibhaags.slice(start, start + vibhaagCount);
        const rowStartMatra = rowVibhaags.length > 0 ? rowVibhaags[0].start : 0;
        const rowWidthPercent = PdfExport._getRenderedRowWidthPercent(taal, rowVibhaags, rowStartMatra, renderedMatraCount);

        const rowGridTemplate = rowVibhaags
          .map(vibhaag => `minmax(0, ${Math.max(1, vibhaag.size)}fr)`)
          .join(' ');

        html += `<div class="pdf-avartan-row" style="grid-template-columns: ${rowGridTemplate}; width:${rowWidthPercent}%;">`;

        for (let offset = 0; offset < vibhaagCount; offset++) {
          const vibhaag = rowVibhaags[offset];
          const vibhaagColumns = Math.max(1, vibhaag.size);
          const showDivider = offset < rowVibhaags.length - 1 || vibhaag.isComplete;

          html += `
          <div class="pdf-vibhaag-cell">
            ${showDivider ? '<span class="pdf-vibhaag-divider"></span>' : ''}
            <div class="pdf-vibhaag-grid" style="grid-template-columns: repeat(${vibhaagColumns}, minmax(0, 1fr));">`;

          vibhaag.matras.forEach((matra, matraOffset) => {
            const matraIndex = vibhaag.start + matraOffset;
            const bols = matra ? matra.bols : [];
            const marker = getMarkerForMatra(taal, matraIndex);
            const bolHtml = PdfExport._renderBol(bols, script);
            const markerHtml = marker ? PdfExport._markerLabel(marker, script) : '';
            const markerClass = PdfExport._shouldAnchorMarkerToFirstBol(bols, marker) ? ' marker-under-first' : '';

            html += `
              <div class="pdf-grid-cell">
                <div class="pdf-matra-group${markerClass}">
                  ${bolHtml}
                  <div class="pdf-matra-chinh">${PdfExport._escapeHtml(markerHtml)}</div>
                </div>
              </div>`;
          });

          html += `
            </div>
          </div>`;
        }

        html += `</div>`;
        start += vibhaagCount;
      });

      html += `</div>`;
    });

    html += `</div>`;
    return html;
  }

  static _getSectionLabel(composition, section, script) {
    const rawLabel = section && section.label ? section.label : '';
    if (
      script === 'devanagari' &&
      section &&
      section.type === 'mukh' &&
      typeof isExpandableCompositionType === 'function' &&
      isExpandableCompositionType(composition.compositionType) &&
      /^(main|mukh|theme|मुख)$/i.test(rawLabel.trim())
    ) {
      return 'मुख';
    }

    const normalizedLabel = PdfExport._normalizePdfSectionLabel(rawLabel, script);
    return PdfExport._localizeText(normalizedLabel, script, normalizedLabel);
  }

  static _normalizePdfSectionLabel(label, script) {
    const rawLabel = String(label || '').trim();
    if (!rawLabel) return rawLabel;

    if (script !== 'devanagari') {
      return rawLabel;
    }

    const thekaWrappedMatch = rawLabel.match(/^(?:Theka|ठेका)\s*\((.+)\)\s*$/i);
    if (!thekaWrappedMatch) {
      return rawLabel;
    }

    const innerLabel = String(thekaWrappedMatch[1] || '').trim();
    if (/^(thah|ठाह)$/i.test(innerLabel)) {
      return rawLabel;
    }

    return innerLabel;
  }

  static _renderBol(bols, script) {
    if (!bols || bols.length === 0 || (bols.length === 1 && (bols[0] === 'S' || bols[0] === '-'))) {
      return '<div class="pdf-matra-words"><div class="pdf-word-shell plain"><span class="pdf-word-text empty-bol-rest">ऽ</span></div></div>';
    }

    let isCompound = false;
    if (bols.length === 1 && typeof isCompoundBol !== 'undefined' && isCompoundBol(bols[0])) {
      isCompound = true;
    }

    if (bols.length === 1 && !isCompound) {
      return `<div class="pdf-matra-words"><div class="pdf-word-shell plain"><span class="pdf-word-text">${PdfExport._escapeHtml(PdfExport._getBolDisplayForPdf(bols[0], script))}</span></div></div>`;
    }

    const groupedText = PdfExport._getGroupedBolText(bols, script);

    return `<div class="pdf-matra-words grouped">
              <div class="pdf-word-shell grouped">
                <span class="pdf-word-text">${PdfExport._escapeHtml(groupedText)}</span>
                <div class="word-curve"></div>
              </div>
            </div>`;
  }

  static _getRowSizesForAvartan(avartan, taal, script, renderedMatraCount = taal.matras, pageOption = getPdfPageOption('A4'), fontOption = getPdfFontSizeOption('10')) {
    const vibhaags = PdfExport._getVibhaagsForAvartan(avartan, taal, renderedMatraCount);
    const vibhaagCount = Math.max(1, PdfExport._getVisibleVibhaagCount(taal, renderedMatraCount));
    const naturalChunkRows = Math.max(1, Math.ceil(Math.max(1, renderedMatraCount) / Math.max(1, taal.wrapAfter || taal.matras)));
    const maxRows = Math.min(4, vibhaagCount);

    for (let rows = naturalChunkRows; rows <= maxRows; rows++) {
      const candidates = PdfExport._getRowSizeCandidates(vibhaags, taal, rows, renderedMatraCount);
      for (const rowSizes of candidates) {
        if (!PdfExport._rowSizesHaveOverlapRisk(vibhaags, rowSizes, taal, script, renderedMatraCount, pageOption, fontOption)) {
          return rowSizes;
        }
      }
    }

    const fallbackCandidates = PdfExport._getRowSizeCandidates(vibhaags, taal, maxRows, renderedMatraCount);
    return fallbackCandidates[0] || PdfExport._splitEvenly(vibhaagCount, maxRows);
  }

  static _getVibhaagsForAvartan(avartan, taal, renderedMatraCount = taal.matras) {
    const vibhaags = [];
    let start = 0;
    const visibleLimit = Math.max(1, Math.min(renderedMatraCount, taal.matras));

    taal.vibhaagStructure.forEach(size => {
      if (start >= visibleLimit) return;

      const visibleSize = Math.min(size, visibleLimit - start);
      vibhaags.push({
        start,
        size: visibleSize,
        fullSize: size,
        isComplete: visibleSize === size,
        matras: avartan.matras.slice(start, start + visibleSize)
      });
      start += size;
    });

    return vibhaags;
  }

  static _getVisibleVibhaagCount(taal, renderedMatraCount) {
    let start = 0;
    let count = 0;
    const visibleLimit = Math.max(1, Math.min(renderedMatraCount, taal.matras));

    taal.vibhaagStructure.forEach(size => {
      if (start >= visibleLimit) return;
      count += 1;
      start += size;
    });

    return count;
  }

  static _getRenderedRowWidthPercent(taal, rowVibhaags, rowStartMatra, renderedMatraCount = taal.matras) {
    return 100;
  }

  static _getVisibleVibhaagCountForRange(taal, startMatra, endMatra) {
    const safeStart = Math.max(0, startMatra || 0);
    const safeEnd = Math.max(safeStart + 1, endMatra || 0);
    let position = 0;
    let count = 0;

    taal.vibhaagStructure.forEach(size => {
      const vibhaagStart = position;
      const vibhaagEnd = position + size;
      const overlaps = vibhaagEnd > safeStart && vibhaagStart < safeEnd;
      if (overlaps) count += 1;
      position = vibhaagEnd;
    });

    return count;
  }

  static _getRowSizeCandidates(vibhaags, taal, rows, renderedMatraCount) {
    const total = Math.max(1, (vibhaags || []).length);
    const candidates = [];

    function build(remaining, partsLeft, current) {
      if (partsLeft === 1) {
        candidates.push([...current, remaining]);
        return;
      }

      const minSize = 1;
      const maxSize = remaining - (partsLeft - 1);
      for (let size = minSize; size <= maxSize; size++) {
        build(remaining - size, partsLeft - 1, [...current, size]);
      }
    }

    build(total, Math.max(1, Math.min(rows, total)), []);

    return candidates.sort((a, b) => {
      const aScore = PdfExport._scoreRowSizeCandidate(vibhaags, taal, a, renderedMatraCount);
      const bScore = PdfExport._scoreRowSizeCandidate(vibhaags, taal, b, renderedMatraCount);
      if (aScore !== bScore) return aScore - bScore;

      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const aVal = a[i] || 0;
        const bVal = b[i] || 0;
        if (aVal !== bVal) return bVal - aVal;
      }
      return 0;
    });
  }

  static _scoreRowSizeCandidate(vibhaags, taal, rowSizes, renderedMatraCount) {
    const referenceMatras = Math.max(1, Math.min(taal.wrapAfter || taal.matras, taal.matras));
    const visibleLimit = Math.max(1, Math.min(renderedMatraCount, taal.matras));
    let start = 0;
    let score = 0;

    rowSizes.forEach((rowCount, rowIndex) => {
      const rowVibhaags = vibhaags.slice(start, start + rowCount);
      if (rowVibhaags.length === 0) return;

      const rowStart = rowVibhaags[0].start;
      const rowEnd = rowVibhaags[rowVibhaags.length - 1].start + rowVibhaags[rowVibhaags.length - 1].size;
      const startChunk = Math.floor(rowStart / referenceMatras);
      const endChunk = Math.floor(Math.max(rowStart, rowEnd - 1) / referenceMatras);

      if (startChunk !== endChunk) {
        score += 100;
      }

      const isFinalVisibleRow = rowEnd >= visibleLimit;
      const endsOnChunkBoundary = rowEnd % referenceMatras === 0;
      if (!isFinalVisibleRow && !endsOnChunkBoundary) {
        score += 5;
      }

      score += rowIndex;
      start += rowCount;
    });

    return score;
  }

  static _rowSizesHaveOverlapRisk(vibhaags, rowSizes, taal, script, renderedMatraCount, pageOption, fontOption) {
    let start = 0;
    for (const rowCount of rowSizes) {
      const rowVibhaags = vibhaags.slice(start, start + rowCount);
      if (PdfExport._rowHasOverlapRisk(rowVibhaags, taal, script, renderedMatraCount, pageOption, fontOption)) {
        return true;
      }
      start += rowCount;
    }
    return false;
  }

  static _rowHasOverlapRisk(rowVibhaags, taal, script, renderedMatraCount, pageOption, fontOption) {
    if (!rowVibhaags || rowVibhaags.length === 0) return false;

    const rowStartMatra = rowVibhaags[0].start || 0;
    const rowWidthPercent = PdfExport._getRenderedRowWidthPercent(taal, rowVibhaags, rowStartMatra, renderedMatraCount);
    const rowWidthPx = PdfExport._estimateRowWidthPx(pageOption, rowWidthPercent);
    const rowGapPx = 12 * Math.max(0, rowVibhaags.length - 1);
    const totalVibhaagUnits = Math.max(1, rowVibhaags.reduce((sum, vibhaag) => sum + Math.max(1, vibhaag.size), 0));
    const availableWidthPx = Math.max(32, rowWidthPx - rowGapPx);

    return rowVibhaags.some(vibhaag => {
      const vibhaagOuterWidthPx = Math.max(32, (availableWidthPx * Math.max(1, vibhaag.size)) / totalVibhaagUnits);
      const innerWidthPx = Math.max(24, vibhaagOuterWidthPx - 16);
      const matraGapPx = 8 * Math.max(0, vibhaag.size - 1);
      const matraWidthPx = Math.max(18, (innerWidthPx - matraGapPx) / Math.max(1, vibhaag.size));

      return vibhaag.matras.some(matra => {
        const bols = matra && Array.isArray(matra.bols) ? matra.bols : [];
        const requiredWidthPx = PdfExport._estimateMatraRenderWidthPx(bols, script, fontOption);
        const allowedWidthPx = Math.max(14, matraWidthPx - 4);
        return requiredWidthPx > allowedWidthPx * 0.95;
      });
    });
  }

  static _estimateRowWidthPx(pageOption, rowWidthPercent) {
    const mmToPx = 96 / 25.4;
    const printPageMarginsMm = 20;
    const printBodyPaddingMm = 20;
    const avartanPaddingPx = 28;
    const printableWidthPx = Math.max(260, ((pageOption.widthMm - printPageMarginsMm - printBodyPaddingMm) * mmToPx) - avartanPaddingPx);
    return printableWidthPx * Math.max(0.2, Math.min(1, rowWidthPercent / 100));
  }

  static _estimateMatraRenderWidthPx(bols, script, fontOption = getPdfFontSizeOption('10')) {
    if (!Array.isArray(bols) || bols.length === 0 || (bols.length === 1 && (bols[0] === 'S' || bols[0] === '-'))) {
      return 10;
    }

    const displayText = bols.length > 1
      ? PdfExport._getGroupedBolText(bols, script)
      : bols.map(bol => PdfExport._getBolDisplayForPdf(bol, script)).join('');

    const baseWidth = PdfExport._measureTextWidthPx(displayText, script, fontOption);
    const isGrouped = bols.length > 1 || (bols.length === 1 && typeof isCompoundBol !== 'undefined' && isCompoundBol(bols[0]));
    return baseWidth + (isGrouped ? 8 : 4);
  }

  static _getGroupedBolText(bols, script) {
    return (bols || []).map(bol => PdfExport._getBolDisplayForPdf(bol, script)).join('');
  }

  static _getBolDisplayForPdf(bol, script) {
    const displayText = getBolDisplay(bol, script);
    if (script !== 'devanagari') {
      return PdfExport._normalizeRomanPreviewBol(displayText, bol);
    }
    return displayText;
  }

  static _normalizeRomanPreviewBol(displayText, originalBol) {
    const raw = String(originalBol || displayText || '').trim();
    if (!raw) return '';
    if (!/^[A-Z][A-Z\s-]*$/.test(raw)) return displayText;
    if (/^S+$/.test(raw)) return raw;

    return raw
      .split(/\s+/)
      .map(part => {
        if (!/^[A-Z]+$/.test(part) || /^S+$/.test(part)) return part;
        return part.charAt(0) + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  static _measureTextWidthPx(text, script, fontOption = getPdfFontSizeOption('10')) {
    const sampleText = String(text || '');
    if (!sampleText) return 0;

    const notationPt = Math.max(8, Number(fontOption && fontOption.notationPt) || 10);
    const fallbackWidthMultiplier = script === 'devanagari' ? 0.82 : 0.74;

    if (typeof document === 'undefined') {
      return sampleText.length * notationPt * fallbackWidthMultiplier;
    }

    if (!PdfExport._measureContext) {
      const canvas = document.createElement('canvas');
      PdfExport._measureContext = canvas.getContext('2d');
    }

    const ctx = PdfExport._measureContext;
    if (!ctx) return sampleText.length * notationPt * fallbackWidthMultiplier;

    const fontFamily = script === 'devanagari'
      ? '"Noto Sans Devanagari", "Inter", sans-serif'
      : '"Inter", "Noto Sans Devanagari", sans-serif';
    ctx.font = `600 ${notationPt}pt ${fontFamily}`;
    return ctx.measureText(sampleText).width;
  }

  static _shouldAnchorMarkerToFirstBol(bols, marker) {
    return Boolean(marker) && Array.isArray(bols) && bols.length > 1;
  }

  static _splitEvenly(total, parts) {
    const base = Math.floor(total / parts);
    const remainder = total % parts;
    const sizes = [];

    for (let i = 0; i < parts; i++) {
      sizes.push(base + (i < remainder ? 1 : 0));
    }

    return sizes.filter(size => size > 0);
  }

  static _markerLabel(marker, script) {
    if (!marker) return '';
    return PdfExport._formatNumber(marker.label, script);
  }

  static _formatNumber(value, script) {
    return String(value);
  }

  static _localizeText(text, script, fallback = '') {
    const baseText = text || fallback || '';
    if (script !== 'devanagari') return baseText;

    let localized = baseText;
    const replacements = [
      [/Untitled Composition/gi, 'अशीर्षक रचना'],
      [/Teentaal/gi, 'तीनताल'],
      [/Rupak/gi, 'रूपक'],
      [/Jhaptaal/gi, 'झपताल'],
      [/Ektaal/gi, 'एकताल'],
      [/Dhamar/gi, 'धमार'],
      [/Ada Chautaal/gi, 'आड़ा चौताल'],
      [/Dadra/gi, 'दादरा'],
      [/Keherwa/gi, 'कहरवा'],
      [/Chautaal/gi, 'चौताल'],
      [/Sooltaal/gi, 'सूलताल'],
      [/Jhoomra/gi, 'झूमरा'],
      [/Tilwada/gi, 'तिलवाड़ा'],
      [/Deepchandi/gi, 'दीपचंदी'],
      [/Pancham Sawari/gi, 'पंचम सवारी'],
      [/Layakari/gi, 'लयकारी'],
      [/Composition/gi, 'रचना'],
      [/Theka/gi, 'ठेका'],
      [/Kayda/gi, 'कायदा'],
      [/Rela/gi, 'रेला'],
      [/Tukda/gi, 'टुकड़ा'],
      [/Peshkar/gi, 'पेशकार'],
      [/Chakradhar/gi, 'चक्रधार'],
      [/Gat/gi, 'गत'],
      [/Fard/gi, 'फ़र्द'],
      [/Paran/gi, 'परण'],
      [/Palta/gi, 'पलटा'],
      [/Tihai/gi, 'तिहाई'],
      [/Mohra/gi, 'मोहरा'],
      [/Mukh/gi, 'मुख'],
      [/Dohra/gi, 'दोहरा'],
      [/Section/gi, 'खंड'],
      [/Avartan/gi, 'आवर्तन'],
      [/Thah/gi, 'ठाह'],
      [/Dugun/gi, 'दुगुन'],
      [/Tigun/gi, 'तिगुन'],
      [/Chaugun/gi, 'चौगुन'],
      [/Aad/gi, 'आड़'],
      [/Kuad/gi, 'कुआड़'],
      [/Biyad/gi, 'बियाड़'],
      [/Vilambit/gi, 'विलंबित'],
      [/Madhya/gi, 'मध्य'],
      [/Drut/gi, 'द्रुत'],
      [/Ati Drut/gi, 'अति द्रुत'],
      [/Delhi/gi, 'दिल्ली'],
      [/Lucknow/gi, 'लखनऊ'],
      [/Ajrada/gi, 'अजराड़ा'],
      [/Farukhabad/gi, 'फर्रूखाबाद'],
      [/Punjab/gi, 'पंजाब'],
      [/Benares/gi, 'बनारस']
    ];

    replacements.forEach(([pattern, replacement]) => {
      localized = localized.replace(pattern, replacement);
    });

    localized = localized.replace(/Dugun\s*\(\s*2\s*[xX]\s*\)/gi, 'दुगुन');
    localized = localized.replace(/Tigun\s*\(\s*3\s*[xX]\s*\)/gi, 'तिगुन');
    localized = localized.replace(/Chaugun\s*\(\s*4\s*[xX]\s*\)/gi, 'चौगुन');
    localized = localized.replace(/दुगुन\s*\(\s*2\s*गुना\s*\)/g, 'दुगुन');
    localized = localized.replace(/तिगुन\s*\(\s*3\s*गुना\s*\)/g, 'तिगुन');
    localized = localized.replace(/चौगुन\s*\(\s*4\s*गुना\s*\)/g, 'चौगुन');
    localized = localized.replace(/(\d+)\s*[xX]/g, (_, digits) => `${PdfExport._formatNumber(digits, script)} गुना`);
    return PdfExport._formatNumber(localized, script);
  }

  static _labels(script) {
    if (script === 'devanagari') {
      return {
        lang: 'hi',
        brand: 'bhatkhande.io',
        untitledTitle: 'अशीर्षक रचना',
        popupBlocked: 'पीडीएफ निर्यात करने के लिए कृपया पॉप-अप की अनुमति दें।',
        saveHint: 'पृष्ठ आकार और फ़ॉन्ट आकार चुनें, फिर "प्रिंट / पीडीएफ सुरक्षित करें" का उपयोग करें।',
        pageSize: 'पृष्ठ आकार',
        fontSize: 'फ़ॉन्ट आकार',
        printAction: 'प्रिंट / पीडीएफ सुरक्षित करें',
        matras: 'मात्राएँ',
        meta: {
          taal: 'ताल:',
          type: 'प्रकार:',
          laya: 'लय:',
          gharana: 'घराना:',
          guru: 'गुरु / स्रोत:'
        },
        info: {
          structure: 'विभाग विन्यास',
          markers: 'चिह्न',
          theka: 'ठेका'
        },
        footer: 'bhatkhande.io द्वारा तैयार'
      };
    }

    return {
      lang: 'en',
      brand: 'Bhatkhande.io',
      untitledTitle: 'Untitled Composition',
      popupBlocked: 'Please allow pop-ups to export PDF.',
      saveHint: 'Choose the page size and font size here, then use Print / Save PDF.',
      pageSize: 'Page Size',
      fontSize: 'Font Size',
      printAction: 'Print / Save PDF',
      matras: 'Matras',
      meta: {
        taal: 'Taal:',
        type: 'Type:',
        laya: 'Laya:',
        gharana: 'Gharana:',
        guru: 'Guru / Source:'
      },
      info: {
        structure: 'Structure',
        markers: 'Markers',
        theka: 'Theka'
      },
      footer: 'Generated by Bhatkhande.io'
    };
  }

  static _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
