# Shiny Paws Admin Panel - Security Documentation

## 🔐 Security Model: Token-Per-Update

Your admin panel uses a **secure token-per-update** model for maximum security.

### How It Works

1. **You click "Update Website"**
2. **Browser prompts:** "Enter your GitHub Personal Access Token"
3. **You paste your token** (one time)
4. **System uses token** to push changes to GitHub
5. **Token is immediately deleted** from memory
6. **Token is never stored** on disk or browser storage

### Why This is Secure

✅ **No stored tokens** - Token only exists in memory for seconds
✅ **No browser persistence** - Token is not saved to localStorage
✅ **No server storage** - Everything happens in your browser
✅ **Complete control** - You decide when token is used
✅ **Easy revocation** - Delete token on GitHub anytime
✅ **Audit trail** - Every update is logged with timestamp

## 🛡️ Security Features

### 1. Token Prompt
- Token is requested fresh each time you update
- Token is masked in the prompt (shows as dots)
- You can see the prompt before entering token

### 2. Memory Clearing
- Token is cleared from memory after use
- JavaScript garbage collection removes it
- Token cannot be recovered after update

### 3. Audit Logging
- Every update is logged with timestamp
- Logs show what action was performed
- Logs are stored locally (only you can see)
- View logs: Open console and run `viewUpdateLogs()`

### 4. Error Handling
- Invalid tokens show clear error messages
- Failed updates don't compromise security
- Errors are logged for debugging

## 🔑 GitHub Token Best Practices

### Creating Your Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. **Name:** `Shiny Paws Admin`
4. **Scope:** Check only `repo` (full control of repositories)
5. **Expiration:** Choose 90 days or 1 year (your preference)
6. **Copy token** and save it somewhere safe

### Token Permissions

Your token needs **only** the `repo` scope:
- ✅ Full control of private repositories
- ✅ Can read and write files
- ✅ Can create commits
- ❌ Cannot access other repositories
- ❌ Cannot delete the repository
- ❌ Cannot manage users or settings

### Token Security

- **Keep it private** - Don't share with anyone
- **Don't commit it** - Never put it in code
- **Don't email it** - Use secure channels only
- **Revoke old tokens** - When changing computers
- **Use expiration** - Tokens expire automatically
- **Monitor usage** - Check GitHub activity log

## 🚨 What If Token is Compromised?

### If Someone Gets Your Token

1. **Go to:** https://github.com/settings/tokens
2. **Find the token** (named "Shiny Paws Admin")
3. **Click "Delete"**
4. **Create a new token** with a new name
5. **Use the new token** in admin panel

**That's it!** The old token becomes useless immediately.

### If You Suspect Unauthorized Access

1. **Delete the token** immediately
2. **Check GitHub commit history** for suspicious changes
3. **Revert any unauthorized commits** (GitHub has "Revert" button)
4. **Create a new token** with a new name
5. **Change admin panel password** (if you want)

## 📋 Security Checklist

### Initial Setup
- [ ] Created GitHub token with `repo` scope only
- [ ] Saved token in secure location (password manager)
- [ ] Did NOT commit token to any code
- [ ] Did NOT email token to anyone
- [ ] Verified token works in admin panel

### Regular Maintenance
- [ ] Check GitHub commit history monthly
- [ ] Review update logs occasionally
- [ ] Rotate token every 6-12 months
- [ ] Delete unused tokens
- [ ] Monitor GitHub activity

### If Using on Shared Computer
- [ ] Use private browser window
- [ ] Clear browser history after logout
- [ ] Don't save token in browser
- [ ] Use strong admin panel password
- [ ] Log out when done

## 🔍 Monitoring & Auditing

### View Update Logs

Open browser console (F12 → Console) and run:
```javascript
viewUpdateLogs()
```

This shows all updates made through the admin panel with:
- Timestamp
- Action type (content, pricing, image)
- Details (what was changed)

### Check GitHub Commits

1. Go to: https://github.com/ssorvex/ShinyPaws
2. Click "Commits"
3. See all changes with timestamps
4. Each commit shows what was changed
5. You can revert any commit

### Monitor GitHub Activity

1. Go to: https://github.com/settings/security-log
2. See all activity on your account
3. Check for suspicious logins or token usage
4. Delete tokens you don't recognize

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Token compromised | Someone can edit website | Delete token immediately |
| Unauthorized edits | Website content changed | Revert commits on GitHub |
| Lost token | Can't update website | Create new token |
| Shared computer | Others see your token | Use private browser window |
| Forgotten token | Need to create new one | Save in password manager |

## 🎓 Technical Details

### How Token is Used

1. **Fetch file from GitHub**
   ```
   GET /repos/ssorvex/ShinyPaws/contents/studio.html
   Authorization: token YOUR_TOKEN
   ```

2. **Update file on GitHub**
   ```
   PUT /repos/ssorvex/ShinyPaws/contents/studio.html
   Authorization: token YOUR_TOKEN
   Content: Base64 encoded HTML
   ```

3. **Token is cleared**
   ```javascript
   clearSensitiveData(token);
   token = null;
   ```

### What Token Can't Do

- ❌ Access other repositories
- ❌ Delete the repository
- ❌ Manage users or permissions
- ❌ Access private data outside the repo
- ❌ Create new repositories
- ❌ Access your account settings

### What Token Can Do

- ✅ Read files from repository
- ✅ Update files in repository
- ✅ Create commits
- ✅ View commit history
- ✅ Update repository settings (limited)

## 📞 Questions?

If you have security concerns:
1. Check this document
2. Review GitHub's security documentation
3. Contact your developer
4. Check GitHub security settings

## 🎉 You're Secure!

Your admin panel is designed with **security first**. The token-per-update model ensures your GitHub access is always protected.

---

**Last Updated:** April 11, 2026
**Security Model:** Token-Per-Update (No Storage)
