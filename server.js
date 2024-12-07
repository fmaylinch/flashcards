require("dotenv").config() // load .env variables
const express = require("express") // import express
const morgan = require("morgan") //import morgan
const {log} = require("mercedlogger") // import mercedlogger's log function
const cors = require("cors") // import cors
const UserRouter = require("./controllers/User") //import User Routes
const TodoRouter = require("./controllers/Todo") // import Todo Routes
const CardRouter = require("./controllers/Card") // import Card Routes
const {createContext} = require("./controllers/middleware")

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

// TODO: use s3 when it's configured
app.use('/audio', express.static(`${FILES_FOLDER}/audio`));

app.use("/user", UserRouter) // send all "/user" requests to UserRouter
app.use("/todos", TodoRouter) // send all "/todos" request to TodoRouter
app.use("/cards", CardRouter) // send all "/cards" request to CardRouter

// APP LISTENER
app.listen(PORT, () => log.green("SERVER STATUS", `Listening on port ${PORT}`))
