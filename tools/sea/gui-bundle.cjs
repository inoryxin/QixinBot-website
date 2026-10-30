#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tools/store-gui.mjs
var import_node_http = __toESM(require("node:http"), 1);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var import_node_url = require("node:url");
var import_node_child_process = require("node:child_process");

// tools/lib-anzu.mjs
var import_node_zlib = require("node:zlib");
function parseManifest(text) {
  const out = {};
  for (const m of text.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]*)"/gm)) {
    if (!(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}
function listZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66e3); i--) {
    if (buf.readUInt32LE(i) === 101010256) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("\u4E0D\u662F\u5408\u6CD5\u7684 zip\uFF08\u627E\u4E0D\u5230 EOCD\uFF09");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 33639248) throw new Error("zip \u4E2D\u592E\u76EE\u5F55\u635F\u574F");
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString("utf8");
    const lnLen = buf.readUInt16LE(lho + 26);
    const leLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lnLen + leLen;
    const data = buf.slice(dataStart, dataStart + csize);
    out.push({ name, data: method === 8 ? (0, import_node_zlib.inflateRawSync)(data) : data });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// tools/store-gui.mjs
var import_meta = {};
function isSeaRuntime() {
  try {
    return typeof require === "function" && require("node:sea").isSea();
  } catch {
    return false;
  }
}
var SEA = isSeaRuntime();
var EXE_DIR = SEA ? (0, import_node_path.dirname)(process.execPath) : null;
var CFG_DEFAULT = {
  giteaUrl: "http://10.0.0.140:30008",
  giteaToken: "",
  githubToken: "",
  proxy: "http://127.0.0.1:7890",
  giteaOwner: "inoryxin",
  githubOwner: "inoryxin",
  pluginsRepo: "QixinBot-go-plugins",
  deployKeyPath: "",
  nasYamlPath: "C:/Users/anzu/Documents/xin/nas.yaml",
  // exe 模式下必填：官网（website 仓库）本地路径，registry/分类/部署都在里面
  repoPath: "C:/Users/anzu/Documents/xin/zcode/QixinBot-website"
};
var CFG = { ...CFG_DEFAULT };
var ROOT;
var CONFIG_PATH;
if (SEA) {
  CONFIG_PATH = (0, import_node_path.join)(EXE_DIR, "gui-config.json");
  if ((0, import_node_fs.existsSync)(CONFIG_PATH)) CFG = { ...CFG_DEFAULT, ...JSON.parse((0, import_node_fs.readFileSync)(CONFIG_PATH, "utf8")) };
  else saveCfg();
  ROOT = CFG.repoPath || CFG_DEFAULT.repoPath;
} else {
  ROOT = (0, import_node_path.resolve)((0, import_node_path.dirname)((0, import_node_url.fileURLToPath)(import_meta.url)), "..");
  CONFIG_PATH = (0, import_node_path.join)(ROOT, "tools", "gui-config.json");
  if ((0, import_node_fs.existsSync)(CONFIG_PATH)) CFG = { ...CFG_DEFAULT, ...JSON.parse((0, import_node_fs.readFileSync)(CONFIG_PATH, "utf8")) };
}
var saveCfg = () => (0, import_node_fs.writeFileSync)(CONFIG_PATH, JSON.stringify(CFG, null, 2));
var REG_PATH = () => (0, import_node_path.join)(ROOT, "docs", "plugins", "registry.json");
var CATS_PATH = () => (0, import_node_path.join)(ROOT, "docs", "plugins", "categories.json");
var PORT = 7802;
function seaAsset(name) {
  if (SEA) {
    const buf = require("node:sea").getAsset(name);
    return Buffer.from(buf);
  }
  return (0, import_node_fs.readFileSync)((0, import_node_path.join)((0, import_node_path.dirname)((0, import_node_url.fileURLToPath)(import_meta.url)), name));
}
async function gitea(path, { method = "GET", body } = {}) {
  const res = await fetch(`${CFG.giteaUrl}/api/v1${path}`, {
    method,
    headers: { Authorization: `token ${CFG.giteaToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : void 0
  });
  const text = await res.text();
  let json2 = null;
  try {
    json2 = JSON.parse(text);
  } catch {
  }
  return { status: res.status, json: json2, text };
}
function gh(path, { method = "GET", body } = {}) {
  const auth = CFG.githubToken ? `-H "Authorization: Bearer ${CFG.githubToken}"` : "";
  const data = body ? `-d @-` : "";
  const out = (0, import_node_child_process.execSync)(
    `curl -sL -m 120 -x ${CFG.proxy} ${auth} -H "Accept: application/vnd.github+json" -X ${method} ${data} "${`https://api.github.com${path}`}"`,
    { maxBuffer: 256 * 1024 * 1024, input: body ? JSON.stringify(body) : void 0 }
  );
  try {
    return { status: 200, json: JSON.parse(out.toString("utf8")) };
  } catch {
    return { status: 0, json: null };
  }
}
function dl(url, useProxy) {
  const p = useProxy ? `-x ${CFG.proxy}` : "";
  return (0, import_node_child_process.execSync)(`curl -sL -m 300 ${p} "${url}"`, { maxBuffer: 256 * 1024 * 1024 });
}
function gitRegistryCommit(msg) {
  (0, import_node_child_process.execSync)(`git add docs/plugins/registry.json && git commit -m ${JSON.stringify(msg)} && git push`, {
    cwd: ROOT,
    stdio: "pipe"
  });
}
function scanPackage(raw) {
  const entries = listZipEntries(raw);
  const mEntry = entries.find((e) => e.name === "manifest.toml");
  const man = mEntry ? parseManifest(mEntry.data.toString("utf8")) : {};
  const mRaw = mEntry ? mEntry.data.toString("utf8") : "";
  const TEXT_RE = /\.(js|mjs|cjs|py|json|toml|css|html|md|sh)$/i;
  const urls = /* @__PURE__ */ new Set();
  const flags = [];
  const SUSPICIOUS = [
    [/eval\s*\(/, "eval()"],
    [/new\s+Function/, "new Function"],
    [/child_process|execSync|spawnSync|exec\(/, "\u5B50\u8FDB\u7A0B\u8C03\u7528"],
    [/\.env\b|cookie|password|passwd|credential/i, "\u51ED\u636E\u5173\u952E\u8BCD"],
    [/writeFileSync|rmSync|unlink/i, "\u6587\u4EF6\u5199\u5165/\u5220\u9664"],
    [/registry|startup|schtasks|crontab/i, "\u6301\u4E45\u5316\u7EBF\u7D22"]
  ];
  for (const e of entries) {
    if (!TEXT_RE.test(e.name) || e.data.length > 2 * 1024 * 1024) continue;
    const text = e.data.toString("utf8");
    for (const u of text.matchAll(/https?:\/\/[\w.-]+(?:\/[\w./?%&=-]*)?/g)) urls.add(u[0]);
    for (const [re2, label] of SUSPICIOUS) if (re2.test(text)) flags.push(`${label} \u2190 ${e.name}`);
  }
  return { entries, man, mRaw, urls: [...urls].sort(), flags: [...new Set(flags)] };
}
function issueFields(body) {
  const fields = {};
  const re = /### ([^\n]+)\n([\s\S]*?)(?=\n+### |\n*$)/g;
  let m;
  while (m = re.exec(body ?? "")) fields[m[1].trim()] = m[2].trim();
  return fields;
}
function readCats() {
  return JSON.parse((0, import_node_fs.readFileSync)(CATS_PATH(), "utf8"));
}
var catMap = () => Object.fromEntries(Object.entries(readCats()).map(([k, v]) => [v, k]));
function buildEntry(f, man, issue, mRaw) {
  return {
    id: man.id ?? f["\u63D2\u4EF6 ID"] ?? "",
    name: f["\u63D2\u4EF6\u4E2D\u6587\u540D"] || man.name || "",
    tier: "third-party",
    kind: man.kind === "theme" ? "theme" : "plugin",
    category: catMap()[f["\u5206\u7C7B"]] ?? "tool",
    description: f["\u4E00\u53E5\u8BDD\u7B80\u4ECB"] || man.description || "",
    language: f["\u8BED\u8A00"] || "Node.js",
    deps: (f["\u8FD0\u884C\u4F9D\u8D56"] ?? "").split(/[、,，\s]+/).filter(Boolean),
    permissions: String(man.permissions ?? "").split(/[[\]",\s]+/).filter((s) => s.startsWith("onebot.")),
    observe: /observe\s*=\s*true/.test(mRaw),
    version: man.version ?? "?",
    author: issue.user?.login ?? "\u672A\u77E5",
    repo: f["\u6E90\u7801\u4ED3\u5E93\u5730\u5740"] ?? "",
    package: f[".anzu \u4E0B\u8F7D\u76F4\u94FE"] ?? "",
    fingerprint: (f["\u7B7E\u540D\u516C\u94A5\u6216\u6307\u7EB9"] ?? "").split("\n")[0] || null,
    tags: []
  };
}
var reviewCache = /* @__PURE__ */ new Map();
async function doReview(platform, num) {
  let issue, download;
  if (platform === "gitea") {
    const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}`);
    if (r.status !== 200) throw new Error(`issue \u62C9\u53D6\u5931\u8D25 ${r.status}`);
    issue = r.json;
    const mm = (issue.body ?? "").match(/### \.anzu 下载直链\n+([^\n]+)/);
    download = mm?.[1]?.trim();
  } else {
    const r = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}`);
    issue = r.json;
    if (!issue?.title) throw new Error("issue \u62C9\u53D6\u5931\u8D25\uFF08GitHub\uFF09");
    const mm = (issue.body ?? "").match(/### \.anzu 下载直链\n+([^\n]+)/);
    download = mm?.[1]?.trim();
  }
  const fields = issueFields(issue.body);
  if (!download) throw new Error("issue \u91CC\u6CA1\u6709 .anzu \u4E0B\u8F7D\u76F4\u94FE");
  const raw = download.includes("github.com") || download.includes("githubusercontent") ? dl(download, true) : dl(download, false);
  const scan = scanPackage(raw);
  const report = {
    platform,
    num,
    title: issue.title,
    author: issue.user?.login,
    created: issue.created_at,
    fields,
    man: scan.man,
    urls: scan.urls,
    flags: scan.flags,
    files: scan.entries.map((e) => ({ name: e.name, size: e.data.length }))
  };
  const checks = [];
  checks.push({ ok: (fields["\u63D2\u4EF6 ID"] ?? "") === scan.man.id, label: `\u63D2\u4EF6 ID \u4E00\u81F4\uFF08issue=${fields["\u63D2\u4EF6 ID"] ?? "\u2014"} / \u5305=${scan.man.id ?? "\u2014"}\uFF09` });
  checks.push({ ok: !!fields["\u7B7E\u540D\u516C\u94A5\u6216\u6307\u7EB9"], label: "\u5DF2\u63D0\u4EA4\u7B7E\u540D\u516C\u94A5/\u6307\u7EB9" });
  checks.push({ ok: !!fields["\u6E90\u7801\u4ED3\u5E93\u5730\u5740"], label: "\u5DF2\u586B\u6E90\u7801\u4ED3\u5E93" });
  checks.push({ ok: CAT[fields["\u5206\u7C7B"]] != null, label: `\u5206\u7C7B\u6709\u6548\uFF08${fields["\u5206\u7C7B"] ?? "\u2014"}\uFF09` });
  checks.push({ ok: scan.flags.length === 0, label: scan.flags.length ? `\u53EF\u7591\u6A21\u5F0F ${scan.flags.length} \u9879\u5F85\u4EBA\u5DE5\u786E\u8BA4` : "\u5B89\u5168\u626B\u63CF\u65E0\u53EF\u7591\u6A21\u5F0F" });
  const concerns = checks.filter((c) => !c.ok);
  report.checks = checks;
  report.verdict = concerns.length === 0 ? "ok" : "concerns";
  report.entry = buildEntry(fields, scan.man, issue, scan.mRaw);
  reviewCache.set(`${platform}:${num}`, { ...report, raw });
  return report;
}
function readReg() {
  return JSON.parse((0, import_node_fs.readFileSync)(REG_PATH(), "utf8"));
}
function writeReg(list) {
  (0, import_node_fs.writeFileSync)(REG_PATH(), JSON.stringify(list, null, 2) + "\n");
}
var SKIP = /* @__PURE__ */ new Set([".git", "node_modules", "dist", "build", "__pycache__", ".DS_Store"]);
function collectDir(dir, destPrefix, out) {
  for (const entry of (0, import_node_fs.readdirSync)(dir)) {
    if (SKIP.has(entry)) continue;
    const full = (0, import_node_path.join)(dir, entry);
    if ((0, import_node_fs.statSync)(full).isDirectory()) collectDir(full, `${destPrefix}/${entry}`, out);
    else if ((0, import_node_fs.statSync)(full).size <= 2 * 1024 * 1024) out.push({ path: `${destPrefix}/${entry}`, buf: (0, import_node_fs.readFileSync)(full) });
  }
}
async function uploadPublish({ target, anzu, yes }) {
  if (!target || !(0, import_node_fs.existsSync)(target)) throw new Error("\u8DEF\u5F84\u4E0D\u5B58\u5728");
  const files = [];
  let id, ver, name, manifestText;
  if ((0, import_node_fs.statSync)(target).isDirectory()) {
    const mPath = (0, import_node_path.join)(target, "manifest.toml");
    if (!(0, import_node_fs.existsSync)(mPath)) throw new Error("\u76EE\u5F55\u91CC\u6CA1\u6709 manifest.toml");
    manifestText = (0, import_node_fs.readFileSync)(mPath, "utf8");
    ({ id, version: ver, name } = parseManifest(manifestText));
    collectDir(target, `src/${(0, import_node_path.basename)((0, import_node_path.resolve)(target))}`, files);
    const anzuFile = anzu ?? [(0, import_node_path.join)(target, `${id}.anzu`), (0, import_node_path.join)((0, import_node_path.dirname)(target), `${id}.anzu`)].find((p) => (0, import_node_fs.existsSync)(p));
    if (anzuFile) files.push({ path: `packages/${id}.anzu`, buf: (0, import_node_fs.readFileSync)(anzuFile) });
  } else {
    const raw = (0, import_node_fs.readFileSync)(target);
    manifestText = listZipEntries(raw).find((e) => e.name === "manifest.toml")?.data.toString("utf8") ?? "";
    if (!manifestText) throw new Error("\u5305\u91CC\u6CA1\u6709 manifest.toml");
    ({ id, version: ver, name } = parseManifest(manifestText));
    files.push({ path: `packages/${id}.anzu`, buf: raw });
  }
  if (!id) throw new Error("manifest \u7F3A id");
  const kind = manifestText.includes('kind = "theme"') ? "\u4E3B\u9898" : "\u63D2\u4EF6";
  const message = `\u53D1\u5E03${kind} ${name}(${id}) v${ver ?? "?"}\uFF08\u7BA1\u7406\u53F0\u4E0A\u4F20\uFF09`;
  const plan = [];
  for (const f of files) {
    const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/${f.path}?ref=main`);
    if (r.status === 200) f.sha = r.json.sha;
    plan.push({ path: f.path, size: f.buf.length, update: !!f.sha });
  }
  if (!yes) return { dryRun: true, files: plan, message };
  try {
    const res = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/changefiles`, {
      method: "POST",
      body: { branch: "main", message, files: files.map((f) => ({ operation: f.sha ? "update" : "create", path: f.path, content_base64: f.buf.toString("base64"), ...f.sha ? { sha: f.sha } : {} })) }
    });
    if (res.status >= 300) throw new Error("changefiles " + res.status);
  } catch {
    for (const f of files) {
      const body = { branch: "main", content: f.buf.toString("base64"), message };
      if (f.sha) body.sha = f.sha;
      const res = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/${f.path}`, { method: "PUT", body });
      if (res.status >= 300) throw new Error(`PUT ${f.path} ${res.status}`);
    }
  }
  return { dryRun: false, files: plan, message };
}
function deploySite() {
  let keyPath = CFG.deployKeyPath;
  if (!keyPath && CFG.nasYamlPath && (0, import_node_fs.existsSync)(CFG.nasYamlPath)) {
    const yaml = (0, import_node_fs.readFileSync)(CFG.nasYamlPath, "utf8");
    const m = yaml.match(/private_key: \|\n((?: {8}.+\n?)+)/);
    if (m) {
      keyPath = (0, import_node_path.join)((0, import_node_os.tmpdir)(), "op_key");
      (0, import_node_fs.writeFileSync)(keyPath, m[1].split("\n").map((l) => l.slice(8)).join("\n"));
      (0, import_node_child_process.execSync)(`icacls "${keyPath}" /inheritance:r /grant:r "%username%":F`, { shell: "cmd.exe", stdio: "pipe" });
    }
  }
  if (!keyPath || !(0, import_node_fs.existsSync)(keyPath)) throw new Error("\u6CA1\u6709\u90E8\u7F72\u79C1\u94A5\uFF08\u8BBE\u7F6E\u91CC\u586B deployKeyPath \u6216\u786E\u8BA4 nas.yaml \u53EF\u8BFB\uFF09");
  const log = [];
  const run = (cmd) => {
    log.push("$ " + cmd);
    log.push((0, import_node_child_process.execSync)(cmd, { cwd: ROOT, stdio: "pipe", shell: "bash.exe" }).toString());
  };
  run("npx vitepress build docs 2>&1 | tail -2");
  run("tar -C docs/.vitepress/dist -czf /tmp/site.tar.gz .");
  run(`scp -i "${keyPath}" -o StrictHostKeyChecking=accept-new /tmp/site.tar.gz root@10.0.0.123:/tmp/site.tar.gz`);
  run(`ssh -i "${keyPath}" -o StrictHostKeyChecking=accept-new root@10.0.0.123 "rm -rf /opt/qixinbot-site/* && tar -C /opt/qixinbot-site -xzf /tmp/site.tar.gz && rm /tmp/site.tar.gz"`);
  return log;
}
function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let b = "";
  for await (const c of req) b += c;
  return b ? JSON.parse(b) : {};
}
var server = import_node_http.default.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(seaAsset("store-gui.html"));
    }
    if (url.pathname === "/api/config") {
      if (req.method === "GET") return json(res, 200, { ...CFG, giteaToken: CFG.giteaToken ? "\u2022\u2022\u2022\u2022" + CFG.giteaToken.slice(-4) : "", githubToken: CFG.githubToken ? "\u2022\u2022\u2022\u2022" + CFG.githubToken.slice(-4) : "", hasGiteaToken: !!CFG.giteaToken, hasGithubToken: !!CFG.githubToken });
      const b = await readBody(req);
      for (const k of ["giteaUrl", "giteaToken", "githubToken", "proxy", "giteaOwner", "githubOwner", "pluginsRepo", "deployKeyPath", "nasYamlPath"]) {
        if (typeof b[k] === "string" && b[k] && !b[k].startsWith("\u2022\u2022\u2022\u2022")) CFG[k] = b[k];
      }
      saveCfg();
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/compare" && req.method === "GET") {
      const [g, h, reg] = await Promise.all([
        gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages`),
        Promise.resolve(gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages`)),
        Promise.resolve(readReg())
      ]);
      if (g.status !== 200) throw new Error(`Gitea API ${g.status}\uFF1A\u68C0\u67E5\u8BBE\u7F6E\u91CC\u7684 token / \u4ED3\u5E93\u5F52\u5C5E`);
      if (!Array.isArray(h.json)) throw new Error("GitHub API \u5931\u8D25\uFF1A\u68C0\u67E5\u7F51\u7EDC\u4EE3\u7406\u6216 token");
      const gMap = new Map((g.json ?? []).map((e) => [e.name.replace(/\.anzu$/, ""), e]));
      const hMap = new Map((h.json ?? []).map((e) => [e.name.replace(/\.anzu$/, ""), e]));
      const regMap = new Map(reg.map((e) => [e.id, e]));
      const ids = [.../* @__PURE__ */ new Set([...gMap.keys(), ...hMap.keys(), ...regMap.keys()])].sort();
      const rows = ids.map((id) => ({
        id,
        gitea: gMap.has(id),
        giteaSize: gMap.get(id)?.size ?? 0,
        github: hMap.has(id),
        githubSize: hMap.get(id)?.size ?? 0,
        inStore: regMap.has(id),
        storeVersion: regMap.get(id)?.version ?? null,
        storeTier: regMap.get(id)?.tier ?? null
      }));
      return json(res, 200, { rows, regCount: reg.length });
    }
    if (url.pathname === "/api/sync" && req.method === "POST") {
      const { direction, ids } = await readBody(req);
      const out = [];
      for (const id of ids) {
        const name = `${id}.anzu`;
        if (direction === "gitea2github") {
          const src = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`);
          if (src.status !== 200) {
            out.push({ id, ok: false, err: "gitea \u8BFB\u53D6\u5931\u8D25" });
            continue;
          }
          const b64 = src.json.content?.replace(/\n/g, "") ?? src.json.content;
          const dst = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`);
          const sha = dst.json?.sha;
          const res2 = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages/${name}`, {
            method: "PUT",
            body: { message: `\u540C\u6B65 ${name}\uFF08\u81EA Gitea\uFF09`, content: b64, branch: "main", ...sha ? { sha } : {} }
          });
          out.push({ id, ok: !!res2.json?.commit?.sha });
        } else {
          const buf = dl(`https://github.com/${CFG.githubOwner}/${CFG.pluginsRepo}/raw/main/packages/${name}`, true);
          const src = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`);
          const res2 = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}`, {
            method: "PUT",
            body: { branch: "main", message: `\u540C\u6B65 ${name}\uFF08\u81EA GitHub\uFF09`, content: buf.toString("base64"), ...src.status === 200 ? { sha: src.json.sha } : {} }
          });
          out.push({ id, ok: res2.status < 300 });
        }
      }
      return json(res, 200, { results: out });
    }
    if (url.pathname === "/api/shelf" && req.method === "POST") {
      const { id } = await readBody(req);
      const raw = dl(`${CFG.giteaUrl}/${CFG.giteaOwner}/${CFG.pluginsRepo}/raw/branch/main/packages/${id}.anzu`, false);
      const scan = scanPackage(raw);
      if (!scan.man.id) throw new Error("\u5305\u91CC\u6CA1\u6709 manifest.toml");
      const list = readReg();
      if (list.some((e) => e.id === scan.man.id)) throw new Error(`\u5546\u5E97\u91CC\u5DF2\u6709 ${scan.man.id}`);
      const entry = {
        id: scan.man.id,
        name: scan.man.name ?? id,
        tier: "official",
        kind: scan.man.kind === "theme" ? "theme" : "plugin",
        category: "tool",
        description: scan.man.description ?? "",
        language: "Node.js",
        deps: [],
        permissions: String(scan.man.permissions ?? "").split(/[[\]",\s]+/).filter((s) => s.startsWith("onebot.")),
        observe: /observe\s*=\s*true/.test(scan.mRaw),
        version: scan.man.version ?? "?",
        author: "QixinBot \u5B98\u65B9",
        repo: `repo://QixinBot-go-plugins/tree/main/src/${scan.man.id ?? id}`,
        package: `repo://QixinBot-go-plugins/raw/main/packages/${scan.man.id ?? id}.anzu`,
        fingerprint: null,
        tags: []
      };
      list.push(entry);
      writeReg(list);
      gitRegistryCommit(`\u5546\u5E97\u4E0A\u67B6 ${entry.name}(${entry.id})\uFF08\u7BA1\u7406\u53F0\uFF09`);
      return json(res, 200, { ok: true, entry });
    }
    if (url.pathname === "/api/issues" && req.method === "GET") {
      const platform = url.searchParams.get("platform") ?? "github";
      let issues;
      if (platform === "gitea") {
        const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues?state=open&labels=\u63D2\u4EF6\u6536\u5F55&limit=50`);
        if (r.status !== 200 || !Array.isArray(r.json)) {
          return json(res, 200, { issues: [], note: `Gitea \u8FD4\u56DE ${r.status}\uFF1Atoken \u9700\u8981 read:issue / write:issue \u6743\u9650\uFF08\u8BBE\u7F6E\u91CC\u6362\u65B0 token\uFF09\uFF0C\u6216\u6539\u7528 GitHub \u63D0\u4EA4` });
        }
        issues = r.json.map((i) => ({ num: i.number, title: i.title, author: i.user?.login, created: i.created_at }));
      } else {
        const r = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues?state=open&labels=\u63D2\u4EF6\u6536\u5F55&per_page=50`);
        issues = (r.json ?? []).map((i) => ({ num: i.number, title: i.title, author: i.user?.login, created: i.created_at }));
      }
      return json(res, 200, { issues });
    }
    if (url.pathname === "/api/review" && req.method === "POST") {
      const { platform, num } = await readBody(req);
      return json(res, 200, await doReview(platform, num));
    }
    if (url.pathname === "/api/review-file" && req.method === "GET") {
      const key = url.searchParams.get("key");
      const name = url.searchParams.get("name");
      const cached = reviewCache.get(key);
      const e = cached?.entries.find((x) => x.name === name);
      if (!e) return json(res, 404, { err: "not found" });
      return json(res, 200, { name: e.name, text: e.data.subarray(0, 3e5).toString("utf8"), truncated: e.data.length > 3e5 });
    }
    if (url.pathname === "/api/approve" && req.method === "POST") {
      const { platform, num } = await readBody(req);
      const key = `${platform}:${num}`;
      const cached = reviewCache.get(key);
      const report = cached ?? await doReview(platform, num);
      const list = readReg();
      if (list.some((e) => e.id === report.entry.id)) throw new Error(`\u5546\u5E97\u91CC\u5DF2\u6709 ${report.entry.id}\uFF08\u5982\u9700\u66F4\u65B0\u8BF7\u624B\u5DE5\u7F16\u8F91\u6761\u76EE\uFF09`);
      list.push(report.entry);
      writeReg(list);
      gitRegistryCommit(`\u5546\u5E97\u4E0A\u67B6\u7B2C\u4E09\u65B9\u63D2\u4EF6 ${report.entry.name}(${report.entry.id})\uFF0C\u5BA1\u6838 issue ${platform}#${num}`);
      return json(res, 200, { ok: true, entry: report.entry });
    }
    if (url.pathname === "/api/reject" && req.method === "POST") {
      const { platform, num, reason } = await readBody(req);
      const comment = `\u5BA1\u6838\u672A\u901A\u8FC7\uFF1A${reason || "\u672A\u8BF4\u660E\u539F\u56E0"}

\u53EF\u4EE5\u8865\u5145\u6750\u6599\u540E\u91CD\u65B0\u63D0\u4EA4\u6536\u5F55\u7533\u8BF7\u3002`;
      if (platform === "gitea") {
        await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}/comments`, { method: "POST", body: { body: comment } });
        await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}`, { method: "PATCH", body: { state: "closed" } });
      } else {
        gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}/comments`, { method: "POST", body: { body: comment } });
        gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}`, { method: "PATCH", body: { state: "closed" } });
      }
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/registry" && req.method === "GET") {
      return json(res, 200, { entries: readReg() });
    }
    if (url.pathname === "/api/categories" && req.method === "GET") {
      return json(res, 200, readCats());
    }
    if (url.pathname === "/api/categories/save" && req.method === "POST") {
      const { cats } = await readBody(req);
      if (!cats || typeof cats !== "object" || Object.keys(cats).length === 0) throw new Error("\u5206\u7C7B\u4E0D\u80FD\u4E3A\u7A7A");
      const removed = Object.keys(readCats()).filter((k) => !(k in cats));
      const inUse = readReg().filter((e) => removed.includes(e.category)).map((e) => e.id);
      if (inUse.length) throw new Error(`\u5206\u7C7B\u4ECD\u6709\u6761\u76EE\u5728\u7528\uFF1A${inUse.join("\u3001")}\u2014\u2014\u5148\u7ED9\u5B83\u4EEC\u6539\u5206\u7C7B\u518D\u5220`);
      (0, import_node_fs.writeFileSync)(CATS_PATH(), JSON.stringify(cats, null, 2) + "\n");
      gitRegistryCommit("\u5546\u5E97\u540E\u53F0\uFF1A\u66F4\u65B0\u5206\u7C7B");
      return json(res, 200, { ok: true, cats });
    }
    if (url.pathname === "/api/registry/save" && req.method === "POST") {
      const { entries, msg } = await readBody(req);
      writeReg(entries);
      gitRegistryCommit(msg || "\u5546\u5E97\u540E\u53F0\u66F4\u65B0 registry\uFF08\u7BA1\u7406\u53F0\uFF09");
      return json(res, 200, { ok: true, count: entries.length });
    }
    if (url.pathname === "/api/upload" && req.method === "POST") {
      return json(res, 200, await uploadPublish(await readBody(req)));
    }
    if (url.pathname === "/api/deploy" && req.method === "POST") {
      return json(res, 200, { log: deploySite() });
    }
    json(res, 404, { err: "no route" });
  } catch (e) {
    json(res, 500, { err: String(e.message || e) });
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\u2713 \u63D2\u4EF6\u5546\u5E97\u7BA1\u7406\u53F0\u5DF2\u542F\u52A8\uFF1Ahttp://localhost:${PORT}`);
  console.log("  \u914D\u7F6E\u6587\u4EF6\uFF1Atools/gui-config.json\uFF08\u542B token\uFF0C\u52FF\u63D0\u4EA4\uFF09");
});
