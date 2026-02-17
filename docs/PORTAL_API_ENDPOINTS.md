# Portal CMS API Endpoints

> Portal content management system API endpoints
> Discovered: 2026-02-17

---

## CMS Content API

### Get Column Contents

**Endpoint**: `/portal-api/v1/cms/content/getColumncontents`

**Method**: GET

**Base URL**: `https://portal.ksu.edu.cn`

---

## Endpoints

### 1. Remote Content Column

**URL**: `https://portal.ksu.edu.cn/portal-api/v1/cms/content/getColumncontents?kw=&columnId=remote-a&pageNo=1&pageSize=12&loadContent=false&loadPicContents=false`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| kw | (empty) | Keyword search |
| columnId | remote-a | Remote content column ID |
| pageNo | 1 | Page number |
| pageSize | 12 | Items per page |
| loadContent | false | Load full content |
| loadPicContents | false | Load picture contents |

---

### 2. Specific Content Column

**URL**: `https://portal.ksu.edu.cn/portal-api/v1/cms/content/getColumncontents?kw=&columnId=8aaa86f37e2e47eb017f8bed5dbb76cd&pageNo=1&pageSize=12&loadContent=false&loadPicContents=false`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| kw | (empty) | Keyword search |
| columnId | 8aaa86f37e2e47eb017f8bed5dbb76cd | Specific column ID |
| pageNo | 1 | Page number |
| pageSize | 12 | Items per page |
| loadContent | false | Load full content |
| loadPicContents | false | Load picture contents |

---

## Request Headers

**Required Headers**:
```javascript
{
  "accept": "application/json, text/plain, */*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
  "sec-ch-ua": "\"Not:A-Brand\";v=\"99\", \"Microsoft Edge\";v=\"145\", \"Chromium\";v=\"145\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"Windows\"",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-device-info": "PC",
  "x-id-token": "{JWT_TOKEN}",
  "x-terminal-info": "PC",
  "cookie": "{PORTAL_COOKIES}",
  "Referer": "https://portal.ksu.edu.cn/main.html"
}
```

### Key Headers

| Header | Value | Source |
|--------|-------|--------|
| x-id-token | JWT token from CAS login | CAS ticket payload |
| Referer | `https://portal.ksu.edu.cn/main.html` | Fixed |
| x-device-info | PC | Fixed |
| x-terminal-info | PC | Fixed |
| cookie | Portal session cookies | After portal login |

---

## Cookie Requirements

**Required Cookies** (example):
```
Hm_lvt_23846a0bdebe934dc3495247ab78cec6=1751977943,1752383463
Hm_lvt_13d25967c163952b40b7b86f66fd5ecf=1771303807
HMACCOUNT=A576CB7614BCCBBE
isLogin=true
Hm_lpvt_13d25967c163952b40b7b86f66fd5ecf=1771303845
```

**Note**: These cookies are set after successful portal login via CAS.

---

## Usage Example

```javascript
async function getColumnContents(columnId, token, cookies) {
  const url = new URL('https://portal.ksu.edu.cn/portal-api/v1/cms/content/getColumncontents');
  url.searchParams.set('kw', '');
  url.searchParams.set('columnId', columnId);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('pageSize', '12');
  url.searchParams.set('loadContent', 'false');
  url.searchParams.set('loadPicContents', 'false');

  const response = await fetch(url.toString(), {
    headers: {
      'accept': 'application/json, text/plain, */*',
      'x-id-token': token,
      'x-device-info': 'PC',
      'x-terminal-info': 'PC',
      'cookie': cookies,
      'Referer': 'https://portal.ksu.edu.cn/main.html'
    }
  });

  return await response.json();
}
```

---

## Notes

1. **Authentication**: Requires valid `x-id-token` from CAS login
2. **Session**: Requires portal session cookies
3. **Response Format**: JSON
4. **CORS**: Same-origin requests from portal.ksu.edu.cn

---

*This document is part of the Ksu-App API reference collection*
