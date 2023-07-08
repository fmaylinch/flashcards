# Flashcards

Work in progress

## Sample calls

```bash
SERVER=http://127.0.0.1:3001

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
```
