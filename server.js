const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/clips', express.static(path.join(__dirname, 'clips')));

app.get('/speakers', (req, res) => {
    const clipsDir = path.join(__dirname, 'clips');
    if (!fs.existsSync(clipsDir)) {
        return res.json([]);
    }
    fs.readdir(clipsDir, (err, speakers) => {
        if (err) {
            return res.status(500).send('Unable to scan directory');
        }
        res.json(speakers); // Returns an array of speaker names
    });
});

// Endpoint to fetch clips of a specific speaker
app.get('/speakers/:speaker', (req, res) => {
    const speakerDir = path.join(__dirname, 'clips', req.params.speaker);
    if (!fs.existsSync(speakerDir)) {
        return res.json({ speaker: req.params.speaker, clips: [] });
    }
    fs.readdir(speakerDir, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading speaker directory');
        }
        const clips = files.map(file => path.join('clips', req.params.speaker, file));
        res.json({ speaker: req.params.speaker, clips });
    });
});

function getRandomSilenceDuration(min, max) {
    return Math.random() * (max - min) + min;
}

function generateSilence(duration, outputFilePath, callback) {
    exec(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -q:a 9 "${outputFilePath}"`, (err) => {
        if (err) {
            console.error("Error generating silence:", err);
            callback(err);
        } else {
            callback(null);
        }
    });
}

async function generatePlaylist(clips, minInterval, maxInterval, targetDurationSeconds, fileListPath, callback) {
    let currentDuration = 0;
    let playlistContent = '';
    const silenceFiles = [];
    const promises = [];

    while (currentDuration < targetDurationSeconds) {
        // ✅ Step 1: Pick a random clip
        const randomClip = clips[Math.floor(Math.random() * clips.length)];
        playlistContent += `file '${randomClip}'\n`;
        currentDuration += 10; // Assume average clip length = 30 seconds

        // ✅ Step 2: Generate random silence (4-8 minutes)
        const silenceDuration = getRandomSilenceDuration(minInterval, maxInterval) * 60;
        const silencePath = `silence_${Date.now()}.mp3`;
        silenceFiles.push(silencePath);

        // ✅ Step 3: Generate the silence audio
        try {
            await new Promise((resolve, reject) => {
                generateSilence(silenceDuration, silencePath, (err) => {
                    if (err) return reject(err);

                    playlistContent += `file '${silencePath}'\n`;
                    currentDuration += silenceDuration;
                    resolve();
                });
            });
        } catch (err) {
            return callback(err);
        }

        // ✅ Step 4: Break the loop if we reached 2 hours
        if (currentDuration >= targetDurationSeconds) {
            break;
        }
    }

    // ✅ Step 5: Write the playlist
    fs.writeFile(fileListPath, playlistContent, (err) => {
        if (err) {
            return callback(err);
        }
        callback(null, silenceFiles);
    });
}

app.post('/generate_audio', (req, res) => {
    const { audioLength, clipInterval, clips } = req.body;

    if (!audioLength || !clipInterval || !clips || clips.length === 0) {
        return res.status(400).json({ error: 'Audio length, clip interval, and clips are required.' });
    }

    // ✅ Parse audio length and interval
    const [minInterval, maxInterval] = clipInterval.split('-').map(Number);
    const [targetHours, targetMinutes] = audioLength.split(':').map(Number);
    const targetDurationSeconds = (targetHours * 60 * 60) + (targetMinutes * 60);

    // ✅ Generate the playlist file
    const fileListPath = path.join(__dirname, 'filelist.txt');
    generatePlaylist(clips, minInterval, maxInterval, targetDurationSeconds, fileListPath, (err, silenceFiles) => {
        if (err) {
            console.error("Error generating playlist:", err);
            return res.status(500).json({ error: 'Error generating audio.' });
        }

        // ✅ Generate the final audio
        const outputPath = path.join(__dirname, 'output', `generated_audio_${Date.now()}.mp3`);
        const command = `
            ffmpeg -f concat -safe 0 -i ${fileListPath} -c copy ${outputPath}
        `;
    

        exec(command, (error) => {
            // ✅ Cleanup silence files
            silenceFiles.forEach(file => fs.unlinkSync(file));
            fs.unlinkSync(fileListPath);

            if (error) {
                console.error('Error generating audio:', error);
                return res.status(500).json({ error: 'Error generating audio.' });
            }

            // ✅ Send the generated audio file to the client
            res.sendFile(outputPath, () => {
                fs.unlinkSync(outputPath);
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
