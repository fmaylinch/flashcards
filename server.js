require("dotenv").config() // load .env variables
const express = require("express") // import express
const morgan = require("morgan") //import morgan
const {log} = require("mercedlogger") // import mercedlogger's log function
const cors = require("cors") // import cors
const UserRouter = require("./controllers/User") //import User Routes
const TodoRouter = require("./controllers/Todo") // import Todo Routes
const CardRouter = require("./controllers/Card") // import Card Routes
const {createContext} = require("./controllers/middleware")
const { s3, bucketName } = require("./util/aws");

//DESTRUCTURE ENV VARIABLES WITH DEFAULT VALUES
const {PORT = 3000} = process.env

// Create Application Object
const app = express()

const {FILES_FOLDER = "files"} = process.env

// GLOBAL MIDDLEWARE
app.use(cors()) // add cors headers
app.use(morgan("tiny")) // log the request for debugging
app.use(express.json()) // parse json bodies
app.use(createContext) // create req.context

// ROUTES AND ROUTES
app.get("/", (req, res) => {
    res.send("this is the test route to make sure server is working")
})

// Route to serve audio files - TODO: move to Cards controller (create another path, where username is taken from req.user)
// TODO: why it doesn't work from app?
app.get('/new-audio/*', async (req, res) => {
    const key = `files/audio/${req.params[0]}`; // TODO: refactor this, see completeAudioFilepath
    console.log("Loading object with key: " + key)
    try {
        const stream = s3.getObject({Bucket: bucketName, Key: key}).createReadStream();
        const filename = key.split('/').pop();
        console.log("Sending stream with filename: " + filename);
        res.set('Content-Disposition', `inline; filename="${filename}"`);
        res.set('Content-Type', 'audio/x-wav');
        stream.pipe(res);
    } catch (err) {
        console.error('Error fetching object from S3:', err);
        res.status(500).send('Error from AWS S3: ' + err.code);
    }
});

// Old route to static folder
app.use('/audio', express.static(`${FILES_FOLDER}/audio`));

app.use("/user", UserRouter) // send all "/user" requests to UserRouter
app.use("/todos", TodoRouter) // send all "/todos" request to TodoRouter
app.use("/cards", CardRouter) // send all "/cards" request to CardRouter

// APP LISTENER
app.listen(PORT, () => log.green("SERVER STATUS", `Listening on port ${PORT}`))
