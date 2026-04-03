import './style.css'

// --- State ---
let timerInterval = null;
let wakeLock = null;
let totalSeconds = 0;
let remainingSeconds = 0;
let isOvertime = false;
let endTime = 0; // Wall-clock timestamp when timer reaches zero
let prevDigits = { 'm-tens': null, 'm-ones': null, 's-tens': null, 's-ones': null };
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
let overtimePrefix;
let digitSlots;

// --- Initialization ---
function init() {
    const saved = localStorage.getItem('bigtimer-settings');
    if (saved) {
        currentSettings = JSON.parse(saved);
    }

    overtimePrefix = document.getElementById('overtime-prefix');
    digitSlots = {
        'm-tens': document.querySelector('.digit-slot[data-pos="m-tens"]'),
        'm-ones': document.querySelector('.digit-slot[data-pos="m-ones"]'),
        's-tens': document.querySelector('.digit-slot[data-pos="s-tens"]'),
        's-ones': document.querySelector('.digit-slot[data-pos="s-ones"]'),
    };

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

    // Update timer immediately when user returns to the tab
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && timerInterval) {
            updateTimer();
        }
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
    endTime = Date.now() + totalSeconds * 1000;

    // Reset digit tracking so initial display doesn't animate
    prevDigits = { 'm-tens': null, 'm-ones': null, 's-tens': null, 's-ones': null };
    updateDisplay(formatTime(remainingSeconds), false);

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

    // Reset digit tracking
    prevDigits = { 'm-tens': null, 'm-ones': null, 's-tens': null, 's-ones': null };

    // Release screen wake lock when returning to configuration
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Screen wake lock released');
    }
}

function updateTimer() {
    const now = Date.now();
    const diffMs = endTime - now;

    if (diffMs > 0) {
        // Still counting down
        remainingSeconds = Math.ceil(diffMs / 1000);
        isOvertime = false;
    } else {
        // Timer has reached zero or past it
        if (!isOvertime) {
            isOvertime = true;
            document.body.classList.add('overtime', 'overtime-flash');
        }
        remainingSeconds = Math.floor(Math.abs(diffMs) / 1000);
    }

    updateDisplay(formatTime(Math.abs(remainingSeconds)), isOvertime);
    checkAlerts();
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Odometer Display Logic ---
function updateDisplay(timeStr, overtime) {
    // timeStr is "MM:SS"
    const digits = {
        'm-tens': timeStr[0],
        'm-ones': timeStr[1],
        's-tens': timeStr[3],
        's-ones': timeStr[4],
    };

    for (const [pos, newDigit] of Object.entries(digits)) {
        if (prevDigits[pos] === null) {
            // Initial set — no animation
            const slot = digitSlots[pos];
            slot.innerHTML = '<span class="digit-value">' + newDigit + '</span>';
            prevDigits[pos] = newDigit;
            continue;
        }

        if (newDigit === prevDigits[pos]) continue; // No change, skip

        animateDigit(pos, prevDigits[pos], newDigit);
        prevDigits[pos] = newDigit;
    }

    // Handle overtime prefix visibility
    if (overtime) {
        overtimePrefix.classList.remove('hidden');
        // Force reflow to restart transition if needed
        void overtimePrefix.offsetWidth;
        overtimePrefix.classList.add('visible');
    } else {
        overtimePrefix.classList.remove('visible');
        if (!overtimePrefix.classList.contains('visible')) {
            overtimePrefix.classList.add('hidden');
        }
    }
}

function animateDigit(pos, oldDigit, newDigit) {
    const slot = digitSlots[pos];

    // Build new slot content:
    // .digit-value — invisible, maintains slot height
    // .digit-exit  — old digit, slides up out (absolute positioned)
    // .digit-enter — new digit, slides up from below (absolute positioned)

    const valueSpan = document.createElement('span');
    valueSpan.className = 'digit-value';
    valueSpan.textContent = newDigit;
    valueSpan.style.visibility = 'hidden';

    const exitSpan = document.createElement('span');
    exitSpan.className = 'digit-exit';
    exitSpan.textContent = oldDigit;

    const enterSpan = document.createElement('span');
    enterSpan.className = 'digit-enter';
    enterSpan.textContent = newDigit;

    slot.innerHTML = '';
    slot.appendChild(valueSpan);
    slot.appendChild(exitSpan);
    slot.appendChild(enterSpan);

    // Get duration from CSS variable for the fallback timeout
    const duration = parseInt(getComputedStyle(slot).getPropertyValue('--digit-duration')) || 300;

    // Clean up after animation: replace with simple static digit (no visual change)
    const onEnd = () => {
        if (slot.contains(valueSpan)) {
            slot.innerHTML = '<span class="digit-value">' + newDigit + '</span>';
        }
    };
    enterSpan.addEventListener('animationend', onEnd, { once: true });

    // Safety fallback
    setTimeout(onEnd, duration + 100);
}

// --- Alerts / Flashing Logic ---
function checkAlerts() {
    if (isOvertime) return;

    if (remainingSeconds === 120 || remainingSeconds === 60) {
        flash(4); // 4 flashes for 2min and 1min
    } else if (remainingSeconds <= 30 && remainingSeconds > 0) {
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
    }, 1000);
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