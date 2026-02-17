"""
KSU 认证模块 - 喀什大学 CAS → Portal → JWXT 完整登录流程

运行方式:
    python ksu_auth.py

环境变量:
    KSU_USER: 学号/用户名
    KSU_KEY: 密码

输出:
    auth.json - 包含所有认证信息（ticket, cookies, session keys）
"""

import os
import re
import json
import time
from urllib.parse import urlparse
from dataclasses import dataclass, asdict
from typing import Optional, Dict
import requests

# URLs
CAS_LOGIN_URL = "https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F"
PORTAL_URL = "https://portal.ksu.edu.cn/"
JWXT_SSO_URL = "https://jwnet.ksu.edu.cn/sso/ddlogin"

# Session (全局共享 cookies)
session = requests.Session()


@dataclass
class AuthInfo:
    timestamp: float
    ticket: Optional[str] = None
    portal_cookies: Optional[Dict[str, str]] = None
    jwxt_cookies: Optional[Dict[str, str]] = None
    jsessionid: Optional[str] = None
    tgc: Optional[str] = None
    portal_session: Optional[str] = None

    def to_json(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(asdict(self), f, indent=2, ensure_ascii=False)

    @classmethod
    def from_json(cls, filepath: str) -> Optional['AuthInfo']:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return cls(**data)
        except (FileNotFoundError, json.JSONDecodeError):
            return None


def get_hidden_fields(html: str) -> Dict[str, str]:
    """从 HTML 提取 hidden input 字段"""
    pattern = r'<input[^>]*>'
    fields = {}
    for match in re.finditer(pattern, html, re.IGNORECASE):
        tag = match.group(0)
        type_match = re.search(r'type\s*=\s*["\']([^"\']+)["\']', tag, re.IGNORECASE)
        input_type = type_match.group(1).lower() if type_match else ''
        if input_type != 'hidden':
            continue
        name_match = re.search(r'name\s*=\s*["\']([^"\']+)["\']', tag, re.IGNORECASE)
        value_match = re.search(r'value\s*=\s*["\']([^"\']*)["\']', tag, re.IGNORECASE)
        if name_match:
            name = name_match.group(1)
            value = value_match.group(1) if value_match else ''
            fields[name] = value
    return fields


def refresh_session(ticket: str) -> Optional[AuthInfo]:
    """
    仅刷新 Session（复用已有 ticket）

    流程:
        1. 使用 ticket 建立 Portal Session
        2. JWXT SSO 登录及重定向链
        3. 提取新的 JSESSIONID

    返回:
        AuthInfo，失败返回 None
    """
    global session
    session = requests.Session()  # 重置 session

    try:
        print(f"\n[刷新] 使用 Ticket 刷新 Session")
        print(f"    Ticket: {ticket[:50]}...")

        # === 步骤 1: Portal 登录（使用 ticket）===
        print(f"\n[1] 建立 Portal Session")
        ticket_url = f"https://portal.ksu.edu.cn/?ticket={ticket}"
        portal_resp = session.get(ticket_url, allow_redirects=True)
        print(f"    状态码: {portal_resp.status_code}")

        portal_cookies = {}
        for cookie in session.cookies:
            portal_cookies[cookie.name] = cookie.value
        print(f"    Portal Cookies: {list(portal_cookies.keys())}")

        # === 步骤 2: JWXT SSO 登录及重定向链 ===
        print(f"\n[2] JWXT SSO 登录")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': PORTAL_URL,
        }

        current_url = JWXT_SSO_URL

        for i in range(10):
            print(f"    重定向 {i+1}/10: {current_url[:60]}...")

            try:
                resp = session.get(current_url, headers=headers, allow_redirects=False, timeout=30)
            except Exception as e:
                if 'ticketlogin' in current_url:
                    print(f"    状态码: 超时（预期行为），session 已建立")
                    print(f"    继续处理...")
                    break
                raise e

            status = resp.status_code
            location = resp.headers.get('Location', '')
            print(f"      状态码: {status}")

            if status == 302 and location:
                print(f"      跳转到: {location[:60]}...")
                if location.startswith('/'):
                    parsed = urlparse(current_url)
                    current_url = f"{parsed.scheme}://{parsed.netloc}{location}"
                else:
                    current_url = location
            elif status == 200:
                print(f"      到达最终页面")
                break
            else:
                print(f"      状态码异常: {status}")
                break

        # === 提取 JWXT cookies ===
        jwxt_cookies = {}
        for cookie in session.cookies:
            if 'jwnet' in cookie.domain:
                jwxt_cookies[cookie.name] = cookie.value

        jsessionid = jwxt_cookies.get('JSESSIONID')
        if not jsessionid:
            raise Exception("无法获取 JSESSIONID")

        print(f"\n[3] 提取认证信息")
        print(f"    JSESSIONID: {jsessionid}")
        print(f"    所有 JWXT Cookies: {list(jwxt_cookies.keys())}")

        # === 返回新认证信息 ===
        auth_info = AuthInfo(
            timestamp=time.time(),
            ticket=ticket,
            portal_cookies=portal_cookies,
            jwxt_cookies=jwxt_cookies,
            jsessionid=jsessionid,
            tgc=portal_cookies.get('TGC'),
            portal_session=portal_cookies.get('SESSION')
        )

        # 自动保存
        auth_info.to_json("auth.json")

        print("\n" + "=" * 60)
        print("Session 刷新成功！")
        print(f"JSESSIONID: {jsessionid}")
        print(f"已更新到: auth.json")
        print("=" * 60)

        return auth_info

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """主函数"""
    print("=" * 60)
    print("KSU 认证工具")
    print("=" * 60)

    # 检查是否仅刷新 Session
    refresh_only = os.environ.get('REFRESH_ONLY', '').lower() in ('1', 'true', 'yes')

    if refresh_only:
        # 仅刷新 Session 模式
        print("模式: 仅刷新 Session")

        auth_info = AuthInfo.from_json("auth.json")
        if not auth_info or not auth_info.ticket:
            print("错误: 未找到有效的 auth.json 或 ticket")
            print("  请先运行完整登录获取 ticket")
            return

        refresh_session(auth_info.ticket)
        return

    # 完整登录模式
    username = os.environ.get('KSU_USER')
    password = os.environ.get('KSU_KEY')

    if not username or not password:
        print("错误: 请设置 KSU_USER 和 KSU_KEY 环境变量")
        return

    print(f"用户名: {username}")

    try:
        # === 步骤 1: CAS 登录页面 GET ===
        print(f"\n[1] 访问 CAS 登录页面")
        resp = session.get(CAS_LOGIN_URL, allow_redirects=False)
        if resp.status_code != 200:
            raise Exception(f"CAS 登录页面访问失败: {resp.status_code}")

        hidden_fields = get_hidden_fields(resp.text)
        print(f"    提取到 {len(hidden_fields)} 个隐藏字段")

        # === 步骤 2: CAS 登录 POST ===
        print(f"\n[2] 提交 CAS 登录")

        execution = hidden_fields.get('execution', '')
        if not execution:
            raise Exception("未找到 execution 参数")

        login_data = [
            ('username', username),
            ('password', password),
            ('captcha', ''),
            ('mfaState', ''),
            ('currentMenu', hidden_fields.get('currentMenu', '1')),
            ('failN', hidden_fields.get('failN', '0')),
            ('execution', execution),
            ('_eventId', 'submit'),
            ('geolocation', hidden_fields.get('geolocation', '')),
            ('fpVisitorId', hidden_fields.get('fpVisitorId', '')),
        ]

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Origin': 'https://cas.ksu.edu.cn',
            'Referer': CAS_LOGIN_URL,
            'Content-Type': 'application/x-www-form-urlencoded',
        }

        resp = session.post(CAS_LOGIN_URL, data=login_data, headers=headers, allow_redirects=False)

        if resp.status_code == 302:
            location = resp.headers.get('Location', '')
            if not location or 'ticket=' not in location:
                raise Exception("登录失败，未返回 ticket")
            print(f"    登录成功，重定向到: {location[:60]}...")

            # 提取 ticket
            match = re.search(r'ticket=([A-Za-z0-9._-]+)', location)
            ticket = match.group(1) if match else ''
            print(f"    Ticket: {ticket[:50]}...")
        else:
            raise Exception(f"登录失败，状态码: {resp.status_code}")

        # === 步骤 3: Portal 登录（使用 ticket）===
        print(f"\n[3] 建立 Portal Session")
        portal_resp = session.get(location, allow_redirects=True)
        print(f"    状态码: {portal_resp.status_code}")

        portal_cookies = {}
        for cookie in session.cookies:
            portal_cookies[cookie.name] = cookie.value
        print(f"    Portal Cookies: {list(portal_cookies.keys())}")

        # === 步骤 4 & 5: JWXT SSO 登录及重定向链 ===
        print(f"\n[4] JWXT SSO 登录")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': PORTAL_URL,
        }

        current_url = JWXT_SSO_URL

        for i in range(10):
            print(f"    重定向 {i+1}/10: {current_url[:60]}...")

            try:
                resp = session.get(current_url, headers=headers, allow_redirects=False, timeout=30)
            except Exception as e:
                # ticketlogin 可能超时，但 session 已建立
                if 'ticketlogin' in current_url:
                    print(f"    状态码: 超时（预期行为），session 已建立")
                    print(f"    继续处理...")
                    break
                raise e

            status = resp.status_code
            location = resp.headers.get('Location', '')
            print(f"      状态码: {status}")

            if status == 302 and location:
                print(f"      跳转到: {location[:60]}...")
                # 处理相对路径
                if location.startswith('/'):
                    parsed = urlparse(current_url)
                    current_url = f"{parsed.scheme}://{parsed.netloc}{location}"
                else:
                    current_url = location
            elif status == 200:
                print(f"      到达最终页面")
                break
            else:
                print(f"      状态码异常: {status}")
                break

        # === 提取 JWXT cookies ===
        jwxt_cookies = {}
        for cookie in session.cookies:
            if 'jwnet' in cookie.domain:
                jwxt_cookies[cookie.name] = cookie.value

        jsessionid = jwxt_cookies.get('JSESSIONID')
        if not jsessionid:
            raise Exception("无法获取 JSESSIONID")

        print(f"\n[5] 提取认证信息")
        print(f"    JSESSIONID: {jsessionid}")
        print(f"    所有 JWXT Cookies: {list(jwxt_cookies.keys())}")

        # === 保存结果 ===
        auth_info = AuthInfo(
            timestamp=time.time(),
            ticket=ticket,
            portal_cookies=portal_cookies,
            jwxt_cookies=jwxt_cookies,
            jsessionid=jsessionid,
            tgc=portal_cookies.get('TGC'),
            portal_session=portal_cookies.get('SESSION')
        )

        auth_info.to_json("auth.json")

        print("\n" + "=" * 60)
        print("认证完成！")
        print(f"JSESSIONID: {jsessionid}")
        print(f"已保存到: auth.json")
        print("=" * 60)

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
