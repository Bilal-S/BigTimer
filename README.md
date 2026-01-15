# Big Timer 🕒

A high-visibility, distraction-free Progressive Web App timer designed specifically for public speakers, presenters, and performers. Unlike standard phone timers, Big Timer prioritizes legibility from a distance and uses visual haptic alerts (screen flashing) to notify speakers of remaining time without requiring them to read small numbers or hear audio alarms.

## 🚀 Key Features

### Ultra-Minimalist Focus Mode
Once the timer starts, the UI strips away everything except:
- **The Countdown**: Displayed in the largest font size possible to fill the viewport using Roboto Condensed font.
- **Exit Button**: A small "×" to return to the configuration screen.

### Smart Visual Alerts
To keep speakers on track without audio cues, the app uses color-inversion flashes:
- **2 Minutes**: Screen flashes 4 times (200ms cycles).
- **1 Minute**: Screen flashes 4 times (200ms cycles).
- **30 Seconds**: Continuous flashing until the clock hits zero.
- **Overtime**: Upon reaching 00:00, the timer counts upward. The background turns solid red and the text solid white to signal urgency.

### Customization & Accessibility
- **Persistent Settings**: Remembers your last timer duration and theme preferences using localStorage.
- **Color Control**: Choose custom foreground and background colors.
- **High Contrast Themes**: Quick-toggle presets for High-Contrast Dark and Light modes to ensure readability in any lighting conditions (e.g., a dark stage vs. a bright conference room).
- **Responsive Design**: The timer automatically adjusts to your screen size, with the clock face taking at least 90% of the screen space.

### PWA Capabilities
- **Offline Support**: Works without an internet connection once installed.
- **Installable**: Can be installed to your home screen for a borderless, immersive experience.
- **Full Screen Mode**: Optional fullscreen toggle for maximum visibility.

## 🎯 Quick Start

### Prerequisites
- Node.js (version 16 or higher recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd BigTimer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production
```bash
npm run build
npm run preview
```

## 📖 Usage

### Setting Up a Timer
1. **Set Duration**: Enter your desired time in MM:SS format (e.g., `05:00` for 5 minutes) or use the quick-set buttons (1m, 2m, 3m, 5m, 10m, 20m, 30m).

2. **Choose a Theme**:
   - **Dark**: Black background, white text (default)
   - **Light**: White background, black text
   - **Custom**: Select your own background and text colors

3. **Start**: Click the START button to enter focus mode.

### During the Timer
- The countdown fills the screen with a large, bold font.
- Visual alerts will notify you of time milestones through screen flashing.
- Use the "⛶" button to toggle fullscreen mode for maximum visibility.
- Click "×" to exit back to configuration.

### Preferences
Your last used settings are automatically saved and restored when you return to the app.

## 🛠 Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript ES6 Modules
- **Build Tool**: Vite
- **Styling**: CSS Variables for easy theme switching, Roboto Condensed font for timer display
- **Storage**: localStorage API for user preferences persistence
- **PWA Features**: Service Worker (via `/sw.js`), Web App Manifest (via `/manifest.json`)
- **Hosting**: Any static site host supports PWAs

## 📱 Progressive Web App
Big Timer works offline and can be installed as a native-like app on your device:
- **iOS**: Open in Safari, tap share, "Add to Home Screen"
- **Android/Chrome**: "Install App" option in browser menu
- **Desktop**: Available as a desktop app via browser installation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Bilal Soylu** - *Initial work*

---

**Note**: This app is optimized for modern browsers with JavaScript enabled. For the best experience, use a compatible browser like Chrome, Firefox, Safari, or Edge.
