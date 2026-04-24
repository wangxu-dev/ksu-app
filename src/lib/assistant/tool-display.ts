const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_user_info: "验证身份",
  get_personal_info: "读取档案",
  get_grades: "查询成绩",
  get_calendar: "同步校历",
  get_current_time: "校准时间",
};

function getToolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] || name;
}

export { getToolDisplayName };
