const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dlhfbu3kh/image/upload/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dp7bxmquq/image/upload/**",
      },
      {
        protocol: "https",
        hostname: "assets.sthyra.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sthyra.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "curly-leaf-d240.aasish.workers.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
