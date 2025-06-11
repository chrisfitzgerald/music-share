const form = document.getElementById('music-form');
const urlInput = document.getElementById('music-url');
const titleInput = document.getElementById('music-title');
const musicList = document.getElementById('music-list');
const playerContainer = document.getElementById('player-container');
const closePlayerBtn = document.getElementById('close-player');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const randomButton = document.getElementById('random-button');

// YouTube player instance
let player = null;
let allMusic = []; // Store all music items

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

// YouTube API ready
window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: '',
    playerVars: {
      'playsinline': 1,
      'controls': 1,
      'autoplay': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
};

function onPlayerReady(event) {
  console.log('Player is ready');
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    closePlayer();
  }
}

function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function playYouTubeVideo(url) {
  const videoId = getYouTubeId(url);
  if (videoId) {
    if (!player) {
      // If player isn't initialized yet, create it
      player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'playsinline': 1,
          'controls': 1,
          'autoplay': 1
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    } else {
      // If player exists, load the new video
      player.loadVideoById(videoId);
    }
    playerContainer.classList.add('active');
  }
}

function closePlayer() {
  if (player) {
    player.stopVideo();
  }
  playerContainer.classList.remove('active');
}

// Close player when clicking the close button
closePlayerBtn.addEventListener('click', closePlayer);

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

function createMusicCard(url, title, sharedBy) {
  const card = document.createElement('div');
  card.className = 'music-card';
  
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  
  const cover = document.createElement('img');
  cover.className = 'music-cover';
  cover.src = getCoverArt(url);
  cover.alt = 'cover';
  
  const info = document.createElement('div');
  info.className = 'music-info';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'music-title';
  titleEl.textContent = title || url;
  
  const sharedByEl = document.createElement('div');
  sharedByEl.className = 'music-shared-by';
  sharedByEl.textContent = `Shared by: ${sharedBy}`;
  
  info.appendChild(titleEl);
  info.appendChild(sharedByEl);
  link.appendChild(cover);
  link.appendChild(info);
  
  // Add play button for YouTube links
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = '▶';
    playButton.addEventListener('click', (e) => {
      e.preventDefault();
      playYouTubeVideo(url);
    });
    card.appendChild(playButton);
  }
  
  card.appendChild(link);
  return card;
}

function createShowMoreButton() {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'show-more-container';
  
  const button = document.createElement('button');
  button.className = 'show-more-button';
  button.textContent = 'Show More';
  button.addEventListener('click', loadMoreMusic);
  
  buttonContainer.appendChild(button);
  return buttonContainer;
}

async function loadMoreMusic() {
  if (isLoading || !hasMore) return;
  
  isLoading = true;
  const showMoreButton = document.querySelector('.show-more-button');
  if (showMoreButton) {
    showMoreButton.textContent = 'Loading...';
    showMoreButton.disabled = true;
  }
  
  try {
    const response = await fetch(`${API_URL}/music?page=${currentPage}&limit=20`);
    const data = await response.json();
    
    if (data.music.length === 0) {
      hasMore = false;
      if (showMoreButton) {
        showMoreButton.remove();
      }
      return;
    }
    
    // Filter out any items we've already loaded
    const newItems = data.music.filter(item => !allLoadedItems.has(item.url));
    
    if (newItems.length === 0) {
      hasMore = false;
      if (showMoreButton) {
        showMoreButton.remove();
      }
      return;
    }
    
    // Remove the old show more button
    const oldButton = document.querySelector('.show-more-container');
    if (oldButton) {
      oldButton.remove();
    }
    
    newItems.forEach(({ url, title, sharedBy }) => {
      allLoadedItems.add(url);
      const card = createMusicCard(url, title, sharedBy);
      musicList.appendChild(card);
    });
    
    currentPage++;
    hasMore = currentPage <= data.totalPages;
    
    // Add the show more button back if there are more items
    if (hasMore) {
      const buttonContainer = createShowMoreButton();
      musicList.appendChild(buttonContainer);
    }
  } catch (error) {
    console.error('Error loading more music:', error);
    if (showMoreButton) {
      showMoreButton.textContent = 'Error loading more. Click to retry.';
      showMoreButton.disabled = false;
    }
  } finally {
    isLoading = false;
  }
}

async function renderMusicList() {
  try {
    const response = await fetch(`${API_URL}/music?page=1&limit=20`);
    const data = await response.json();
    
    musicList.innerHTML = '';
    allLoadedItems.clear(); // Clear the set of loaded items
    
    data.music.forEach(({ url, title, sharedBy }) => {
      allLoadedItems.add(url);
      const card = createMusicCard(url, title, sharedBy);
      musicList.appendChild(card);
    });
    
    currentPage = 2;
    hasMore = currentPage <= data.totalPages;
    
    // Add show more button if there are more items
    if (hasMore) {
      const buttonContainer = createShowMoreButton();
      musicList.appendChild(buttonContainer);
    }
  } catch (error) {
    console.error('Error fetching music:', error);
    musicList.innerHTML = '<p class="error">Error loading music. Please try again later.</p>';
  }
}

// Add form submission handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  
  if (!url) return;
  
  try {
    const response = await fetch(`${API_URL}/music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, title }),
    });
    
    if (response.ok) {
      urlInput.value = '';
      titleInput.value = '';
      titleInput.style.display = 'none';
      renderMusicList(); // Refresh the list
    }
  } catch (error) {
    console.error('Error adding music:', error);
  }
});

// Load initial music list when the page loads
document.addEventListener('DOMContentLoaded', () => {
  renderMusicList();
});

async function searchMusic(query) {
  query = query.toLowerCase();
  
  // Clear the current list
  musicList.innerHTML = '';
  
  try {
    // Query the database directly
    const response = await fetch(`${API_URL}/music/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    // Update allMusic with search results
    allMusic = data.music;
    
    // Render filtered results
    data.music.forEach(({ url, title, sharedBy }) => {
      const card = createMusicCard(url, title, sharedBy);
      musicList.appendChild(card);
    });
    
    // If no results, show a message
    if (data.music.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.textContent = 'No results found';
      musicList.appendChild(noResults);
    }
  } catch (error) {
    console.error('Error searching music:', error);
    const errorMessage = document.createElement('div');
    errorMessage.className = 'no-results';
    errorMessage.textContent = 'Error searching music';
    musicList.appendChild(errorMessage);
  }
}

async function playRandomMusic() {
  try {
    // Get a random music item from the database
    const response = await fetch(`${API_URL}/music/random`);
    const data = await response.json();
    
    if (data.music) {
      const { url, title } = data.music;
      playYouTubeVideo(url);
    } else {
      console.error('No music found');
    }
  } catch (error) {
    console.error('Error playing random music:', error);
  }
}

// Event Listeners
searchButton.addEventListener('click', () => {
  searchMusic(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchMusic(searchInput.value);
  }
});

randomButton.addEventListener('click', playRandomMusic);

// Initial load
async function loadAllMusic() {
  try {
    const response = await fetch(`${API_URL}/music`);
    const data = await response.json();
    allMusic = data.music;
    renderMusicList(allMusic);
  } catch (error) {
    console.error('Error loading music:', error);
    musicList.innerHTML = '<p class="error">Error loading music. Please try again later.</p>';
  }
}

// Initial load
loadAllMusic(); 