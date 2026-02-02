# LetsDraw

A real-time drawing app where multiple people draw on the same canvas together. Built with React, Node.js, and Socket.io.

Live: https://letsdraw-ebon.vercel.app

## Getting Started

You need Node.js v18+. 

Terminal 1 - run the backend:
```
cd Server
npm install
npm start
```
It runs on http://localhost:3001

Terminal 2 - run the frontend:
```
cd client
npm install
npm run dev
```
Open http://localhost:5173

## How to Test with Multiple Users

Open http://localhost:5173 in two browser windows. Both join the same room automatically. Draw in one window and you'll see it appear in the other instantly. The undo/redo/clear buttons work across both windows.

## What It Does

Real-time drawing sync across multiple users. Brush and eraser with color picker. You can undo/redo even what other people drew. Clear the whole canvas. Shows where other users are with cursors. Handles reconnection if the connection drops.

## Folder Structure

client - React frontend, Socket.io connection, canvas drawing
Server - Node + Express backend, room management, history/undo tracking

## What Won't Work

Drawings disappear if the server restarts (no database). Can't export or download. No zoom/pan. Touch pressure doesn't affect brush size. Gets slow with 10+ people drawing at once.

## Why This Approach

Used native Canvas API, no drawing libraries. Server keeps the source of truth for all drawing. Events get batched to reduce network traffic. Only redraw the parts of the canvas that changed. This keeps it fast even with multiple users.

## Time Spent

Initial setup - 1.5 hours. Core drawing and sync - 2.5 hours. Undo/redo - 1.5 hours. User cursors - 1 hour. Debugging and deployment - 1 hour. Total around 7.5 hours.

Architecture details are in ARCHITECTURE.md.
