const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause-btn');
const uploadForm = document.getElementById('upload-form');
const speakersDiv = document.getElementById('speakers');

let isPlaying = false;
let interval;
let clips = [];

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

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(uploadForm);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        alert('Clip uploaded successfully!'); // Optional feedback
        uploadForm.reset(); // Clears the form
        fetchSpeakers(); // Refresh speakers list
    } else {
        alert('Upload failed. Please try again.');
    }
});

async function checkAdmin() {
    const response = await fetch('/is-admin'); // API to check admin status
    const data = await response.json();

    if (!data.isAdmin) {
        document.getElementById('upload-form').style.display = 'none'; // Hide upload form
    }
}

checkAdmin();

fetchSpeakers();
