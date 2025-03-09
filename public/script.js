const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause-btn');
const speakersDiv = document.getElementById('speakers');
const openFormBtn = document.getElementById('open-form-btn');
const audioForm = document.getElementById('audio-form');
const formModal = document.getElementById('form-modal');
const closeModal = document.querySelector('.close');
const generateButton = audioForm.querySelector('button[type="submit"]');


let isPlaying = false;
let interval;
let clips = [];

openFormBtn.addEventListener('click', () => {
    formModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    formModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == formModal) {
        formModal.style.display = 'none';
    }
});

let wakeLock = null;

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            console.log('Wake Lock was released');
        });
        console.log('Wake Lock is active');
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    requestWakeLock();
});

async function fetchSpeakers() {
    const response = await fetch('/speakers');
    const speakers = await response.json();
    speakersDiv.innerHTML = ''; // Clear previous content
    for (const speaker of speakers) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = speaker;
        checkbox.name = 'speakers';
        checkbox.value = speaker;
        checkbox.checked = true;
        checkbox.addEventListener('change', updateClips);

        const label = document.createElement('label');
        label.htmlFor = speaker;
        label.textContent = ` ${speaker}`; // Ensure speaker name appears next to checkbox
        
        const container = document.createElement('div'); // Wrap checkbox and label for better spacing
        container.appendChild(checkbox);
        container.appendChild(label);
        
        speakersDiv.appendChild(container);
    }
    
    updateClips(); // Update clips after fetching speakers
}

function updateClips() {
    const checkedSpeakers = Array.from(document.querySelectorAll('input[name="speakers"]:checked')).map(cb => cb.value);
    clips = [];
    checkedSpeakers.forEach(speaker => {
        fetch(`/speakers/${speaker}`)
            .then(response => response.json())
            .then(data => {
                clips = clips.concat(data.clips);
            });
    });
}

function playRandomClip() {
    if (clips.length === 0) return;
    const randomClip = clips[Math.floor(Math.random() * clips.length)];
    audioPlayer.src = encodeURI(randomClip);
    audioPlayer.play();
    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
}

function pauseAudio() {
    audioPlayer.pause();
    isPlaying = false;
    playPauseBtn.textContent = 'Resume Chanting';
}

function togglePlayPause() {
    if (isPlaying) {
        pauseAudio();
        clearInterval(interval);
        interval = null;
    } else {
        playRandomClip();
        setRandomClipInterval();
    }
}

playPauseBtn.addEventListener('click', togglePlayPause);

function setRandomClipInterval() {
    const randomInterval = Math.floor(Math.random() * 15 + 1) * 60000;
    interval = setInterval(playRandomClip, randomInterval);
}
audioForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const audioLength = document.getElementById('audio-length').value;
    const clipInterval = document.getElementById('clip-interval').value;
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    formModal.classList.add('disabled');
    fetch('/generate_audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audioLength, clipInterval, clips })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = URL.createObjectURL(blob);
        audioPlayer.src = url;
        formModal.style.display = 'none';
    })
    .catch(error => console.error('Error:', error))
    .finally(() => {
        // Hide the loader
        loader.style.display = 'none';
        formModal.classList.remove('disabled');
    });
});

fetchSpeakers();
