import nextConfig from "eslint-config-next";

// Next.js 16 自带的 flat config（兼容 ESLint 9）
const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // 外部 API 原始数据经校验函数收窄类型，不强制逐字段 narrowing
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
