import path from "node:path";
import { AppError } from "./errors.js";

export interface RemoteFileReference {
  name: string;
  url: string;
  contentType?: string;
  size?: number;
}

const maxFileSize = 8 * 1024 * 1024;
const maxFiles = 30;

function allowedHosts() {
  return new Set((process.env.R2_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
}

function validateUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError("INVALID_FILE_URL", "资料地址格式无效", 400);
  }
  const allowHttp = process.env.ALLOW_HTTP_FILE_URLS === "true" && process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    throw new AppError("INVALID_FILE_URL", "资料地址必须使用 HTTPS", 400);
  }
  if (parsed.username || parsed.password) throw new AppError("INVALID_FILE_URL", "资料地址不能包含账号信息", 400);
  const hosts = allowedHosts();
  if (hosts.size === 0) throw new AppError("FILE_SOURCE_NOT_CONFIGURED", "服务尚未配置资料存储域名", 503);
  if (!hosts.has(parsed.hostname.toLowerCase())) throw new AppError("FILE_SOURCE_NOT_ALLOWED", "资料地址不属于允许的存储域名", 403);
  return parsed;
}

async function readLimitedBody(response: Response) {
  if (!response.body) throw new AppError("FILE_DOWNLOAD_FAILED", "资料下载没有返回内容", 502, true);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxFileSize) {
      await reader.cancel();
      throw new AppError("FILE_TOO_LARGE", "单个资料文件不能超过 8 MB", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export async function downloadRemoteFiles(references: RemoteFileReference[]): Promise<Express.Multer.File[]> {
  if (references.length === 0) throw new AppError("NO_FILES", "没有收到资料文件", 400);
  if (references.length > maxFiles) throw new AppError("TOO_MANY_FILES", "单次最多处理 30 个文件", 413);

  const files: Express.Multer.File[] = [];
  for (const reference of references) {
    if (reference.size !== undefined && reference.size > maxFileSize) {
      throw new AppError("FILE_TOO_LARGE", `${reference.name} 超过 8 MB`, 413);
    }
    const url = validateUrl(reference.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { redirect: "error", signal: controller.signal });
      if (!response.ok) throw new AppError("FILE_DOWNLOAD_FAILED", `资料下载失败（${response.status}）`, 502, response.status >= 500);
      const length = Number(response.headers.get("content-length") || 0);
      if (Number.isFinite(length) && length > maxFileSize) throw new AppError("FILE_TOO_LARGE", `${reference.name} 超过 8 MB`, 413);
      const buffer = await readLimitedBody(response);
      const name = path.basename(reference.name).slice(0, 240);
      if (!name || name === "." || name === "..") throw new AppError("INVALID_FILE_NAME", "资料文件名无效", 400);
      files.push({
        fieldname: "files",
        originalname: name,
        encoding: "7bit",
        mimetype: reference.contentType || response.headers.get("content-type") || "application/octet-stream",
        size: buffer.length,
        buffer,
        destination: "",
        filename: name,
        path: "",
        stream: undefined as never
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("FILE_DOWNLOAD_TIMEOUT", "资料下载超时", 504, true, { cause: error });
      }
      throw new AppError("FILE_DOWNLOAD_FAILED", "无法下载资料文件", 502, true, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
  return files;
}
