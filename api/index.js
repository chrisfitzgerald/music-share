const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection with better options and error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/music-share', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [music, total] = await Promise.all([
      Music.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Music.countDocuments()
    ]);

    res.json({
      music,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    console.error('Error fetching music:', error);
    res.status(500).json({ error: 'Error fetching music', details: error.message });
  }
});

app.post('/api/music', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url || !title) {
      return res.status(400).json({ error: 'URL and title are required' });
    }
    
    const music = new Music({ url, title });
    const savedMusic = await music.save();
    console.log('Saved new music:', savedMusic);
    res.status(201).json(savedMusic);
  } catch (error) {
    console.error('Error saving music:', error);
    res.status(500).json({ error: 'Error saving music', details: error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 