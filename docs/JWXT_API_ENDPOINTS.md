# JWXT (教务系统) API Endpoints

> Kashgar University Educational Administration System API endpoints
> Discovered: 2026-02-17
> Requires: JSESSIONID cookie from SSO login

---

## Authentication

All JWXT API endpoints require **JSESSIONID** cookie obtained after SSO login.

**SSO Login Flow**: See `JWXT_SSO_AUTH_FLOW.md` for complete authentication steps.

---

## Index & Navigation API

### 1. Index Information (学生信息)

**Endpoint**: `/jwglxt/xtgl/index_cxYhxxIndex.html`

**Method**: GET

**URL**: `https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_cxYhxxIndex.html?xt=jw&localeKey=zh_CN&_=1771304134589&gnmkdm=index`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| xt | jw | System type (教务) |
| localeKey | zh_CN | Language |
| _ | timestamp | Cache buster |
| gnmkdm | index | Function module code |

**Headers**:
```javascript
{
  "accept": "text/html, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
  "cookie": "JSESSIONID={SESSION_ID}",
  "Referer": "https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs&_t={timestamp}&echarts=1"
}
```

---

### 2. Index News (新闻通知)

**Endpoint**: `/jwglxt/xtgl/index_cxNews.html`

**Method**: POST

**URL**: `https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_cxNews.html?localeKey=zh_CN&gnmkdm=index`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| localeKey | zh_CN | Language |
| gnmkdm | index | Function module code |

**Headers**:
```javascript
{
  "accept": "text/html, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
  "cookie": "JSESSIONID={SESSION_ID}",
  "Referer": "https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs&_t={timestamp}&echarts=1"
}
```

---

## Grade Query API

### 3. Grade Page (成绩查询页面)

**Endpoint**: `/jwglxt/cjcx/cjcx_cxDgXscj.html`

**Method**: GET

**URL**: `https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| gnmkdm | N305005 | Grade module code |
| layout | default | Layout type |

---

### 4. Grade Query (成绩查询)

**Endpoint**: `/jwglxt/cjcx/cjcx_cxXsgrcj.html`

**Method**: POST

**URL**: `https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxXsgrcj.html?doType=query&gnmkdm=N305005`

**Parameters**:
| Parameter | Value | Description |
|-----------|-------|-------------|
| doType | query | Query action |
| gnmkdm | N305005 | Grade module code |

**Form Data**:
```javascript
{
  xnm: '2024',                    // 学年
  xqm: '12',                      // 学期
  _search: 'false',
  nd: Date.now(),                 // Timestamp
  'queryModel.showCount': '100',
  'queryModel.currentPage': '1',
  'queryModel.sortName': '',
  'queryModel.sortOrder': 'asc',
  time: '1'
}
```

**Headers**:
```javascript
{
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  "cookie": "JSESSIONID={SESSION_ID}",
  "Referer": "https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default"
}
```

---

## Cookie Requirements

**JSESSIONID** cookie is required for all JWXT API calls.

**Example**:
```
JSESSIONID=E4ECF29CFF31A805C14C17D316CB0E3E
```

**How to obtain**:
1. Complete CAS login (get ticket)
2. Establish portal session
3. Call `/sso/ddlogin` and follow redirect chain
4. Extract JSESSIONID from final response cookies

---

## Usage Example

```javascript
// After SSO login, you have JSESSIONID
const jsessionId = "E4ECF29CFF31A805C14C17D316CB0E3E";

// Get student index information
async function getIndexInfo() {
  const url = `https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_cxYhxxIndex.html?xt=jw&localeKey=zh_CN&_=${Date.now()}&gnmkdm=index`;

  const response = await fetch(url, {
    headers: {
      'accept': 'text/html, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': `JSESSIONID=${jsessionId}`,
      'Referer': 'https://jwnet.ksu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs'
    }
  });

  return await response.text();
}

// Query grades
async function getGrades(xnm, xqm) {
  const url = 'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxXsgrcj.html?doType=query&gnmkdm=N305005';

  const formData = new URLSearchParams({
    xnm: xnm,                      // 学年
    xqm: xqm,                      // 学期
    _search: 'false',
    nd: Date.now().toString(),
    'queryModel.showCount': '100',
    'queryModel.currentPage': '1',
    'queryModel.sortName': '',
    'queryModel.sortOrder': 'asc',
    time: '1'
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'cookie': `JSESSIONID=${jsessionId}`,
      'Referer': 'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default'
    },
    body: formData
  });

  return await response.json();
}
```

---

## Module Codes (gnmkdm)

| Code | Module |
|------|--------|
| index | 首页/信息 |
| N305005 | 成绩查询 |

---

## Notes

1. **Session Management**: JSESSIONID expires after period of inactivity
2. **Referer Validation**: Some endpoints validate Referer header
3. **X-Requested-With**: Required for AJAX requests
4. **Response Format**: HTML fragments for index pages, JSON for grade queries

---

*This document is part of the Ksu-App API reference collection*
