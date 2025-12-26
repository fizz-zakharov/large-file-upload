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

## Implementation Details

### File Integrity (Hashing)

File integrity is verified during the finalization step of the upload.

After all chunks are uploaded, the backend streams the assembled file from disk and computes a SHA-256 hash using Node.js crypto utilities. The file is never loaded fully into memory; hashing is done using a read stream to ensure the system remains memory-safe even for large files.

The computed hash is stored with the upload record and returned to the client as part of the finalize response. This ensures that the final file can be verified for correctness and completeness after the upload finishes.

---

### Pause and Resume Logic

The upload system supports pause and resume implicitly through chunk-level state tracking rather than explicit pause controls.

Each upload session is tracked in MongoDB, and every successfully received chunk is recorded with its index. When the frontend initializes or re-initializes an upload, the backend returns the list of chunks that have already been uploaded.

The frontend uses this information to:
- Skip already uploaded chunks
- Resume uploading only the remaining chunks
- Safely continue after page refreshes, browser restarts, or backend restarts

This approach avoids relying on in-memory state and allows uploads to resume reliably as long as the upload session exists in the database.

---

### Trade-offs Made

Several design trade-offs were made to keep the system reliable and focused:

- Chunk size is fixed at 5MB for simplicity rather than being dynamically configurable.
- Pause and resume are handled automatically via retry and re-initialization instead of explicit pause/resume buttons.
- ZIP file inspection is best-effort and non-blocking; uploads are not failed if ZIP parsing is unsuccessful.
- Authentication and user-based upload ownership were intentionally excluded to keep the scope focused on upload mechanics.
- UI styling was kept minimal to prioritize correctness and observability over visual design.

---

### Possible Future Enhancements

There are several areas where this system could be extended further:

- Add explicit pause and resume controls using AbortController to cancel in-flight chunk uploads.
- Support configurable or adaptive chunk sizes based on network conditions.
- Add authentication and associate uploads with user accounts.
- Persist upload progress in local storage to improve resume behavior across devices.
- Improve frontend visualization with progress bars or chunk heatmaps.
- Add server-side cleanup jobs to remove abandoned or expired uploads.
- Support cloud storage backends such as S3 instead of local disk storage.

---


