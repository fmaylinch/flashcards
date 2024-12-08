const { Router } = require("express"); // import Router from express
const { isLoggedIn } = require("./middleware"); // import isLoggedIn custom middleware

const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const exists = util.promisify(fs.exists);
const { s3, bucketName } = require("../util/aws");

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
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware

  if (req.body.tts && req.body.files) {
    res.status(400).json({
      // we could allow mixing custom files with TTS-generated files
      error: "If tts is used, don't specify files, they will be automatically generated"
    });
    return;
  }

  if (req.body.tts) {
    try {
      req.body.files = await generateTTS(username, req.body.front, req.body.back);
    } catch(error) {
      console.log("Error in generateTTS", error);
      res.status(500).json({ error });
      return;
    }
  }

  req.body.username = username; // add username property to req.body

  const now = new Date();
  req.body.created = now;
  req.body.updated = now;
  if (!req.body.deadline) {
    req.body.deadline = now;
  }

  console.log("Creating card", req.body);
  try {
    for (const file of req.body.files) {
      const path = completeAudioFilepath(username, file);
      await uploadToS3(path);
      // deleteFile(path); // we could delete the local file (but we keep it after doing deleteFromS3)
    }

    const card = await Card.create(req.body);

    res.json(card);
  } catch(error) {
    console.log("Error when creating card", JSON.stringify(error));
    res.status(400).json({error: "Cannot create card"}); // TODO - are these errors received well in the app?
  }
});

// --- Generate card with test audio file (doesn't save the card) ---
router.post("/tts", isLoggedIn, async (req, res) => {
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  try {
    // Generate just one voice
    const filename = 'test-listen';
    const voice = 'ja-JP-Neural2-C';
    const file = await generateSingleTTS(username, req.body.front, filename, voice, 0, false);
    req.body.files = [file];
  } catch(error) {
    console.log("Error in generateTTS", error);
    res.status(500).json({ error });
    return;
  }

  const card = req.body;
  res.json(card);
});

// --- Generate audio in static folder, so it can be played ---
// TODO: we do this because the /audio-s3 route in server.js doesn't work
router.post("/audio/:index", isLoggedIn, async (req, res) => {
  const { Card } = req.context.models;
  const { username } = req.user; // get username from req.user property created by isLoggedIn middleware
  let card;

  try {
    const _id = req.body._id
    card = await Card.findOne({ username, _id })
    const fileIndex = req.params.index
    const path = completeAudioFilepath(username, card.files[fileIndex])
    const s3Object = await getFromS3(path);

    const filename = 'temp-s3.wav';
    const outputFilePath = completeAudioFilepath(username, filename);
    console.log(`Writing s3 object with key ${path} to file ${outputFilePath}`)
    fs.writeFileSync(outputFilePath, s3Object.Body);
    card.files = [ filename ]; // similar to /tts endpoint, return temporal file
  } catch(error) {
    console.log("Error in generateTTS", error);
    res.status(500).json({ error });
    return;
  }

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
    const path = completeAudioFilepath(username, file);
    await deleteFromS3(path);
    await deleteFile(path); // delete the files now, because we leave them when we upload to S3
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

async function generateTTS(username, text, filename) {
  // https://cloud.google.com/text-to-speech/docs/voices
  const voices = ['ja-JP-Neural2-B', 'ja-JP-Neural2-C']; // female / male
  // 'ja-JP-Neural2-D' is another male voice
  const files = [];
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const file = await generateSingleTTS(username, text, filename, voice, i);
    files.push(file);
  }
  return files;
}

// Generates audio file(s) for text.
// Returns array of files generated.
// The suggested filename might be cleaned/renamed.
async function generateSingleTTS(username, text, filename, voice, index, addDate = true) {
  // safe filename - TODO: check if exists
  filename = filename
    .replaceAll(" ", "-").replace(/[^\w\-]+/g,"")
    .substring(0, 20).toLowerCase();

  const dateStr = dateToString(new Date());
  const finalFilename = addDate ? `${dateStr}-${filename}-${index}.wav` : `${filename}-${index}.wav`;
  const path = completeAudioFilepath(username, finalFilename);

  // https://cloud.google.com/text-to-speech/docs/samples/tts-synthesize-text-file
  // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
  const request = {
    input: {text},
    voice: {languageCode: 'ja-JP', name: voice},
    audioConfig: {audioEncoding: "LINEAR16"}, // their MP3 encoding sounds pretty bad
  };

  console.log("Sending TTS request", request);
  const [response] = await client.synthesizeSpeech(request);

  console.log(`Writing audio content to file: ${path}`);
  // TODO: containing folder must exist for this to work (e.g. files/audio/<username>)
  await writeFile(path, response.audioContent, 'binary');
  console.log(`Audio content written to file: ${path}`);

  return finalFilename;
}

function completeAudioFilepath(username, file) {
  return `${FILES_FOLDER}/audio/${username}/${file}`;
}

function dateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// S3

async function getFromS3(path) {
  console.log(`Getting '${path}' from S3`);
  return await s3.getObject({Bucket: bucketName, Key: path}).promise();
}

async function uploadToS3(path) {
  console.log(`Uploading '${path}' to S3`);
  const fileStream = fs.createReadStream(path);
  fileStream.on("error", function (err) {
    console.log("ReadStream encountered an error", err);
  });

  const uploadParams = { Bucket: bucketName, Key: path, Body: fileStream };
  await s3.upload(uploadParams).promise();
}

async function deleteFromS3(path) {
  const deleteParams = {Bucket: bucketName, Key: path};
  await s3.deleteObject(deleteParams).promise()
}

async function deleteFile(path) {
  // https://stackoverflow.com/q/5315138/node-remove-file
  if (await exists(path)) {
    const result = await unlink(path);
    console.log(`Result of unlinking '${path}'`, result); // not sure about how error is detected
  } else {
    console.log(`Doesn't exist: '${path}'`);
  }
}

module.exports = router;
