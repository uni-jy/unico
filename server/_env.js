// 必须作为 server/index.js 的第一个 import —— 在 ncm/axios 等模块加载前清理代理 env
process.loadEnvFile?.(".env");
for (const k of ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy", "ALL_PROXY", "all_proxy"]) {
  delete process.env[k];
}
// Claude CLI 既可以走 OAuth，也可以走 OpenAI/Anthropic-compatible 中转。
// Unico 默认模型是 deepseek-v4-pro，需要保留调用方配置的 key/base URL。
// 只有显式使用 Claude 模型且未声明 UNICO_USE_API_KEY 时，才清理这些变量走 OAuth。
const model = process.env.UNICO_MODEL || "deepseek-v4-pro";
const shouldForceOAuth = /^claude/i.test(model) && !process.env.UNICO_USE_API_KEY;
if (shouldForceOAuth) {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("[env] 已忽略 ANTHROPIC_API_KEY（强制 claude CLI 走 OAuth Max）");
    delete process.env.ANTHROPIC_API_KEY;
  }
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.ANTHROPIC_BASE_URL;
}
