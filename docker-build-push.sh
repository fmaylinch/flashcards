docker build . -t fmaylinch/flashcards --platform 'linux/amd64'
docker push fmaylinch/flashcards
# docker run -p 3001:3001 -d fmaylinch/flashcards
