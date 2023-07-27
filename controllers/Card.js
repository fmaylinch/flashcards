const { Router } = require("express"); // import Router from express
const { isLoggedIn } = require("./middleware"); // import isLoggedIn custom middleware

// For TTS
const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

const router = Router();

//custom middleware could also be set at the router level like so
// router.use(isLoggedIn) then all routes in this router would be protected

// Index Route with isLoggedIn middleware
router.get("/", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  //send all cards with that user
  res.json(
    await Card.find({ username }).catch((error) =>
      res.status(400).json({ error })
    )
  );
});

// --- Get card ---
router.get("/:id", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  const _id = req.params.id; // get id from params
  //send target card
  res.json(
    await Card.findOne({ username, _id }).catch((error) =>
      res.status(400).json({ error })
    )
  );
});

// --- Create card ---
router.post("/", isLoggedIn, async (req, res) => {

  if (req.body.tts && req.body.files) {
    res.status(400).json({
      // we could allow mixing custom files with TTS-generated files
      error: "If tts is used, don't specify files, they will be automatically generated"
    });
    return;
  }

  if (req.body.tts) {
    try {
      req.body.files = await generateTTS(req.body.front, req.body.back);
    } catch(error) {
      console.log("Error in generateTTS", error);
      res.status(500).json({ error });
      return;
    }
  }

  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  req.body.username = username; // add username property to req.body

  const now = new Date();
  req.body.created = now;
  req.body.updated = now;
  if (!req.body.deadline) {
    req.body.deadline = now;
  }

  console.log("Creating card", req.body);
  try {
    const card = await Card.create(req.body);
    res.json(card);
  } catch(error) {
    console.log("Error when creating card", JSON.stringify(error));
    // TODO - why the error is not received well in the app?
    return res.status(400).json({error: "Cannot create card"});
  }

});

// --- Update card ---
router.put("/:id", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  const _id = req.params.id;
  req.body.updated = new Date();
  console.log("Updating card", req.body);
  try {
    const card = await Card.updateOne({ username, _id }, req.body, { new: true });
    res.json(card);
  } catch(error) {
    console.log("Error when updating", JSON.stringify(error));
    // TODO - why the error is not received well in the app?
    return res.status(400).json({error: "Cannot update card"});
  }
});

// --- Delete card ---
router.delete("/:id", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  const _id = req.params.id;

  // Get the card and delete files first
  const card = await Card.findOne({ username, _id }).catch((error) => {
    res.status(400).json({ error });
    return;
  })

  // Remove card audio files
  for (let file of card.files) {
    // TODO - refactor, this is used when creating a card
    const path = `${FILES_FOLDER}/audio/${file}`;
    // https://stackoverflow.com/q/5315138/node-remove-file
    const result = await unlink(path);
    // The result is the error, it's undefined if there's no error
    console.log(`Result of unlinking '${path}'`, result);
  }

  // Remove the card
  res.json(
    await Card.deleteOne({ username, _id }).catch((error) =>
      res.status(400).json({ error })
    )
  );
});

const {FILES_FOLDER = "files"} = process.env

async function generateTTS(text, filename) {
  // https://cloud.google.com/text-to-speech/docs/voices
  const voices = ['ja-JP-Neural2-B', 'ja-JP-Neural2-C', 'ja-JP-Neural2-D'];
  const files = [];
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const file = await generateSingleTTS(text, filename, voice, i);
    files.push(file);
  }
  return files;
}

// Generates audio file(s) for text.
// Returns array of files generated.
// The suggested filename might be cleaned/renamed.
async function generateSingleTTS(text, filename, voice, index) {
  // safe filename - TODO: check if exists
  filename = filename
    .replaceAll(" ", "-").replace(/[^\w\-]+/g,"")
    .substring(0, 20).toLowerCase();

  const dateStr = dateToString(new Date());
  const finalFilename = `${dateStr}-${filename}-${index}.wav`
  const outputFile = `${FILES_FOLDER}/audio/${finalFilename}`;

  // https://cloud.google.com/text-to-speech/docs/samples/tts-synthesize-text-file
  // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
  const request = {
    input: {text},
    voice: {languageCode: 'ja-JP', name: voice},
    audioConfig: {audioEncoding: "LINEAR16"}, // their MP3 encoding sounds pretty bad
  };

  console.log("Sending TTS request", request);
  const [response] = await client.synthesizeSpeech(request);

  console.log(`Writing audio content to file: ${outputFile}`);
  await writeFile(outputFile, response.audioContent, 'binary');
  console.log(`Audio content written to file: ${outputFile}`);

  return finalFilename;
}

function dateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = router;
