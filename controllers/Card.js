const { Router } = require("express"); // import Router from express
const { isLoggedIn } = require("./middleware"); // import isLoggedIn custom middleware

// For TTS
const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

const { AWS_KEY_ID, AWS_SECRET } = process.env;
const AWS = require("aws-sdk");
const path = require("path");

AWS.config.update({
  region: "ru-central1",
  apiVersion: "2006-03-01",
  endpoint: "storage.yandexcloud.net",
  credentials: { accessKeyId: AWS_KEY_ID, secretAccessKey: AWS_SECRET }
});
s3 = new AWS.S3();

const router = Router();

//custom middleware could also be set at the router level like so
// router.use(isLoggedIn) then all routes in this router would be protected

// Get all cards (as array)
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

// Get all cards (as object with array inside)
router.get("/list", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  //send all cards with that user
  try {
    const cards = await Card.find({ username });
    res.json({ cards });
  } catch (error) {
    console.log("Error getting cards", error);
    res.status(500).json({ error });
  }
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

    // TODO: this works, upload all files, swap to s3 (keep code for local files)
    uploadToS3(completeAudioFilepath(card.files[0]));

    res.json(card);
  } catch(error) {
    console.log("Error when creating card", JSON.stringify(error));
    // TODO - why the error is not received well in the app?
    res.status(400).json({error: "Cannot create card"});
  }

});

function uploadToS3(file) {
  const fileStream = fs.createReadStream(file);
  fileStream.on("error", function (err) {
    console.log("File Error", err);
  });

  const uploadParams = {
    Bucket: "fmaylinch-flashcards",
    Key: file,
    Body: fileStream
  };

  s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log("Upload ERROR", err);
    }
    if (data) {
      console.log("Upload OK", data.Location);
    }
  });
}

// --- Generate card with test audio file (doesn't save the card) ---
router.post("/tts", isLoggedIn, async (req, res) => {
  try {
    // Generate just one voice
    const file = await generateSingleTTS(
      req.body.front, 'test-listen', 'ja-JP-Neural2-C', 0, false);
    req.body.files = [file];
  } catch(error) {
    console.log("Error in generateTTS", error);
    res.status(500).json({ error });
    return;
  }

  const card = req.body;
  res.json(card);
});

// --- Update card ---
router.put("/:id", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  const _id = req.params.id;
  req.body.updated = new Date();
  console.log("Updating card", req.body);
  try {
    // Card.updateOne() doesn't return the card
    await Card.updateOne({ username, _id }, req.body);
    const card = await Card.findOne({ username, _id });
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
  let card;
  try {
    card = await Card.findOne({ username, _id })
  } catch(error) {
    res.status(400).json({error: "Cannot find card to delete"});
    return
  }
  if (!card) {
    res.status(400).json({error: "Cannot find card to delete"});
    return
  }

  // Remove card audio files
  for (let file of card.files) {
    // TODO - refactor, this is used when creating a card
    const path = completeAudioFilepath(file);
    // https://stackoverflow.com/q/5315138/node-remove-file
    const result = await unlink(path);
    // The result is the error, it's undefined if there's no error
    console.log(`Result of unlinking '${path}'`, result);
  }

  console.log("Deleting card", req.body);
  try {
    await Card.deleteOne({ username, _id });
    res.json(card);
  } catch(error) {
    console.log("Error when deleting card", JSON.stringify(error));
    res.status(400).json({error: "Cannot delete card"});
  }
});

const {FILES_FOLDER = "files"} = process.env

async function generateTTS(text, filename) {
  // https://cloud.google.com/text-to-speech/docs/voices
  const voices = ['ja-JP-Neural2-B', 'ja-JP-Neural2-C']; // female / male
  // 'ja-JP-Neural2-D' is another male voice
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
async function generateSingleTTS(text, filename, voice, index, addDate = true) {
  // safe filename - TODO: check if exists
  filename = filename
    .replaceAll(" ", "-").replace(/[^\w\-]+/g,"")
    .substring(0, 20).toLowerCase();

  const dateStr = dateToString(new Date());
  const finalFilename = addDate ? `${dateStr}-${filename}-${index}.wav` : `${filename}-${index}.wav`;
  const outputFile = completeAudioFilepath(finalFilename);

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

function completeAudioFilepath(file) {
  return `${FILES_FOLDER}/audio/${file}`;
}

function dateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = router;
