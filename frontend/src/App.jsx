import { useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

function App() {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [uploadedChunks, setUploadedChunks] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Split file into chunks
  const createChunks = (file) => {
    const chunksArray = [];
    let index = 0;

    while (index * CHUNK_SIZE < file.size) {
      const start = index * CHUNK_SIZE;
      const end = start + CHUNK_SIZE;

      chunksArray.push({
        index,
        blob: file.slice(start, end),
      });

      index++;
    }

    return chunksArray;
  };

  // Handshake with backend
  const initUpload = async (selectedFile) => {
    const res = await fetch("http://localhost:4000/uploads/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: selectedFile.name,
        totalSize: selectedFile.size,
        chunkSize: CHUNK_SIZE,
      }),
    });

    const data = await res.json();

    setUploadId(data.uploadId);
    setUploadedChunks(data.uploadedChunks);

    // Start upload automatically (temporary)
    setTimeout(() => startUpload(data.uploadId, data.uploadedChunks), 0);
  };

  // Upload a single chunk with retry
  const uploadChunk = async (uploadId, chunkObj, retryCount = 0) => {
    const { index, blob } = chunkObj;

    try {
      const res = await fetch(
        `http://localhost:4000/uploads/${uploadId}/chunk?chunkIndex=${index}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: blob,
        }
      );

      if (!res.ok) {
        throw new Error("Chunk upload failed");
      }

      return true;
    } catch (err) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 500;
        await new Promise((r) => setTimeout(r, delay));
        return uploadChunk(uploadId, chunkObj, retryCount + 1);
      }
      throw err;
    }
  };

  // Upload chunks with concurrency limit
  const uploadChunksWithLimit = async (
    uploadId,
    pendingChunks,
    limit = 3
  ) => {
    let completed = 0;
    const total = pendingChunks.length;

    const queue = [...pendingChunks];
    const workers = [];

    const runWorker = async () => {
      while (queue.length) {
        const chunk = queue.shift();
        await uploadChunk(uploadId, chunk);

        completed++;
        setProgress(Math.round((completed / total) * 100));
      }
    };

    for (let i = 0; i < limit; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
  };

  // Start upload
  const startUpload = async (uploadId, alreadyUploaded) => {
    if (!uploadId) return;

    setUploading(true);
    setProgress(0);

    const pendingChunks = chunks.filter(
      (c) => !alreadyUploaded.includes(c.index)
    );

    await uploadChunksWithLimit(uploadId, pendingChunks, 3);

    setUploading(false);
    console.log("All chunks uploaded");
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const createdChunks = createChunks(selectedFile);
    setChunks(createdChunks);

    console.log("File:", selectedFile.name);
    console.log("Total size:", selectedFile.size);
    console.log("Total chunks:", createdChunks.length);

    initUpload(selectedFile);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Large File Upload</h2>

      <input type="file" onChange={handleFileChange} />

      {file && (
        <div style={{ marginTop: 12 }}>
          <p>
            <strong>File:</strong> {file.name}
          </p>
          <p>
            <strong>Size:</strong>{" "}
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p>
            <strong>Total Chunks:</strong> {chunks.length}
          </p>
          <p>
            <strong>Progress:</strong> {progress}%
          </p>
          {uploading && <p>Uploading…</p>}
        </div>
      )}
    </div>
  );
}

export default App;
