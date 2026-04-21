/**
 * Mock 模式统一开关
 * 有 VITE_API_BASE_URL 时自动关闭 mock，否则使用 mock 数据
 */
export const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
