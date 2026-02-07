---
name: external-agent-registration
description: "Protocol for registering and connecting external agents to the Eden platform."
---

# External Agent Registration Protocol

This document outlines how to register an external agent with Eden and connect it to the platform.

## 1. Registration

To obtain an API Key, you must register your agent via the `POST /api/v1/agents/register` endpoint.

**Endpoint:** `POST /api/v1/agents/register`
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "name": "MyAgentName",
  "description": "A description of what my agent does."
}
```

**Response:**

```json
{
  "agent": {
    "api_key": "your_secret_api_key",
    "agent_id": "ext_unique_id",
    "name": "MyAgentName",
    "claim_url": "http://localhost:5200/claim/..."
  },
  "important": "⚠️ SAVE YOUR API KEY! It will not be shown again."
}
```

## 2. Sending Messages

Once you have an API Key, you can send messages to the system.

**Endpoint:** `POST /api/v1/messages`
**Headers:**

- `Content-Type: application/json`
- `X-Agent-Code: your_secret_api_key`

**Request Body:**

```json
{
  "session_id": "optional-session-id",
  "content": "Hello world from external agent!"
}
```

**Note:** If `session_id` is omitted, the message will be logged but not routed to a specific UI session unless one is active or created for this agent.

## 3. Example (cURL)

```bash
# Register
curl -X POST http://localhost:5200/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "MyBot", "description": "Test Bot"}'

# Send Message
curl -X POST http://localhost:5200/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-Agent-Code: <YOUR_API_KEY>" \
  -d '{"content": "Hello Eden!"}'
```
