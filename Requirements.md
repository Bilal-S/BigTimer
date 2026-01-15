Project Name: Big Timer 🕒
📝 Description
Big Timer is a high-visibility, distraction-free Progressive Web App designed for public speakers, presenters, and performers. Unlike standard phone timers, Big Timer prioritizes legibility from a distance and uses visual haptic alerts (screen flashing) to notify the speaker of remaining time without requiring them to read small numbers or hear an alarm.

The app operates in two modes: Configuration Mode (setting the time and theme) and Focus Mode (the countdown).

🚀 Key Features
1. Ultra-Minimalist Focus Mode
Once the timer starts, the UI strips away everything except:

The Countdown: Displayed in the largest font size possible to fill the viewport.

Exit Button: A small (x) to return to the configuration screen.

2. Smart Visual Alerts
To keep speakers on track without audio cues, the app uses color-inversion flashes:

2 Minutes: Screen flashes (inverts colors) 4 times in 1s cycles.

1 Minute: Screen flashes 4 times in 1s cycles.

30 Seconds: Continuous flashing until the clock hits zero.

Overtime: Upon reaching 00:00, the timer counts upward. The background turns Solid Red and the text Solid White to signal urgency.

3. Customization & Accessibility
Persistent Settings: Remembers your last timer duration using localStorage.

Color Control: Choose custom foreground and background colors.

High Contrast Themes: Quick-toggle presets for High-Contrast Dark and Light modes to ensure readability in any lighting (e.g., a dark stage vs. a bright conference room).

4. PWA Capabilities
Offline Support: Works without an internet connection once installed.

Full Screen: Can be "installed" to the home screen for a borderless, immersive experience.

🛠 Tech Stack (Suggested)
Frontend: HTML5, CSS3, JavaScript (or React/Vue for state management).

Styling: CSS Variables (for easy theme swapping and flashing logic).

Storage: localStorage API to persist user preferences.

PWA: Service Workers and a Web App Manifest.


5. Features

- Project should have an optional icon that goes to full screen
- clock should be responsive and grow with the screen
- while timing dow the clock face should at least be 90% of the screen
- Use super bold numbers