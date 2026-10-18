# Claude & Model Context Protocol (MCP) Integration Guide

This guide explains how to connect **Claude Desktop**, **Claude Code**, Cursor, or any MCP-compatible AI client directly to your **WeBotApp WhatsApp Gateway** using the **Model Context Protocol (MCP)**.

---

## 1. Overview & Endpoint URL

Just like Wassenger's MCP endpoint (`https://api.wassenger.com/mcp?key=YOUR_API_KEY`), your WhatsApp Gateway now has a native, full-featured Model Context Protocol endpoint supporting both **Server-Sent Events (SSE)** and **Streamable HTTP POST (JSON-RPC 2.0)**.

### Your MCP Endpoint:
```
https://your-domain.com/mcp?key=YOUR_API_KEY
```
*(Alternative alias: `https://your-domain.com/api/mcp?key=YOUR_API_KEY`)*

- Replace `https://your-domain.com` with your deployed gateway URL (or `http://localhost:3030` for local testing).
- Replace `YOUR_API_KEY` with your API key generated from the **User Profile / API Key** section in your dashboard.

---

## 2. Setting Up Claude Desktop

To connect Claude Desktop to your WhatsApp Gateway:

1. Open your Claude Desktop configuration file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. Add your WhatsApp Gateway under `mcpServers`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "url": "https://your-domain.com/mcp?key=YOUR_API_KEY"
    }
  }
}
```

3. Restart Claude Desktop.
4. You will see a 🔨 (hammer) icon in Claude with the available WhatsApp tools!

---

## 3. Setting Up Cursor / Cline / LibreChat / Claude Code

### Direct MCP Remote URL
In any client that supports remote HTTP/SSE MCP servers, simply enter:
- **Server Type:** SSE or HTTP
- **URL:** `https://your-domain.com/mcp?key=YOUR_API_KEY`

---

## 4. Available Tools in Claude

Once connected, Claude automatically has access to the following 8 tools:

| Tool Name | Description |
| :--- | :--- |
| `whatsapp_list_sessions` | List all WhatsApp devices/sessions connected to your account, live status (`CONNECTED`, `QR`, `DISCONNECTED`), phone number, and device name. |
| `whatsapp_send_message` | Send a WhatsApp text message to any phone number or group JID. Automatically formats phone numbers with country codes. |
| `whatsapp_get_chats` | Retrieve active conversations and chats, contact names, phone numbers, and last message previews. |
| `whatsapp_get_messages` | Retrieve recent chat message history for a specific phone number or contact. |
| `whatsapp_check_number` | Check if a phone number is registered and active on WhatsApp, and return its verified JID. |
| `whatsapp_list_contacts` | Search and list saved WhatsApp contacts. |
| `whatsapp_list_groups` | List all WhatsApp groups that the connected account participates in. |
| `whatsapp_get_account_info` | Inspect user account info, plan, role, and total active WhatsApp sessions. |

---

## 5. Example Prompts to Ask Claude

Once connected, you can talk to Claude naturally:

- *"Check if +1 (555) 234-5678 is registered on WhatsApp."*
- *"Send a WhatsApp message to +919876543210 saying 'Hello! Your order has been shipped.'."*
- *"Show me my connected WhatsApp devices and their battery/connection status."*
- *"Show my recent WhatsApp chats and who messaged me last."*
- *"Read the last 10 messages from +919876543210."*
- *"List all WhatsApp groups I am an admin or member of."*

---

## 6. Security & Authentication

- The endpoint supports API keys passed via:
  1. URL Query parameter: `?key=YOUR_API_KEY` or `?apiKey=YOUR_API_KEY`
  2. Request Header: `x-api-key: YOUR_API_KEY`
  3. Authorization Header: `Authorization: Bearer YOUR_API_KEY`
- All requests are bound to the authenticated user's account and role permissions.
- In-memory SSE connections automatically keep alive via periodic ping frames and clean up upon disconnection.
