import './style.css'

// --- State ---
let timerInterval = null;
let wakeLock = null;
let totalSeconds = 0;
let remainingSeconds = 0;
let isOvertime = false;
let currentSettings = {
    duration: '05:00',
    theme: 'dark',
    customBg: '#000000',
    customText: '#ffffff'
};

// --- DOM Elements ---
const configMode = document.getElementById('config-mode');
const focusMode = document.getElementById('focus-mode');
const timerDisplay = document.getElementById('timer-display');
const durationInput = document.getElementById('timer-duration');
const startBtn = document.getElementById('start-btn');
const exitBtn = document.getElementById('exit-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const themeBtns = document.querySelectorAll('.theme-btn');
const customColors = document.getElementById('custom-colors');
const bgColorInput = document.getElementById('bg-color');
const textColorInput = document.getElementById('text-color');

// --- Initialization ---
function init() {
    const saved = localStorage.getItem('bigtimer-settings');
    if (saved) {
        currentSettings = JSON.parse(saved);
    }

    durationInput.value = currentSettings.duration;
    bgColorInput.value = currentSettings.customBg;
    textColorInput.value = currentSettings.customText;

    applyTheme(currentSettings.theme);

    // Event Listeners
    startBtn.addEventListener('click', startTimer);
    exitBtn.addEventListener('click', stopTimer);
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.theme);
        });
    });

    bgColorInput.addEventListener('input', (e) => {
        currentSettings.customBg = e.target.value;
        if (currentSettings.theme === 'custom') updateColors();
    });

    textColorInput.addEventListener('input', (e) => {
        currentSettings.customText = e.target.value;
        if (currentSettings.theme === 'custom') updateColors();
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            durationInput.value = btn.dataset.time;
            saveSettings();
        });
    });
}

// --- Theme Logic ---
function applyTheme(theme) {
    currentSettings.theme = theme;
    themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    customColors.classList.toggle('hidden', theme !== 'custom');

    if (theme === 'dark') {
        document.documentElement.style.setProperty('--bg-color', '#000000');
        document.documentElement.style.setProperty('--text-color', '#ffffff');
    } else if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', '#000000');
    } else {
        updateColors();
    }
    saveSettings();
}

function updateColors() {
    document.documentElement.style.setProperty('--bg-color', currentSettings.customBg);
    document.documentElement.style.setProperty('--text-color', currentSettings.customText);
}

function saveSettings() {
    currentSettings.duration = durationInput.value;
    localStorage.setItem('bigtimer-settings', JSON.stringify(currentSettings));
}

// --- Timer Logic ---
function startTimer() {
    const parts = durationInput.value.split(':');
    const mm = parseInt(parts[0]) || 0;
    const ss = parseInt(parts[1]) || 0;
    totalSeconds = (mm * 60) + ss;

    if (totalSeconds <= 0) return;

    remainingSeconds = totalSeconds;
    isOvertime = false;
    timerDisplay.textContent = formatTime(remainingSeconds);

    configMode.classList.remove('active');
    focusMode.classList.add('active');
    document.body.classList.remove('overtime');

    // Request screen wake lock to prevent screen from turning off during timer
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
            wakeLock = lock;
            console.log('Screen wake lock acquired');
        }).catch(err => {
            console.log('Failed to acquire wake lock:', err);
        });
    }

    saveSettings();

    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    configMode.classList.add('active');
    focusMode.classList.remove('active');
    document.body.classList.remove('overtime', 'flash', 'flash-continuous', 'overtime-flash');

    // Release screen wake lock when returning to configuration
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Screen wake lock released');
    }
}

function updateTimer() {
    if (!isOvertime) {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            isOvertime = true;
            document.body.classList.add('overtime', 'overtime-flash');
            remainingSeconds = 0;
        }
    } else {
        remainingSeconds++;
    }

    const prefix = isOvertime ? '+' : '';
    timerDisplay.textContent = prefix + formatTime(Math.abs(remainingSeconds));
    checkAlerts();
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Alerts / Flashing Logic ---
function checkAlerts() {
    if (isOvertime) return;

    if (remainingSeconds === 120 || remainingSeconds === 60) {
        flash(4); // 4 flashes for 2min and 1min
    } else if (remainingSeconds <= 30 && remainingSeconds > 0) {
        // Continuous flash logic could be handled by a class if we want, 
        // but the requirement says "Continuous flashing until the clock hits zero".
        // We'll toggle it every second or use a CSS animation. 
        // CSS animation is cleaner for "continuous".
        if (remainingSeconds === 30) {
            document.body.classList.add('flash-continuous');
        }
    } else if (remainingSeconds === 0) {
        document.body.classList.remove('flash-continuous');
    }
}

function flash(count) {
    let flashes = 0;
    const interval = setInterval(() => {
        document.body.classList.toggle('flash');
        flashes++;
        if (flashes >= count * 2) {
            clearInterval(interval);
            document.body.classList.remove('flash');
        }
    }, 1000); // 1s between color changes
}

// --- Fullscreen ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

registerSW();

function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('SW registered:', reg);
            }).catch(err => {
                console.log('SW registration failed:', err);
            });
        });
    }
}

init();
