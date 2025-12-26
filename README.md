Large File Upload System (Resumable)

This project implements a resumable large file upload system using a Node.js backend, MongoDB, and a React frontend.

The goal was to support uploading large files reliably by splitting them into chunks, allowing uploads to resume after refreshes, failures, or backend restarts.

Features

Upload large files by splitting them into fixed-size chunks (5MB)

Resume uploads after page refresh or network failure

Upload chunks out of order

Avoid re-uploading already uploaded chunks

Stream file data to disk (no full file in memory)

Track upload progress on the frontend

Finalize uploads with SHA-256 hash verification

Safely inspect ZIP contents (if applicable)

MongoDB-backed state for crash recovery

Tech Stack

Backend

Node.js

Express

MongoDB (via Docker)

Mongoose

Frontend

React (Vite)

Fetch API
