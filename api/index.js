const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/music-share', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Music Schema
const musicSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Music = mongoose.model('Music', musicSchema);

// Routes
app.get('/api/music', async (req, res) => {
  try {
    const music = await Music.find().sort({ createdAt: -1 });
    res.json(music);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching music' });
  }
});

app.post('/api/music', async (req, res) => {
  try {
    const { url, title } = req.body;
    const music = new Music({ url, title });
    await music.save();
    res.status(201).json(music);
  } catch (error) {
    res.status(500).json({ error: 'Error saving music' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 