# Gesture Shooter

#### Contributors: Jingru Sang, Bill Tang

## Overview

This project is a third-person 2D shooting game designed to provide a unique gaming experience by integrating gesture-based interaction. The game is developed using standard HTML and JavaScript technologies and can run directly in modern web browsers without requiring any additional plugins.

## How to run

#### 1. Clone the Repository

```
git clone https://github.com/sangsjr/Gesture_Shooter
cd gesture-shooter
```

#### 2. Run locally

You need a local web server to access camera APIs.  
If you use **VS Code**, simply:

- Install the extension “Live Server”

- Right-click `index.html` → **Open with Live Server**

Or run Python server:

```
python3 -m http.server 5500
```

Then open:  http://localhost:5500

#### Tip

Please allow camera permission to enable hand gesture tracking

## Game Mechanism

The player controls a character on a flat map while enemies attack from all directions. The player must move, aim, shoot, and collect items to survive. As time progresses, the difficulty of the game increases — both the number of enemies and their attack frequency gradually rise.

## Interactions / How to play

| Function          | Keyboard & Mouse   | Gestures / Voice                       |
| ----------------- | ------------------ | -------------------------------------- |
| **Move**          | WASD or Arrow keys | Left-hand position (relative locator)  |
| **Aim & Shoot**   | Mouse aim + click  | Right-hand position (absolute locator) |
| **Pick Item**     | F key              | Left-hand pinch                        |
| **Switch Weapon** | R key              | Right-hand pinch                       |

## Technology Stack

- **JavaScript (ES6 Modules)**

- **HTML5** for rendering

- **Google Mediapipe Hands** for gesture recognition

## Code Structure

```
Gesture Shooter
├─ index.html
├─ assets/
│  ├─ images   ← sprites & UI
│  └─ sounds   ← sound effects
└─ js/
   ├─ main.js      → game orchestration / state machine / loop / render / HUD
   ├─ core.js      → EventBus / InputManager (Keyboard · Gesture) /
   │                  CollisionSystem / Utils / ImageLoader / SoundManager /
   │                  GestureInputManager
   └─ gameplay.js  → Player / Weapon (Pistol · MachineGun · Knife · Grenade) /
                      Projectile / ENEMY_REGISTRY / Pickup & TYPES
```

### Game State Machine

BOOT → MENU → PLAYING → PAUSED → UPGRADE_PICK → GAME_OVER

### Main Scripts

- **main.js** - Orchestrates execution and rendering.

- **core.js** - Common systems and services.

- **gameplay.js** - Gameplay rules and entities.
