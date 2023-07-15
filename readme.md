# Flashcards

(Work in progress)

Frontend part:
- https://github.com/fmaylinch/flashcards-rn

## Sample calls

```bash
SERVER=http://127.0.0.1:3001

# controllers/User.js

# login
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"may", "password":"12345"}' \
  $SERVER/user/login | jq

TOKEN="xxx"
AUTH="Authorization: Bearer $TOKEN"

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
  -d '{"front":"車","back":"car","tags":["sample"],"deadline":"2023-07-20"}' \
  $SERVER/cards

# controllers/Todo.js (model from the original example)

curl \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  $SERVER/todos

```
