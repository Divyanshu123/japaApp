const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/clips', express.static(path.join(__dirname, 'clips')));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.get('/login', (req, res) => {
    const { username, password } = req.query;

    // Hardcoded admin credentials (Replace with DB validation)
    if (username === 'admin' && password === 'password123') {
        req.session.isAdmin = true;
        res.send('Login successful! You are now an admin.');
    } else {
        res.status(401).send('Invalid credentials.');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged out successfully.');
});

app.get('/is-admin', (req, res) => {
    // Check if user is an admin (from session or authentication)
    const isAdmin = req.session?.isAdmin || false; // Ensure session exists

    res.json({ isAdmin });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const speakerName = req.body.speaker.trim(); // Ensure no leading/trailing spaces
        const speakerDir = path.join(__dirname, 'clips', speakerName);
        if (!fs.existsSync(speakerDir)) {
            fs.mkdirSync(speakerDir, { recursive: true });
        }
        cb(null, speakerDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/upload', (req, res, next) => {
    const isAdmin = req.session?.isAdmin || false;

    if (!isAdmin) {
        return res.status(403).send('Access denied');
    }
    next();
}, upload.single('clip'), (req, res) => {
    res.send('Clip uploaded successfully');
});


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

// New endpoint to fetch clips of a specific speaker
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

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
