const form = document.getElementById('music-form');
const urlInput = document.getElementById('music-url');
const titleInput = document.getElementById('music-title');
const musicList = document.getElementById('music-list');

// Determine API URL based on current hostname
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api';

// Pagination state
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let allLoadedItems = new Set(); // Keep track of loaded items to prevent duplicates

// Initially hide the title input
titleInput.style.display = 'none';

async function getTitleFromUrl(url) {
  try {
    // For YouTube
    if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      return data.title || null;
    }
    // For Spotify
    if (url.includes('open.spotify.com/track/')) {
      const id = url.split('track/')[1].split('?')[0];
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      return data.title || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching title:', error);
    return null;
  }
}

function getCoverArt(url) {
  // Spotify
  if (url.includes('open.spotify.com/track/')) {
    const id = url.split('track/')[1].split('?')[0];
    return `https://i.scdn.co/image/${id}`;
  }
  // YouTube
  if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
    let id = '';
    if (url.includes('watch?v=')) {
      id = url.split('watch?v=')[1].split('&')[0];
    } else {
      id = url.split('youtu.be/')[1].split('?')[0];
    }
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  // Default
  return 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
}

function createMusicCard(url, title) {
  const card = document.createElement('a');
  card.className = 'music-card';
  card.href = url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  
  const cover = document.createElement('img');
  cover.className = 'music-cover';
  cover.src = getCoverArt(url);
  cover.alt = 'cover';
  
  const info = document.createElement('div');
  info.className = 'music-info';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'music-title';
  titleEl.textContent = title || url;
  
  info.appendChild(titleEl);
  card.appendChild(cover);
  card.appendChild(info);
  
  return card;
}

async function loadMoreMusic() {
  if (isLoading || !hasMore) return;
  
  isLoading = true;
  try {
    const response = await fetch(`${API_URL}/music?page=${currentPage}&limit=10`);
    const data = await response.json();
    
    if (data.music.length === 0) {
      hasMore = false;
      return;
    }
    
    // Filter out any items we've already loaded
    const newItems = data.music.filter(item => !allLoadedItems.has(item.url));
    
    if (newItems.length === 0) {
      hasMore = false;
      return;
    }
    
    newItems.forEach(({ url, title }) => {
      allLoadedItems.add(url);
      const card = createMusicCard(url, title);
      musicList.appendChild(card);
    });
    
    currentPage++;
    hasMore = currentPage <= data.totalPages;
  } catch (error) {
    console.error('Error loading more music:', error);
  } finally {
    isLoading = false;
  }
}

// Intersection Observer for infinite scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && hasMore) {
      loadMoreMusic();
    }
  });
}, {
  rootMargin: '100px'
});

// Create and observe a sentinel element
const sentinel = document.createElement('div');
sentinel.id = 'sentinel';
musicList.appendChild(sentinel);
observer.observe(sentinel);

async function renderMusicList() {
  try {
    const response = await fetch(`${API_URL}/music?page=1&limit=10`);
    const data = await response.json();
    
    musicList.innerHTML = '';
    allLoadedItems.clear(); // Clear the set of loaded items
    
    data.music.forEach(({ url, title }) => {
      allLoadedItems.add(url);
      const card = createMusicCard(url, title);
      musicList.appendChild(card);
    });
    
    // Add sentinel element back
    musicList.appendChild(sentinel);
    observer.observe(sentinel);
    
    currentPage = 2;
    hasMore = currentPage <= data.totalPages;
  } catch (error) {
    console.error('Error fetching music:', error);
    musicList.innerHTML = '<p class="error">Error loading music. Please try again later.</p>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  
  let title = titleInput.value.trim();
  
  // If no title provided, try to fetch it
  if (!title) {
    titleInput.style.display = 'none';
    titleInput.required = false;
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Fetching title...';
    submitButton.disabled = true;
    
    title = await getTitleFromUrl(url);
    
    // Reset button state
    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
    
    // If title fetch failed, show the title input
    if (!title) {
      titleInput.style.display = 'block';
      titleInput.required = true;
      titleInput.focus();
      return; // Prevent form submission until title is provided
    }
  }
  
  try {
    const response = await fetch(`${API_URL}/music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, title }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save music');
    }
    
    urlInput.value = '';
    titleInput.value = '';
    titleInput.style.display = 'none';
    titleInput.required = false;
    
    // Reset pagination and reload the list
    currentPage = 1;
    hasMore = true;
    renderMusicList();
  } catch (error) {
    console.error('Error saving music:', error);
    alert('Failed to save music. Please try again.');
  }
});

// Initial render
renderMusicList(); 