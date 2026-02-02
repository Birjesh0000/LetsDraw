# Architecture

## How Data Flows

User draws on canvas -> Canvas renders locally -> Draw event sent to server -> Server saves it and validates -> Server sends to everyone in the room -> Other clients apply the stroke to their canvas

## WebSocket Communication

When someone draws, we send x, y, color, brush size, and the previous position (lastX, lastY). The server gets these events and broadcasts them. For undo/redo/clear, the server processes them and tells everyone what the updated history is. We also send when someone starts/stops drawing so cursors can show a "drawing" indicator.

## State on Client and Server

On the client side, App.jsx owns the canvas element and button states (can undo/redo?). Canvas.jsx handles local drawing state and brush settings. SocketService manages the connection. HistoryManager keeps the last 20 drawing actions.

On the server, rooms.js tracks who's connected in each room. drawing-state.js keeps the full history of strokes and manages undo/redo. Everything is in memory, so if the server restarts you lose the drawing.

## Undo and Redo

Each room has a history of strokes. When someone hits undo, the server removes the most recent stroke from the history (doesn't matter who drew it). Then it sends the updated history to everyone. Same with redo - restores the last removed stroke. This way if user A and user B are both drawing, user B can undo A's stroke.

## Performance

Drawing events happen constantly (100+ per second). Instead of sending each one, we batch them every 16ms so we're only sending about 60 per second. Huge bandwidth savings.

For canvas rendering, we don't redraw the whole thing each frame. We only redraw the rectangle where strokes happened. This is way faster than clearing and redrawing everything.

Rooms are independent so if many people use it, just split them into different rooms and the load is distributed.

The server listens on all interfaces (0.0.0.0) not just localhost, so external services like Vercel and Render can reach it. CORS is set up for the frontend domain.

## Handling Problems

If someone sends actions out of order, the server detects it. If it's a duplicate, ignore it. If prerequisites are missing, queue it and wait. If there's a real conflict, tell the client to resync from the authoritative history on the server. This prevents the client and server from getting out of sync.

Socket.io handles reconnection automatically with exponential backoff. If the connection drops, it tries to reconnect, waiting longer between each retry. When it reconnects, the client re-joins the room and gets the full history, so it catches up.

## Tech Stack

Canvas for drawing (no libraries). Socket.io for real-time sync. React and Vite on the frontend. Node and Express on the backend. Everything stored in memory, no database. Tailwind for styling.

Tradeoffs: No persistence if the server restarts. Can handle about 100 concurrent users before memory gets tight. No login system. New users have to download the entire drawing history when they join.
