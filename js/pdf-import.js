/**
 * bhatkhande.io — PDF Import
 * Restores a composition from PDFs exported by the app after PDF import support was added.
 */

class PdfImport {
  static LINK_PATTERN = /https:\/\/bhatkhande\.io\/pdf-import\/v1\/(\d{4})-of-(\d{4})\/([A-Za-z0-9_-]+)/g;
  static TEXT_PATTERN = /BHATKHANDE_PDF_IMPORT_CHUNK\s+(\d{4})\/(\d{4})\s+([A-Za-z0-9_-]+)/g;

  static async importFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const encodedPayload = await PdfImport._extractEncodedPayload(bytes);

    if (!encodedPayload) {
      throw new Error('This PDF does not contain an embedded bhatkhande.io composition. Export it again from the current app version and try once more.');
    }

    let envelope;
    try {
      envelope = JSON.parse(PdfImport._decodeBase64Url(encodedPayload));
    } catch (err) {
      throw new Error('The embedded composition data in this PDF could not be decoded.');
    }

    if (
      !envelope ||
      envelope.app !== 'bhatkhande.io' ||
      envelope.kind !== 'composition-pdf-export' ||
      Number(envelope.version) !== 1 ||
      !envelope.composition
    ) {
      throw new Error('This PDF is not a supported bhatkhande.io export.');
    }

    return Composition.fromJSON(envelope.composition);
  }

  static async _extractEncodedPayload(bytes) {
    const candidateTexts = [PdfImport._decodeLatin1(bytes)];
    const inflatedTexts = await PdfImport._inflateFlateStreams(bytes);
    candidateTexts.push(...inflatedTexts);

    return PdfImport._extractFromMatches(candidateTexts, PdfImport.LINK_PATTERN)
      || PdfImport._extractFromMatches(candidateTexts, PdfImport.TEXT_PATTERN);
  }

  static _extractFromMatches(texts, pattern) {
    const chunks = new Map();
    let expectedTotal = 0;

    texts.forEach(text => {
      if (!text) return;

      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        const partNumber = parseInt(match[1], 10);
        const totalParts = parseInt(match[2], 10);
        const payloadChunk = match[3] || '';

        if (Number.isFinite(partNumber) && partNumber > 0 && payloadChunk) {
          expectedTotal = Math.max(expectedTotal, totalParts || 0);
          if (!chunks.has(partNumber)) chunks.set(partNumber, payloadChunk);
        }

        match = pattern.exec(text);
      }
    });

    if (chunks.size === 0) return '';

    const total = expectedTotal || Math.max(...chunks.keys());
    const orderedChunks = [];

    for (let partNumber = 1; partNumber <= total; partNumber++) {
      const chunk = chunks.get(partNumber);
      if (!chunk) {
        throw new Error('The PDF import payload looks incomplete. Please export the PDF again from the app and retry.');
      }
      orderedChunks.push(chunk);
    }

    return orderedChunks.join('');
  }

  static async _inflateFlateStreams(bytes) {
    if (typeof DecompressionStream !== 'function') return [];

    const sourceText = PdfImport._decodeLatin1(bytes);
    const inflated = [];
    let searchStart = 0;

    while (true) {
      const filterIndex = sourceText.indexOf('/FlateDecode', searchStart);
      if (filterIndex === -1) break;

      const streamIndex = sourceText.indexOf('stream', filterIndex);
      if (streamIndex === -1) break;

      let dataStart = streamIndex + 6;
      if (sourceText[dataStart] === '\r' && sourceText[dataStart + 1] === '\n') dataStart += 2;
      else if (sourceText[dataStart] === '\n' || sourceText[dataStart] === '\r') dataStart += 1;

      const endStreamIndex = sourceText.indexOf('endstream', dataStart);
      if (endStreamIndex === -1) break;

      let dataEnd = endStreamIndex;
      if (sourceText[dataEnd - 2] === '\r' && sourceText[dataEnd - 1] === '\n') dataEnd -= 2;
      else if (sourceText[dataEnd - 1] === '\n' || sourceText[dataEnd - 1] === '\r') dataEnd -= 1;

      if (dataEnd > dataStart) {
        try {
          const decompressed = await PdfImport._inflateBytes(bytes.slice(dataStart, dataEnd));
          if (decompressed) inflated.push(PdfImport._decodeLatin1(new Uint8Array(decompressed)));
        } catch (err) {
          // Ignore unrelated or malformed streams and keep scanning the rest.
        }
      }

      searchStart = endStreamIndex + 9;
    }

    return inflated;
  }

  static async _inflateBytes(streamBytes) {
    const decompressor = new DecompressionStream('deflate');
    const response = new Response(new Blob([streamBytes]).stream().pipeThrough(decompressor));
    return response.arrayBuffer();
  }

  static _decodeBase64Url(encoded) {
    const normalized = String(encoded || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddingLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(paddingLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let idx = 0; idx < binary.length; idx++) {
      bytes[idx] = binary.charCodeAt(idx);
    }

    return new TextDecoder().decode(bytes);
  }

  static _decodeLatin1(bytes) {
    try {
      return new TextDecoder('latin1').decode(bytes);
    } catch (err) {
      let text = '';
      const chunkSize = 0x8000;
      for (let idx = 0; idx < bytes.length; idx += chunkSize) {
        text += String.fromCharCode.apply(null, bytes.subarray(idx, idx + chunkSize));
      }
      return text;
    }
  }
}
