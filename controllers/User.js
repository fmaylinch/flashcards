require("dotenv").config(); // load .env variables
const { Router } = require("express"); // import router from express
const bcrypt = require("bcryptjs"); // import bcrypt to hash passwords
const jwt = require("jsonwebtoken"); // import jwt to sign tokens

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;

// Signup route to create a new user
router.post("/signup", async (req, res) => {
  if (true) {
    res.status(400).json({ error: "signup disabled" });
    return;
  }
  const { User } = req.context.models; // see createContext in middleware.js
  try {
    // hash the password
    req.body.password = await bcrypt.hash(req.body.password, 10);
    // create a new user
    const user = await User.create(req.body);
    // send new user as response
    res.json(user);
  } catch (error) {
    res.status(400).json({ error });
  }
});

// Login route to verify a user and get a token
router.post("/login", async (req, res) => {
  const { User } = req.context.models;
  try {
    // check if the user exists
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      //check if password matches
      const result = await bcrypt.compare(req.body.password, user.password);
      if (result) {
        // sign token and send it in response
        const token = await jwt.sign({ username: user.username }, SECRET);
        res.json({ token });
      } else {
        console.log("wrong pass");
        res.status(401).json({ error: "wrong credentials" }); // wrong pwd
      }
    } else {
      console.log("wrong user");
      res.status(401).json({ error: "wrong credentials" }); // user doesn't exist
    }
  } catch (error) {
    console.log("other error: " + error);
    res.status(400).json({ error });
  }
});

module.exports = router;
