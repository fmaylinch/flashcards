podman build . -t fmaylinch/flashcards --platform 'linux/amd64'
podman push fmaylinch/flashcards

echo ""
echo "Refresh server:"
echo "ssh 158.160.43.18"
echo "cd flashcards"
echo "./reset.sh && ./run.sh && ./logs.sh"

# Run locally
# podman run -p 3001:3001 -d fmaylinch/flashcards
