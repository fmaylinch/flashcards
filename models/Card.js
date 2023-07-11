const {Schema, model} = require("../db/connection") // import Schema & model

// Item Schema
const CardSchema = new Schema({
    username: {type: String, required: true},
    front: {type: String, required: true},
    back: {type: String, required: true},
    files: {type: [String], required: true, default: []},
    tags: {type: [String], required: true, default: []},
    rating: {type: Number, required: true, default: 50}, // 0..100
    //deadline: {type: Date, required: true},
    //archived: {type: Boolean, required: true, default: false},
})

// Card model
const Card = model("Card", CardSchema)

module.exports = Card
