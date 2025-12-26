# Large File Upload System (Resumable)

This project implements a resumable large file upload system using a Node.js backend, MongoDB, and a React frontend.

The system allows large files to be uploaded reliably by splitting them into fixed-size chunks and storing upload state in the database. Uploads can be resumed after refreshes, network failures, or backend restarts.

---

## Features

- Chunk-based upload (5MB chunks)
- Resume uploads after interruption
- Skip already uploaded chunks
- Support out-of-order chunk uploads
- Stream file data to disk (no full file buffering)
- Frontend progress tracking
- Final upload verification using SHA-256 hashing
- Optional ZIP content inspection
- MongoDB-backed upload state for crash recovery

---

## Tech Stack

Backend:
- Node.js
- Express
- MongoDB (Docker)
- Mongoose

Frontend:
- React (Vite)
- Fetch API
