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

// Add sort state
let currentSort = 'newest'; // 'newest' or 'oldest'

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

function createMusicCard(music) {
  const card = document.createElement('div');
  card.className = 'music-card';
  
  const cover = document.createElement('img');
  cover.className = 'music-cover';
  const coverSrc = getCoverArt(music.url) || 'https://via.placeholder.com/150';
  cover.src = coverSrc;
  cover.alt = 'cover';

  console.log('Music card creation:');
  console.log('Music URL:', music.url);
  console.log('Cover Image URL:', coverSrc);
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'music-info';
  infoDiv.innerHTML = `
    <h3>${music.title}</h3>
    <p class="music-meta">
      <span class="shared-by">Shared by ${music.sharedBy}</span>
      <span class="shared-date">${music.sharedAt ? new Date(music.sharedAt).toLocaleDateString() : ''}</span>
    </p>
  `;
  
  card.appendChild(cover);
  card.appendChild(infoDiv);
  
  // Add play overlay for YouTube links
  if (music.url.includes('youtube.com') || music.url.includes('youtu.be')) {
    const playOverlay = document.createElement('div');
    playOverlay.className = 'play-overlay';
    playOverlay.innerHTML = '<i class="fas fa-play"></i>';
    card.appendChild(playOverlay);

    // Add click listener directly to the play overlay
    playOverlay.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the card's click listener from firing
      playYouTubeVideo(music.url);
    });
  }
  
  card.addEventListener('click', (e) => {
    // Only handle clicks for the right-side link area
    const rect = card.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    if (clickX > rect.width - 64) {
      // Open original link in new tab
      window.open(music.url, '_blank');
    }
    // No else block here, as playOverlay handles video playback
  });
  
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
    const response = await fetch(`${API_URL}/music?page=${currentPage}&limit=20&sort=${currentSort}`);
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
      const card = createMusicCard({ url, title, sharedBy });
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
      const card = createMusicCard({ url, title, sharedBy });
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

// Add function to toggle sort
async function toggleSort() {
  currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
  const sortButton = document.getElementById('sort-button');
  sortButton.textContent = currentSort === 'newest' ? '↑ Newest First' : '↓ Oldest First';
  
  // Reset pagination
  currentPage = 1;
  hasMore = true;
  allLoadedItems.clear();
  
  // Clear the current list
  musicList.innerHTML = '';
  
  // Load music with new sort
  await loadMoreMusic();
}

// Add sort button to the controls
const controls = document.querySelector('.controls');
const sortButton = document.createElement('button');
sortButton.id = 'sort-button';
sortButton.className = 'sort-button';
sortButton.textContent = '↑ Newest First';
sortButton.addEventListener('click', toggleSort);
controls.appendChild(sortButton);

// Update search function to maintain sort order
async function searchMusic(query) {
  query = query.toLowerCase();
  
  // Clear the current list
  musicList.innerHTML = '';
  
  try {
    // Query the database directly
    const response = await fetch(`${API_URL}/music/search?q=${encodeURIComponent(query)}&sort=${currentSort}`);
    const data = await response.json();
    
    // Update allMusic with search results
    allMusic = data.music;
    
    // Render filtered results
    data.music.forEach(({ url, title, sharedBy }) => {
      const card = createMusicCard({ url, title, sharedBy });
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

// Add event listener for search input
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (query === '') {
    // Clear the current list
    musicList.innerHTML = '';
    // Reset pagination
    currentPage = 1;
    hasMore = true;
    allLoadedItems.clear();
    // Load initial music list
    await loadMoreMusic();
  } else {
    await searchMusic(query);
  }
});

// Update search button click handler
searchButton.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (query === '') {
    // Clear the current list
    musicList.innerHTML = '';
    // Reset pagination
    currentPage = 1;
    hasMore = true;
    allLoadedItems.clear();
    // Load initial music list
    await loadMoreMusic();
  } else {
    await searchMusic(query);
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