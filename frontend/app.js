/**
 * Chennai Flood Predictor - Front-end Controller
 * Handles atmospheric storm canvas loop, sound synthesis, API query, and offline fallback.
 */

// HTML Sanitization Helper to prevent DOM XSS
function escapeHTML(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/[&<>"']/g, function(match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}

// Global state variables
let isOfflineMode = false;
let isAudioEnabled = false;
let isAnimationEnabled = true;
let forecastChartInstance = null;
let map = null;
let mapMarkers = {};
let radarLayer = null;
let hasActiveAlertSubscription = false;
let subscribedPhoneNumber = "";
let currentWeatherPreset = null;
let activePresetName = null;


// Web Audio API components
let audioCtx = null;
let rainSource = null;
let rainGainNode = null;
let currentThunderTimeout = null;

// Upgraded Audio Engine state variables for track playback and analysis
let audioAnalyser = null;
let audioBufferCache = {};
let currentAudioTrack = "synth"; // 'synth' | 'heavy' | 'natural'
let trackSource = null;
let trackGainNode = null;
let html5Audio = null;
let isAudioLoading = false;
let audioDataArray = null;
let lastLightningTime = 0;

// Area database constants for offline fallback evaluations
const AREAS_DB = {
    // Existing 20
    "Velachery": { elevation: 5.0, drainage: 0.30, river_dist: 1.5, lat: 12.9815, lon: 80.2180 },
    "Adyar": { elevation: 4.0, drainage: 0.25, river_dist: 0.2, lat: 13.0012, lon: 80.2565 },
    "T. Nagar": { elevation: 12.0, drainage: 0.55, river_dist: 2.2, lat: 13.0418, lon: 80.2337 },
    "Anna Nagar": { elevation: 14.0, drainage: 0.60, river_dist: 1.8, lat: 13.0850, lon: 80.2101 },
    "Tambaram": { elevation: 20.0, drainage: 0.65, river_dist: 4.5, lat: 12.9249, lon: 80.1467 },
    "Sholinganallur": { elevation: 3.0, drainage: 0.20, river_dist: 0.8, lat: 12.9010, lon: 80.2279 },
    "Porur": { elevation: 10.0, drainage: 0.50, river_dist: 1.2, lat: 13.0382, lon: 80.1561 },
    "Perambur": { elevation: 8.0, drainage: 0.40, river_dist: 0.5, lat: 13.1085, lon: 80.2443 },
    "Chromepet": { elevation: 16.0, drainage: 0.58, river_dist: 3.8, lat: 12.9616, lon: 80.1374 },
    "Kodambakkam": { elevation: 9.0, drainage: 0.45, river_dist: 1.6, lat: 13.0473, lon: 80.2158 },
    "Mylapore": { elevation: 6.0, drainage: 0.32, river_dist: 1.1, lat: 13.0330, lon: 80.2677 },
    "Guindy": { elevation: 11.0, drainage: 0.48, river_dist: 1.4, lat: 13.0067, lon: 80.2206 },
    "Nungambakkam": { elevation: 13.0, drainage: 0.52, river_dist: 2.0, lat: 13.0580, lon: 80.2423 },
    "Madipakkam": { elevation: 7.0, drainage: 0.35, river_dist: 1.9, lat: 12.9623, lon: 80.1986 },
    "Pallikaranai": { elevation: 2.0, drainage: 0.18, river_dist: 0.4, lat: 12.9349, lon: 80.2137 },
    "Besant Nagar": { elevation: 5.0, drainage: 0.30, river_dist: 0.9, lat: 13.0003, lon: 80.2702 },
    "Thiruvanmiyur": { elevation: 4.0, drainage: 0.28, river_dist: 0.7, lat: 12.9830, lon: 80.2594 },
    "Ambattur": { elevation: 9.0, drainage: 0.42, river_dist: 2.5, lat: 13.1143, lon: 80.1548 },
    "Avadi": { elevation: 18.0, drainage: 0.60, river_dist: 3.0, lat: 13.1181, lon: 80.1036 },
    "Manali": { elevation: 3.0, drainage: 0.22, river_dist: 0.3, lat: 13.1672, lon: 80.2592 },

    // North Chennai New Areas
    "Ennore": { elevation: 2.0, drainage: 0.20, river_dist: 0.1, lat: 13.2161, lon: 80.3247 },
    "Tiruvottiyur": { elevation: 3.0, drainage: 0.25, river_dist: 0.4, lat: 13.1612, lon: 80.3032 },
    "Madhavaram": { elevation: 9.0, drainage: 0.45, river_dist: 1.8, lat: 13.1482, lon: 80.2307 },
    "Puzhal": { elevation: 12.0, drainage: 0.50, river_dist: 2.0, lat: 13.1601, lon: 80.2012 },
    "Kodungaiyur": { elevation: 4.0, drainage: 0.30, river_dist: 0.8, lat: 13.1385, lon: 80.2510 },
    "Tondiarpet": { elevation: 3.0, drainage: 0.35, river_dist: 0.6, lat: 13.1252, lon: 80.2882 },
    "Royapuram": { elevation: 4.0, drainage: 0.40, river_dist: 0.2, lat: 13.1118, lon: 80.2925 },
    "Washermanpet": { elevation: 5.0, drainage: 0.40, river_dist: 1.0, lat: 13.1025, lon: 80.2811 },
    "Vyasarpadi": { elevation: 3.0, drainage: 0.28, river_dist: 0.3, lat: 13.1095, lon: 80.2544 },

    // Central Chennai New Areas
    "Kilpauk": { elevation: 11.0, drainage: 0.55, river_dist: 1.2, lat: 13.0788, lon: 80.2385 },
    "Ayanavaram": { elevation: 9.0, drainage: 0.45, river_dist: 1.5, lat: 13.0970, lon: 80.2312 },
    "Chetpet": { elevation: 8.0, drainage: 0.50, river_dist: 0.3, lat: 13.0689, lon: 80.2418 },
    "Egmore": { elevation: 7.0, drainage: 0.48, river_dist: 0.2, lat: 13.0783, lon: 80.2605 },
    "Purasawalkam": { elevation: 8.0, drainage: 0.45, river_dist: 1.0, lat: 13.0901, lon: 80.2520 },
    "Choolai": { elevation: 6.0, drainage: 0.40, river_dist: 0.8, lat: 13.0872, lon: 80.2625 },
    "Vadapalani": { elevation: 10.0, drainage: 0.52, river_dist: 1.4, lat: 13.0494, lon: 80.2084 },
    "Ashok Nagar": { elevation: 11.0, drainage: 0.55, river_dist: 1.1, lat: 13.0360, lon: 80.2110 },
    "KK Nagar": { elevation: 10.0, drainage: 0.52, river_dist: 0.9, lat: 13.0285, lon: 80.2030 },

    // South Chennai New Areas
    "Saidapet": { elevation: 6.0, drainage: 0.40, river_dist: 0.1, lat: 13.0205, lon: 80.2225 },
    "Alandur": { elevation: 12.0, drainage: 0.50, river_dist: 1.8, lat: 12.9975, lon: 80.2006 },
    "Nanganallur": { elevation: 14.0, drainage: 0.55, river_dist: 2.5, lat: 12.9804, lon: 80.1965 },
    "Perungudi": { elevation: 3.0, drainage: 0.22, river_dist: 0.5, lat: 12.9654, lon: 80.2461 },
    "Kottivakkam": { elevation: 4.0, drainage: 0.28, river_dist: 0.5, lat: 12.9682, lon: 80.2601 },
    "Palavakkam": { elevation: 4.0, drainage: 0.26, river_dist: 0.4, lat: 12.9554, lon: 80.2625 },
    "Neelankarai": { elevation: 4.0, drainage: 0.28, river_dist: 0.3, lat: 12.9492, lon: 80.2647 },
    "Karapakkam": { elevation: 3.0, drainage: 0.22, river_dist: 0.4, lat: 12.9220, lon: 80.2292 },
    "Thoraipakkam": { elevation: 3.0, drainage: 0.24, river_dist: 0.6, lat: 12.9430, lon: 80.2345 },
    "Semmencheri": { elevation: 4.0, drainage: 0.25, river_dist: 0.8, lat: 12.8718, lon: 80.2215 },
    "Uthandi": { elevation: 3.0, drainage: 0.30, river_dist: 0.2, lat: 12.8605, lon: 80.2458 },

    // West Chennai New Areas
    "Mogappair": { elevation: 11.0, drainage: 0.48, river_dist: 1.6, lat: 13.0854, lon: 80.1762 },
    "Nolambur": { elevation: 13.0, drainage: 0.50, river_dist: 1.2, lat: 13.0745, lon: 80.1650 },
    "Maduravoyal": { elevation: 11.0, drainage: 0.48, river_dist: 0.5, lat: 13.0664, lon: 80.1685 },
    "Valasaravakkam": { elevation: 9.0, drainage: 0.45, river_dist: 0.9, lat: 13.0402, lon: 80.1784 },
    "Ramapuram": { elevation: 8.0, drainage: 0.42, river_dist: 0.8, lat: 13.0232, lon: 80.1802 },
    "Virugambakkam": { elevation: 9.0, drainage: 0.45, river_dist: 0.6, lat: 13.0485, lon: 80.1895 },
    "Saligramam": { elevation: 9.0, drainage: 0.48, river_dist: 1.0, lat: 13.0538, lon: 80.1982 },
    "Koyambedu": { elevation: 10.0, drainage: 0.50, river_dist: 0.3, lat: 13.0732, lon: 80.1912 },
    "Nerkundram": { elevation: 10.0, drainage: 0.48, river_dist: 0.7, lat: 13.0694, lon: 80.1785 }
};

// ----------------------------------------------------
// ----------------------------------------------------
// ATMOSPHERIC RAIN CANVAS ANIMATION
// ----------------------------------------------------
const canvas = document.getElementById("rain-canvas");
const ctx = canvas.getContext("2d");

let canvasWidth = (canvas.width = window.innerWidth);
let canvasHeight = (canvas.height = window.innerHeight);

// Handle window resizing
window.addEventListener("resize", () => {
    canvasWidth = canvas.width = window.innerWidth;
    canvasHeight = canvas.height = window.innerHeight;
});

// Wind angle dynamic state
let currentWindAngle = 0.2; // in radians
let splashes = [];

// Ripple splash particle definition
class Splash {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1 + Math.random() * 2;
        this.maxRadius = 6 + Math.random() * 8;
        this.opacity = 0.6;
        this.decay = 0.02 + Math.random() * 0.03;
    }
    update() {
        this.radius += 0.4;
        this.opacity -= this.decay;
    }
    draw() {
        ctx.strokeStyle = `rgba(184, 212, 255, ${this.opacity})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.25, 0, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

// Rain particle class definition
class RainDrop {
    constructor() {
        this.reset();
        // Stagger initial height distribution
        this.y = Math.random() * canvasHeight;
    }

    reset() {
        this.x = Math.random() * (canvasWidth + 400) - 200;
        this.y = -Math.random() * 100;
        
        // Dynamic rain depth layers: 0 (background), 1 (midground), 2 (foreground)
        const rand = Math.random();
        if (rand < 0.55) {
            this.layer = 0; // distant background
            this.length = 5 + Math.random() * 6;
            this.speed = 8 + Math.random() * 4;
            this.opacity = 0.06 + Math.random() * 0.1;
            this.width = 0.2 + Math.random() * 0.2;
        } else if (rand < 0.88) {
            this.layer = 1; // midground
            this.length = 12 + Math.random() * 10;
            this.speed = 14 + Math.random() * 8;
            this.opacity = 0.15 + Math.random() * 0.25;
            this.width = 0.5 + Math.random() * 0.4;
        } else {
            this.layer = 2; // foreground
            this.length = 26 + Math.random() * 12;
            this.speed = 24 + Math.random() * 10;
            this.opacity = 0.35 + Math.random() * 0.25;
            this.width = 1.0 + Math.random() * 0.6;
        }
    }

    update(intensity = 1.0) {
        const speedMultiplier = 0.6 + 0.5 * intensity;
        const dx = this.speed * speedMultiplier * Math.sin(currentWindAngle);
        const dy = this.speed * speedMultiplier * Math.cos(currentWindAngle);
        this.y += dy;
        this.x += dx;

        if (this.y > canvasHeight || this.x > canvasWidth + 200 || this.x < -200) {
            // Spawn ripples on collision
            if (this.layer > 0 && Math.random() < 0.3 * intensity) {
                const collisionX = this.x - (this.y - canvasHeight) * Math.tan(currentWindAngle);
                splashes.push(new Splash(collisionX, canvasHeight - 5 - Math.random() * 10));
            }
            this.reset();
        }
    }

    draw(intensity = 1.0) {
        const opacityMultiplier = 0.5 + 0.6 * intensity;
        ctx.strokeStyle = `rgba(184, 212, 255, ${Math.min(1.0, this.opacity * opacityMultiplier)})`;
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
            this.x + this.length * Math.sin(currentWindAngle),
            this.y + this.length * Math.cos(currentWindAngle)
        );
        ctx.stroke();
    }
}

// Instantiate particles (mix foreground, midground, background)
const raindrops = Array.from({ length: 420 }, () => new RainDrop());

function renderRainAnimation() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!isAnimationEnabled) {
        requestAnimationFrame(renderRainAnimation);
        return;
    }

    let rainRate = 12.0; // default baseline monsoon
    if (currentWeatherPreset) {
        rainRate = currentWeatherPreset.rainRate;
    } else {
        const currentMonth = new Date().getMonth() + 1;
        const isMonsoon = [10, 11, 12].includes(currentMonth);
        rainRate = isMonsoon ? 18.0 : 0.0;
    }

    const maxRainRate = 35.0; // 2015 deluge

    // Analyze audio track if enabled and playing file
    let modulatedRainRate = rainRate;
    if (isAudioEnabled && currentAudioTrack !== "synth" && audioAnalyser && audioDataArray) {
        audioAnalyser.getByteFrequencyData(audioDataArray);
        
        // Compute averages
        let lowSum = 0;
        const lowBinsCount = 8;
        for (let i = 0; i < lowBinsCount; i++) {
            lowSum += audioDataArray[i];
        }
        const lowAvg = lowSum / lowBinsCount;

        let totalSum = 0;
        for (let i = 0; i < audioDataArray.length; i++) {
            totalSum += audioDataArray[i];
        }
        const totalAvg = totalSum / audioDataArray.length;

        // Modulate rain rate (fallback to track baseline if preset rate is 0)
        const audioIntensity = Math.max(0.3, Math.min(2.0, totalAvg / 35.0));
        const baseRainRate = rainRate > 0 ? rainRate : (currentAudioTrack === "heavy" ? 26.0 : 16.0);
        modulatedRainRate = Math.min(maxRainRate, baseRainRate * audioIntensity);

        // Real-time thunderclap detector
        const now = Date.now();
        // Adjust threshold based on testing - usually low frequency averages go up to 200+ on loud booms
        if (lowAvg > 165 && (now - lastLightningTime > 4000)) {
            lastLightningTime = now;
            triggerLightningVisuals();
        }
    }

    const rainIntensityFactor = Math.min(1.2, modulatedRainRate / 24.0); // scale intensity factor

    let activeCount = Math.floor(raindrops.length * Math.min(1.0, modulatedRainRate / maxRainRate));
    if (modulatedRainRate === 0) activeCount = 0;

    // Update dynamic wind sway parameters in real-time
    const baseSway = 0.22;
    const lfoSway = 0.12 * Math.sin(Date.now() / 5500.0);
    // Increase sway during heavy winds (currentWeatherPreset)
    const presetSway = currentWeatherPreset ? (currentWeatherPreset.windSpeed / 90.0) * (0.15 + 0.1 * Math.sin(Date.now() / 1500.0)) : 0.05;
    currentWindAngle = baseSway + lfoSway + presetSway;

    // Update and draw raindrops
    for (let i = 0; i < activeCount; i++) {
        raindrops[i].update(rainIntensityFactor);
        raindrops[i].draw(rainIntensityFactor);
    }

    // Update, draw, and filter splash ripples
    splashes.forEach(s => s.update());
    splashes = splashes.filter(s => s.opacity > 0);
    splashes.forEach(s => s.draw());

    requestAnimationFrame(renderRainAnimation);
}
renderRainAnimation();

// ----------------------------------------------------
// LIGHTNING FLASH overlay TIMELINE
// ----------------------------------------------------
function triggerLightningVisuals() {
    const flashEl = document.getElementById("lightning-flash");
    if (!flashEl || !isAnimationEnabled) return;

    // Double flash timelines
    const flash1Duration = 100 + Math.random() * 140; // 100-240ms
    const gapDuration = 80 + Math.random() * 100;     // 80-180ms
    const flash2Duration = 150 + Math.random() * 200; // 150-350ms

    // Step 1: Trigger first flash overlay & highlight UI cards
    flashEl.style.transition = "none";
    flashEl.style.opacity = (0.55 + Math.random() * 0.25).toString();
    document.querySelectorAll(".glass-card").forEach(c => c.classList.add("lightning-active"));

    setTimeout(() => {
        // Step 2: Gap (darkness)
        flashEl.style.opacity = "0";
        document.querySelectorAll(".glass-card").forEach(c => c.classList.remove("lightning-active"));

        setTimeout(() => {
            // Step 3: Trigger second flash overlay & highlights
            flashEl.style.opacity = (0.65 + Math.random() * 0.3).toString();
            document.querySelectorAll(".glass-card").forEach(c => c.classList.add("lightning-active"));

            setTimeout(() => {
                // Step 4: Fade second flash out smoothly
                flashEl.style.transition = "opacity 0.8s ease-out";
                flashEl.style.opacity = "0";
                document.querySelectorAll(".glass-card").forEach(c => c.classList.remove("lightning-active"));
            }, flash2Duration);

        }, gapDuration);

    }, flash1Duration);
}

function triggerLightning() {
    let rainRate = 12.0; // default monsoon baseline
    if (currentWeatherPreset) {
        rainRate = currentWeatherPreset.rainRate;
    } else {
        const currentMonth = new Date().getMonth() + 1;
        const isMonsoon = [10, 11, 12].includes(currentMonth);
        rainRate = isMonsoon ? 18.0 : 0.0;
    }

    // If we're playing a track, lightning is driven by the audio analyzer, not the random loop
    if (isAudioEnabled && currentAudioTrack !== "synth") {
        setTimeout(triggerLightning, 2000);
        return;
    }

    // No lightning in dry/clear weather or if animation is disabled
    if (rainRate <= 0.0 || !isAnimationEnabled) {
        setTimeout(triggerLightning, 2000);
        return;
    }

    triggerLightningVisuals();

    // Programmatic thunder audio trigger synchronized with speed of sound gap
    if (isAudioEnabled && currentAudioTrack === "synth") {
        const thunderDelay = 150 + Math.random() * 450; // 150-600ms
        if (currentThunderTimeout) clearTimeout(currentThunderTimeout);
        currentThunderTimeout = setTimeout(() => {
            playThunderRumble();
        }, thunderDelay);
    }

    // Schedule next random lightning event interval based on storm intensity
    let minInterval = 15000;
    let maxInterval = 30000;
    if (rainRate >= 28.0) {
        // Severe deluge or Michaung
        minInterval = 5000;
        maxInterval = 12000;
    } else if (rainRate >= 15.0) {
        minInterval = 8000;
        maxInterval = 18000;
    }
    const nextInterval = minInterval + Math.random() * (maxInterval - minInterval);
    setTimeout(triggerLightning, nextInterval);
}
// Start lightning loops
setTimeout(triggerLightning, 5000);

// ----------------------------------------------------
// PROGRAMMATIC WEB AUDIO GENERATION & FILE PLAYBACK
// ----------------------------------------------------
// Upgraded Audio Engine state variables
let windSource = null;
let windGainNode = null;
let windWhistleFilter = null;
let windRumbleFilter = null;
let whistleGain = null;

function createRainBuffer(ctx, duration = 4, density = 500) {
    const sampleRate = ctx.sampleRate;
    const bufferSize = duration * sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // 1. Smooth, soothing pink noise background (soft "shhh" rain wash, no harsh hiss)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        // Background noise scaled to sound like a soft cozy downpour
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11 * 0.06;
        b6 = white * 0.115926;
    }

    // 2. Softer Liquid Rain Drops ("plops" and "pats")
    const totalDrops = duration * density;
    for (let d = 0; d < totalDrops; d++) {
        const dropIndex = Math.floor(Math.random() * bufferSize);
        const decayLen = Math.floor(100 + Math.random() * 220); // slightly longer decay for soft rounded thuds
        const amplitude = 0.08 + Math.random() * 0.18; // soft volume
        
        const frequencyRad = (2.0 * Math.PI * (200 + Math.random() * 250)) / sampleRate;

        for (let i = 0; i < decayLen; i++) {
            const idx = dropIndex + i;
            if (idx < bufferSize) {
                const t = i / decayLen;
                const wave = Math.sin(i * frequencyRad);
                data[idx] += amplitude * Math.exp(-t * 9.5) * wave;
            }
        }
    }
    return buffer;
}

function createPinkNoiseBuffer(ctx, duration = 3) {
    const bufferSize = duration * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
    }
    return buffer;
}

async function loadAndDecodeAudio(url) {
    if (audioBufferCache[url]) {
        return audioBufferCache[url];
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioBufferCache[url] = buffer;
    return buffer;
}

function initSynthEngine() {
    if (rainSource) return; // already initialized

    // 1. Soothing Rain Patter
    const rainBuffer = createRainBuffer(audioCtx, 4, 950);
    rainSource = audioCtx.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;

    const rainFilter = audioCtx.createBiquadFilter();
    rainFilter.type = "lowpass";
    rainFilter.frequency.value = 850; // soft lowpass rain filter (removes high hiss)

    rainGainNode = audioCtx.createGain();
    rainGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

    rainSource.connect(rainFilter);
    rainFilter.connect(rainGainNode);
    rainGainNode.connect(audioCtx.destination);
    rainSource.start();

    // 2. Cozy, Deep Blowing Wind
    const windBuffer = createPinkNoiseBuffer(audioCtx, 4);
    windSource = audioCtx.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;

    // Pathway A: Deep atmospheric rumble
    windRumbleFilter = audioCtx.createBiquadFilter();
    windRumbleFilter.type = "lowpass";
    windRumbleFilter.frequency.value = 120; // low bass rumble

    // Pathway B: Cozy howling swells (soft resonance)
    windWhistleFilter = audioCtx.createBiquadFilter();
    windWhistleFilter.type = "bandpass";
    windWhistleFilter.Q.value = 3.0; // gentle resonance, no high pitch whistle

    whistleGain = audioCtx.createGain();
    whistleGain.gain.value = 0.18; // level relative to rumble

    windGainNode = audioCtx.createGain();
    windGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

    // Connect Pathway A
    windSource.connect(windRumbleFilter);
    windRumbleFilter.connect(windGainNode);

    // Connect Pathway B
    windSource.connect(windWhistleFilter);
    windWhistleFilter.connect(whistleGain);
    whistleGain.connect(windGainNode);

    windGainNode.connect(audioCtx.destination);
    windSource.start();

    // Modulate wind howling swells
    function modulateWind() {
        if (!audioCtx || !isAudioEnabled || currentAudioTrack !== "synth") {
            setTimeout(modulateWind, 200);
            return;
        }
        const now = audioCtx.currentTime;

        // Howling wind pitch sweeps back and forth: 120Hz to 320Hz
        const targetFreq = 220 + 100 * Math.sin(now * 0.3) + (Math.random() - 0.5) * 30;
        windWhistleFilter.frequency.exponentialRampToValueAtTime(Math.max(90, targetFreq), now + 0.85);

        // Modulate gain to simulate wind gust sweeps
        const basePresetGain = currentWeatherPreset ? (currentWeatherPreset.windSpeed / 100.0) * 0.14 : 0.04;
        const targetGain = Math.max(0.001, basePresetGain + (Math.random() * 0.05) * Math.sin(now * 0.65));
        windGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.85);

        // Modulate whistle volume gently
        const targetWhistleVol = 0.10 + 0.15 * Math.max(0, Math.sin(now * 0.65));
        whistleGain.gain.linearRampToValueAtTime(targetWhistleVol, now + 0.85);

        setTimeout(modulateWind, 850);
    }
    modulateWind();
}

async function playCurrentTrack() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    
    if (audioCtx.state === "suspended") {
        await audioCtx.resume();
    }

    // Stop existing track source if playing
    if (trackSource) {
        try { trackSource.stop(); } catch(e){}
        trackSource = null;
    }

    // Set up track gain and analyser if they don't exist
    if (!trackGainNode) {
        trackGainNode = audioCtx.createGain();
        trackGainNode.connect(audioCtx.destination);
    }
    if (!audioAnalyser) {
        audioAnalyser = audioCtx.createAnalyser();
        audioAnalyser.fftSize = 512;
        const bufferLength = audioAnalyser.frequencyBinCount;
        audioDataArray = new Uint8Array(bufferLength);
    }

    if (currentAudioTrack === "synth") {
        // Stop HTML5 audio if playing
        if (html5Audio) {
            html5Audio.pause();
        }

        // Mute/fade out file track volume
        trackGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
        
        // Start or ensure synth engine is running
        initSynthEngine();
        
        // Restore gains for synth engine
        updateAudioPresetLevels();
    } else {
        // File tracks: heavy or natural
        // 1. Mute/fade out synth engine nodes
        if (rainGainNode) rainGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
        if (windGainNode) windGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

        // 2. Identify file path
        let url = "";
        if (currentAudioTrack === "heavy") {
            url = "static/u_u6ti8mxhyp-heavy-rain-and-thunder-370985.mp3";
        } else if (currentAudioTrack === "natural") {
            url = "static/freesound_community-rain-and-thunder-16705.m4a";
        }

        const button = document.getElementById("audio-toggle-btn");
        const span = button.querySelector("span");

        // 2b. If running via file:// protocol, play using HTML5 audio element
        if (window.location.protocol === "file:") {
            if (!html5Audio) {
                html5Audio = new Audio();
                html5Audio.loop = true;
            }
            
            const expectedSrc = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + url;
            if (html5Audio.src !== expectedSrc) {
                html5Audio.src = url;
            }
            
            // Set volume according to preset
            let targetVolume = 0.25;
            if (currentWeatherPreset) {
                if (currentWeatherPreset.rainRate <= 0) targetVolume = 0.0;
                else if (currentWeatherPreset.label.includes("2015")) targetVolume = 0.45;
                else if (currentWeatherPreset.label.includes("Michaung")) targetVolume = 0.40;
            }
            html5Audio.volume = targetVolume;
            
            isAudioLoading = true;
            span.innerText = "Buffering storm...";
            button.classList.add("buffering");
            
            try {
                await html5Audio.play();
                span.innerText = "Mute Audio";
            } catch (error) {
                console.error("Failed to play HTML5 audio:", error);
                alert("Error loading audio file. Falling back to Synthesized Storm.");
                currentAudioTrack = "synth";
                document.getElementById("audio-track-select").value = "synth";
                playCurrentTrack();
            } finally {
                isAudioLoading = false;
                button.classList.remove("buffering");
            }
            return;
        }

        // Otherwise, use Web Audio API (HTTP/HTTPS modes)
        isAudioLoading = true;
        span.innerText = "Buffering storm...";
        button.classList.add("buffering");

        try {
            if (html5Audio) {
                html5Audio.pause();
            }
            const buffer = await loadAndDecodeAudio(url);
            
            // Check if user switched track or muted while decoding
            if (!isAudioEnabled || currentAudioTrack === "synth") {
                isAudioLoading = false;
                button.classList.remove("buffering");
                span.innerText = isAudioEnabled ? "Mute Audio" : "Enable Audio";
                return;
            }

            trackSource = audioCtx.createBufferSource();
            trackSource.buffer = buffer;
            trackSource.loop = true;

            // Connect: trackSource -> analyser -> trackGainNode -> destination
            trackSource.connect(audioAnalyser);
            audioAnalyser.connect(trackGainNode);

            // Scale track gain based on preset
            let targetGain = 0.25; // default
            if (currentWeatherPreset) {
                if (currentWeatherPreset.rainRate <= 0) targetGain = 0.001;
                else if (currentWeatherPreset.label.includes("2015")) targetGain = 0.45;
                else if (currentWeatherPreset.label.includes("Michaung")) targetGain = 0.40;
            }
            trackGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
            trackGainNode.gain.exponentialRampToValueAtTime(targetGain, audioCtx.currentTime + 1.0);

            trackSource.start();
            span.innerText = "Mute Audio";
        } catch (error) {
            console.error("Failed to play track:", error);
            alert("Error loading audio file. Falling back to Synthesized Storm.");
            currentAudioTrack = "synth";
            document.getElementById("audio-track-select").value = "synth";
            playCurrentTrack();
        } finally {
            isAudioLoading = false;
            button.classList.remove("buffering");
        }
    }
}

function initAudioEngine() {
    playCurrentTrack();
}

function updateAudioPresetLevels() {
    if (!audioCtx || !isAudioEnabled) return;
    const now = audioCtx.currentTime;

    let targetRainGain = 0.12; // default monsoon
    let targetWindGain = 0.06;
    let targetTrackGain = 0.25;

    if (currentWeatherPreset) {
        const rate = currentWeatherPreset.rainRate;
        if (rate <= 0) {
            targetRainGain = 0.001;
            targetWindGain = 0.002;
            targetTrackGain = 0.001;
        } else if (currentWeatherPreset.label.includes("2015")) {
            targetRainGain = 0.38;
            targetWindGain = 0.18;
            targetTrackGain = 0.45;
        } else if (currentWeatherPreset.label.includes("Michaung")) {
            targetRainGain = 0.30;
            targetWindGain = 0.22;
            targetTrackGain = 0.40;
        } else {
            targetRainGain = 0.14;
            targetWindGain = 0.08;
            targetTrackGain = 0.25;
        }
    }

    if (currentAudioTrack === "synth") {
        if (rainGainNode) {
            rainGainNode.gain.exponentialRampToValueAtTime(targetRainGain, now + 1.0);
        }
        if (windGainNode) {
            windGainNode.gain.exponentialRampToValueAtTime(targetWindGain, now + 1.2);
        }
    } else {
        if (window.location.protocol === "file:" && html5Audio) {
            html5Audio.volume = targetTrackGain;
        } else if (trackGainNode) {
            trackGainNode.gain.exponentialRampToValueAtTime(targetTrackGain, now + 1.0);
        }
    }
}

let scannerInterval = null;
let radarSoundInterval = null;

function playTouchSound() {
    if (!isAudioEnabled) return;
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.08);
    
    gainNode.gain.setValueAtTime(0.12, now); // Increased volume
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.08);
}

function startScannerSound() {
    if (!isAudioEnabled) return;
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    stopScannerSound();
    
    const playScanPulse = () => {
        if (!isAudioEnabled) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gainNode = audioCtx.createGain();
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(550, now + 0.4);
        
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.linearRampToValueAtTime(800, now + 0.4);
        filter.Q.value = 4.0;
        
        gainNode.gain.setValueAtTime(0.18, now); // Increased volume
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.45);
    };
    
    playScanPulse();
    scannerInterval = setInterval(playScanPulse, 600);
}

function stopScannerSound() {
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }
}

function playRiskLevelSound(riskClass) {
    if (!isAudioEnabled) return;
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    if (riskClass === 0) {
        // Low Risk: Ascending clean chime (C5 to G5)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        const gain2 = audioCtx.createGain();
        
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.15, now); // Increased volume
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.25);
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(783.99, now + 0.12);
        gain2.gain.setValueAtTime(0.15, now + 0.12); // Increased volume
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.4);
        
    } else if (riskClass === 1) {
        // Moderate Risk: Dual-tone warning chime (A4 to D5)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440.00, now);
        osc.frequency.setValueAtTime(587.33, now + 0.15);
        
        gainNode.gain.setValueAtTime(0.15, now); // Increased volume
        gainNode.gain.setValueAtTime(0.15, now + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
        
    } else if (riskClass === 2) {
        // High Risk: 3 short staccato alert beeps (650Hz)
        for (let i = 0; i < 3; i++) {
            const timeOffset = i * 0.18;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(650, now + timeOffset);
            
            gainNode.gain.setValueAtTime(0.20, now + timeOffset); // Increased volume
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.12);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.12);
        }
        
    } else if (riskClass === 3) {
        // Severe Risk: 2-cycle warbling high-pitched alarm sirens (850Hz to 1100Hz)
        const duration = 0.8;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.2);
        osc.frequency.linearRampToValueAtTime(850, now + 0.4);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.6);
        osc.frequency.linearRampToValueAtTime(850, now + 0.8);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);
        
        gainNode.gain.setValueAtTime(0.18, now); // Increased volume
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    }
}

function startRadarSound() {
    if (!isAudioEnabled) return;
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    stopRadarSound();
    
    const playRadarSweep = () => {
        if (!isAudioEnabled) return;
        const now = audioCtx.currentTime;
        
        // 1. Dual oscillators detuned by 6Hz for a metallic, ringing beat texture
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        
        // 2. Gain and feedback echo nodes
        const mainGain = audioCtx.createGain();
        const feedbackGain = audioCtx.createGain();
        
        // 3. Delay node for sonar ping echoes
        const delayNode = audioCtx.createDelay();
        delayNode.delayTime.setValueAtTime(0.35, now); // 350ms echo intervals
        
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(1150, now);
        osc1.frequency.exponentialRampToValueAtTime(1130, now + 1.2);
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1156, now);
        osc2.frequency.exponentialRampToValueAtTime(1136, now + 1.2);
        
        // Volume envelopes (fast attack, slow exponential decay)
        mainGain.gain.setValueAtTime(0.12, now);
        mainGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        
        feedbackGain.gain.setValueAtTime(0.38, now); // feedback gain for echoes
        
        // Connections
        osc1.connect(mainGain);
        osc2.connect(mainGain);
        mainGain.connect(audioCtx.destination); // original sound
        
        // Feedback delay loop
        mainGain.connect(delayNode);
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        feedbackGain.connect(audioCtx.destination); // echo output
        
        osc1.start(now);
        osc1.stop(now + 1.5);
        osc2.start(now);
        osc2.stop(now + 1.5);
    };
    
    playRadarSweep();
    radarSoundInterval = setInterval(playRadarSweep, 4000);
}

function stopRadarSound() {
    if (radarSoundInterval) {
        clearInterval(radarSoundInterval);
        radarSoundInterval = null;
    }
}

function playThunderRumble() {
    if (!audioCtx || !isAudioEnabled || currentAudioTrack !== "synth") return;

    const now = audioCtx.currentTime;
    const sampleRate = audioCtx.sampleRate;

    // Distant factor: smaller means closer and more massive blast!
    const distance = 0.05 + Math.random() * 0.3;
    const duration = 7.0 + Math.random() * 4.0; // long rolling tail (7 to 11 seconds)

    // Generate a single large buffer of Brownian noise for the rumble and boom
    const bufferSize = duration * sampleRate;
    const thunderBuffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = thunderBuffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 4.0; // gain boost
    }

    const thunderSource = audioCtx.createBufferSource();
    thunderSource.buffer = thunderBuffer;

    const rumbleFilter = audioCtx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(120, now);
    rumbleFilter.frequency.linearRampToValueAtTime(32, now + duration);

    const blastFilter = audioCtx.createBiquadFilter();
    blastFilter.type = "bandpass";
    blastFilter.frequency.setValueAtTime(90, now);
    blastFilter.Q.value = 1.0;

    const rumbleGain = audioCtx.createGain();
    const blastGain = audioCtx.createGain();

    const mainVol = 0.90 - distance * 0.40;
    const blastVol = 0.80 - distance * 0.50;

    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.exponentialRampToValueAtTime(mainVol * 0.2, now + 0.25);

    const boomTime = now + 0.25;
    rumbleGain.gain.exponentialRampToValueAtTime(mainVol, boomTime + 0.02);
    
    blastGain.gain.setValueAtTime(0.001, now);
    blastGain.gain.setValueAtTime(0.001, boomTime);
    blastGain.gain.exponentialRampToValueAtTime(blastVol, boomTime + 0.015);
    blastGain.gain.exponentialRampToValueAtTime(blastVol * 0.2, boomTime + 0.4);
    blastGain.gain.linearRampToValueAtTime(0.001, boomTime + 1.8);

    const rumbleStartTime = boomTime + 0.2;
    rumbleGain.gain.exponentialRampToValueAtTime(mainVol * 0.45, rumbleStartTime);
    
    const steps = 15;
    const rumbleDuration = duration - (rumbleStartTime - now);
    for (let s = 1; s <= steps; s++) {
        const timeOffset = rumbleStartTime + (s * rumbleDuration / steps);
        const progress = s / steps;
        const waver = 0.5 + 0.5 * Math.sin(s * 2.2) * (0.8 + Math.random() * 0.4);
        const currentVal = mainVol * 0.45 * (1.0 - progress) * waver;
        rumbleGain.gain.linearRampToValueAtTime(Math.max(0.001, currentVal), timeOffset);
    }
    rumbleGain.gain.linearRampToValueAtTime(0.001, now + duration);

    thunderSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(audioCtx.destination);

    const distortion = audioCtx.createWaveShaper();
    function makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0 ; i < n_samples; ++i ) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
        }
        return curve;
    }
    distortion.curve = makeDistortionCurve(70);
    distortion.oversample = '4x';

    thunderSource.connect(blastFilter);
    blastFilter.connect(distortion);
    distortion.connect(blastGain);
    blastGain.connect(audioCtx.destination);

    thunderSource.start(now);
    thunderSource.stop(now + duration);
}

// Audio Button Listener Toggle
document.getElementById("audio-toggle-btn").addEventListener("click", async () => {
    try {
        const button = document.getElementById("audio-toggle-btn");
        const span = button.querySelector("span");

        if (isAudioLoading) return;

        if (!isAudioEnabled) {
            isAudioEnabled = true;
            button.classList.add("enabled");
            span.innerText = "Mute Audio";
            await playCurrentTrack();
            
            // Resume radar sound if radar overlay is active
            if (radarLayer && map && map.hasLayer(radarLayer)) {
                startRadarSound();
            }
        } else {
            isAudioEnabled = false;
            button.classList.remove("enabled");
            span.innerText = "Enable Audio";
            
            if (html5Audio) {
                html5Audio.pause();
            }
            
            // Stop additional sounds
            stopRadarSound();
            stopScannerSound();
            
            const now = audioCtx ? audioCtx.currentTime : 0;
            if (audioCtx) {
                if (rainGainNode) rainGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                if (windGainNode) windGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                if (trackGainNode) trackGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                
                setTimeout(() => {
                    if (!isAudioEnabled && audioCtx) {
                        audioCtx.suspend();
                    }
                }, 400);
            }
        }
    } catch (e) {
        console.error("Audio toggle failed: ", e);
    }
});

// Audio Track Selector Change Listener
document.getElementById("audio-track-select").addEventListener("change", (e) => {
    currentAudioTrack = e.target.value;
    const button = document.getElementById("audio-toggle-btn");
    
    if (isAudioEnabled) {
        playCurrentTrack();
    } else {
        if (currentAudioTrack === "synth") {
            button.title = "Synthesizes sound of falling rain and distant storm thunder using programmatic Web Audio nodes.";
        } else {
            button.title = "Plays natural pre-recorded storm soundtrack and synchronizes visual animations.";
        }
    }
});

// Animation Button Listener Toggle
document.getElementById("animation-toggle-btn").addEventListener("click", () => {
    const button = document.getElementById("animation-toggle-btn");
    const span = button.querySelector("span");

    if (isAnimationEnabled) {
        isAnimationEnabled = false;
        button.classList.remove("enabled");
        span.innerText = "Enable Animation";
        
        // Clear rain canvas immediately
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    } else {
        isAnimationEnabled = true;
        button.classList.add("enabled");
        span.innerText = "Disable Animation";
    }
});

// ----------------------------------------------------
// SYSTEM HEALTH CHECK AND MODEL SYNCHRONIZATION
// ----------------------------------------------------
async function checkBackendHealth() {
    const statusBadge = document.getElementById("backend-status");
    const statusDot = statusBadge.querySelector(".pulse-dot");
    const statusText = statusBadge.querySelector("span");

    try {
        const response = await fetch("http://localhost:8000/health");
        if (response.ok) {
            const data = await response.json();
            if (data.models_loaded) {
                statusText.innerText = "AI System Live";
                statusBadge.style.background = "rgba(29, 158, 117, 0.12)";
                statusBadge.style.borderColor = "rgba(29, 158, 117, 0.25)";
                statusBadge.style.color = "#9FE1CB";
                statusDot.style.background = "#1D9E75";
                isOfflineMode = false;
                document.getElementById("offline-warning-banner").classList.remove("active");
                return;
            }
        }
        throw new Error("Backend invalid configuration or models not ready");
    } catch (e) {
        console.warn("FastAPI offline fallback initiated.", e);
        statusText.innerText = "Local Fallback Mode";
        statusBadge.style.background = "rgba(186, 117, 23, 0.12)";
        statusBadge.style.borderColor = "rgba(186, 117, 23, 0.25)";
        statusBadge.style.color = "#FAC775";
        statusDot.style.background = "#BA7517";
        isOfflineMode = true;
        document.getElementById("offline-warning-banner").classList.add("active");
    }
}
// Initial run
checkBackendHealth();

// ----------------------------------------------------
// CHART GENERATION HELPER
// ----------------------------------------------------
function updateForecastChart(forecastData) {
    const canvasElement = document.getElementById("forecastChart");
    if (!canvasElement) return;

    // Clear old chart to prevent state conflicts
    if (forecastChartInstance) {
        forecastChartInstance.destroy();
    }

    const labels = forecastData.map(d => d.time);
    const rainData = forecastData.map(d => d.rainfall_mm);
    const riskData = forecastData.map(d => d.risk_pct);

    // Calculate cumulative sum curve
    let accumulator = 0;
    const cumulativeData = rainData.map(val => {
        accumulator += val;
        return Math.round(accumulator);
    });

    forecastChartInstance = new Chart(canvasElement, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Hourly Precipitation (mm/h)",
                    type: "bar",
                    data: rainData,
                    borderColor: "#22d3ee",
                    backgroundColor: "rgba(34, 211, 238, 0.4)",
                    borderWidth: 1.5,
                    yAxisID: "yRate",
                    order: 2
                },
                {
                    label: "Cumulative Accumulation (mm)",
                    type: "line",
                    data: cumulativeData,
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3,
                    yAxisID: "yCumulative",
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ffffff",
                        font: { family: "Outfit", size: 12 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.08)" },
                    ticks: { color: "#ffffff", font: { family: "Outfit" } }
                },
                yRate: {
                    type: "linear",
                    position: "left",
                    title: { display: true, text: "Hourly Rate (mm/hr)", color: "#22d3ee" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#22d3ee" },
                    min: 0
                },
                yCumulative: {
                    type: "linear",
                    position: "right",
                    title: { display: true, text: "Cumulative Volume (mm)", color: "#10b981" },
                    grid: { drawOnChartArea: false }, // avoid overlapping grids
                    ticks: { color: "#10b981" },
                    min: 0
                }
            }
        }
    });
}

// Helper to update bottom wave animation severity class
function updateWaveSeverityClass(prob) {
    const waveContainer = document.querySelector(".flood-waves-container");
    const body = document.body;
    const states = ["state-low", "state-moderate", "state-high", "state-severe"];
    
    // Reset all state classes
    if (waveContainer) waveContainer.classList.remove(...states);
    if (body) body.classList.remove(...states);
    
    let activeState = "state-low";
    if (prob >= 75) {
        activeState = "state-severe";
    } else if (prob >= 50) {
        activeState = "state-high";
    } else if (prob >= 25) {
        activeState = "state-moderate";
    }
    
    if (waveContainer) waveContainer.classList.add(activeState);
    if (body) body.classList.add(activeState);
}

// ----------------------------------------------------
// RENDER OUTPUT DETAILS
// ----------------------------------------------------
function displayPredictionOutput(data) {
    // Update bottom waves based on predicted neighborhood risk level
    updateWaveSeverityClass(data.flood_probability);

    // Play distinctive risk level sound
    playRiskLevelSound(data.risk_class);

    // 1. Show results block
    const resultsBlock = document.getElementById("predict-results-block");
    resultsBlock.classList.add("show");

    // 2. Set Risk Level Banner Styles
    const banner = document.getElementById("results-banner");
    const bannerTitle = document.getElementById("banner-risk-level");
    const bannerSummary = document.getElementById("banner-risk-summary");
    const bannerIcon = document.getElementById("results-banner-icon");

    banner.className = "status-banner"; // reset
    let bannerSvg = "";

    const prob = data.flood_probability;

    if (prob >= 75) {
        banner.classList.add("risk-severe");
        bannerTitle.innerText = "🔴 SEVERE RISK ALERT";
        bannerSummary.innerText = "Severe inundation and runoff flooding imminent. Drainage networks fully saturated. Travel is hazardous.";
        bannerSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
        document.getElementById("val-risk-pct").style.color = "var(--risk-severe)";
    } else if (prob >= 50) {
        banner.classList.add("risk-high");
        bannerTitle.innerText = "🟠 HIGH RISK WARNING";
        bannerSummary.innerText = "Significant runoff accumulation. Localized street-level waterlogging expected on secondary networks.";
        bannerSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
        document.getElementById("val-risk-pct").style.color = "var(--risk-high)";
    } else if (prob >= 25) {
        banner.classList.add("risk-moderate");
        bannerTitle.innerText = "🟡 MODERATE RISK ADVISORY";
        bannerSummary.innerText = "Monsoon runoff active. Silt-carrying stormwater structures running near design capacities.";
        bannerSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
        document.getElementById("val-risk-pct").style.color = "var(--risk-moderate)";
    } else {
        banner.classList.add("risk-low");
        bannerTitle.innerText = "🟢 LOW RISK ALERT";
        bannerSummary.innerText = "No active waterlogging risks calculated. Microdrainage channels operating within safe parameters.";
        bannerSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
        document.getElementById("val-risk-pct").style.color = "var(--risk-low)";
    }

    bannerIcon.innerHTML = bannerSvg;

    // 3. Set Quantitative Metric Value texts
    document.getElementById("val-risk-pct").innerText = `${data.flood_probability}%`;
    document.getElementById("val-rain-dur").innerText = `${data.rain_duration_hours}h`;
    document.getElementById("val-cum-rain").innerText = `${data.total_rainfall_expected} mm`;
    document.getElementById("val-peak-rate").innerText = `${data.peak_intensity_mmhr} mm/h`;

    // 4. Fill Forecast Scrolling Cards Row
    const forecastContainer = document.getElementById("forecast-cards-container");
    forecastContainer.innerHTML = ""; // reset

    data.forecast.forEach(item => {
        const card = document.createElement("div");
        card.className = "forecast-card";

        let badgeClass = "var(--risk-low-bg)";
        let badgeColor = "var(--risk-low-text)";
        let badgeText = "Low";

        if (item.risk_pct >= 75) {
            badgeClass = "var(--risk-severe-bg)";
            badgeColor = "var(--risk-severe-text)";
            badgeText = "Severe";
        } else if (item.risk_pct >= 50) {
            badgeClass = "var(--risk-high-bg)";
            badgeColor = "var(--risk-high-text)";
            badgeText = "High";
        } else if (item.risk_pct >= 25) {
            badgeClass = "var(--risk-moderate-bg)";
            badgeColor = "var(--risk-moderate-text)";
            badgeText = "Moderate";
        }

        card.innerHTML = `
            <div class="forecast-time">${item.time}</div>
            <div class="forecast-val">${item.rainfall_mm} <span style="font-size:10px; font-weight:normal;">mm/h</span></div>
            <div class="forecast-prob">Risk: ${item.risk_pct}%</div>
            <span class="forecast-badge" style="background: ${badgeClass}; color: ${badgeColor};">${badgeText}</span>
        `;
        forecastContainer.appendChild(card);
    });

    // 5. Fill Chart.js Dual Axis Canvas
    updateForecastChart(data.forecast);

    // 6. Fill SHAP Explanations list
    const shapContainer = document.getElementById("shap-reasons-container");
    shapContainer.innerHTML = "";
    data.shap_reasons.forEach(reason => {
        const div = document.createElement("div");
        div.className = "shap-row";
        div.innerText = reason;
        shapContainer.appendChild(div);
    });

    // 7. Fill recommendations list
    const recsContainer = document.getElementById("consequences-container");
    recsContainer.innerHTML = "";
    data.consequences.forEach(consequence => {
        const div = document.createElement("div");
        div.className = "consequence-item";
        div.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color);">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${escapeHTML(consequence)}</span>
        `;
        recsContainer.appendChild(div);
    });

    // 8. Trigger Emergency Alert simulation if risk is High or Severe
    if (data.risk_class >= 2) {
        const riskClassLabel = data.risk_class === 3 ? "severe" : "high";
        showToast(
            `🚨 ${data.risk_level.toUpperCase()} WARNING`,
            `${data.area} has been evaluated at ${data.risk_level} (${data.flood_probability}% probability).`,
            riskClassLabel
        );
        
        if (hasActiveAlertSubscription) {
            setTimeout(() => {
                triggerSMSSimulation(data.area, data.risk_level, data.flood_probability);
            }, 1200);
        }
    }
}

// ----------------------------------------------------
// AMBER CLIENT SIDE EVALUATION MODE
// ----------------------------------------------------
function executeOfflinePrediction(areaName, customCoordinates = null) {
    // 1. Resolve area geological constant parameters
    let matchedArea = null;
    let lat = null;
    let lon = null;

    if (customCoordinates) {
        lat = customCoordinates.lat;
        lon = customCoordinates.lon;
        
        const isWithinChennai = (lat >= 12.75 && lat <= 13.35) && (lon >= 79.95 && lon <= 80.4);
        if (!isWithinChennai) {
            throw new Error("LocationNotFound");
        }
        
        // Find closest geographic neighborhood
        let minDist = Infinity;
        for (const name in AREAS_DB) {
            const area = AREAS_DB[name];
            const dist = Math.sqrt(Math.pow(area.lat - lat, 2) + Math.pow(area.lon - lon, 2));
            if (dist < minDist) {
                minDist = dist;
                matchedArea = name;
            }
        }
    } else if (areaName) {
        // Find match inside keys
        for (const name in AREAS_DB) {
            if (name.toLowerCase().includes(areaName.toLowerCase()) || areaName.toLowerCase().includes(name.toLowerCase())) {
                matchedArea = name;
                break;
            }
        }
    }

    if (!matchedArea) {
        throw new Error("LocationNotFound");
    }

    const geo = AREAS_DB[matchedArea];
    if (lat === null) lat = geo.lat;
    if (lon === null) lon = geo.lon;

    // 2. Perform mock weather simulation calculations
    let currentRainRate, cumulative72h, soilMoisture, tideLevel, isMonsoon;

    if (currentWeatherPreset) {
        currentRainRate = currentWeatherPreset.rainRate;
        cumulative72h = currentWeatherPreset.cumulative;
        soilMoisture = currentWeatherPreset.soilMoisture;
        tideLevel = currentWeatherPreset.tideLevel;
        isMonsoon = currentWeatherPreset.isMonsoon ? 1 : 0;
    } else {
        const currentMonth = new Date().getMonth() + 1; // 1-12
        isMonsoon = [10, 11, 12].includes(currentMonth) ? 1 : 0;
        currentRainRate = isMonsoon ? 18.0 : 0.0;
        cumulative72h = currentRainRate * 4.2 + (isMonsoon ? 80.0 : 0.0);
        soilMoisture = Math.min(1.0, 0.2 + (cumulative72h / 240.0));
        tideLevel = 0.8 + 0.4 * Math.sin(Date.now() / 3600000.0);
    }


    // 3. Hydrological rule based risk prediction logic
    let riskClass = 0; // 0: Safe, 1: Low, 2: High
    if (cumulative72h >= 120 && geo.elevation < 8.0) {
        riskClass = 2;
    } else if (cumulative72h >= 60 || geo.elevation < 5.0) {
        riskClass = 1;
    }

    const floodProb = riskClass === 2 ? 85 + Math.floor(Math.random() * 11) :
                      riskClass === 1 ? 35 + Math.floor(Math.random() * 30) :
                      5 + Math.floor(Math.random() * 18);

    let riskLevel = "Low Risk";
    let finalRiskClass = 0;
    if (floodProb >= 75) {
        riskLevel = "Severe Risk";
        finalRiskClass = 3;
    } else if (floodProb >= 50) {
        riskLevel = "High Risk";
        finalRiskClass = 2;
    } else if (floodProb >= 25) {
        riskLevel = "Moderate Risk";
        finalRiskClass = 1;
    }

    const predictedDuration = isMonsoon ? 24 + Math.floor(Math.random() * 12) : 0;

    // Simulate 48h LSTM forecast decays
    const forecastTimes = ["6h", "12h", "18h", "24h", "36h", "48h"];
    // Decay values
    const multipliers = [0.8, 0.6, 0.4, 0.3, 0.1, 0.0];
    const forecastList = [{ time: "Now", rainfall_mm: Math.round(currentRainRate), risk_pct: floodProb }];

    forecastTimes.forEach((lbl, idx) => {
        const rate = Math.round(currentRainRate * multipliers[idx]);
        const cum = cumulative72h + rate;
        let futureRiskClass = 0;
        if (cum >= 120 && geo.elevation < 8.0) futureRiskClass = 2;
        else if (cum >= 60 || geo.elevation < 5.0) futureRiskClass = 1;

        const futureProb = futureRiskClass === 2 ? 80 + Math.floor(Math.random() * 15) :
                             futureRiskClass === 1 ? 30 + Math.floor(Math.random() * 35) :
                             5 + Math.floor(Math.random() * 15);

        forecastList.push({
            time: lbl,
            rainfall_mm: rate,
            risk_pct: futureProb
        });
    });

    const totalRainfallExpected = Math.round(currentRainRate + forecastList.reduce((acc, curr) => acc + (curr.time !== "Now" ? curr.rainfall_mm : 0), 0));
    const peakIntensity = Math.round(Math.max(currentRainRate, ...forecastList.map(i => i.rainfall_mm)));

    // SHAP explanation mock arrays
    const shapReasons = [
        `Elevation: ${geo.elevation}m → ${geo.elevation < 6.0 ? "+24% risk spike (Low-lying lowland)" : "-12% risk dampening (Elevated)"}`,
        `72h Accumulation: ${cumulative72h.toFixed(1)}mm → ${cumulative72h > 100 ? "+32% surge factor (Deep soil saturation)" : "+4% (Negligible loading)"}`,
        `Drainage Outlet Capacity: ${(geo.drainage * 100).toFixed(0)}% → ${geo.drainage < 0.3 ? "+18% clearing delay (Marsh basin)" : "-8% standard hydraulic clearance"}`
    ];

    // Recommendations lists
    let consequences = [];
    if (riskClass === 2) {
        consequences = [
            "Severe waterlogging on roads — avoid all travel",
            "Ground floor flooding likely — move valuables above 3ft immediately",
            "Do not start vehicles in flooded zones",
            "Switch off mains power if water enters home",
            "Follow NDRF and local corporation evacuation alerts"
        ];
    } else if (riskClass === 1) {
        consequences = [
            "Moderate waterlogging at low-lying crossings",
            "Drainage systems operating at critical threshold",
            "Drive with caution; watch for open stormwater drains",
            "Check basements for seepage and run pumps if needed"
        ];
    } else {
        consequences = [
            "No immediate flood risk detected",
            "Stay alert for general monsoon updates",
            "Ensure roof drain pipes are clear of debris"
        ];
    }

    return {
        elevation_m: Math.round(geo.elevation),
        drainage_capacity: geo.drainage,
        risk_level: riskLevel,
        risk_class: finalRiskClass,
        flood_probability: floodProb,
        rain_duration_hours: predictedDuration,
        total_rainfall_expected: totalRainfallExpected,
        peak_intensity_mmhr: peakIntensity,
        current_rainfall_mmhr: Math.round(currentRainRate),
        forecast: forecastList,
        shap_reasons: shapReasons,
        consequences: consequences,
        area: matchedArea,
        coordinates: { lat, lon }
    };
}

// ----------------------------------------------------
// EVENT HANDLERS & INPUT LISTENER ORCHESTRATION
// ----------------------------------------------------
const predictBtn = document.getElementById("predict-risk-btn");
const gpsBtn = document.getElementById("gps-locate-btn");
const areaInput = document.getElementById("area-input");
const loadingMask = document.getElementById("loading-mask");
const loadingMsg = document.getElementById("loading-msg");

async function handlePredictionRequest() {
    const areaName = areaInput.value.trim();
    
    // Check if input is empty
    if (!areaName) {
        alert("Please enter a valid Chennai neighborhood or use GPS Location.");
        return;
    }

    // Activate loading mask
    loadingMsg.innerText = "Querying regional sensor grid...";
    loadingMask.classList.add("active");

    // Re-verify backend health asynchronously in case it woke up
    await checkBackendHealth();

    if (isOfflineMode) {
        // Run simulated client-side logic
        setTimeout(() => {
            try {
                const results = executeOfflinePrediction(areaName);
                displayPredictionOutput(results);
                
                // Pan map
                if (map && results.coordinates) {
                    map.setView([results.coordinates.lat, results.coordinates.lon], 13);
                    if (mapMarkers[results.area]) {
                        mapMarkers[results.area].openPopup();
                    }
                }
            } catch (err) {
                console.error("Local calculation failed: ", err);
                if (err.message === "LocationNotFound") {
                    alert("The entered neighborhood was not found or is outside the Chennai Metropolitan area.");
                } else {
                    alert("Error during local prediction logic calculation.");
                }
            } finally {
                loadingMask.classList.remove("active");
            }
        }, 800); // simulated slight delay
    } else {
        // Execute API fetch
        try {
            // First geocode the neighborhood name to get coords
            const geocodeRes = await fetch(`http://localhost:8000/geocode?area_name=${encodeURIComponent(areaName)}`);
            if (!geocodeRes.ok) {
                throw new Error("Geocoding neighborhood failed.");
            }
            const coords = await geocodeRes.json();

            // Check if coordinates are within Chennai Metropolitan Area boundaries
            const isWithinChennai = (coords.lat >= 12.75 && coords.lat <= 13.35) && (coords.lon >= 79.95 && coords.lon <= 80.4);
            if (!isWithinChennai) {
                alert("The entered neighborhood is outside the Chennai Metropolitan hydrological zone. This model only supports flood predictions within the Chennai region.");
                loadingMask.classList.remove("active");
                return;
            }

            // Call prediction endpoint with potential overrides
            const bodyObj = {
                area_name: areaName,
                latitude: coords.lat,
                longitude: coords.lon
            };
            if (currentWeatherPreset) {
                bodyObj.current_rainfall = currentWeatherPreset.rainRate;
                bodyObj.cumulative_rainfall_72h = currentWeatherPreset.cumulative;
                bodyObj.soil_moisture = currentWeatherPreset.soilMoisture;
                bodyObj.tide_level = currentWeatherPreset.tideLevel;
                bodyObj.is_monsoon = currentWeatherPreset.isMonsoon ? 1 : 0;
            }

            const predictRes = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyObj)
            });

            if (predictRes.status === 400) {
                const errData = await predictRes.json();
                alert(errData.detail || "Location is outside the Chennai Metropolitan area.");
                loadingMask.classList.remove("active");
                return;
            }

            if (!predictRes.ok) {
                throw new Error("Prediction API call returned failure code.");
            }

            const data = await predictRes.json();
            displayPredictionOutput(data);

            // Pan map
            if (map && data.coordinates) {
                map.setView([data.coordinates.lat, data.coordinates.lon], 13);
                if (mapMarkers[data.area]) {
                    mapMarkers[data.area].openPopup();
                }
            }

            // Deactivate loading mask on success
            loadingMask.classList.remove("active");

        } catch (e) {
            console.error("API Prediction failed, falling back locally: ", e);
            // Dynamic fallback on error
            try {
                const data = executeOfflinePrediction(areaName);
                displayPredictionOutput(data);
                
                // Pan map
                if (map && data.coordinates) {
                    map.setView([data.coordinates.lat, data.coordinates.lon], 13);
                    if (mapMarkers[data.area]) {
                        mapMarkers[data.area].openPopup();
                    }
                }
            } catch (err) {
                if (err.message === "LocationNotFound") {
                    alert("The entered neighborhood was not found or is outside the Chennai Metropolitan area.");
                } else {
                    alert("Evaluation error occurred. Check network connection.");
                }
            } finally {
                loadingMask.classList.remove("active");
            }
        }
    }
}

async function handleGPSRequest() {
    if (!navigator.geolocation) {
        alert("Geolocation sensors not supported by this browser.");
        return;
    }

    loadingMsg.innerText = "Locating GPS coordinates...";
    loadingMask.classList.add("active");

    const proceedWithCoords = async (lat, lon) => {
        // Re-verify backend health asynchronously in case it woke up
        await checkBackendHealth();

        if (isOfflineMode) {
            // Evaluate using local constants closest to coordinates
            setTimeout(() => {
                try {
                    const results = executeOfflinePrediction(null, { lat, lon });
                    areaInput.value = results.area;
                    displayPredictionOutput(results);
                    
                    // Pan map
                    if (map && results.coordinates) {
                        map.setView([results.coordinates.lat, results.coordinates.lon], 13);
                        if (mapMarkers[results.area]) {
                            mapMarkers[results.area].openPopup();
                        }
                    }
                } catch (err) {
                    alert("Geological coordinate processing failed.");
                } finally {
                    loadingMask.classList.remove("active");
                }
            }, 800);
        } else {
            try {
                // Call predict directly using coordinates and potential overrides
                const bodyObj = {
                    latitude: lat,
                    longitude: lon
                };
                if (currentWeatherPreset) {
                    bodyObj.current_rainfall = currentWeatherPreset.rainRate;
                    bodyObj.cumulative_rainfall_72h = currentWeatherPreset.cumulative;
                    bodyObj.soil_moisture = currentWeatherPreset.soilMoisture;
                    bodyObj.tide_level = currentWeatherPreset.tideLevel;
                    bodyObj.is_monsoon = currentWeatherPreset.isMonsoon ? 1 : 0;
                }

                const predictRes = await fetch("http://localhost:8000/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bodyObj)
                });

                if (!predictRes.ok) {
                    throw new Error("Coordinate prediction request failed.");
                }

                const data = await predictRes.json();
                areaInput.value = data.area;
                displayPredictionOutput(data);

                // Pan map
                if (map && data.coordinates) {
                    map.setView([data.coordinates.lat, data.coordinates.lon], 13);
                    if (mapMarkers[data.area]) {
                        mapMarkers[data.area].openPopup();
                    }
                }

            } catch (e) {
                console.error("API geolocation fetch failed, falling back locally: ", e);
                try {
                    const data = executeOfflinePrediction(null, { lat, lon });
                    areaInput.value = data.area;
                    displayPredictionOutput(data);
                    
                    // Pan map
                    if (map && data.coordinates) {
                        map.setView([data.coordinates.lat, data.coordinates.lon], 13);
                        if (mapMarkers[data.area]) {
                            mapMarkers[data.area].openPopup();
                        }
                    }
                } catch (err) {
                    alert("Error parsing regional coordinate grids.");
                }
            } finally {
                loadingMask.classList.remove("active");
            }
        }
    };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Check if user is within Chennai Metropolitan Area boundaries
            const isWithinChennai = (lat >= 12.75 && lat <= 13.35) && (lon >= 79.95 && lon <= 80.4);
            if (!isWithinChennai) {
                const useMock = confirm("Your GPS coordinates (" + lat.toFixed(4) + ", " + lon.toFixed(4) + ") are outside the Chennai Metropolitan hydrological zone.\n\nWould you like to simulate a GPS location inside Chennai (Velachery) for testing?");
                if (useMock) {
                    await proceedWithCoords(12.9815, 80.2180);
                } else {
                    loadingMask.classList.remove("active");
                }
                return;
            }

            await proceedWithCoords(lat, lon);
        },
        async (error) => {
            console.warn("Geolocation query failed: ", error.message, "trying IP geolocation fallback...");
            
            try {
                const ipRes = await fetch("http://localhost:8000/geocode/ip");
                if (ipRes.ok) {
                    const ipData = await ipRes.json();
                    const lat = ipData.lat;
                    const lon = ipData.lon;
                    
                    // Check if geolocated coordinates are within Chennai Metropolitan Area boundaries
                    const isWithinChennai = (lat >= 12.75 && lat <= 13.35) && (lon >= 79.95 && lon <= 80.4);
                    if (isWithinChennai) {
                        await proceedWithCoords(lat, lon);
                        return;
                    } else {
                        const useMock = confirm(`Your IP coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)}) locate you in ${ipData.city}, ${ipData.region}, which is outside the Chennai zone.\n\nWould you like to simulate a GPS location inside Chennai (Velachery) for testing?`);
                        if (useMock) {
                            await proceedWithCoords(12.9815, 80.2180);
                        } else {
                            loadingMask.classList.remove("active");
                        }
                        return;
                    }
                }
            } catch (ipErr) {
                console.warn("Backend IP geolocation failed, trying direct public geocoder...");
                try {
                    const directRes = await fetch("https://ipapi.co/json/");
                    if (directRes.ok) {
                        const ipData = await directRes.json();
                        const lat = ipData.latitude;
                        const lon = ipData.longitude;
                        
                        const isWithinChennai = (lat >= 12.75 && lat <= 13.35) && (lon >= 79.95 && lon <= 80.4);
                        if (isWithinChennai) {
                            await proceedWithCoords(lat, lon);
                            return;
                        } else {
                            const useMock = confirm(`Your IP coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)}) locate you in ${ipData.city || 'unknown'}, ${ipData.region || 'unknown'}, which is outside the Chennai zone.\n\nWould you like to simulate a GPS location inside Chennai (Velachery) for testing?`);
                            if (useMock) {
                                await proceedWithCoords(12.9815, 80.2180);
                            } else {
                                loadingMask.classList.remove("active");
                            }
                            return;
                        }
                    }
                } catch (directErr) {
                    console.error("Direct public IP geolocation failed: ", directErr);
                }
            }
            
            let errMsg = "Unable to retrieve your location.";
            if (error.code === error.PERMISSION_DENIED) {
                errMsg = "Location access denied by user.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errMsg = "Location information is unavailable.";
            } else if (error.code === error.TIMEOUT) {
                errMsg = "Location request timed out.";
            }
            
            const useMock = confirm(errMsg + "\n\nWould you like to simulate a GPS location inside Chennai (Velachery) for testing?");
            if (useMock) {
                await proceedWithCoords(12.9815, 80.2180);
            } else {
                loadingMask.classList.remove("active");
            }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
}

// ----------------------------------------------------
// INTERACTIVE SPATIAL MAP (LEAFLET.JS)
// ----------------------------------------------------
function initLeafletMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement || map) return;

    // Centered in Chennai [13.03, 80.22]
    map = L.map("map", {
        center: [13.03, 80.22],
        zoom: 11.5,
        zoomControl: true,
        attributionControl: false
    });

    // Dark-themed tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19
    }).addTo(map);

    // Create circle markers for each area
    for (const name in AREAS_DB) {
        const area = AREAS_DB[name];
        const marker = L.circleMarker([area.lat, area.lon], {
            radius: 8,
            fillColor: "var(--safe-text)",
            color: "var(--safe-text)",
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.55
        }).addTo(map);

        // Click handler: fill search field and trigger evaluate
        marker.on("click", () => {
            areaInput.value = name;
            handlePredictionRequest();
        });

        // Store marker reference
        mapMarkers[name] = marker;
    }

    // Add premium dark/glass theme legend control
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'leaflet-legend');
        const colors = ["#1D9E75", "#FAC775", "#F59E0B", "#E24B4A"];
        const labels = ["🟢 Low Risk (<25%)", "🟡 Moderate Risk (25-50%)", "🟠 High Risk (50-75%)", "🔴 Severe Risk (>=75%)"];

        div.innerHTML = '<strong style="display:block; margin-bottom: 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;">Flood Risk Index</strong>';

        for (let i = 0; i < colors.length; i++) {
            div.innerHTML += `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <i style="background: ${colors[i]}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255, 255, 255, 0.2);"></i>
                    <span>${labels[i]}</span>
                </div>
            `;
        }
        return div;
    };
    legend.addTo(map);

    // Initialize custom canvas weather radar overlay
    radarLayer = new L.RadarOverlay();
    radarLayer.addTo(map);
}

function updateSpatialMapAndCitySnapshot() {
    let totalRisk = 0;
    let severeCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    
    // Evaluate all areas
    for (const name in AREAS_DB) {
        const results = executeOfflinePrediction(name);
        const prob = results.flood_probability;
        totalRisk += prob;
        
        if (prob >= 75) {
            severeCount++;
        } else if (prob >= 50) {
            highCount++;
        } else if (prob >= 25) {
            moderateCount++;
        } else {
            lowCount++;
        }
        
        // Update Leaflet circle marker color and tooltip
        if (mapMarkers[name]) {
            let color = "var(--risk-low)"; // default Low
            let label = "Low Risk";
            if (prob >= 75) {
                color = "var(--risk-severe)";
                label = "Severe Risk";
            } else if (prob >= 50) {
                color = "var(--risk-high)";
                label = "High Risk";
            } else if (prob >= 25) {
                color = "var(--risk-moderate)";
                label = "Moderate Risk";
            }
            
            mapMarkers[name].setStyle({
                color: color,
                fillColor: color
            });
            
            // Bind popups
            mapMarkers[name].bindPopup(`
                <div style="font-family: var(--font-sans); color: #fff;">
                    <strong style="font-size: 13px;">${name}</strong>
                    <div style="font-size: 11px; margin-top: 4px; opacity: 0.85;">
                        Elevation: <strong>${results.elevation_m}m</strong><br>
                        Drainage: <strong>${(results.drainage_capacity * 100).toFixed(0)}%</strong><br>
                        Flood Probability: <strong style="color: ${color};">${prob}%</strong>
                    </div>
                    <div style="font-size: 9px; margin-top: 6px; text-transform: uppercase; color: ${color}; font-weight: bold;">
                        ${label}
                    </div>
                </div>
            `);
        }
    }
    
    // Calculate average city risk
    const avgRisk = Math.round(totalRisk / Object.keys(AREAS_DB).length);
    
    // Update bottom waves to match the average city risk level
    updateWaveSeverityClass(avgRisk);

    const avgEl = document.getElementById("city-avg-risk");
    if (avgEl) {
        avgEl.innerText = `${avgRisk}%`;
        if (avgRisk >= 75) {
            avgEl.style.color = "var(--risk-severe)";
        } else if (avgRisk >= 50) {
            avgEl.style.color = "var(--risk-high)";
        } else if (avgRisk >= 25) {
            avgEl.style.color = "var(--risk-moderate)";
        } else {
            avgEl.style.color = "var(--risk-low)";
        }
    }
    
    // Set status description text
    const statusText = document.getElementById("city-status-text");
    if (statusText) {
        let presetDesc = activePresetName ? `<strong>[${escapeHTML(activePresetName.toUpperCase())}]</strong> ` : "";
        if (avgRisk >= 75) {
            statusText.innerHTML = `${presetDesc}City condition: <span style="color: var(--risk-severe); font-weight: bold;">🔴 SEVERE RISK</span>. Extreme waterlogging imminent. ${severeCount} zones in Severe state.`;
        } else if (avgRisk >= 50) {
            statusText.innerHTML = `${presetDesc}City condition: <span style="color: var(--risk-high); font-weight: bold;">🟠 HIGH RISK</span>. Widespread flooding. ${highCount} zones under high risk.`;
        } else if (avgRisk >= 25) {
            statusText.innerHTML = `${presetDesc}City condition: <span style="color: var(--risk-moderate); font-weight: bold;">🟡 MODERATE RISK</span>. Localized waterlogging. ${moderateCount} zones under moderate risk.`;
        } else {
            statusText.innerHTML = `${presetDesc}City condition: <span style="color: var(--risk-low); font-weight: bold;">🟢 LOW RISK</span>. City is stable. All ${lowCount} zones operating normally.`;
        }
    }
}

// ----------------------------------------------------
// LIVE SENSOR TELEMETRY FEED SIMULATION
// ----------------------------------------------------
const TELEMETRY_STATIONS = [
    { name: "Adyar River (Guindy Bridge)", param: "Water Level", unit: "m", minVal: 1.0, maxVal: 4.8, alertVal: 3.5, val: 1.2 },
    { name: "Cooum River (Choolaimedu)", param: "Water Level", unit: "m", minVal: 0.8, maxVal: 3.9, alertVal: 2.8, val: 1.0 },
    { name: "Buckingham Canal (Kotturpuram)", param: "Flow Velocity", unit: "m/s", minVal: 0.2, maxVal: 2.5, alertVal: 1.8, val: 0.4 },
    { name: "Velachery Drainage Sluice 4", param: "Silt Saturation", unit: "%", minVal: 15, maxVal: 95, alertVal: 75, val: 28 },
    { name: "Pallikaranai Marsh Inflow", param: "Discharge Volume", unit: "kL/s", minVal: 50, maxVal: 850, alertVal: 600, val: 120 },
    { name: "Nungambakkam Central Gauge", param: "Rain Intensity", unit: "mm/h", minVal: 0, maxVal: 45, alertVal: 25, val: 0 },
    { name: "Madipakkam Soil Sensor Grid", param: "Soil Saturation", unit: "%", minVal: 30, maxVal: 98, alertVal: 85, val: 42 }
];

function updateTelemetryFeed() {
    const container = document.getElementById("telemetry-feed-container");
    if (!container) return;
    
    // Clear
    container.innerHTML = "";
    
    // Weather factor scales telemetry up or down based on current rain rate
    let multiplier = 1.0;
    if (currentWeatherPreset) {
        multiplier = 0.5 + (currentWeatherPreset.rainRate / 10.0);
    } else {
        const currentMonth = new Date().getMonth() + 1;
        if ([10, 11, 12].includes(currentMonth)) multiplier = 2.0; // monsoon active
    }
    
    TELEMETRY_STATIONS.forEach(station => {
        // Add random slight variation
        let variance = (Math.random() - 0.5) * (station.maxVal - station.minVal) * 0.08;
        let baseline = station.minVal + (station.maxVal - station.minVal) * 0.18 * multiplier;
        station.val = Math.max(station.minVal, Math.min(station.maxVal, baseline + variance));
        
        // Round for readability
        let displayVal = station.val.toFixed(station.unit === "%" || station.unit === "mm/h" ? 0 : 2);
        
        let color = "var(--safe-text)";
        let pulseColor = "#1D9E75";
        if (station.val >= station.alertVal) {
            color = "var(--high-text)";
            pulseColor = "#e24b4a";
        } else if (station.val >= station.alertVal * 0.6) {
            color = "var(--low-text)";
            pulseColor = "#BA7517";
        }
        
        const item = document.createElement("div");
        item.className = "telemetry-item";
        item.innerHTML = `
            <div class="telemetry-name">
                <strong>${escapeHTML(station.name)}</strong>
                <span style="font-size: 9px; opacity: 0.65; display: block;">${escapeHTML(station.param)}</span>
            </div>
            <div class="telemetry-value-box">
                <span class="telemetry-val" style="color: ${color};">${displayVal} ${escapeHTML(station.unit)}</span>
                <div class="telemetry-pulse" style="background: ${pulseColor}; box-shadow: 0 0 4px ${pulseColor};"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

// ----------------------------------------------------
// HISTORICAL WEATHER PRESETS INTERACTION
// ----------------------------------------------------
function handlePresetClick(e) {
    const presetName = e.currentTarget.getAttribute("data-preset");
    const PRESETS = {
        "clear": { rainRate: 0.0, cumulative: 0.0, soilMoisture: 0.15, tideLevel: 0.4, isMonsoon: 0, windSpeed: 5.0, label: "Clear Summer" },
        "monsoon": { rainRate: 12.0, cumulative: 60.0, soilMoisture: 0.65, tideLevel: 0.8, isMonsoon: 1, windSpeed: 45.0, label: "Monsoon Baseline" },
        "deluge_2015": { rainRate: 35.0, cumulative: 220.0, soilMoisture: 0.98, tideLevel: 1.1, isMonsoon: 1, windSpeed: 75.0, label: "2015 Deluge" },
        "michaung_2023": { rainRate: 28.0, cumulative: 145.0, soilMoisture: 0.92, tideLevel: 1.6, isMonsoon: 1, windSpeed: 95.0, label: "2023 Michaung" }
    };
    
    const preset = PRESETS[presetName];
    if (!preset) return;
    
    currentWeatherPreset = preset;
    activePresetName = preset.label;
    
    // Highlight active preset button
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.classList.remove("enabled");
        btn.style.borderColor = "rgba(255, 255, 255, 0.08)";
        btn.style.background = "rgba(255, 255, 255, 0.05)";
        btn.style.color = "rgba(255, 255, 255, 0.8)";
    });
    e.currentTarget.classList.add("enabled");
    e.currentTarget.style.borderColor = "var(--accent-color)";
    e.currentTarget.style.background = "rgba(29, 158, 117, 0.12)";
    e.currentTarget.style.color = "#ffffff";
    
    // Update spatial map, telemetry ticker and city average immediately
    updateSpatialMapAndCitySnapshot();
    updateTelemetryFeed();

    // Dynamically scale sound levels based on active preset
    updateAudioPresetLevels();
    
    // Automatically trigger evaluation for the currently searched area if there is one
    const currentArea = areaInput.value.trim();
    if (currentArea) {
        handlePredictionRequest();
    }
}

// Bind Button actions
predictBtn.addEventListener("click", handlePredictionRequest);
gpsBtn.addEventListener("click", handleGPSRequest);

// Bind input key triggers (Enter key starts evaluation)
areaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        handlePredictionRequest();
    }
});

// Bind preset button click handlers
document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", handlePresetClick);
});

// ----------------------------------------------------
// DIALOG MODALS OPEN/CLOSE ORCHESTRATION
// ----------------------------------------------------
const paramsModal = document.getElementById("modal-params");
const historicalModal = document.getElementById("modal-historical");

document.getElementById("help-explain-btn").addEventListener("click", () => {
    paramsModal.showModal();
});
document.getElementById("close-params-btn").addEventListener("click", () => {
    paramsModal.close();
});

document.getElementById("help-historical-btn").addEventListener("click", () => {
    historicalModal.showModal();
});
document.getElementById("close-historical-btn").addEventListener("click", () => {
    historicalModal.close();
});

// Close modals when user clicks outside boundaries
window.addEventListener("click", (e) => {
    if (e.target === paramsModal) paramsModal.close();
    if (e.target === historicalModal) historicalModal.close();
});

// ----------------------------------------------------
// CUSTOM LEAFLET RADAR CANVAS OVERLAY LAYER
// ----------------------------------------------------
L.RadarOverlay = L.Layer.extend({
    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-radar-layer');
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        this._canvas.style.opacity = '0.35';
        map.getPanes().overlayPane.appendChild(this._canvas);
        
        // Listen to move events to dynamically reposition canvas overlay
        map.on('move', this._reset, this);
        map.on('zoom', this._reset, this);
        this._reset();
        
        // Initialize storm cell center coordinates and characteristics
        this._cells = [
            { lat: 13.06, lon: 80.20, size: 0.035, dLat: 0.0001, dLon: 0.00015, dbz: 55 },
            { lat: 12.98, lon: 80.25, size: 0.045, dLat: -0.00008, dLon: 0.0001, dbz: 42 },
            { lat: 13.12, lon: 80.22, size: 0.06, dLat: 0.00005, dLon: -0.00012, dbz: 28 },
            { lat: 12.92, lon: 80.16, size: 0.04, dLat: 0.00012, dLon: -0.00008, dbz: 50 }
        ];
        
        this._sweepAngle = 0;
        this._animId = requestAnimationFrame(() => this._tick());
    },
    onRemove: function(map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('move', this._reset, this);
        map.off('zoom', this._reset, this);
        cancelAnimationFrame(this._animId);
    },
    _reset: function() {
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
    },
    _tick: function() {
        if (!this._map) return;
        this._sweepAngle = (this._sweepAngle + 0.012) % (Math.PI * 2);
        
        // Drift storm cells across map grid
        this._cells.forEach(cell => {
            cell.lat += cell.dLat;
            cell.lon += cell.dLon;
            
            // Loop boundaries to keep them floating in Chennai
            if (cell.lat > 13.35) cell.lat = 12.75;
            if (cell.lat < 12.75) cell.lat = 13.35;
            if (cell.lon > 80.40) cell.lon = 79.95;
            if (cell.lon < 79.95) cell.lon = 80.40;
        });
        
        this._draw();
        this._animId = requestAnimationFrame(() => this._tick());
    },
    _draw: function() {
        const ctx = this._canvas.getContext('2d');
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        const radarCenterLatLng = [13.06, 80.24];
        const center = this._map.latLngToContainerPoint(radarCenterLatLng);
        const maxRadius = Math.max(this._canvas.width, this._canvas.height) * 0.6;
        
        // 1. Draw spinning sweep cone
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(this._sweepAngle);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
        gradient.addColorStop(0, 'rgba(29, 158, 117, 0.22)');
        gradient.addColorStop(0.5, 'rgba(29, 158, 117, 0.06)');
        gradient.addColorStop(1, 'rgba(29, 158, 117, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxRadius, -0.22, 0);
        ctx.closePath();
        ctx.fill();
        
        // Sweep line highlight
        ctx.strokeStyle = 'rgba(159, 225, 203, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxRadius, 0);
        ctx.stroke();
        ctx.restore();
        
        // 2. Draw animated precipitation density blotches
        this._cells.forEach(cell => {
            const cellPoint = this._map.latLngToContainerPoint([cell.lat, cell.lon]);
            if (cellPoint.x < 0 || cellPoint.x > this._canvas.width || cellPoint.y < 0 || cellPoint.y > this._canvas.height) {
                return;
            }
            
            const sizeOffsetLatLng = [cell.lat + cell.size, cell.lon + cell.size];
            const sizePoint = this._map.latLngToContainerPoint(sizeOffsetLatLng);
            const radius = Math.max(15, Math.abs(sizePoint.x - cellPoint.x));
            
            // Check sweep proximity for pass glow
            const angleToCenter = Math.atan2(cellPoint.y - center.y, cellPoint.x - center.x);
            const angleDiff = Math.abs((angleToCenter - this._sweepAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            const isSweepPassing = angleDiff < 0.22;
            
            let baseColor, midColor;
            if (cell.dbz >= 50) {
                baseColor = isSweepPassing ? 'rgba(226, 75, 74, 0.6)' : 'rgba(226, 75, 74, 0.3)';
                midColor = isSweepPassing ? 'rgba(245, 158, 11, 0.45)' : 'rgba(245, 158, 11, 0.2)';
            } else if (cell.dbz >= 40) {
                baseColor = isSweepPassing ? 'rgba(245, 158, 11, 0.55)' : 'rgba(245, 158, 11, 0.25)';
                midColor = isSweepPassing ? 'rgba(250, 199, 117, 0.4)' : 'rgba(250, 199, 117, 0.15)';
            } else {
                baseColor = isSweepPassing ? 'rgba(29, 158, 117, 0.45)' : 'rgba(29, 158, 117, 0.2)';
                midColor = isSweepPassing ? 'rgba(159, 225, 203, 0.3)' : 'rgba(159, 225, 203, 0.1)';
            }
            
            const radGrad = ctx.createRadialGradient(
                cellPoint.x, cellPoint.y, 2,
                cellPoint.x, cellPoint.y, radius
            );
            radGrad.addColorStop(0, baseColor);
            radGrad.addColorStop(0.45, midColor);
            radGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(cellPoint.x, cellPoint.y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Core pixel blip
            ctx.fillStyle = isSweepPassing ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(cellPoint.x, cellPoint.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
});

// ----------------------------------------------------
// EMERGENCY ALERT DISPATCH & SMS SYSTEM
// ----------------------------------------------------
function showToast(title, body, riskClassLabel) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `custom-toast toast-${riskClassLabel}`;
    
    let titleClass = "low";
    if (riskClassLabel === "severe") titleClass = "severe";
    if (riskClassLabel === "high") titleClass = "high";
    
    toast.innerHTML = `
        <div class="toast-title ${titleClass}">${escapeHTML(title)}</div>
        <div class="toast-body">${escapeHTML(body)}</div>
    `;
    container.appendChild(toast);
    
    // Slide-in animation frame delay
    setTimeout(() => toast.classList.add("show"), 50);
    
    // Remove after 6 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 6000);
}

function triggerSMSSimulation(areaName, riskLevel, probability, customMessage = null) {
    const phoneOverlay = document.getElementById("phone-simulation-overlay");
    const textContent = document.getElementById("sms-text-content");
    if (!phoneOverlay || !textContent) return;
    
    const contact = subscribedPhoneNumber || "+91 98765 43210";
    
    // Set dispatcher status monitor to ALERTING (Severe Red flashing)
    const dot = document.getElementById("dispatcher-dot");
    const statusText = document.getElementById("dispatcher-status-text");
    if (dot && statusText) {
        dot.className = "dispatcher-status-dot alerting";
        statusText.innerHTML = `<span><span class="dispatcher-status-dot alerting"></span> 🚨 ALERT DISPATCHED to ${escapeHTML(contact)}</span>`;
    }
    
    // Construct SMS Text content
    let msg = `[CMWSSB Flood Alert] ${areaName.toUpperCase()} is evaluated at ${riskLevel.toUpperCase()} (${probability}% probability). Saturated soils and elevated tide levels detected. Switch off main power if water enters home. Avoid travel.`;
    if (customMessage) {
        msg = customMessage;
    }
    
    textContent.innerText = msg;
    phoneOverlay.classList.add("active");
    
    // Reset monitor state back to active monitoring after 8 seconds
    setTimeout(() => {
        if (dot && statusText) {
            if (hasActiveAlertSubscription) {
                dot.className = "dispatcher-status-dot active";
                statusText.innerHTML = `<span><span class="dispatcher-status-dot active"></span> Broadcast Monitor: Active (${escapeHTML(contact)})</span>`;
            } else {
                dot.className = "dispatcher-status-dot";
                statusText.innerHTML = `<span><span class="dispatcher-status-dot"></span> Monitor: Idle (Ready to broadcast)</span>`;
            }
        }
    }, 8000);
}

function handleSubscription() {
    const phoneInput = document.getElementById("alert-phone");
    if (!phoneInput) return;
    
    const phoneNum = phoneInput.value.trim();
    if (!phoneNum) {
        alert("Please enter a valid phone number to subscribe.");
        return;
    }
    
    hasActiveAlertSubscription = true;
    subscribedPhoneNumber = phoneNum;
    
    const dot = document.getElementById("dispatcher-dot");
    const statusText = document.getElementById("dispatcher-status-text");
    if (dot && statusText) {
        dot.className = "dispatcher-status-dot active";
        statusText.innerHTML = `<span><span class="dispatcher-status-dot active"></span> Broadcast Monitor: Active (${escapeHTML(phoneNum)})</span>`;
    }
    
    showToast("System Notification", `Successfully subscribed ${escapeHTML(phoneNum)} to emergency alerts.`, "low");
}

function triggerTestBroadcast() {
    const currentArea = areaInput.value.trim() || "Velachery";
    showToast(
        "🚨 TEST BROADCAST",
        `Simulating emergency warning dispatch for ${currentArea}.`,
        "severe"
    );
    setTimeout(() => {
        triggerSMSSimulation(
            currentArea,
            "Severe Risk",
            95,
            `[CMWSSB Flood Alert - TEST] Evacuation warnings active for ${currentArea}. Heavy precipitation expected. Switch off mains power. Emergency: 1913.`
        );
    }, 1200);
}

function toggleRadarOverlay() {
    const btn = document.getElementById("radar-toggle-btn");
    const dot = document.getElementById("radar-dot");
    if (!btn || !dot) return;
    
    if (radarLayer && map.hasLayer(radarLayer)) {
        map.removeLayer(radarLayer);
        dot.classList.remove("active");
        btn.style.borderColor = "rgba(255, 255, 255, 0.08)";
        btn.style.background = "rgba(255, 255, 255, 0.05)";
        btn.style.color = "rgba(255, 255, 255, 0.8)";
        stopRadarSound();
    } else if (radarLayer) {
        radarLayer.addTo(map);
        dot.classList.add("active");
        btn.style.borderColor = "var(--accent-color)";
        btn.style.background = "rgba(29, 158, 117, 0.1)";
        btn.style.color = "#ffffff";
        startRadarSound();
    }
}

// ----------------------------------------------------
// INITIALIZATION ON FIRST LOAD
// ----------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    initLeafletMap();
    updateSpatialMapAndCitySnapshot();
    updateTelemetryFeed();
    
    // Bind Dispatcher controls
    const subBtn = document.getElementById("subscribe-alerts-btn");
    if (subBtn) subBtn.addEventListener("click", handleSubscription);
    
    const testBtn = document.getElementById("broadcast-test-btn");
    if (testBtn) testBtn.addEventListener("click", triggerTestBroadcast);
    
    const radarBtn = document.getElementById("radar-toggle-btn");
    if (radarBtn) radarBtn.addEventListener("click", toggleRadarOverlay);
    
    const phoneCloseBtn = document.getElementById("phone-close-btn");
    if (phoneCloseBtn) phoneCloseBtn.addEventListener("click", () => {
        const phoneOverlay = document.getElementById("phone-simulation-overlay");
        if (phoneOverlay) phoneOverlay.classList.remove("active");
    });
    
    // Live sensor ticker interval updates every 3 seconds
    setInterval(updateTelemetryFeed, 3000);

    // Global touch/click sound for interactive elements
    document.addEventListener("click", (e) => {
        const target = e.target.closest("button, .preset-btn, .forecast-card, .guide-item, a, select, input, .leaflet-interactive");
        if (target) {
            playTouchSound();
        }
    });

    // Automatically trigger scanner sound when loading mask is active
    const loadingMask = document.getElementById("loading-mask");
    if (loadingMask) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    const isActive = loadingMask.classList.contains("active");
                    if (isActive) {
                        startScannerSound();
                    } else {
                        stopScannerSound();
                    }
                }
            });
        });
        observer.observe(loadingMask, { attributes: true });
    }
});

