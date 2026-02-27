// @ts-nocheck
function getCurrentTimePayload() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
    now.getDay()
  ];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  return {
    datetime: `${y}年${m}月${d}日 ${hh}:${mm}:${ss}`,
    weekday,
    timezone,
    text: `本机时间为：${y}年${m}月${d}日 ${hh}:${mm}:${ss} ${weekday}`,
  };
}

export { getCurrentTimePayload };
