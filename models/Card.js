const {Schema, model} = require("../db/connection") // import Schema & model

// Item Schema
const CardSchema = new Schema({
    username: {type: String, required: true},
    front: {type: String, required: true},
    back: {type: String, required: true},
    notes: {type: String, required: false, default: ""},
    files: {type: [String], required: true, default: []},
    tts: {type: Boolean, required: true, default: false}, // use TTS
    tags: {type: [String], required: true, default: []},
    // for phrases, list of important Japanese words
    mainWords: {type: [String], required: false, default: []},
    rating: {type: Number, required: true, default: 0}, // 0-new word, 100-mastered
    orientation: {type: Number, required: true, default: 2}, // 1-front, 2-both, 3-back
    created: {type: Date, required: true},
    updated: {type: Date, required: true},
    deadline: {type: Date, required: true},
    archived: {type: Boolean, required: true, default: false},
})

// Card model
const Card = model("Card", CardSchema)

module.exports = Card
