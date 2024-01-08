# Flashcards

Setup and run:
- Clone repository
- `npm install`
- Create `.env` file.
- `npm run dev`

Frontend clients:
- https://github.com/fmaylinch/flashcards-rn
- https://github.com/fmaylinch/flashcards-ios

## Sample calls

```bash
SERVER=http://127.0.0.1:3001 # start local server with: npm run dev
TOKEN="xxx" # get this with login, see below
AUTH="Authorization: Bearer $TOKEN"

# controllers/User.js

# login
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"may", "password":"12345"}' \
  $SERVER/user/login | jq

# signup
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"may", "password":"12345"}' \
  $SERVER/user/signup | jq

# controllers/Card.js

# Get cards (of auth user)
curl -s \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  $SERVER/cards | jq

# Add card (for auth user)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"front":"日本語", "back":"Japanese", "tags":["sample"], "tts":true}' \
  $SERVER/cards

# Generate test card for audio listening
curl -X POST \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"front":"日本語"}' \
  $SERVER/cards/tts

# controllers/Todo.js (model from the original example)

curl \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  $SERVER/todos

```
