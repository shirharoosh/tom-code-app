const mongoose = require("mongoose");

// Define the structure (schema) for a Code Block document
const CodeBlockSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  template: {
    type: String,
    required: true,
  },
  solution: {
    type: String,
    required: true,
  },
});

// Export the Mongoose model so it can be used in index.js
module.exports = mongoose.model("CodeBlock", CodeBlockSchema);
