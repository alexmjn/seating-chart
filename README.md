# AA Meeting Seating Chart Tool

A web-based tool for creating and managing seating charts for meetings.

## Features
- Drag-and-drop seating arrangement
- Multiple furniture types (seats, couches, tables)
- Zoom and pan functionality
- Save/load templates
- PDF export for printing
- Fullscreen editing mode

## How to Use

### For Users:
1. Open the tool in your web browser
2. Use "Load Your Chart Template" for a pre-made layout
3. Add, move, and resize seats and furniture as needed
4. Save templates for reuse
5. Export to PDF for printing

### For Developers:
1. Install Node.js (https://nodejs.org)
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
4. Run `npm run build` to create production build

## Sharing the Tool

### Option 1: Share Development Version
- Run `npm run dev` 
- Share the local URL (usually http://localhost:5173)
- Others can access it on your network

### Option 2: Build and Host
- Run `npm run build`
- Upload the `dist` folder to any web hosting service
- Share the hosted URL

### Option 3: Share as Files
- Run `npm run build`
- Share the entire `dist` folder
- Others can open `index.html` in their browser