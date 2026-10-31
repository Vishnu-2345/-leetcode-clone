# Login Issue Troubleshooting

## Current Status
- ✅ Backend is running and responding
- ✅ Login API is working
- ✅ Problems API is returning data
- ⚠️ Frontend may be stuck or showing blank page

## Quick Fixes

### 1. Hard Refresh the Browser
Press `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac) to clear cache and reload

### 2. Clear Browser Storage
1. Press `F12` to open Developer Tools
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click "Clear site data" or "Clear Storage"
4. Refresh the page

### 3. Check Browser Console
1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Look for any red errors
4. Take a screenshot if you see errors

### 4. Check Network Tab
1. Press `F12`
2. Go to **Network** tab
3. Try logging in again
4. Check if `/api/auth/login` shows status 200
5. Check if `/api/problems` shows status 200

### 5. Try Direct URL
After logging in, manually type in the address bar:
```
http://localhost:5173/problems
```

### 6. Check If You're Actually Logged In
Open Console (F12) and type:
```javascript
localStorage.getItem('auth-storage')
```

If you see `null`, you're not logged in. If you see JSON data, you ARE logged in.

## Expected Behavior After Login

1. You click "Sign in"
2. You see a success toast message "Login successful!"
3. Browser redirects to `/problems` URL
4. You see a list of 5 problems:
   - Two Sum (Easy)
   - Valid Parentheses (Easy)  
   - Reverse Linked List (Easy)
   - Longest Substring Without Repeating Characters (Medium)
   - Median of Two Sorted Arrays (Hard)

## If Still Stuck

### Option A: Try Register Instead
1. Go to http://localhost:5173/register
2. Create a new account
3. See if that works better

### Option B: Check What's Actually Showing
Take a screenshot of:
1. The page you're seeing
2. The browser console (F12 → Console tab)
3. The browser network tab (F12 → Network tab)

## API Testing

You can test the backend directly:

### Test Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123\"}"
```

### Test Problems (should get 5 problems):
```bash
curl http://localhost:3000/api/problems
```

## Common Issues

### Issue 1: White/Blank Page
**Cause:** React error or CSS not loading
**Fix:** Hard refresh (Ctrl+Shift+R) and clear cache

### Issue 2: Stuck on Login Page
**Cause:** Redirect not working
**Fix:** Check console for errors, manually go to /problems

### Issue 3: "Cannot read property" errors
**Cause:** API response format mismatch
**Fix:** Check Network tab to see actual API response

### Issue 4: CORS Errors
**Cause:** Backend not allowing frontend requests
**Fix:** Backend is configured correctly, but restart if needed:
```bash
docker-compose restart backend frontend
```

## Quick Test URLs

- Homepage: http://localhost:5173/
- Login: http://localhost:5173/login
- Problems: http://localhost:5173/problems  
- Register: http://localhost:5173/register

## Backend Health Check

```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok","timestamp":"..."}`

---

## What To Try RIGHT NOW

1. **Open a new Incognito/Private window**
2. Go to: http://localhost:5173/login
3. Login with:
   - Email: test@example.com
   - Password: test123
4. See if it works in incognito

If it works in incognito, your browser cache is the issue!
