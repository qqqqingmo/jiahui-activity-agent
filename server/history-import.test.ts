import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseHistoryFiles } from "./history-import.js";

function uploadedFile(name: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: "files",
    originalname: name,
    encoding: "7bit",
    mimetype: "application/octet-stream",
    size: buffer.length,
    destination: "",
    filename: name,
    path: "",
    buffer,
    stream: undefined as never
  };
}

describe("历史活动资料解析", () => {
  it("读取 Markdown 并保留中文内容", async () => {
    const result = await parseHistoryFiles([uploadedFile("活动复盘.md", Buffer.from("# 猫咪午餐会\n\n45 人在禄岛拍照并共进午餐。"))]);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].name).toBe("活动复盘.md");
    expect(result.parsed[0].text).toContain("禄岛拍照");
  });

  it("从 XLSX 工作表提取共享字符串和数字", async () => {
    const zip = new JSZip();
    zip.file("xl/sharedStrings.xml", "<sst><si><t>预算项目</t></si><si><t>午餐</t></si></sst>");
    zip.file("xl/worksheets/sheet1.xml", "<worksheet><sheetData><row><c t=\"s\"><v>0</v></c><c t=\"s\"><v>1</v></c><c><v>4500</v></c></row></sheetData></worksheet>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await parseHistoryFiles([uploadedFile("经费表.xlsx", buffer)]);
    expect(result.parsed[0].text).toContain("预算项目 | 午餐 | 4500");
  });
});
