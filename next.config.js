/**
 * Next.js 配置文件
 * 定义应用的构建和运行时配置
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用React严格模式，帮助发现潜在问题
  reactStrictMode: true,
  
  // 图片域名配置 - 允许从这些域名加载图片
  images: {
    domains: [
      "lh3.googleusercontent.com", // Google用户头像
      "carpoolnubucket.s3.us-east-2.amazonaws.com", // AWS S3存储桶
    ],
  },
  
  // 编译器配置
  compiler: {
    styledComponents: true, // 启用styled-components支持
  },
};

module.exports = nextConfig;