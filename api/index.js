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
  sharedBy: { type: String, required: true },
  sharedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for better performance
musicSchema.index({ sharedAt: -1 });
musicSchema.index({ sharedBy: 1 });

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

// Add the bulk import endpoint
app.post('/api/music/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    // Validate each item
    const validItems = items.filter(item => {
      return item.url && item.title && item.sharedBy && item.sharedAt;
    });

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'No valid items to import' });
    }

    // Process items in batches of 100
    const batchSize = 100;
    const results = {
      total: items.length,
      valid: validItems.length,
      imported: 0,
      errors: []
    };

    for (let i = 0; i < validItems.length; i += batchSize) {
      const batch = validItems.slice(i, i + batchSize);
      try {
        const docs = await Music.insertMany(batch, { ordered: false });
        results.imported += docs.length;
      } catch (error) {
        if (error.writeErrors) {
          results.errors.push(...error.writeErrors.map(e => ({
            url: batch[e.index].url,
            error: e.errmsg
          })));
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk importing music:', error);
    res.status(500).json({ error: 'Error bulk importing music', details: error.message });
  }
});

// Add the search endpoint
app.get('/api/music/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Create a case-insensitive search query
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { sharedBy: { $regex: query, $options: 'i' } }
      ]
    };

    const music = await Music.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(100); // Limit results to prevent overwhelming the client

    res.json({ music });
  } catch (error) {
    console.error('Error searching music:', error);
    res.status(500).json({ error: 'Error searching music', details: error.message });
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