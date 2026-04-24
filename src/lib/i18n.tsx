import React from "react";

export type AppLocale = "zh-CN" | "en-US";

const LOCALE_KEY = "ksu:locale";

const messages = {
  "zh-CN": {
    common: {
      cancel: "取消",
      save: "保存",
      refresh: "刷新",
      loading: "加载中...",
      noData: "未发现数据",
      page: "页",
      items: "条",
    },
    nav: {
      home: "首页",
      grades: "成绩单",
      calendar: "校历",
      assistant: "智能助手",
    },
    theme: {
      label: "主题",
      ariaLabel: "切换主题",
      system: "跟随系统",
      light: "浅色",
      dark: "深色",
    },
    locale: {
      label: "语言",
      zhCN: "简体中文",
      enUS: "English",
    },
    command: {
      openSearch: "搜索功能...",
      openSearchHint: "搜索功能 (Ctrl+K)",
      inputPlaceholder: "输入指令或搜索内容...",
      empty: "未找到相关结果。",
      pages: "页面跳转",
      themes: "界面主题",
      account: "账户管理",
      home: "控制台首页",
      grades: "我的成绩单",
      calendar: "校历查询",
      assistant: "智能助手",
      logout: "退出当前账户",
    },
    login: {
      campusAlt: "喀什大学校园风光",
      entry: "喀什大学认证统一入口",
      username: "学号",
      usernamePlaceholder: "请输入学号",
      password: "密码",
      passwordPlaceholder: "请输入密码",
      remember: "记住账号",
      submitting: "登录中...",
      submit: "登录",
    },
    home: {
      gpa: "平均绩点",
      gpaDesc: "教务系统上一学期存档",
      balance: "卡片余额",
      balanceDesc: "一卡通实时账户余额",
      week: "教学周次",
      weekDesc: "当前校历运行进度",
      library: "图书借阅",
      libraryDesc: (count: string | number) => `累计借阅 ${count} 本`,
      academic: "学业数据动态",
      gradesDetail: "成绩单详情",
      courses: "累计修读课程",
      achievements: "登记科研成果",
      termSummary: "学期关键摘要",
      creditsEarned: "应得学分",
      electiveCourses: "选修课程",
      requiredCourses: "必修课程",
      note: "数据均同步自校务系统存档，仅供参考。如有异议，请以学校教务处发布的官方纸质报表为准。",
      profile: "学生档案",
      defaultIdentity: "普通学生",
      defaultOrg: "喀什大学",
      news: "校园公告与新闻",
      latest: "最新",
      hot: "热门",
      newsPage: (pageNo: number, total: string | number) => `第 ${pageNo} 页 / 共 ${total} 条`,
      syncError: "数据同步异常",
    },
    grades: {
      title: "我的成绩单概览",
      sync: "教务系统数据同步",
      syncTime: (value: string) => `同步时间：${value}`,
      syncing: "正在同步",
      refresh: "刷新数据",
      syncError: "同步异常",
      gpa: "平均绩点 (GPA)",
      ga: "加权平均分",
      totalCredit: "累计总学分",
      totalScore: "课程总分",
      credit: "学分",
      gp: "绩点",
      fetchFailed: "获取成绩失败",
    },
    calendar: {
      refresh: "刷新",
      prevMonth: "上月",
      currentMonth: "本月",
      nextMonth: "下月",
      updatedAt: (value: string) => `上次更新：${value}`,
      fetchFailed: "获取校历失败",
      fetchError: (value: string) => `获取失败：${value}`,
      monthView: "月视图",
      function: "功能",
      searchPlaceholder: "搜索功能（Ctrl+K）",
      searchInput: "搜索…",
      searchEmpty: "没有匹配的结果",
      grades: "成绩",
      calendar: "校历",
    },
    assistant: {
      conversationDraftTitle: "新对话",
      conversationLoadingTitle: "加载中...",
      historyTitle: "对话历史",
      historyEmpty: "暂无历史记录",
      newConversation: "开启新对话",
      startConversation: "开始对话",
      sendPlaceholder: "输入指令或提问...",
      regenerate: "重新回答",
      requestSubmitted: "请求已发送",
      assistantWorking: "助手处理中",
      toolWorking: "处理中",
      toolDone: "已完成",
      toolSummarizing: "正在整理回答",
      streaming: "正在生成回答",
      aborted: "已停止",
      failed: "请求失败",
      settings: "助手配置",
      baseUrl: "接口地址",
      model: "模型名称",
      apiKey: "密钥 (API Key)",
      systemPrompt: "系统提示词",
      saveSettings: "保存配置",
    },
    account: {
      current: "当前用户",
      management: "账号管理",
      profileHome: "个人资料首页",
      assistantSettings: "助手高级设置",
      logout: "退出当前账号",
      notLoggedIn: "未登录",
    },
    updater: {
      preparing: "准备更新...",
      restart: "重启更新",
      downloading: (percent: number) => `更新下载中 ${percent}%`,
    },
  },
  "en-US": {
    common: {
      cancel: "Cancel",
      save: "Save",
      refresh: "Refresh",
      loading: "Loading...",
      noData: "No data",
      page: "page",
      items: "items",
    },
    nav: {
      home: "Home",
      grades: "Grades",
      calendar: "Calendar",
      assistant: "Assistant",
    },
    theme: {
      label: "Theme",
      ariaLabel: "Switch theme",
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    locale: {
      label: "Language",
      zhCN: "简体中文",
      enUS: "English",
    },
    command: {
      openSearch: "Search...",
      openSearchHint: "Search (Ctrl+K)",
      inputPlaceholder: "Type a command or search...",
      empty: "No results found.",
      pages: "Pages",
      themes: "Theme",
      account: "Account",
      home: "Dashboard",
      grades: "My grades",
      calendar: "Academic calendar",
      assistant: "Assistant",
      logout: "Log out",
    },
    login: {
      campusAlt: "Kashgar University campus view",
      entry: "Kashgar University unified sign-in",
      username: "Student ID",
      usernamePlaceholder: "Enter your student ID",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      remember: "Remember account",
      submitting: "Signing in...",
      submit: "Sign in",
    },
    home: {
      gpa: "GPA",
      gpaDesc: "Last archived semester from academic affairs",
      balance: "Card balance",
      balanceDesc: "Campus card real-time balance",
      week: "Teaching week",
      weekDesc: "Current academic calendar progress",
      library: "Library loans",
      libraryDesc: (count: string | number) => `${count} books borrowed`,
      academic: "Academic overview",
      gradesDetail: "Grades details",
      courses: "Completed courses",
      achievements: "Recorded research outputs",
      termSummary: "Term summary",
      creditsEarned: "Credits earned",
      electiveCourses: "Electives",
      requiredCourses: "Required",
      note: "Data is synchronized from the university archive and is for reference only. Please use official records for disputes.",
      profile: "Student profile",
      defaultIdentity: "Student",
      defaultOrg: "Kashgar University",
      news: "Campus news",
      latest: "Latest",
      hot: "Hot",
      newsPage: (pageNo: number, total: string | number) => `Page ${pageNo} / ${total} items`,
      syncError: "Failed to sync data",
    },
    grades: {
      title: "Grades overview",
      sync: "Academic affairs sync",
      syncTime: (value: string) => `Synced at: ${value}`,
      syncing: "Syncing",
      refresh: "Refresh",
      syncError: "Sync error",
      gpa: "GPA",
      ga: "Weighted average",
      totalCredit: "Total credits",
      totalScore: "Total score",
      credit: "Credit",
      gp: "GP",
      fetchFailed: "Failed to fetch grades",
    },
    calendar: {
      refresh: "Refresh",
      prevMonth: "Prev",
      currentMonth: "Current",
      nextMonth: "Next",
      updatedAt: (value: string) => `Updated: ${value}`,
      fetchFailed: "Failed to fetch calendar",
      fetchError: (value: string) => `Error: ${value}`,
      monthView: "Month view",
      function: "Functions",
      searchPlaceholder: "Search (Ctrl+K)",
      searchInput: "Search…",
      searchEmpty: "No matching results",
      grades: "Grades",
      calendar: "Calendar",
    },
    assistant: {
      conversationDraftTitle: "New chat",
      conversationLoadingTitle: "Loading...",
      historyTitle: "History",
      historyEmpty: "No history yet",
      newConversation: "New conversation",
      startConversation: "Start chatting",
      sendPlaceholder: "Type a prompt or question...",
      regenerate: "Regenerate",
      requestSubmitted: "Request sent",
      assistantWorking: "Assistant working",
      toolWorking: "Working",
      toolDone: "Done",
      toolSummarizing: "Summarizing response",
      streaming: "Generating response",
      aborted: "Stopped",
      failed: "Request failed",
      settings: "Assistant settings",
      baseUrl: "Base URL",
      model: "Model",
      apiKey: "API Key",
      systemPrompt: "System prompt",
      saveSettings: "Save settings",
    },
    account: {
      current: "Current user",
      management: "Account",
      profileHome: "Profile home",
      assistantSettings: "Assistant settings",
      logout: "Log out",
      notLoggedIn: "Not signed in",
    },
    updater: {
      preparing: "Preparing update...",
      restart: "Restart to update",
      downloading: (percent: number) => `Downloading ${percent}%`,
    },
  },
} as const;

type Messages = (typeof messages)[AppLocale];

type I18nContextValue = {
  locale: AppLocale;
  messages: Messages;
  setLocale: (locale: AppLocale) => void;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function getStoredLocale(): AppLocale {
  const raw = localStorage.getItem(LOCALE_KEY);
  if (raw === "en-US" || raw === "zh-CN") return raw;
  return navigator.language.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>(() => getStoredLocale());

  const setLocale = React.useCallback((next: AppLocale) => {
    localStorage.setItem(LOCALE_KEY, next);
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo(
    () => ({
      locale,
      messages: messages[locale],
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
