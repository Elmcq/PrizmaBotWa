# PrizmaBotWa

Baileys WhatsApp bot for Ideology Prizmarine. It controls a Minecraft Bedrock server on Railway through Railway SSH and keeps deployment-specific values in `.env`.

## Setup

Install dependencies:

```bash
npm install
```

Install and login to Railway CLI on the machine running the bot:

```bash
npm install -g @railway/cli
railway login
```

Create `.env` from the example:

```bash
cp .env.example .env
```

Edit `.env`. This file is the only deployment config file. Do not hardcode owner JIDs, group IDs, Railway IDs, server IPs, or ports in code.

Start locally:

```bash
node index.js
```

Run with PM2:

```bash
pm2 start index.js --name PrizmaBotWa
pm2 restart PrizmaBotWa --update-env
```

Scan the QR code from WhatsApp linked devices on first login.

## JID Formats

- Personal Baileys JID: `628xxxxxxxxxx@s.whatsapp.net`
- Linked identity JID: `35455038935243@lid`
- Group JID: `120363xxxx@g.us`

Legacy `@c.us` JIDs are not used by this Baileys bot.

## Required Env

```env
BOT_NAME=Ideology Prizmarine Bot
DISPLAY_NAME=PrizmaBotWa
PREFIX=/
WA_AUTH_DIR=./auth
OWNER_JIDS=6281335758501@s.whatsapp.net,35455038935243@lid
ALLOWED_GROUP_JIDS=120363402388386113@g.us
TRIGGER_MENTION_JIDS=6281335758501@s.whatsapp.net,6287730616481@s.whatsapp.net,35455038935243@lid
AUTO_RESTART_COOLDOWN_SECONDS=600
RAILWAY_PROJECT=140979a3-d79f-4896-89c9-f90bdfe9333e
RAILWAY_ENVIRONMENT=bb5ac455-bd08-413b-b8c2-51387174ecee
RAILWAY_SERVICE=995190bf-f3f8-4c37-917c-273b1704b133
COMMAND_TIMEOUT=45
SERVER_NAME=Ideology Prizmarine
SERVER_IP=example.com
SERVER_PORT=19132
ENABLE_MONITORING=false
MONITOR_INTERVAL=60000
```

Optional:

```env
LOG_LEVEL=error
NOTIFICATION_GROUP_JID=
```

## Commands

Owner-only Railway commands:

```text
/status
/start
/stop
/restart
/list
/backup
/say <message>
```

Owner-only helper commands:

```text
/jid
/groupid
/groups
/cooldown
/unlockrestart
```

Safe helper commands:

```text
/help
/ip
/player
/ping
/about
/uptime
/changelog
```

Group commands only work in `ALLOWED_GROUP_JIDS`, except setup helpers marked safe for discovery such as `/jid`, `/groupid`, `/groups`, and `/help`.

Test Railway control:

```text
/status
```

## Railway SSH

The bot spawns Railway CLI without shell execution:

```text
railway ssh --project=<RAILWAY_PROJECT> --environment=<RAILWAY_ENVIRONMENT> --service=<RAILWAY_SERVICE>
```

It writes only one whitelisted script command to stdin, then writes `exit`.

Allowed remote scripts:

```text
/home/mc/scripts/status.sh
/home/mc/scripts/start.sh
/home/mc/scripts/stop.sh
/home/mc/scripts/restart.sh
/home/mc/scripts/list.sh
/home/mc/scripts/backup.sh
/home/mc/scripts/say.sh "<sanitized message>"
```

`/say` input is capped at 120 characters, strips newlines, carriage returns, backticks, semicolons, pipes, and ampersands, and rejects empty messages.

Railway interactive output is cleaned before WhatsApp replies. ANSI/control sequences, bracketed paste markers, OSC title sequences, shell prompts, echoed script paths, and trailing `exit` are removed.

## How to get WhatsApp Group ID

Use the bot itself. Do not use browser DevTools or the WhatsApp Web console.

1. Start the bot:

```bash
node index.js
```

2. Send any message in the group and read the terminal `FROM` field.
3. Or send `/jid` inside the group as an owner.
4. Or send `/groups` in private chat to the bot.
5. Copy the value ending with `@g.us` into `ALLOWED_GROUP_JIDS`.

Every incoming message logs:

```text
=== MESSAGE ===
FROM: 120363xxxx@g.us
SENDER: 628xxxxxxxxxx@s.whatsapp.net
IS_GROUP: true
TEXT: hello
MENTIONED: -
===============
```

## Auto Lag Restart

Auto restart triggers only when all rules match:

- message is in `ALLOWED_GROUP_JIDS`
- message mentions the bot JID or one of `TRIGGER_MENTION_JIDS`
- text contains `lag`, `ngelag`, `server lag`, `patah`, `delay`, or `lemot`
- cooldown is not active

The trigger runs the same whitelisted script as `/restart`:

```text
/home/mc/scripts/restart.sh
```

Private chat never auto-restarts the server. Owners can check or clear cooldown with:

```text
/cooldown
/unlockrestart
```

## Monitoring

Monitoring is controlled by:

```env
ENABLE_MONITORING=false
MONITOR_INTERVAL=60000
```

When enabled, `SERVER_IP` and `SERVER_PORT` are used for Bedrock status checks. Monitoring does not auto-restart the server. Repeated status failures are throttled in logs so the terminal is not spammed every interval.

To send monitoring status-change notifications, set:

```env
NOTIFICATION_GROUP_JID=120363xxxx@g.us
```

## Security

- `.env` is the single source of deployment config.
- Owner commands require `OWNER_JIDS`, including `@lid` where needed.
- Group commands are restricted by `ALLOWED_GROUP_JIDS`.
- No arbitrary shell command route exists.
- Railway is executed with `child_process.spawn`, not shell `exec`.
- User input is never concatenated into a local shell command.
- Only whitelisted `/home/mc/scripts/*.sh` commands can run.
- Do not commit `.env`, `auth/`, or WhatsApp session files.
