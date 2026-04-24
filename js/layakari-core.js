(function (global) {
  'use strict';

  const DEFAULT_LAYAKARI_SPEEDS = [
    { val: '2', name: 'Dugun (2x)', type: 'palta' },
    { val: '3', name: 'Tigun (3x)', type: 'palta' },
    { val: '4', name: 'Chaugun (4x)', type: 'palta' },
    { val: '3/2', name: 'Aad (3/2)', type: 'palta' },
    { val: '5/4', name: 'Kuad (5/4)', type: 'palta' },
    { val: '7/4', name: 'Biyad (7/4)', type: 'palta' }
  ];

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createLayakariError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function parseLayakariSpeed(speed) {
    let numerator = 1;
    let denominator = 1;

    if (typeof speed === 'string' && speed.includes('/')) {
      const parts = speed.split('/');
      numerator = parseInt(parts[0], 10);
      denominator = parseInt(parts[1], 10);
    } else {
      numerator = parseInt(speed, 10);
    }

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
      throw createLayakariError('Invalid layakari speed.', 'invalid_speed');
    }

    return { numerator, denominator };
  }

  function extractSectionMatras(section) {
    const sourceMatras = [];
    (section?.avartans || []).forEach(avartan => {
      (avartan?.matras || []).forEach(matra => {
        sourceMatras.push({ bols: [...(matra?.bols || [])] });
      });
    });
    return sourceMatras;
  }

  function isSectionEmpty(sourceMatras) {
    return sourceMatras.every(matra => (matra?.bols || []).length === 0);
  }

  function createThekaSeedMatras(taal) {
    const seedMatras = (taal?.theka || []).map(bol => ({ bols: [bol] }));
    while (seedMatras.length < taal.matras) {
      seedMatras.push({ bols: [] });
    }
    return seedMatras;
  }

  function createSeedSection(taal, label = 'Theka (Thah)') {
    const defaultSection = typeof getDefaultSectionBlueprintForCompositionType === 'function'
      ? getDefaultSectionBlueprintForCompositionType('theka')
      : { type: 'custom', label: 'Theka' };

    return {
      type: defaultSection.type,
      label,
      avartans: [{ matras: createThekaSeedMatras(taal) }]
    };
  }

  function cloneSection(section) {
    return cloneData(section);
  }

  function getCleanSectionLabel(label, fallback = 'Theka') {
    const clean = String(label || '').split(' (')[0].trim();
    return clean || fallback;
  }

  function getBaseSectionForGeneration(compositionData, taal, options = {}) {
    const requestedSection = options.baseSection
      || (options.useFirstSection && Array.isArray(compositionData?.sections) ? compositionData.sections[0] : null);

    if (!requestedSection) {
      return createSeedSection(taal, options.baseLabel || 'Theka (Thah)');
    }

    const clonedSection = cloneSection(requestedSection);
    const cleanLabel = getCleanSectionLabel(options.baseLabel || clonedSection.label || 'Theka');
    clonedSection.label = `${cleanLabel} (Thah)`;
    return clonedSection;
  }

  function buildIntegerLayakariMatras(sourceMatras, numerator) {
    const repeatedMatras = [];
    const resultMatras = [];

    for (let idx = 0; idx < numerator; idx++) {
      sourceMatras.forEach(matra => repeatedMatras.push({ bols: [...matra.bols] }));
    }

    for (let idx = 0; idx < repeatedMatras.length; idx += numerator) {
      const chunkBols = [];
      for (let offset = 0; offset < numerator; offset++) {
        const matra = repeatedMatras[idx + offset];
        if (!matra) continue;
        if ((matra.bols || []).length === 0) {
          chunkBols.push('S');
        } else {
          chunkBols.push(...matra.bols);
        }
      }
      resultMatras.push({ bols: chunkBols });
    }

    return resultMatras;
  }

  function buildFractionalLayakariMatras(sourceMatras, taal, numerator, denominator) {
    const flatBols = [];

    sourceMatras.forEach(matra => {
      if ((matra.bols || []).length === 0) {
        flatBols.push('S');
      } else {
        flatBols.push(...matra.bols);
      }
    });

    const numBolsNeeded = Math.ceil((taal.matras / denominator) * numerator);
    while (flatBols.length < numBolsNeeded) {
      flatBols.push(...flatBols);
    }

    const trimmedBols = flatBols.slice(0, numBolsNeeded);
    const totalSubBeats = taal.matras * numerator;
    const subBeatsArray = new Array(totalSubBeats).fill('S');

    for (let idx = 0; idx < trimmedBols.length; idx++) {
      const targetIndex = idx * denominator;
      if (targetIndex < totalSubBeats) {
        subBeatsArray[targetIndex] = trimmedBols[idx];
      }
    }

    const resultMatras = [];
    for (let idx = 0; idx < taal.matras; idx++) {
      resultMatras.push({
        bols: subBeatsArray.slice(idx * numerator, (idx + 1) * numerator)
      });
    }

    return resultMatras;
  }

  function blockMatrasIntoAvartans(resultMatras, taal) {
    const avartans = [];
    for (let idx = 0; idx < resultMatras.length; idx += taal.matras) {
      const matraChunk = resultMatras.slice(idx, idx + taal.matras);
      while (matraChunk.length < taal.matras) {
        matraChunk.push({ bols: [] });
      }
      avartans.push({ matras: matraChunk });
    }
    return avartans;
  }

  function buildLayakariLabel(sourceSection, speedName, speed) {
    const cleanLabel = String(sourceSection?.label || 'Section').split(' (')[0];
    return `${cleanLabel} (${speedName || speed})`;
  }

  function getTeachingSourceMatras(sourceSection, taal) {
    let sourceMatras = extractSectionMatras(sourceSection);
    if (isSectionEmpty(sourceMatras)) {
      sourceMatras = createThekaSeedMatras(taal);
    }
    return sourceMatras;
  }

  function summarizeMatraForTeaching(matra) {
    const bols = Array.isArray(matra?.bols) ? matra.bols : [];
    return bols.length > 0 ? bols.join(' ') : 'S';
  }

  function createFlattenedSourceUnits(sourceMatras) {
    const units = [];
    sourceMatras.forEach((matra, matraIdx) => {
      const bols = Array.isArray(matra?.bols) ? matra.bols : [];
      if (bols.length === 0) {
        units.push({
          token: 'S',
          sourceMatraNumber: matraIdx + 1,
          sourcePulseNumber: units.length + 1
        });
        return;
      }

      bols.forEach(bol => {
        units.push({
          token: bol,
          sourceMatraNumber: matraIdx + 1,
          sourcePulseNumber: units.length + 1
        });
      });
    });
    return units;
  }

  function buildReferenceExplanation(sourceMatras, generatedMatras, taal, speedName, script = 'roman') {
    const isHi = script === 'devanagari';
    const exampleRows = generatedMatras.slice(0, 4).map((matra, index) => ({
      generatedMatraNumber: index + 1,
      sourceRef: isHi ? `मूल मात्रा ${index + 1}` : `Source matra ${index + 1}`,
      sourceUnits: [summarizeMatraForTeaching(sourceMatras[index])],
      resultTokens: [...(matra?.bols || [])]
    }));

    return {
      shortLabel: getCleanSectionLabel(speedName, isHi ? 'ठाह' : 'Thah'),
      title: speedName || (isHi ? 'ठाह (1x)' : 'Thah (1x)'),
      summary: isHi
        ? 'यह ठाह (मूल लय) का संदर्भ है। इसमें किसी भी प्रकार का पुनर्समूहन या खाली स्थान नहीं होता है, बल्कि प्रत्येक मात्रा में एक ही मूल मात्रा होती है।'
        : 'This is the reference writing in thah. Each matra carries the original pulse before any regrouping or inserted space is introduced.',
      detailCards: [
        { label: isHi ? 'मूल पल्स' : 'Source Pulse', text: isHi ? 'प्रत्येक मात्रा में सीधे एक मुख्य पल्स पढ़ी जाती है।' : 'One main pulse is read directly in each matra.' },
        { label: isHi ? 'लेखन नियम' : 'Writing Rule', text: isHi ? 'प्रत्येक मूल मात्रा को वैसे ही पढ़ें। किसी पुनर्समूहन की आवश्यकता नहीं है।' : 'Read each source matra as it is. No regrouping is needed.' },
        { label: isHi ? 'गिनती में सहायता' : 'Counting Aid', text: isHi ? 'तेज़ लयकारियों का प्रयास करने से पहले इसे आधारभूत गति के रूप में उपयोग करें।' : 'Use this as the baseline gait before attempting faster layakaris.' },
        { label: isHi ? 'क्या स्थिर रहता है' : 'What Stays Fixed', text: isHi ? `${taal.name} अभी भी ${taal.matras} मात्राओं तक चलता है, जिसमें सम और विभाग के चिह्न अपरिवर्तित रहते हैं।` : `${taal.name} still runs for ${taal.matras} matras, with sam and vibhaag markers unchanged.` }
      ],
      practicePrompt: isHi ? 'मूल रचना को एक बार में एक मात्रा पढ़ें और तेज़ लयकारी पर जाने से पहले ताल के आवर्तन पर ताली बजाएं।' : 'Recite the source one matra at a time and clap the taal cycle before moving to a faster layakari.',
      examples: exampleRows
    };
  }

  function buildIntegerExplanation(sourceMatras, generatedMatras, taal, numerator, speedName, script = 'roman') {
    const isHi = script === 'devanagari';
    
    // Traditional Avartan Calculation Math
    const totalBols = sourceMatras.length;
    const timeRequired = totalBols / numerator;
    const startingPoint = Math.max(0, taal.matras - timeRequired);
    const wholeMatrasToLeave = Math.floor(startingPoint);
    
    const formatFraction = (val) => {
      if (Number.isInteger(val)) return val.toString();
      const whole = Math.floor(val);
      const frac = Math.round((val - whole) * numerator);
      return whole > 0 ? `${whole} ${frac}/${numerator}` : `${frac}/${numerator}`;
    };

    const timeReqStr = formatFraction(timeRequired);
    const startStr = formatFraction(startingPoint);

    const exampleRows = generatedMatras.slice(0, 4).map((matra, index) => {
      const sourceIndexes = [];
      for (let offset = 0; offset < numerator; offset++) {
        sourceIndexes.push((index * numerator + offset) % sourceMatras.length);
      }

      return {
        generatedMatraNumber: index + 1,
        sourceRef: isHi ? `मूल मात्राएं ${sourceIndexes.map(sourceIndex => sourceIndex + 1).join(', ')}` : `Source matras ${sourceIndexes.map(sourceIndex => sourceIndex + 1).join(', ')}`,
        sourceUnits: sourceIndexes.map(sourceIndex => summarizeMatraForTeaching(sourceMatras[sourceIndex])),
        resultTokens: [...(matra?.bols || [])]
      };
    });

    return {
      shortLabel: getCleanSectionLabel(speedName, `${numerator}x`),
      title: speedName || `${numerator}x`,
      summary: isHi 
        ? `${speedName} प्रत्येक लिखित मात्रा में ${numerator} लगातार मूल मात्राओं को समूहित करता है, जिससे लिखित घनत्व बढ़ता है लेकिन क्रम बरकरार रहता है।`
        : `${speedName} groups ${numerator} consecutive source matras into each written matra, so the order stays intact while the written density increases.`,
      detailCards: [
        { 
          label: isHi ? 'समय की गणना' : 'Time Calculation', 
          text: isHi 
            ? `कुल बोल (${totalBols}) ÷ ${numerator} = ${timeReqStr} मात्राएँ आवश्यक हैं।` 
            : `Total Bols (${totalBols}) ÷ ${numerator} = requires ${timeReqStr} matras.` 
        },
        { 
          label: isHi ? 'प्रारंभिक बिंदु' : 'Starting Point', 
          text: isHi 
            ? `कुल मात्राएँ (${taal.matras}) - ${timeReqStr} = ${startStr} मात्राओं के बाद शुरू होता है।` 
            : `Total Matras (${taal.matras}) - ${timeReqStr} = starts after ${startStr} matras.` 
        },
        { 
          label: isHi ? 'लेखन नियम' : 'Writing Rule', 
          text: isHi 
            ? `शुरुआत में ${wholeMatrasToLeave} मात्राएँ खाली छोड़ें या मूल ठेका बजाएं, फिर प्रत्येक मात्रा में ${numerator} बोल एक साथ लिखें।` 
            : `Leave the first ${wholeMatrasToLeave} matras empty (or play base theka), then write ${numerator} bols together in each subsequent matra.` 
        },
        { 
          label: isHi ? 'गिनती में सहायता' : 'Counting Aid', 
          text: isHi 
            ? "यदि मूल मात्रा खाली है, तो 'S' (अवग्रह) लिखें ताकि गिनती पूरी रहे।" 
            : "If a source matra is empty, write 'S' (Avagrah) so the count stays complete." 
        }
      ],
      practicePrompt: isHi ? `उत्तर को छिपाएं और लिखित परिणाम को जांचने से पहले अगली ${numerator} मूल मात्राओं को स्वयं जोड़ने का प्रयास करें।` : `Cover the answer and try combining the next ${numerator} source matras yourself before checking the written result.`,
      examples: exampleRows
    };
  }

  function buildFractionalExplanation(sourceMatras, generatedMatras, taal, numerator, denominator, speedName, script = 'roman') {
    const isHi = script === 'devanagari';
    
    // Traditional Avartan Calculation Math
    const totalBols = sourceMatras.length; 
    const timeRequired = (totalBols * denominator) / numerator;
    const startingPoint = Math.max(0, taal.matras - timeRequired);
    
    const wholeMatrasToLeave = Math.floor(startingPoint);
    const fractionalPart = startingPoint - wholeMatrasToLeave;
    const initialRestsCount = Math.round(fractionalPart * numerator);
    
    const formatFraction = (val) => {
      if (Number.isInteger(val)) return val.toString();
      const whole = Math.floor(val);
      const frac = Math.round((val - whole) * numerator);
      return whole > 0 ? `${whole} ${frac}/${numerator}` : `${frac}/${numerator}`;
    };

    const timeReqStr = formatFraction(timeRequired);
    const startStr = formatFraction(startingPoint);

    const sourceUnits = createFlattenedSourceUnits(sourceMatras);
    const numBolsNeeded = Math.ceil((taal.matras / denominator) * numerator);
    const repeatedUnits = [];

    while (repeatedUnits.length < numBolsNeeded) {
      repeatedUnits.push(...sourceUnits.map(unit => ({ ...unit })));
    }

    const trimmedUnits = repeatedUnits.slice(0, numBolsNeeded);
    const totalSubBeats = taal.matras * numerator;
    const slots = new Array(totalSubBeats).fill(null).map(() => ({ token: 'S', inserted: true }));

    trimmedUnits.forEach((unit, idx) => {
      const targetIndex = idx * denominator;
      if (targetIndex < totalSubBeats) {
        slots[targetIndex] = { ...unit, inserted: false };
      }
    });

    const exampleRows = generatedMatras.slice(0, 4).map((matra, index) => {
      const slotSlice = slots.slice(index * numerator, (index + 1) * numerator);
      const actualSourcePulses = slotSlice.filter(slot => !slot.inserted);
      const sourceMatrasUsed = [...new Set(actualSourcePulses.map(slot => slot.sourceMatraNumber))];

      return {
        generatedMatraNumber: index + 1,
        sourceRef: actualSourcePulses.length > 0
          ? (isHi ? `मूल पल्स ${actualSourcePulses.map(slot => slot.sourcePulseNumber).join(', ')} (मात्रा ${sourceMatrasUsed.join(', ')})` : `Source pulses ${actualSourcePulses.map(slot => slot.sourcePulseNumber).join(', ')} from matras ${sourceMatrasUsed.join(', ')}`)
          : (isHi ? 'केवल सम्मिलित स्थान' : 'Inserted spacing only'),
        slotTokens: slotSlice.map(slot => slot.token),
        resultTokens: [...(matra?.bols || [])]
      };
    });

    return {
      shortLabel: getCleanSectionLabel(speedName, `${numerator}/${denominator}`),
      title: speedName || `${numerator}/${denominator}`,
      summary: isHi 
        ? `${speedName} आवर्तन को ${taal.matras} मात्राओं पर रखता है, लेकिन प्रत्येक मात्रा को ${numerator} आंतरिक पल्स में उप-विभाजित किया जाता है। यहाँ हम शास्त्रीय गणना पद्धति (आवर्तन गणना) का उपयोग करते हैं।`
        : `${speedName} keeps the avartan at ${taal.matras} matras, but each matra is subdivided into ${numerator} internal pulses. Here we use the traditional calculation method.`,
      detailCards: [
        { 
          label: isHi ? 'समय की गणना' : 'Time Calculation', 
          text: isHi 
            ? `कुल बोल (${totalBols}) × (${denominator}/${numerator}) = ${timeReqStr} मात्राएँ आवश्यक हैं।` 
            : `Total Bols (${totalBols}) × (${denominator}/${numerator}) = requires ${timeReqStr} matras.` 
        },
        { 
          label: isHi ? 'प्रारंभिक बिंदु' : 'Starting Point', 
          text: isHi 
            ? `कुल मात्राएँ (${taal.matras}) - ${timeReqStr} = ${startStr} मात्राओं के बाद शुरू होता है।` 
            : `Total Matras (${taal.matras}) - ${timeReqStr} = starts after ${startStr} matras.` 
        },
        { 
          label: isHi ? 'लेखन नियम' : 'Writing Rule', 
          text: isHi 
            ? `शुरुआत में ${wholeMatrasToLeave} पूरी मात्राएँ खाली छोड़ें। अगली मात्रा में ${initialRestsCount} अवग्रह (S) लगाकर बोल लिखना शुरू करें।` 
            : `Leave the first ${wholeMatrasToLeave} full matras empty. On the next matra, place ${initialRestsCount} rest(s) ('S') before starting the bols.` 
        },
        { 
          label: isHi ? 'अवग्रह का उपयोग' : 'Using Avagrah', 
          text: isHi 
            ? "S (अवग्रह) मौन स्थानधारक है जो गणितीय रूप से आवश्यक खाली समय को पूरा करता है।" 
            : "S (Avagrah) is the silent placeholder that fulfills the mathematically required empty space." 
        }
      ],
      practicePrompt: isHi ? `गणितीय प्रारंभिक बिंदु का उपयोग करके भविष्यवाणी करें कि सेल को देखने से पहले पहला बोल कहां आना चाहिए।` : `Use the calculated starting point to predict where the first bol should land before revealing the cell.`,
      examples: exampleRows
    };
  }

  function describeLayakariSectionData({ sourceSection, generatedSection, taal, compositionType, speed = '1', speedName = '', script = 'roman' }) {
    if (!sourceSection || !generatedSection || !taal) {
      throw createLayakariError('A source section, generated section, and taal are required for explanation.', 'missing_explanation_input');
    }

    const { numerator, denominator } = parseLayakariSpeed(speed);
    const normalizedType = normalizeCompositionType(compositionType);
    const sourceMatras = getTeachingSourceMatras(sourceSection, taal);
    const generatedMatras = extractSectionMatras(generatedSection);

    if (denominator !== 1 && normalizedType !== 'theka') {
      throw createLayakariError(
        'Fractional layakaris are currently only supported for Theka compositions.',
        'fractional_non_theka'
      );
    }

    if (numerator === 1 && denominator === 1) {
      return buildReferenceExplanation(sourceMatras, generatedMatras, taal, speedName || 'Thah (1x)', script);
    }

    if (denominator === 1) {
      return buildIntegerExplanation(sourceMatras, generatedMatras, taal, numerator, speedName || speed, script);
    }

    return buildFractionalExplanation(sourceMatras, generatedMatras, taal, numerator, denominator, speedName || speed, script);
  }

  function getTaalById(taalId) {
    const taalDatabase = typeof TAAL_DATABASE !== 'undefined'
      ? TAAL_DATABASE
      : global.TAAL_DATABASE;

    if (!taalDatabase || !taalDatabase[taalId]) {
      throw createLayakariError(`Unknown taal: ${taalId || 'unspecified'}`, 'unknown_taal');
    }
    return taalDatabase[taalId];
  }

  function normalizeCompositionType(typeId) {
    if (typeof normalizeCompositionTypeId === 'function') {
      return normalizeCompositionTypeId(typeId);
    }
    return typeId || 'theka';
  }

  function generateLayakariSectionData({ sourceSection, taal, compositionType, speed = '1', speedName = '' }) {
    if (!sourceSection || !taal) {
      throw createLayakariError('A source section and taal are required.', 'missing_input');
    }

    const { numerator, denominator } = parseLayakariSpeed(speed);
    const normalizedType = normalizeCompositionType(compositionType);

    if (denominator !== 1 && normalizedType !== 'theka') {
      throw createLayakariError(
        'Fractional layakaris are currently only supported for Theka compositions.',
        'fractional_non_theka'
      );
    }

    let sourceMatras = extractSectionMatras(sourceSection);
    if (isSectionEmpty(sourceMatras)) {
      sourceMatras = createThekaSeedMatras(taal);
    }

    const resultMatras = denominator === 1
      ? buildIntegerLayakariMatras(sourceMatras, numerator)
      : buildFractionalLayakariMatras(sourceMatras, taal, numerator, denominator);

    return {
      type: sourceSection.type,
      label: buildLayakariLabel(sourceSection, speedName, speed),
      avartans: blockMatrasIntoAvartans(resultMatras, taal)
    };
  }

  function generateAllLayakariSectionsData(compositionData, options = {}) {
    const normalizedType = normalizeCompositionType(compositionData?.compositionType);
    if (normalizedType !== 'theka') {
      throw createLayakariError(
        'Generate All Layakaris currently matches the editor behavior and requires a Theka composition.',
        'generate_all_requires_theka'
      );
    }

    const taal = getTaalById(compositionData?.taalId);
    const speeds = Array.isArray(options.speeds) && options.speeds.length > 0
      ? options.speeds
      : DEFAULT_LAYAKARI_SPEEDS;

    const baseSection = getBaseSectionForGeneration(compositionData, taal, options);
    const generatedSections = speeds.map(speed =>
      generateLayakariSectionData({
        sourceSection: baseSection,
        taal,
        compositionType: 'theka',
        speed: speed.val,
        speedName: speed.name
      })
    );

    return [baseSection, ...generatedSections];
  }

  function generateAllLayakariCompositionData(compositionData, options = {}) {
    if (!compositionData || typeof compositionData !== 'object') {
      throw createLayakariError('Composition data is required.', 'missing_composition');
    }

    const nextComposition = cloneData(compositionData);
    nextComposition.sections = generateAllLayakariSectionsData(nextComposition, options);
    nextComposition.updatedAt = new Date().toISOString();
    return nextComposition;
  }

  global.LayakariCore = {
    DEFAULT_LAYAKARI_SPEEDS,
    createSeedSection,
    describeLayakariSectionData,
    generateLayakariSectionData,
    generateAllLayakariSectionsData,
    generateAllLayakariCompositionData
  };
})(window);
