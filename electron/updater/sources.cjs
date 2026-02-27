const UPDATE_SOURCES = {
  primary: {
    name: "github",
    baseUrl: "https://github.com/wangxu-dev/ksu-app",
  },
  fallback: {
    name: "edgeone-proxy",
    baseUrl: "https://edgeone.gh-proxy.org/https://github.com/wangxu-dev/ksu-app",
  },
};

function resolveReleaseAssetUrl(tag, filename, useFallback = false) {
  const source = useFallback ? UPDATE_SOURCES.fallback : UPDATE_SOURCES.primary;
  return `${source.baseUrl}/releases/download/${tag}/${filename}`;
}

module.exports = {
  UPDATE_SOURCES,
  resolveReleaseAssetUrl,
};
