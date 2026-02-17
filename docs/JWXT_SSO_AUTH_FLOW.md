# JWXT SSO Authentication Flow - Complete Technical Reference

> Exact SSO authentication flow for Kashgar University Educational Administration System
> Based on actual working implementation from chat history

**Last Updated**: 2026-02-17
**Version**: 1.0.0

---

## Overview

This document provides the **EXACT** SSO authentication flow for accessing the JWXT (教务系统) system. This is based on actual working implementation and real HTTP request/response analysis.

---

## Complete SSO Flow

```
Portal Session → SSO Login → CAS Redirect → Ticket → SSO Login → ticketlogin → JWXT Session
     (Step 1)       (Step 2)        (Step 3)      (Step 4)    (Step 5)      (Step 6)
```

---

## Step-by-Step Implementation

### Step 1: Establish Portal Session

After CAS login and obtaining the ticket, call the portal ticket URL:

```javascript
await api.get(ticketUrl)
// ticketUrl format: https://portal.ksu.edu.cn/?ticket=ST-XXXXXXXX-XXX-XXX-XXX-XXXXXXXXXXX
```

**Purpose**: Establish portal session and receive portal cookies

**Expected Response**: 200 OK with Set-Cookie headers

---

### Step 2: Initiate JWXT SSO Login

```javascript
const ssoUrl = 'https://jwnet.ksu.edu.cn/sso/ddlogin'
const ssoRes = await api.get(ssoUrl, {
  headers: { Referer: 'https://portal.ksu.edu.cn/' },
})
```

**Request Details**:

- **URL**: `https://jwnet.ksu.edu.cn/sso/ddlogin`
- **Method**: GET
- **Headers**:
  - `Referer`: `https://portal.ksu.edu.cn/` (REQUIRED)
  - `Cookie`: All cookies from portal session
  - `User-Agent`: Standard browser UA

**Expected Response**: 302 Redirect

**Response Location Header**:

```
https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin
```

---

### Step 3: CAS Redirect (First Redirect)

Follow the redirect to CAS:

```javascript
let currentUrl = ssoRes.headers.location
// currentUrl: https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin

const res = await api.get(currentUrl)
// Expected: 302 Redirect
```

**Expected Response**: 302 Redirect

**Response Location Header**:

```
https://jwnet.ksu.edu.cn/sso/ddlogin?ticket=ST-XXXXXXXX-XXX-XXX-XXX-XXXXXXXXXXX
```

---

### Step 4: SSO Login with Ticket (Second Redirect)

```javascript
currentUrl = res.headers.location
// currentUrl: https://jwnet.ksu.edu.cn/sso/ddlogin?ticket=ST-XXXXXXXX-XXX-XXX-XXX-XXXXXXXXXXX

const res = await api.get(currentUrl)
// Expected: 302 Redirect
```

**Expected Response**: 302 Redirect

**Response Location Header**:

```
https://jwnet.ksu.edu.cn/sso/ddlogin
```

---

### Step 5: Final SSO Redirect (Third Redirect)

```javascript
currentUrl = res.headers.location
// currentUrl: https://jwnet.ksu.edu.cn/sso/ddlogin

const res = await api.get(currentUrl)
// Expected: 302 Redirect
```

**Expected Response**: 302 Redirect

**Response Location Header**:

```
https://jwnet.ksu.edu.cn/jwglxt/ticketlogin?uid=***********&timestamp=1768361974&verify=8DDBFA62FD8BC931ADE534FDCE7EBBF5
```

---

### Step 6: Ticket Login (Fourth Redirect - May Timeout)

```javascript
currentUrl = res.headers.location
// currentUrl: https://jwnet.ksu.edu.cn/jwglxt/ticketlogin?uid=***********&timestamp=1768361974&verify=8DDBFA62FD8BC931ADE534FDCE7EBBF5

try {
  const res = await api.get(currentUrl)
  // Expected: 200 OK
} catch (err) {
  // ticketlogin MAY TIMEOUT but session is established
  if (currentUrl.includes('ticketlogin')) {
    // Session is actually valid, continue
  }
}
```

**IMPORTANT**: The `ticketlogin` endpoint may timeout (60s) but the session is still valid!

**Expected Behavior**:

- Response: 200 OK OR timeout
- If timeout, session is STILL valid
- Continue with JWXT API calls

---

## Complete Redirect Chain Summary

```
1. GET https://jwnet.ksu.edu.cn/sso/ddlogin
   → 302 → https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin

2. GET https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin
   → 302 → https://jwnet.ksu.edu.cn/sso/ddlogin?ticket=ST-XXXXXXXX-XXX-XXX-XXX-XXXXXXXXXXX

3. GET https://jwnet.ksu.edu.cn/sso/ddlogin?ticket=ST-XXXXXXXX-XXX-XXX-XXX-XXXXXXXXXXX
   → 302 → https://jwnet.ksu.edu.cn/sso/ddlogin

4. GET https://jwnet.ksu.edu.cn/sso/ddlogin
   → 302 → https://jwnet.ksu.edu.cn/jwglxt/ticketlogin?uid=***********&timestamp=1768361974&verify=8DDBFA62FD8BC931ADE534FDCE7EBBF5

5. GET https://jwnet.ksu.edu.cn/jwglxt/ticketlogin?uid=***********&timestamp=1768361974&verify=8DDBFA62FD8BC931ADE534FDCE7EBBF5
   → 200 OK OR TIMEOUT (session is valid either way)
```

---

## Request Headers

### Required Headers for All Requests

```javascript
headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
    'Referer': 'https://portal.ksu.edu.cn/',
    'Cookie': cookieJar.join('; ')  // All cookies from previous steps
}
```

### Axios Configuration

```javascript
const api = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  maxRedirects: 0, // IMPORTANT: Handle redirects manually
  validateStatus: (status) => status >= 200 && status < 400,
  timeout: 60000, // 60 seconds timeout
})
```

---

## Cookie Management

### Cookie Interceptor

```javascript
let cookieJar = []

// Merge cookies from response
api.interceptors.response.use((response) => {
  if (response.headers['set-cookie']) {
    const newCookies = response.headers['set-cookie'].map(
      (c) => c.split(';')[0],
    )
    const cookieMap = new Map()

    // Add existing cookies
    cookieJar.forEach((c) => {
      const name = c.split('=')[0]
      cookieMap.set(name, c)
    })

    // Add/overwrite with new cookies
    newCookies.forEach((c) => {
      const name = c.split('=')[0]
      cookieMap.set(name, c)
    })

    cookieJar = Array.from(cookieMap.values())
  }
  return response
})

// Add cookies to request
api.interceptors.request.use((config) => {
  if (cookieJar.length) {
    config.headers.Cookie = cookieJar.join('; ')
  }
  return config
})
```

---

## Complete Working Code

```javascript
async function performLogin(username, password) {
  // Step 1: CAS login with Puppeteer (previous steps)
  // ... (CAS login code to get ticket and cookies)

  cookieJar = cookies.map((c) => `${c.name}=${c.value}`)

  // Step 2: Portal login
  await api.get(ticketUrl)

  // Step 3: Initiate JWXT SSO
  const ssoUrl = 'https://jwnet.ksu.edu.cn/sso/ddlogin'
  const ssoRes = await api.get(ssoUrl, {
    headers: { Referer: 'https://portal.ksu.edu.cn/' },
  })

  if (ssoRes.status !== 302 || !ssoRes.headers.location) {
    throw new Error('SSO跳转失败')
  }

  // Step 4-6: Follow redirect chain
  let currentUrl = ssoRes.headers.location

  for (let i = 0; i < 10; i++) {
    try {
      const res = await api.get(currentUrl)

      if (res.status === 200) {
        // Successfully reached final destination
        break
      }

      if (res.status === 302 && res.headers.location) {
        currentUrl = new URL(res.headers.location, currentUrl).href
      } else {
        throw new Error(`重定向链中断，状态码: ${res.status}`)
      }
    } catch (err) {
      // ticketlogin may timeout but session is valid
      if (currentUrl.includes('ticketlogin')) {
        // Session is actually valid, continue
        break
      }
      throw err
    }
  }

  return cookieJar
}
```

---

## Validation

After completing the SSO flow, validate the session:

```javascript
async function validateSession() {
  const gradePageUrl =
    'https://jwnet.ksu.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default'

  const validationRes = await api.get(gradePageUrl)

  if (
    validationRes.status !== 200 ||
    validationRes.data.includes('<title>错误提示</title>')
  ) {
    return { error: 'session_invalid' }
  }

  return { valid: true }
}
```

---

## Key Technical Details

### SSO Endpoint Analysis

**Endpoint**: `https://jwnet.ksu.edu.cn/sso/ddlogin`

**Parameters**:

- No query parameters required initially
- Cookies from portal session are required
- Referer header must be set to portal URL

**Response Flow**:

1. First call redirects to CAS
2. CAS redirects back with ticket
3. Second call with ticket redirects to itself
4. Third call redirects to ticketlogin
5. ticketlogin establishes JWXT session (may timeout)

### Ticket Login Endpoint

**Endpoint**: `https://jwnet.ksu.edu.cn/jwglxt/ticketlogin`

**Query Parameters**:

- `uid`: Student ID (e.g., ****\*\*\*****)
- `timestamp`: Unix timestamp (e.g., 1768361974)
- `verify`: MD5 hash (e.g., 8DDBFA62FD8BC931ADE534FDCE7EBBF5)

**Behavior**:

- May timeout (60s) but still establishes session
- Session cookies are set before timeout
- Continue with API calls after timeout

### Redirect Chain Characteristics

- **Total redirects**: 4-5 hops
- **Max timeout**: 60 seconds per request
- **Critical redirect**: ticketlogin (last hop, may timeout)
- **Success indicator**: Status 200 OR timeout on ticketlogin

---

## Troubleshooting

### SSO Redirect Fails

**Symptom**: First call to ddlogin doesn't return 302

**Solution**:

- Verify portal session is established
- Check Referer header is set correctly
- Ensure all cookies are included

### Session Invalid After Login

**Symptom**: Validation returns session_invalid

**Solution**:

- Check cookieJar contains all cookies
- Verify redirect chain completed (even with timeout)
- Try increasing timeout value

### ticketlogin Timeout

**Symptom**: Request to ticketlogin times out after 60s

**Solution**:

- **This is expected behavior!**
- Session is still valid
- Continue with API calls
- Do not treat as error

---

## Real Execution Example

```
→ [5/5] 跳转教务系统...
  请求: https://jwnet.ksu.edu.cn/sso/ddlogin
  响应状态: 302
  跳转目标: https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin
  重定向 1/10: https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fjwnet.ksu.edu.cn%2Fsso%2Fddlogin
    响应: 302
  重定向 2/10: https://jwnet.ksu.edu.cn/sso/ddlogin?ticket=ST-325214-HNtpZ-Jv0l7ZTDUmcgyC1ic792dGsP0U
    响应: 302
  重定向 3/10: https://jwnet.ksu.edu.cn/sso/ddlogin
    响应: 302
  重定向 4/10: https://jwnet.ksu.edu.cn/jwglxt/ticketlogin?uid=***********&timestamp=1768362409&verify=4A37FC1D6DABD2C96A49D3BFE4083EB4
    ticketlogin 超时，尝试继续...
  ✓ 教务系统登录成功
```

---

_This document provides the exact SSO authentication flow based on working implementation. For complete login flow including CAS authentication, see `JWXT_LOGIN_FLOW.md`_
