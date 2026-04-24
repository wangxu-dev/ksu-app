type UpdateSourceName = string;

type UpdateSource = {
  name: UpdateSourceName;
  baseUrl: string;
};

const UPDATE_SOURCES = [
  {
    name: "github",
    baseUrl: "https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "edgeone-proxy",
    baseUrl: "https://edgeone.gh-proxy.org/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "yylx-proxy",
    baseUrl: "https://git.yylx.win/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "ghf",
    baseUrl: "https://ghf.xn--eqrr82bzpe.top/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "jasonzeng",
    baseUrl: "https://gh.jasonzeng.dev/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "1lin-dpdns",
    baseUrl: "https://j.1lin.dpdns.org/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "ghproxy-imciel",
    baseUrl: "https://ghproxy.imciel.com/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "1win-ggff",
    baseUrl: "https://j.1win.ggff.net/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "cxkpro",
    baseUrl: "https://ghproxy.cxkpro.top/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "mrhjx",
    baseUrl: "https://gitproxy.mrhjx.cn/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "idayer",
    baseUrl: "https://gh.idayer.com/https://github.com/wangxu-dev/ksu-app",
  },
  {
    name: "ghm-078465",
    baseUrl: "https://ghm.078465.xyz/https://github.com/wangxu-dev/ksu-app",
  },
] satisfies UpdateSource[];

function resolveReleaseAssetUrl(
  tag: string,
  filename: string,
  sourceName: UpdateSourceName = "github",
): string {
  const source = UPDATE_SOURCES.find((item) => item.name === sourceName) || UPDATE_SOURCES[0];
  return `${source.baseUrl}/releases/download/${tag}/${filename}`;
}

export { UPDATE_SOURCES, resolveReleaseAssetUrl };
export type { UpdateSource, UpdateSourceName };
