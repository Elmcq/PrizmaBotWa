# Ideology Prizmarine Bot

Owner-only WhatsApp bot for controlling an Ideology Prizmarine Minecraft Bedrock server through Railway SSH.

The bot uses Baileys for WhatsApp and Railway CLI for interactive SSH. It only sends fixed, whitelisted script commands to the Railway SSH session. It does not provide arbitrary shell execution.

## Allowed Commands

```text
/status
/start
/stop
/restart
/list
/backup
/say <message>
/cooldown
/unlockrestart
/jid
/groups
```

Command mapping:

```text
/status      -> /home/mc/scripts/status.sh
/start       -> /home/mc/scripts/start.sh
/stop        -> /home/mc/scripts/stop.sh
/restart     -> /home/mc/scripts/restart.sh
/list        -> /home/mc/scripts/list.sh
/backup      -> /home/mc/scripts/backup.sh
/say hello   -> /home/mc/scripts/say.sh "hello"
```

Owner-only local commands:

```text
/cooldown       -> check remaining auto-restart cooldown
/unlockrestart  -> clear auto-restart cooldown
/jid            -> show current chat, sender, group status, and mentioned JIDs
/groups         -> list all WhatsApp groups the bot participates in
```

`/say` messages are sanitized before they are sent:

- maximum 120 characters
- newlines, carriage returns, backticks, semicolons, pipes, and ampersands are removed
- empty messages are rejected
- the raw user message is never executed directly

## How It Connects

The bot spawns Railway CLI with this shape:

```text
railway ssh --project=<RAILWAY_PROJECT> --environment=<RAILWAY_ENVIRONMENT> --service=<RAILWAY_SERVICE>
```

Because Railway SSH is interactive, the bot writes only one whitelisted script command to stdin, followed by:

```text
exit
```

Normal SSH variables such as `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY_PATH`, and `SSH_CONNECT_TIMEOUT` are no longer used.

## Setup

Install project dependencies:

```bash
npm install
```

Install Railway CLI on the machine running the bot:

```bash
npm install -g @railway/cli
railway login
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
WA_AUTH_DIR=./auth
OWNER_JIDS=628xxxxxxxxxx@s.whatsapp.net
RAILWAY_PROJECT=140979a3-d79f-4896-89c9-f90bdfe9333e
RAILWAY_ENVIRONMENT=bb5ac455-bd08-413b-b8c2-51387174ecee
RAILWAY_SERVICE=995190bf-f3f8-4c37-917c-273b1704b133
COMMAND_TIMEOUT=45
ALLOWED_GROUP_JIDS=120363xxxx@g.us
TRIGGER_MENTION_JIDS=628xxxxxxxxxx@s.whatsapp.net,628yyyyyyyyyy@s.whatsapp.net
AUTO_RESTART_COOLDOWN_SECONDS=600
```

Multiple owners can be comma-separated:

```env
OWNER_JIDS=628111111111@s.whatsapp.net,628222222222@s.whatsapp.net
```

Run the bot:

```bash
npm start
```

Scan the QR code printed in the terminal from WhatsApp's linked devices screen.

Test from an owner WhatsApp account:

```text
/status
```

## How to get WhatsApp Group ID

Use one of these methods from inside the Node.js Baileys bot. Do not use browser DevTools or the WhatsApp Web console.

1. Start the bot:

```bash
node index.js
```

2. Send any message in the group and read the terminal `FROM` field.
3. Or send `/jid` inside the group as an owner.
4. Or send `/groups` in private chat to the bot.
5. Copy the value ending with `@g.us` into `ALLOWED_GROUP_JIDS`.

Every incoming message logs this shape in the terminal:

```text
=== MESSAGE ===
FROM: 120363xxxx@g.us
SENDER: 628xxxxxxxxxx@s.whatsapp.net
IS_GROUP: true
TEXT: hello
MENTIONED: -
===============
```

## Automatic Lag Restart

In approved WhatsApp groups, the bot can restart the server automatically when someone reports lag and mentions the configured trigger account.

The auto-restart trigger only runs when all of these are true:

- the message is in a group listed in `ALLOWED_GROUP_JIDS`
- the message mentions the bot account or one of `TRIGGER_MENTION_JIDS`
- the message contains one of these lag keywords: `lag`, `ngelag`, `server lag`, `patah`, `delay`, `lemot`

When triggered, the bot runs the same whitelist action as `/restart`:

```text
/home/mc/scripts/restart.sh
```

Private chats do not auto-restart the server. In private chat, only an owner using `/restart` can restart it.

The cooldown is stored in memory while the bot is running. Default:

```env
AUTO_RESTART_COOLDOWN_SECONDS=600
```

If cooldown is active, the group receives:

```text
⏳ Restart already triggered recently. Cooldown: X minutes left.
```

When restart starts:

```text
⚠️ Lag report detected. Restarting Minecraft server...
```

After it finishes:

```text
✅ Minecraft server restarted. Please wait 30–60 seconds before joining.
```

or:

```text
❌ Restart failed: <short error>
```

## Railway Service Layout

The Minecraft root is:

```text
/home/mc
```

The bot calls these exact script paths:

```text
/home/mc/scripts/status.sh
/home/mc/scripts/start.sh
/home/mc/scripts/stop.sh
/home/mc/scripts/restart.sh
/home/mc/scripts/list.sh
/home/mc/scripts/backup.sh
/home/mc/scripts/say.sh
```

Example setup inside the Railway service:

```bash
mkdir -p /home/mc/scripts /home/mc/backups
chmod 700 /home/mc/scripts
```

## Minecraft Script Examples

These examples assume:

```bash
BEDROCK_DIR=/home/mc
SCREEN_NAME=mc
```

Make every script executable:

```bash
chmod +x /home/mc/scripts/*.sh
```

### start.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

BEDROCK_DIR=/home/mc
SCREEN_NAME=mc

if screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
  echo "Bedrock server is already running."
  exit 0
fi

cd "$BEDROCK_DIR"
screen -dmS "$SCREEN_NAME" ./bedrock_server
echo "Bedrock server started."
```

### stop.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SCREEN_NAME=mc

if ! screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
  echo "Bedrock server is not running."
  exit 0
fi

screen -S "$SCREEN_NAME" -p 0 -X stuff "say Server stopping now$(printf '\r')"
sleep 2
screen -S "$SCREEN_NAME" -p 0 -X stuff "stop$(printf '\r')"
echo "Stop command sent."
```

### restart.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

/home/mc/scripts/stop.sh
sleep 10
/home/mc/scripts/start.sh
echo "Bedrock server restarted."
```

### status.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SCREEN_NAME=mc

if screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
  echo "Bedrock server is running."
else
  echo "Bedrock server is stopped."
fi
```

### list.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SCREEN_NAME=mc

if ! screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
  echo "Bedrock server is not running."
  exit 1
fi

screen -S "$SCREEN_NAME" -p 0 -X stuff "list$(printf '\r')"
echo "Player list requested. Check the server console/log for full output."
```

### backup.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

BEDROCK_DIR=/home/mc
BACKUP_DIR=/home/mc/backups
STAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$BACKUP_DIR/bedrock-$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
tar -czf "$ARCHIVE" -C "$BEDROCK_DIR" worlds server.properties permissions.json allowlist.json
echo "Backup created: $ARCHIVE"
```

### say.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SCREEN_NAME=mc
MESSAGE="${1:-}"

if [ -z "$MESSAGE" ]; then
  echo "Message is required."
  exit 1
fi

if ! screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"; then
  echo "Bedrock server is not running."
  exit 1
fi

screen -S "$SCREEN_NAME" -p 0 -X stuff "say $MESSAGE$(printf '\r')"
echo "Message sent: $MESSAGE"
```

Bedrock console commands sent through `screen` should not use a leading slash.

## Security Notes

- Access is restricted to `OWNER_JIDS`.
- Automatic lag restart is restricted to `ALLOWED_GROUP_JIDS` and mention-gated by the bot JID or `TRIGGER_MENTION_JIDS`.
- Command execution is whitelist-only.
- There is no arbitrary shell command route.
- The bot uses `child_process.spawn`, not shell `exec`.
- User input is never concatenated into a normal shell command string.
- `/say` is sanitized, length-limited, and shell-quoted before being sent to Railway SSH.
- The Railway SSH process is killed if `COMMAND_TIMEOUT` is exceeded.
- Secrets and Railway IDs are loaded from environment variables and are not hardcoded in code.
