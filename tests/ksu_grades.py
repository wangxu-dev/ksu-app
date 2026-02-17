"""
KSU 成绩查询模块

运行方式:
    python ksu_grades.py

依赖:
    auth.json - 认证信息（由 ksu_auth.py 生成）
"""

import os
import json
import base64
import time
import requests
from typing import Optional, Dict, List

# API 端点
GRADE_API_URL = "https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxXsgrcj.html?doType=query&gnmkdm=N305005"
REFERER_URL = "https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default"


def extract_id_token(ticket: str) -> Optional[str]:
    """从 ticket JWT 中提取 idToken"""
    try:
        parts = ticket.split('.')
        if len(parts) == 3:
            # JWT payload 是 base64 编码的，需要填充
            payload = parts[1]
            # 添加 base64 padding
            payload += '=' * (4 - len(payload) % 4)
            decoded = base64.b64decode(payload)
            payload_data = json.loads(decoded)
            return payload_data.get('idToken')
    except Exception as e:
        print(f"警告: 无法从 ticket 提取 idToken: {e}")
    return None


def load_auth_info(filepath: str = "auth.json") -> Optional[Dict]:
    """加载认证信息，返回 idToken 和 cookies"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            result = {}

            # 提取 idToken（从 ticket）
            if data.get('ticket'):
                id_token = extract_id_token(data.get('ticket'))
                if id_token:
                    result['idToken'] = id_token

            # 获取 cookies
            cookies = {}
            if data.get('portal_cookies'):
                cookies.update(data.get('portal_cookies', {}))
            if data.get('jwxt_cookies'):
                cookies.update(data.get('jwxt_cookies', {}))
            result['cookies'] = cookies

            return result if result else None
    except FileNotFoundError:
        print(f"错误: {filepath} 不存在，请先运行 ksu_auth.py")
        return None
    except json.JSONDecodeError:
        print(f"错误: {filepath} 格式无效")
        return None


def query_grades(xnm: str, xqm: str = "", show_count: int = 2500, time_param: int = 3) -> Optional[List[Dict]]:
    """
    查询成绩

    参数:
        xnm: 学年 (如 "2024", "2025")
        xqm: 学期 ("3"=第1学期, "12"=第2学期, ""=全部)
        show_count: 返回数量上限
        time_param: 查询类型 (0/1/3)

    返回:
        成绩列表，失败返回 None
    """
    auth = load_auth_info()
    if not auth:
        return None

    id_token = auth.get('idToken')
    if not id_token:
        print("错误: 未找到 idToken，请重新运行 ksu_auth.py")
        return None

    print(f"idToken: {id_token[:50]}...")

    # 根据文档，使用新的 API 端点
    # 将 xnm (2024) 转换为 semesterYear (2024-2025)
    semester_year = f"{xnm}-{int(xnm) + 1}"

    api_url = f"https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1&semesterYear={semester_year}"

    headers = {
        'x-id-token': id_token,
        'Referer': 'https://score-inquiry.ksu.edu.cn/ui/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }

    try:
        print(f"\n查询成绩:")
        print(f"  学年: {semester_year}")
        print(f"  URL: {api_url}")

        resp = requests.get(api_url, headers=headers, timeout=30)

        print(f"  状态码: {resp.status_code}")

        # 打印原始响应用于调试
        print(f"\n========== 原始响应 (前500字符) ==========")
        print(resp.text[:500])
        print(f"========== 响应结束 ==========\n")

        if resp.status_code != 200:
            print(f"错误: HTTP {resp.status_code}")
            return None

        result = resp.json()

        # 新 API 响应格式: { success: true, data: { ... } }
        if not result.get('success'):
            print(f"错误: {result.get('msg', '未知错误')}")
            return None

        data = result.get('data', {})
        items = []

        # 转换数据格式
        for sem in data.get('semesterGradeList', []):
            for grade in sem.get('gradeList', []):
                items.append({
                    'xqmmc': sem.get('semesterName'),
                    'kcmc': grade.get('courseName'),
                    'cj': str(grade.get('score', '')),
                    'xf': str(grade.get('credit', '')),
                    'jd': str(grade.get('gp', '')),
                    'kcxzmc': grade.get('courseType', ''),
                })

        print(f"  查询成功! 共 {len(items)} 条记录")
        return items

    except requests.exceptions.Timeout:
        print("错误: 请求超时")
        return None
    except requests.exceptions.RequestException as e:
        print(f"错误: {e}")
        return None
    except json.JSONDecodeError:
        print("错误: 响应不是有效的 JSON")
        return None


def print_grade_table(grades: List[Dict]):
    """打印成绩表格"""
    if not grades:
        print("\n无成绩记录")
        return

    print(f"\n{'='*140}")
    print(f"{'学期':<12} {'课程代码':<15} {'课程名称':<30} {'课程性质':<15} {'成绩':<8} {'学分':<6} {'绩点':<6}")
    print('='*140)

    for grade in grades:
        xqm = grade.get('xqm', '')
        xqmc = grade.get('xqmc', '')
        kch = grade.get('kch', '')
        kcmc = grade.get('kcmc', '')
        kcxzmc = grade.get('kcxzmc', '')
        cj = grade.get('cj', '')
        xf = grade.get('xf', '')
        jd = grade.get('jd', '')

        print(f"{xqmc:<12} {kch:<15} {kcmc:<30} {kcxzmc:<15} {cj:<8} {xf:<6} {jd:<6}")

    print('='*140)


def save_grades(grades: List[Dict], xnm: str, xqm: str):
    """保存成绩到 JSON"""
    if not grades:
        return

    filename = f"grades_{xnm}_{xqm if xqm else 'all'}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(grades, f, indent=2, ensure_ascii=False)

    print(f"\n成绩已保存到: {filename}")


def main():
    """主函数"""
    print("=" * 60)
    print("KSU 成绩查询工具")
    print("=" * 60)

    # 测试参数：2024-2025 学年第2学期
    xnm = '2024'
    xqm = '12'
    time_val = 3

    grades = query_grades(xnm, xqm, show_count=2500, time_param=time_val)

    if grades:
        print_grade_table(grades)
        save_grades(grades, xnm, xqm)


if __name__ == "__main__":
    main()
