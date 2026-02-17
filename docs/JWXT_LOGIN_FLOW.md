# JWXT Login Flow Documentation

> Complete authentication flow for Kashgar University Educational Administration System
> Generated from chat history analysis

**Last Updated**: 2026-02-17
**Version**: 1.0.0

---

## Overview

The JWXT (教务系统) login uses a multi-step authentication flow through CAS and Portal systems. This document details the complete authentication process.

---

## Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CAS LOGIN (Step 1)                         │
│  GET https://cas.ksu.edu.cn/cas/login?service={PORTAL_URL}     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAS LOGIN (Step 2)                         │
│  POST https://cas.ksu.edu.cn/cas/login?service={PORTAL_URL}    │
│  - username, password, execution, currentMenu, failN, etc.     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EXTRACT TICKET (Step 3)                        │
│  302 Redirect → Location: https://portal.ksu.edu.cn/?ticket=   │
│  Format: ST-{XXXXXXXX}-{XXX}-{XXX}-{XXX}-{XXXXXXXXXXX}         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PORTAL LOGIN (Step 4)                          │
│  GET {ticketUrl} - Use ticket to establish portal session      │
│  - Extract cookies from response                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              JWXT SSO LOGIN (Step 5)                            │
│  GET https://jwnet.ksu.edu.cn/sso/ddlogin                      │
│  Headers: Referer: https://portal.ksu.edu.cn/                  │
│  - Follow redirect chain (up to 10 hops)                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              JWXT SESSION ESTABLISHED                           │
│  - Cookies stored in cookieJar                                 │
│  - Ready to access JWXT APIs                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Steps

### Step 1: CAS Login Page (GET)

**URL**: `https://cas.ksu.edu.cn/cas/login?service={PORTAL_URL}`

**Service URL** (URL-encoded):

```
https://portal.ksu.edu.cn/?path=https://portal.ksu.edu.cn/main.html#/Tourist
```

**Full Example**:

```
GET https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%3A%2F%2Fportal.ksu.edu.cn%2Fmain.html%23%2FTourist
```

**Purpose**: Retrieve login form and extract hidden fields

**Hidden Fields to Extract**:

- `execution` - Required
- `currentMenu` - Default: "1"
- `failN` - Default: "0"
- `geolocation` - Optional
- `fpVisitorId` - Optional

---

### Step 2: CAS Login (POST)

**URL**: `https://cas.ksu.edu.cn/cas/login?service={PORTAL_URL}`

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Form Fields**:
| Field | Value | Description |
|-------|-------|-------------|
| username | `{student_id}` | Student ID (e.g., ****\*\*\*****) |
| password | `{password}` | User password |
| execution | `{from_step1}` | Extracted from login page |
| currentMenu | `1` | Default value |
| failN | `0` | Default value |
| geolocation | `{from_step1}` | Optional, from page |
| fpVisitorId | `{from_step1}` | Optional, from page |
| captcha | | Empty string |
| mfaState | | Empty string |
| \_eventId | `submit` | Fixed value |

**Expected Response**: 302 Redirect

**Success Indicator**: `Location` header contains `ticket=` parameter

**Ticket Format**:

```
https://portal.ksu.edu.cn/?ticket=ST-{XXXXXXXX}-{XXX}-{XXX}-{XXX}-{XXXXXXXXXXX}
```

**Example Tickets**:

- `ST-324308-373nwVs-ZhLAZ8E3dJn-8jt8kyXorwRb`
- `ST-325214-HNtpZ-Jv0l7ZTDUmcgyC1ic792dGsP0U`
- `ST-330155-DPJo-rr1VAv-ZWQxDv5LiBWxUaUGdEOX`
- `ST-332784-G3AWMtZKhWTerrZ-PYZAOXkW8iicpTgf`

---

### Step 3: Extract Cookies

After successful login, extract all cookies from the browser session.

**Using Puppeteer CDP Session**:

```javascript
const client = await page.target().createCDPSession()
const { cookies } = await client.send('Network.getAllCookies')
await client.detach()

// Convert to cookie jar format
cookieJar = cookies.map((c) => `${c.name}=${c.value}`)
```

---

### Step 4: Portal Login

**Action**: Make a GET request to the ticket URL obtained from CAS redirect

**Purpose**: Establish portal session using the ticket

**Request**:

```javascript
await api.get(ticketUrl)
```

**Expected**: Sets session cookies for portal.ksu.edu.cn

---

### Step 5: JWXT SSO Login

**URL**: `https://jwnet.ksu.edu.cn/sso/ddlogin`

**Method**: GET

**Required Headers**:

```
Referer: https://portal.ksu.edu.cn/
Cookie: {cookies from step 3}
```

**Implementation**:

```javascript
const ssoUrl = 'https://jwnet.ksu.edu.cn/sso/ddlogin'
const ssoRes = await api.get(ssoUrl, {
  headers: { Referer: 'https://portal.ksu.edu.cn/' },
})

if (ssoRes.status !== 302 || !ssoRes.headers.location) {
  throw new Error('SSO跳转失败')
}
```

**Expected Response**: 302 Redirect to CAS login or directly to JWXT

---

### Step 6: Follow Redirect Chain

The SSO login initiates a redirect chain. Follow all redirects until status 200.

**Implementation**:

```javascript
let currentUrl = ssoRes.headers.location

for (let i = 0; i < 10; i++) {
  const res = await api.get(currentUrl)

  if (res.status === 200) {
    // Successfully reached final destination
    break
  }

  if (res.status === 302 && res.headers.location) {
    // Continue following redirect
    currentUrl = new URL(res.headers.location, currentUrl).href
  } else {
    throw new Error(`重定向链中断，状态码: ${res.status}`)
  }
}
```

**Max Redirects**: 10 hops

**Success**: Status 200 with cookies set for jwnet.ksu.edu.cn

---

## Alternative: Direct ticketlogin (Deprecated/Alternative)

**URL**: `https://jwnet.ksu.edu.cn/jwglxt/ticketlogin`

**Query Parameters**:
| Parameter | Description | Example |
|-----------|-------------|---------|
| uid | Student ID | ****\*\*\***** |
| timestamp | Unix timestamp | 1768361974 |
| verify | Verification hash | 8DDBFA62FD8BC931ADE534FDCE7EBBF5 |

**Note**: This method appears to be an alternative direct login but may require additional verification logic. The SSO flow above is the recommended approach.

---

## Complete Code Example

```javascript
const axios = require('axios')
const https = require('https')
const puppeteer = require('puppeteer')

let cookieJar = []

const agent = new https.Agent({
  rejectUnauthorized: false, // Bypass TLS certificate validation
})

const api = axios.create({
  httpsAgent: agent,
  maxRedirects: 0,
  validateStatus: (status) => status >= 200 && status < 400,
  timeout: 15000,
})

// Cookie management
api.interceptors.request.use((config) => {
  if (cookieJar.length) {
    config.headers.Cookie = cookieJar.join('; ')
  }
  return config
})

api.interceptors.response.use((response) => {
  if (response.headers['set-cookie']) {
    // Merge new cookies
    const newCookies = response.headers['set-cookie'].map(
      (c) => c.split(';')[0],
    )
    const cookieMap = new Map()
    cookieJar.forEach((c) => {
      const name = c.split('=')[0]
      cookieMap.set(name, c)
    })
    newCookies.forEach((c) => {
      const name = c.split('=')[0]
      cookieMap.set(name, c)
    })
    cookieJar = Array.from(cookieMap.values())
  }
  return response
})

async function performLogin(username, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

  // Step 1 & 2: CAS Login
  const serviceUrl =
    'https://portal.ksu.edu.cn/?path=https://portal.ksu.edu.cn/main.html#/Tourist'
  await page.goto(
    `https://cas.ksu.edu.cn/cas/login?service=${encodeURIComponent(serviceUrl)}`,
    {
      waitUntil: 'networkidle2',
    },
  )

  await page.waitForSelector('#username')
  await page.type('#username', username)
  await page.waitForSelector('#password')
  await page.type('#password', password)

  await page.evaluate(() => {
    const form = document.getElementById('fm1')
    if (form) {
      form.submit()
    }
  })

  // Wait for redirect and extract ticket
  let ticketUrl = null
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 })
    ticketUrl = page.url()
  } catch (e) {
    // Ticket may be in redirect chain
  }

  if (!ticketUrl || !ticketUrl.includes('ticket=')) {
    throw new Error('登录失败，未能获取到ticket')
  }

  // Step 3: Extract cookies
  const client = await page.target().createCDPSession()
  const { cookies } = await client.send('Network.getAllCookies')
  await client.detach()
  await browser.close()

  cookieJar = cookies.map((c) => `${c.name}=${c.value}`)

  // Step 4: Portal Login
  await api.get(ticketUrl)

  // Step 5 & 6: JWXT SSO Login with redirect chain
  const ssoUrl = 'https://jwnet.ksu.edu.cn/sso/ddlogin'
  const ssoRes = await api.get(ssoUrl, {
    headers: { Referer: 'https://portal.ksu.edu.cn/' },
  })

  if (ssoRes.status !== 302 || !ssoRes.headers.location) {
    throw new Error('SSO跳转失败')
  }

  let currentUrl = ssoRes.headers.location
  for (let i = 0; i < 10; i++) {
    const res = await api.get(currentUrl)
    if (res.status === 200) break
    if (res.status === 302 && res.headers.location) {
      currentUrl = new URL(res.headers.location, currentUrl).href
    } else {
      throw new Error(`重定向链中断，状态码: ${res.status}`)
    }
  }

  return cookieJar // Return for subsequent API calls
}

async function getGrades(session) {
  cookieJar = session

  const gradePageUrl =
    'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default'
  const gradeQueryUrl =
    'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxXsgrcj.html?doType=query&gnmkdm=N305005'

  const gradeFormData = {
    xnm: '2024',
    xqm: '12',
    _search: 'false',
    nd: Date.now(),
    'queryModel.showCount': '100',
    'queryModel.currentPage': '1',
    'queryModel.sortName': '',
    'queryModel.sortOrder': 'asc',
    time: '1',
  }

  const gradeRes = await api.post(
    gradeQueryUrl,
    querystring.stringify(gradeFormData),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: gradePageUrl,
      },
    },
  )

  return gradeRes.data
}
```

---

## Important Notes

### TLS Certificate

The school's HTTPS certificate may have validation issues. Set `rejectUnauthorized: false` in Node.js or equivalent in other languages.

### Cookie Management

- Cookies must be persisted across all requests
- New cookies from each response must be merged with existing cookie jar
- Cookies are domain-specific (cas.ksu.edu.cn, portal.ksu.edu.cn, jwnet.ksu.edu.cn)

### Redirect Handling

- CAS returns 302 redirects
- SSO initiates a redirect chain (up to 10 hops)
- Follow all redirects until status 200

### Session Validation

After login, validate session by accessing a JWXT page:

```javascript
const validationRes = await api.get(
  'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default',
)
if (
  validationRes.status !== 200 ||
  validationRes.data.includes('<title>错误提示</title>')
) {
  return { error: 'session_invalid' }
}
```

---

## Error Handling

| Error                      | Cause                | Solution                                    |
| -------------------------- | -------------------- | ------------------------------------------- |
| No ticket in URL           | Login failed         | Check username/password, verify form fields |
| SSO redirect failed        | Invalid session      | Ensure portal login completed successfully  |
| Redirect chain interrupted | Network/server error | Retry login, check network connectivity     |
| Session invalid            | Session expired      | Re-run login flow                           |

---

_This document is part of the Ksu-App project. For the complete API reference, see `JWXT_API_REFERENCE.md`_
