/**
 * Client-side Word (.docx) generator.
 * Produces a genuine Office Open XML (.docx) package in pure JavaScript.
 * Opens natively in Microsoft Word, Apple Pages, Google Docs, and LibreOffice without blank pages or warnings.
 */

// CRC-32 table for ZIP checksums
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function calculateCrc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const encoder = new TextEncoder();

/**
 * Creates a valid, uncompressed (Method 0 - Stored) ZIP archive from an array of files.
 * @param {Array<{name: string, data: string | Uint8Array}>} files
 * @returns {Uint8Array}
 */
function createZipArchive(files) {
  const fileEntries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.data === "string" ? encoder.encode(f.data) : f.data;
    const crc = calculateCrc32(dataBytes);
    return {
      nameBytes,
      dataBytes,
      crc,
      size: dataBytes.length,
    };
  });

  // Calculate total buffer size
  let totalLocalSize = 0;
  let totalCentralSize = 0;

  for (const entry of fileEntries) {
    totalLocalSize += 30 + entry.nameBytes.length + entry.size;
    totalCentralSize += 46 + entry.nameBytes.length;
  }
  const totalZipSize = totalLocalSize + totalCentralSize + 22; // 22 bytes for EOCD

  const buffer = new ArrayBuffer(totalZipSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  let offset = 0;
  const centralOffsets = [];

  // Write Local File Headers and Data
  for (const entry of fileEntries) {
    centralOffsets.push(offset);

    // Local file header signature (0x04034b50)
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // Version needed (2.0)
    view.setUint16(offset + 6, 0, true); // General purpose flags
    view.setUint16(offset + 8, 0, true); // Compression method (0 = Stored)
    view.setUint16(offset + 10, 0x5000, true); // Time (10:00:00)
    view.setUint16(offset + 12, 0x5821, true); // Date (2024-01-01)
    view.setUint32(offset + 14, entry.crc, true); // CRC-32
    view.setUint32(offset + 18, entry.size, true); // Compressed size
    view.setUint32(offset + 22, entry.size, true); // Uncompressed size
    view.setUint16(offset + 26, entry.nameBytes.length, true); // File name length
    view.setUint16(offset + 28, 0, true); // Extra field length

    offset += 30;
    uint8.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;

    uint8.set(entry.dataBytes, offset);
    offset += entry.size;
  }

  const centralDirStart = offset;

  // Write Central Directory Headers
  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    const localOffset = centralOffsets[i];

    // Central directory file header signature (0x02014b50)
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // Version made by (2.0)
    view.setUint16(offset + 6, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 8, 0, true); // General purpose flags
    view.setUint16(offset + 10, 0, true); // Compression method (0 = Stored)
    view.setUint16(offset + 12, 0x5000, true); // Time
    view.setUint16(offset + 14, 0x5821, true); // Date
    view.setUint32(offset + 16, entry.crc, true); // CRC-32
    view.setUint32(offset + 20, entry.size, true); // Compressed size
    view.setUint32(offset + 24, entry.size, true); // Uncompressed size
    view.setUint16(offset + 28, entry.nameBytes.length, true); // File name length
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localOffset, true); // Relative offset of local header

    offset += 46;
    uint8.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  const centralDirSize = offset - centralDirStart;

  // Write End of Central Directory Record (EOCD)
  view.setUint32(offset, 0x06054b50, true); // Signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where central directory starts
  view.setUint16(offset + 8, fileEntries.length, true); // Number of central directory records on this disk
  view.setUint16(offset + 10, fileEntries.length, true); // Total number of central directory records
  view.setUint32(offset + 12, centralDirSize, true); // Size of central directory
  view.setUint32(offset + 16, centralDirStart, true); // Offset of start of central directory
  view.setUint16(offset + 20, 0, true); // Comment length

  return uint8;
}

function xmlEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parses markdown inline formatting (bold, italic, code) into Word XML runs.
 */
function parseInlineRunsToWordXml(text) {
  if (!text) return "";

  const runs = [];
  // Tokenize markdown runs
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      runs.push({ text: text.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("***") && token.endsWith("***")) {
      runs.push({ text: token.slice(3, -3), bold: true, italic: true });
    } else if (token.startsWith("**") && token.endsWith("**")) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("__") && token.endsWith("__")) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith("_") && token.endsWith("_")) {
      runs.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push({ text: token.slice(1, -1), font: "Consolas", color: "333333" });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    runs.push({ text: text.slice(lastIdx) });
  }

  if (runs.length === 0) {
    runs.push({ text });
  }

  return runs
    .map((r) => {
      let rPr = "";
      if (r.bold) rPr += "<w:b/>";
      if (r.italic) rPr += "<w:i/>";
      if (r.font) rPr += `<w:rFonts w:ascii="${r.font}" w:hAnsi="${r.font}"/>`;
      if (r.color) rPr += `<w:color w:val="${r.color}"/>`;
      return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(r.text)}</w:t></w:r>`;
    })
    .join("");
}

/**
 * Converts markdown text into Word Document XML paragraphs.
 */
function markdownToWordDocumentXml(markdown, title, agentName) {
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const pNodes = [];

  // Header: Title
  pNodes.push(`
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="0" w:after="100"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="38"/>
          <w:szCs w:val="38"/>
          <w:color w:val="171717"/>
        </w:rPr>
        <w:t>${xmlEscape(title)}</w:t>
      </w:r>
    </w:p>
  `);

  // Subtitle / Metadata
  pNodes.push(`
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="240"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="8" w:color="EB573D"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="666666"/>
          <w:sz w:val="19"/>
        </w:rPr>
        <w:t>Generated by Nexora Multi-Agent Learning Assistant · Agent: ${xmlEscape(agentName)} · ${xmlEscape(dateStr)} at ${xmlEscape(timeStr)}</w:t>
      </w:r>
    </w:p>
  `);

  // Normalize markdown lines
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  let inCodeBlock = false;
  let codeBlockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Handle fenced code block toggle
    if (rawLine.trim().startsWith("```")) {
      if (inCodeBlock) {
        // Close code block
        const codeText = codeBlockLines.join("\n");
        pNodes.push(`
          <w:p>
            <w:pPr>
              <w:spacing w:before="120" w:after="120"/>
              <w:shd w:val="clear" w:color="auto" w:fill="F4F4F2"/>
              <w:ind w:left="360" w:right="360"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>
                <w:sz w:val="19"/>
                <w:color w:val="2D3748"/>
              </w:rPr>
              <w:t xml:space="preserve">${xmlEscape(codeText)}</w:t>
            </w:r>
          </w:p>
        `);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith("### ")) {
      const headingText = trimmed.replace(/^###\s+/, "");
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading3"/>
            <w:spacing w:before="220" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="24"/>
              <w:color w:val="171717"/>
            </w:rPr>
            <w:t>${xmlEscape(headingText)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const headingText = trimmed.replace(/^##\s+/, "");
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading2"/>
            <w:spacing w:before="280" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="27"/>
              <w:color w:val="171717"/>
            </w:rPr>
            <w:t>${xmlEscape(headingText)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      const headingText = trimmed.replace(/^#\s+/, "");
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
            <w:spacing w:before="340" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="32"/>
              <w:color w:val="171717"/>
            </w:rPr>
            <w:t>${xmlEscape(headingText)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    // Bullet points: - item, * item
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1];
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="60"/>
            <w:ind w:left="480" w:hanging="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:color w:val="EB573D"/>
              <w:b/>
            </w:rPr>
            <w:t>• </w:t>
          </w:r>
          ${parseInlineRunsToWordXml(itemText)}
        </w:p>
      `);
      continue;
    }

    // Numbered / Lettered lists: 1. or 1) or A) or (A)
    const numberedMatch = trimmed.match(/^(\d+[.)]|[A-Da-d][.)]|\([A-Da-d]\))\s+(.*)$/);
    if (numberedMatch) {
      const prefix = numberedMatch[1];
      const itemText = numberedMatch[2];
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="60" w:after="60"/>
            <w:ind w:left="480" w:hanging="320"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="171717"/>
            </w:rPr>
            <w:t>${xmlEscape(prefix)} </w:t>
          </w:r>
          ${parseInlineRunsToWordXml(itemText)}
        </w:p>
      `);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quoteText = trimmed.replace(/^>\s*/, "");
      pNodes.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="100" w:after="100"/>
            <w:ind w:left="480"/>
            <w:pBdr>
              <w:left w:val="single" w:sz="18" w:space="12" w:color="EB573D"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:i/>
              <w:color w:val="555555"/>
            </w:rPr>
            <w:t>${xmlEscape(quoteText)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    // Regular body paragraph
    pNodes.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:before="60" w:after="100" w:line="276" w:lineRule="auto"/>
        </w:pPr>
        ${parseInlineRunsToWordXml(trimmed)}
      </w:p>
    `);
  }

  // Footer note
  pNodes.push(`
    <w:p>
      <w:pPr>
        <w:spacing w:before="360" w:after="0"/>
        <w:pBdr>
          <w:top w:val="single" w:sz="6" w:space="8" w:color="E5E5E0"/>
        </w:pBdr>
        <w:jc w:val="right"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="17"/>
          <w:color w:val="999999"/>
        </w:rPr>
        <w:t>Nexora AI Multi-Agent Learning Assistant · End of Document</w:t>
      </w:r>
    </w:p>
  `);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${pNodes.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="171717"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
      <w:color w:val="171717"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="27"/>
      <w:color w:val="171717"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="171717"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="38"/>
      <w:color w:val="171717"/>
    </w:rPr>
  </w:style>
</w:styles>`;

/**
 * Downloads a single agent response as a true Office Open XML Word (.docx) document.
 * Opens seamlessly in Microsoft Word, Apple Pages, Google Docs, and LibreOffice with NO blank page!
 *
 * @param {string} text - Response text or markdown
 * @param {string} agentKey - The agent key (e.g. "mcq_generator")
 */
export function downloadResponseAsDoc(text, agentKey = "assistant") {
  if (!text) return;

  const agentTitles = {
    summarizer: "Summary & Key Points",
    mcq_generator: "MCQ Practice Questions",
    notes_maker: "Study & Revision Notes",
    exam_prep_agent: "Exam Preparation Predictor",
    concept_explainer: "Concept Explanation",
    search_agent: "Verified Research Report",
    chat_agent: "Learning Assistant Response",
  };

  const title = agentTitles[agentKey] || "StudyMate Response";
  const agentDisplayName = agentKey.replace(/_/g, " ");

  const documentXml = markdownToWordDocumentXml(text, title, agentDisplayName);

  // Bundle into genuine .docx ZIP archive
  const zipBytes = createZipArchive([
    { name: "[Content_Types].xml", data: CONTENT_TYPES_XML },
    { name: "_rels/.rels", data: ROOT_RELS_XML },
    { name: "word/_rels/document.xml.rels", data: DOC_RELS_XML },
    { name: "word/styles.xml", data: STYLES_XML },
    { name: "word/document.xml", data: documentXml },
  ]);

  const blob = new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
