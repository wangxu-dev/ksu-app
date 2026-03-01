type UpdateSourceName = "github" | "edgeone-proxy";

type UpdateSource = {
  name: UpdateSourceName;
  baseUrl: string;
};

type UpdateSources = {
  primary: UpdateSource;
  fallback: UpdateSource;
};

const UPDATE_SOURCES = {
  primary: {
    name: "github",
    baseUrl: "https://github.com/wangxu-dev/ksu-app",
  },
  fallback: {
    name: "edgeone-proxy",
    baseUrl: "https://edgeone.gh-proxy.org/https://github.com/wangxu-dev/ksu-app",
  },
} satisfies UpdateSources;

function resolveReleaseAssetUrl(tag: string, filename: string, useFallback = false): string {
  const source = useFallback ? UPDATE_SOURCES.fallback : UPDATE_SOURCES.primary;
  return `${source.baseUrl}/releases/download/${tag}/${filename}`;
}

export { UPDATE_SOURCES, resolveReleaseAssetUrl };
