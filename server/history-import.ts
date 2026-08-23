import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";

export interface ParsedHistoryFile {
  name: string;
  text: string;
}

const plainTextExtensions = new Set([".txt", ".md", ".markdown", ".csv", ".tsv", ".json"]);

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 20_000);
}

async function extractSpreadsheet(file: Express.Multer.File) {
  const workbook = await JSZip.loadAsync(file.buffer);
  const sharedXml = await workbook.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedXml
    ? Array.from(sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)).map((match) => {
      return Array.from(match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join("");
    })
    : [];
  const lines: string[] = [];
  const sheets = Object.keys(workbook.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  for (const sheetName of sheets) {
    const xml = await workbook.file(sheetName)?.async("text");
    if (!xml) continue;
    lines.push(`工作表：${path.basename(sheetName, ".xml")}`);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const type = /\bt="([^"]+)"/.exec(cell[1])?.[1];
        const inline = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(cell[2])?.[1];
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1] || inline || "";
        cells.push(type === "s" ? sharedStrings[Number(raw)] || "" : decodeXml(raw));
      }
      if (cells.some(Boolean)) lines.push(cells.join(" | "));
    }
  }
  return normalizeText(lines.join("\n"));
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function parseHistoryFiles(files: Express.Multer.File[]) {
  const parsed: ParsedHistoryFile[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const name = decodedName.includes("�") ? file.originalname : decodedName;
    const extension = path.extname(name).toLowerCase();
    try {
      let text = "";
      if (plainTextExtensions.has(extension)) {
        text = normalizeText(file.buffer.toString("utf8"));
      } else if (extension === ".docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = normalizeText(result.value);
      } else if (extension === ".xlsx") {
        text = await extractSpreadsheet(file);
      } else {
        skipped.push(name);
        continue;
      }
      if (text.length >= 20) parsed.push({ name, text });
      else skipped.push(name);
    } catch {
      skipped.push(name);
    }
  }

  return { parsed, skipped };
}
