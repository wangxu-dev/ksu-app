# Kashgar University JWXT API Reference

> Comprehensive API documentation for Kashgar University Educational Administration System integration
> Generated from chat history analysis and official API documentation

**Last Updated**: 2026-02-17
**Version**: 1.0.0

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Formats](#requestresponse-formats)
4. [Error Handling](#error-handling)
5. [Implementation Notes](#implementation-notes)

---

## Authentication System

### CAS Login Flow

The system uses CAS (Central Authentication Service) for unified authentication.

#### Step 1: GET Login Page

```
GET https://cas.ksu.edu.cn/cas/login?service={SERVICE_URL}
```

**Query Parameters**:
| Parameter | Description | Example |
|-----------|-------------|---------|
| service | Target service URL after successful login | `https://portal.ksu.edu.cn/?path=https://portal.ksu.edu.cn/main.html#/` |

**Response**: HTML login form page

**Hidden Fields to Extract**:

```html
<input type="hidden" name="execution" value="{EXECUTION_VALUE}" />
<input type="hidden" name="currentMenu" value="{CURRENT_MENU_VALUE}" />
<input type="hidden" name="failN" value="{FAIL_N_VALUE}" />
<input type="hidden" name="geolocation" value="{GEO_VALUE}" />
<input type="hidden" name="fpVisitorId" value="{FP_ID_VALUE}" />
```

#### Step 2: POST Login Credentials

```
POST https://cas.ksu.edu.cn/cas/login?service={SERVICE_URL}
Content-Type: application/x-www-form-urlencoded
```

**Request Headers**:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Origin: https://cas.ksu.edu.cn
Referer: {LOGIN_PAGE_URL}
```

**Form Data**:
| Field | Description | Example |
|-------|-------------|---------|
| username | Student ID | `***********` |
| password | Password | `***` |
| execution | From page | Required |
| currentMenu | From page (default: "1") | |
| failN | From page (default: "0") | |
| geolocation | From page | Optional |
| fpVisitorId | From page | Optional |
| captcha | Captcha | Empty |
| mfaState | MFA state | Empty |
| \_eventId | Event ID | `submit` |

**Response**: 302 Redirect

**Success Indicator**: `Location` header contains `ticket=` parameter

#### Step 3: Extract idToken from Ticket

The ticket is in JWT format: `header.payload.signature`

**Ticket Payload Structure**:

```json
{
  "idToken": "eyJhbGciOiJSUzUxMiJ9...",
  "sub": "***********",
  "iss": "cas.ksu.edu.cn"
}
```

**idToken Usage**: Include in `x-id-token` header for all subsequent API requests

---

## API Endpoints

### Domain Classification

#### 1. Authentication & User Services

**Domain**: `authx-service.ksu.edu.cn`

| Endpoint                              | Method | Description                   |
| ------------------------------------- | ------ | ----------------------------- |
| `/personal/api/v1/personal/me/user`   | GET    | Get user basic information    |
| `/personal/api/v1/me/portrait`        | GET    | Get user avatar               |
| `/personal/api/v1/personal/user/info` | GET    | Get user detailed information |

#### 2. Personal Data Services

**Domain**: `portal-data.ksu.edu.cn`

| Endpoint                                        | Method | Description                     |
| ----------------------------------------------- | ------ | ------------------------------- |
| `/portalCenter/v2/personalData/getPersonalInfo` | GET    | Get comprehensive personal info |
| `/portalCenter/v2/personalData/getXlInfo`       | GET    | Get academic calendar info      |

#### 3. Grade/Score Services

**Domain**: `score-inquiry.ksu.edu.cn`

| Endpoint                   | Method | Description                  |
| -------------------------- | ------ | ---------------------------- |
| `/api/std-grade/detail`    | GET    | Get grade details            |
| `/api/std-grade/semesters` | GET    | Get available semesters list |
| `/api/std-grade/showGpa`   | GET    | Get GPA information          |

#### 4. Educational Administration System

**Domain**: `jwnet.ksu.edu.cn`

| Endpoint                          | Method | Description                          |
| --------------------------------- | ------ | ------------------------------------ |
| `/jwglxt/ticketlogin`             | GET    | Login to academic system with ticket |
| `/sso/ddlogin`                    | GET    | Single sign-on via ticket            |
| `/jwglxt/cjcx/cjcx_cxDgXscj.html` | GET    | Grade inquiry page                   |
| `/jwglxt/cjcx/cjcx_cxXsgrcj.html` | GET    | Personal grade query page            |

#### 5. Portal Services

**Domain**: `portal.ksu.edu.cn`

| Endpoint                              | Method | Description              |
| ------------------------------------- | ------ | ------------------------ |
| `/portal-api/v1/config/getDetail`     | GET    | Get portal configuration |
| `/portal-api/v1/intranet/getDetail`   | GET    | Get intranet details     |
| `/portal-api/v1/service/useTime/save` | GET    | Save service usage time  |
| `/portal-api/v2/theme/themeInfo`      | GET    | Get theme information    |

#### 6. CAS Services

**Domain**: `cas.ksu.edu.cn`

| Endpoint     | Method   | Description        |
| ------------ | -------- | ------------------ |
| `/cas/login` | GET/POST | CAS authentication |

---

## Request/Response Formats

### Standard Request Headers

**Required for all API requests**:

```
x-id-token: {idToken from CAS login}
Referer: https://portal.ksu.edu.cn/main.html
```

**Recommended headers**:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json, text/plain, */*
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
x-device-info: PC
x-terminal-info: PC
```

### Standard Response Format

**Success Response**:

```json
{
  "code": 0,
  "message": null,
  "data": {
    // Response data
  }
}
```

**Error Response**:

```json
{
  "code": 401,
  "message": "Token已过期",
  "data": null
}
```

### Grade API Response Format

**Note**: Grade API uses different response format

**Success Response**:

```json
{
  "success": true,
  "code": 200,
  "msg": "查询成功",
  "data": {
    "totalCredit": 120.5,
    "gpa": "3.45",
    "ga": "85.2",
    "semesterGradeList": [
      {
        "semesterName": "2025-2026学年 第一学期",
        "gradeList": [
          {
            "courseName": "高等数学",
            "credit": 4.0,
            "score": 85.0,
            "gp": 3.5,
            "courseType": "必修",
            "assessmentMethod": "考试"
          }
        ]
      }
    ]
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Status | Description              | Action                                |
| ------ | ------------------------ | ------------------------------------- |
| 302    | Login success redirect   | Extract ticket from Location header   |
| 401    | Token invalid or expired | Re-login to get new token             |
| 500    | Server error             | Check request parameters, retry later |

### Business Error Codes

| Code | Description                  |
| ---- | ---------------------------- |
| 0    | Success                      |
| 401  | Unauthorized / Invalid token |
| 403  | Permission denied            |
| 500  | Business processing failed   |

---

## Implementation Notes

### Important Considerations

1. **TLS Certificate**: School HTTPS certificate may have issues, may need to bypass certificate validation
2. **Request Timeout**: Recommended 20-30 seconds
3. **Token Expiration**: idToken expires, requires re-login
4. **Random Number Parameter**: Some APIs need `random_number` parameter (use timestamp) to prevent caching
5. **Referer Validation**: Some APIs validate Referer header
6. **Domain Spelling**: Watch for `personal` vs `personnel` spelling differences

### Authentication Flow Diagram

```
┌─────────────────┐
│  User Access    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  1. GET /cas/login?service=...    │
│     Get login page                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  2. Parse HTML extract hidden     │
│     fields (execution, currentMenu, │
│     failN, geolocation, fpVisitorId)│
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  3. POST /cas/login              │
│     Submit username, password,      │
│     and hidden fields               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  4. Get 302 response, extract     │
│     ticket from Location header     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  5. Parse ticket JWT              │
│     Extract idToken from payload    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  6. Use idToken for API calls     │
│     Header: x-id-token: {idToken}   │
└─────────────────────────────────────┘
```

### Code Examples

#### Extract idToken from Ticket JWT

```javascript
function extractIdToken(ticket) {
  const parts = ticket.split('.')
  if (parts.length === 3) {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return payload.idToken
  }
  return null
}
```

#### Grade API Request

```javascript
async function getGrades(token, semesterYear = '2025-2026') {
  const response = await fetch(
    `https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1&semesterYear=${semesterYear}`,
    {
      headers: {
        'x-id-token': token,
        Referer: 'https://score-inquiry.ksu.edu.cn/ui/',
      },
    },
  )

  const data = await response.json()
  if (data.success) {
    return data.data
  } else {
    throw new Error(data.msg || '获取成绩失败')
  }
}
```

---

## Appendix

### A. Complete Service URL Examples

**CAS Login**:

```
https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F
```

**Grade Inquiry (URL-encoded)**:

```
https://portal.ksu.edu.cn/?path=https%3A%2F%2Fportal.ksu.edu.cn%2Fmain.html%23%2F
```

### B. JWT Token Structure

**idToken Payload Example**:

```json
{
  "ATTR_userNo": "***********",
  "sub": "***********",
  "iss": "cas.ksu.edu.cn",
  "ATTR_identityTypeId": "3f737ed02cb111ec5dea51183d57be3",
  "ATTR_accountId": "810be150675311ee9b64033fea5decb9",
  "ATTR_userId": "80fc7800675311ee9b64033fea5decb9",
  "ATTR_name": "张三",
  "ATTR_identityTypeCode": "01",
  "ATTR_identityTypeName": "本科生",
  "ATTR_accountName": "***********",
  "ATTR_organizationName": "喀什大学",
  "ATTR_userName": "张三",
  "lang": "en",
  "exp": 1768393180,
  "ATTR_organizationId": "20230705",
  "ATTR_uid": "***********",
  "iat": 1768364380,
  "jti": "ID-Token-57771-w8oJj-0wog8BVTurDpBsX9yovMRcS69d",
  "req": "本科生",
  "ATTR_organizationCode": "20230705"
}
```

---

_This document is maintained as part of the Ksu-App project. For updates, refer to the official API documentation or chat history in `D:\Project\ksu\ksu_mcp\参考\`_
