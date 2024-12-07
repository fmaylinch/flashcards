podman build . -t fmaylinch/flashcards --platform 'linux/amd64'
podman push fmaylinch/flashcards
# podman run -p 3001:3001 -d fmaylinch/flashcards
