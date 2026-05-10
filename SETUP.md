# AO WhatsApp AI Agent — Complete Setup Guide

## Overview

This system handles the full WhatsApp AI agent flow for Adventures Overland:
- Receives leads from Zoho CRM via webhook
- Sends WhatsApp template messages using Meta Cloud API
- AI agent (Claude) handles conversations with full trip context
- Auto-qualifies leads as WARM / COLD / JUNK and syncs to Zoho
- Sends brochures, shares agent contacts, sends inactivity nudges
- Dashboard UI to monitor and manage all conversations

---

## Step 1 — Meta (WhatsApp) Setup

### 1.1 Create a WhatsApp Business App
1. Go to https://developers.facebook.com
2. Create a new App → Business → WhatsApp
3. Add a phone number (your AO business number)
4. Note your **Phone Number ID** and **WhatsApp Business Account ID**

### 1.2 Get a Permanent Access Token
1. Go to Business Settings → System Users
2. Create a system user with Admin role
3. Generate a **Never-expiring** token with these permissions:
   - whatsapp_business_messaging
   - whatsapp_business_management
4. Save the token → this is your `WA_ACCESS_TOKEN`

### 1.3 Create the Lead Notification Template
1. In WhatsApp Manager → Message Templates → Create Template
2. **Template name**: `ao_lead_notification`
3. **Category**: UTILITY
4. **Body**: `Dear {{1}}, We have received your query for {{2}}. Our travel expert will get in touch with you shortly. Meanwhile, feel free to ask any questions here! 😊`
5. Submit for approval (usually 24-48 hours)

### 1.4 Set Verify Token
Pick any random string (e.g., `ao_verify_xyz_2025`) — this is your `WA_VERIFY_TOKEN`

---

## Step 2 — Anthropic API Key

1. Go to https://console.anthropic.com
2. Create an API key
3. Save as `ANTHROPIC_API_KEY`

---

## Step 3 — Zoho CRM Setup

### 3.1 Create OAuth App
1. Go to https://api-console.zoho.in
2. Create a Self Client
3. Generate a code with scope: `ZohoCRM.modules.ALL,ZohoCRM.settings.ALL`
4. Exchange for refresh token (one-time)
5. Save `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`

### 3.2 Create Webhook in Zoho
1. Zoho CRM → Setup → Automation → Webhooks → New Webhook
2. URL: `https://your-backend.render.com/webhook/zoho`
3. Method: POST
4. Trigger: Module = Leads → On Create
5. Parameters to send (map from lead fields):
   - leadId → ${Leads.ID}
   - firstName → ${Leads.First Name}
   - lastName → ${Leads.Last Name}
   - mobile → ${Leads.Mobile}
   - phone → ${Leads.Phone}
   - tripName → ${Leads.CF_Trip_Name}  ← your custom field name

### 3.3 Add Custom Field in Zoho
1. Setup → Modules → Leads → Fields → Add Field
2. Field label: **Trip Name**, Field type: Single Line
3. API name will be: `CF_Trip_Name` (confirm this in the field settings)

---

## Step 4 — Deploy to Render

### 4.1 Push to GitHub
```bash
git init
git add .
git commit -m "AO Agent initial setup"
git remote add origin https://github.com/your-org/ao-agent.git
git push -u origin main
```

### 4.2 Deploy on Render
1. Go to https://render.com → New → Blueprint
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates both services automatically
4. Set all environment variables in Render dashboard (copy from `.env.example`)
5. Deploy!

### 4.3 Get your URLs
- Backend: `https://ao-agent-backend.onrender.com`
- Dashboard: `https://ao-agent-dashboard.onrender.com`

### 4.4 Update Dashboard API URL
Edit `dashboard/index.html` line with `window.AO_API_BASE`:
```js
const API_BASE = window.AO_API_BASE || 'https://ao-agent-backend.onrender.com/api';
```

---

## Step 5 — Configure WhatsApp Webhook

1. Meta Dashboard → WhatsApp → Configuration → Webhooks
2. Callback URL: `https://ao-agent-backend.onrender.com/webhook/whatsapp`
3. Verify Token: your `WA_VERIFY_TOKEN` value
4. Subscribe to: `messages`
5. Click Verify — your server handles the challenge automatically

---

## Step 6 — Add Brochure PDFs

Upload your brochure PDFs to any public CDN (Google Drive public link, AWS S3, Cloudflare R2, etc.)
Set the URLs in Render environment variables:
- `BROCHURE_ICELAND=https://...`
- `BROCHURE_LONDON=https://...`
- etc.

Or set them via the Dashboard → Trip Knowledge Base → Edit trip → Brochure PDF URL

---

## Step 7 — Test

1. Open Dashboard → Test Lead Simulator
2. Enter your own phone number
3. Select a trip
4. Click "Simulate Lead"
5. You'll receive a WhatsApp message on your phone
6. Reply and watch the AI agent respond in real-time

---

## Architecture Summary

```
[Zoho Lead Created]
       ↓ webhook POST
[Your Backend on Render]
       ↓ stores context
[WhatsApp API] → sends template to user
       ↓ user replies (webhook POST)
[Backend] → [Claude AI with trip context]
       ↓ AI response + action
[WhatsApp API] → sends reply
       ↓ if action = send_brochure
[WhatsApp API] → sends PDF
       ↓ if action = connect_agent
[WhatsApp API] → sends agent contact
       ↓ updates lead status
[Zoho CRM API] → WARM/COLD/JUNK
```

---

## Customising the AI Agent

Edit `backend/services/agent.js` → `SYSTEM_PROMPT` function to:
- Change Aria's name/persona
- Add more qualification rules
- Change the language/tone
- Add trip-specific instructions

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Webhook verification fails | Check WA_VERIFY_TOKEN matches exactly |
| Messages not sending | Check WA_ACCESS_TOKEN and PHONE_ID |
| AI not responding | Check ANTHROPIC_API_KEY |
| Zoho not updating | Check OAuth token expiry, refresh ZOHO_REFRESH_TOKEN |
| Template rejected | Re-check template body matches Meta's policies |
