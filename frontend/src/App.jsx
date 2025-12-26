import { useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

function App() {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [uploadedChunks, setUploadedChunks] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Chunk status tracking
  const [chunkStatus, setChunkStatus] = useState({});

  // Metrics
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const createChunks = (file) => {
    const chunksArray = [];
    let index = 0;

    while (index * CHUNK_SIZE < file.size) {
      chunksArray.push({
        index,
        blob: file.slice(
          index * CHUNK_SIZE,
          index * CHUNK_SIZE + CHUNK_SIZE
        ),
      });
      index++;
    }

    return chunksArray;
  };

  const initUpload = async (selectedFile) => {
    const res = await fetch("http://localhost:4000/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: selectedFile.name,
        totalSize: selectedFile.size,
        chunkSize: CHUNK_SIZE,
      }),
    });

    const data = await res.json();
    setUploadId(data.uploadId);
    setUploadedChunks(data.uploadedChunks);

    // mark already uploaded chunks
    const statusMap = {};
    data.uploadedChunks.forEach((i) => (statusMap[i] = "success"));
    setChunkStatus(statusMap);
  };

  const uploadChunk = async (uploadId, chunkObj, retry = 0) => {
    const { index, blob } = chunkObj;

    setChunkStatus((s) => ({ ...s, [index]: "uploading" }));

    try {
      const res = await fetch(
        `http://localhost:4000/uploads/${uploadId}/chunk?chunkIndex=${index}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
        }
      );

      if (!res.ok) throw new Error();

      setChunkStatus((s) => ({ ...s, [index]: "success" }));
      setUploadedBytes((b) => b + blob.size);
    } catch {
      if (retry < 3) {
        await new Promise((r) =>
          setTimeout(r, Math.pow(2, retry) * 500)
        );
        return uploadChunk(uploadId, chunkObj, retry + 1);
      }
      setChunkStatus((s) => ({ ...s, [index]: "error" }));
    }
  };

  const uploadChunksWithLimit = async (pending, limit = 3) => {
    let completed = 0;
    const total = pending.length;
    const queue = [...pending];

    const worker = async () => {
      while (queue.length) {
        const chunk = queue.shift();
        await uploadChunk(uploadId, chunk);
        completed++;
        setProgress(Math.round((completed / total) * 100));
      }
    };

    await Promise.all(
      Array.from({ length: limit }, worker)
    );
  };

  const finalizeUpload = async () => {
    await fetch(
      `http://localhost:4000/uploads/${uploadId}/finalize`,
      { method: "POST" }
    );
  };

  const startUpload = async () => {
    setUploading(true);
    setStartTime(Date.now());
    setUploadedBytes(0);

    const pending = chunks.filter(
      (c) => !uploadedChunks.includes(c.index)
    );

    await uploadChunksWithLimit(pending);
    setUploading(false);
    await finalizeUpload();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setChunks(createChunks(selected));
    setChunkStatus({});
    initUpload(selected);
  };

  const elapsedSeconds = startTime
    ? (Date.now() - startTime) / 1000
    : 0;

  const speedMBps =
    elapsedSeconds > 0
      ? uploadedBytes / 1024 / 1024 / elapsedSeconds
      : 0;

  const remainingBytes = file
    ? file.size - uploadedBytes
    : 0;

  const etaSeconds =
    speedMBps > 0
      ? remainingBytes / 1024 / 1024 / speedMBps
      : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ width: 600 }}>
        <h2>Large File Upload</h2>

        <input type="file" onChange={handleFileChange} />

        {file && (
          <>
            <p>File: {file.name}</p>
            <p>Progress: {progress}%</p>

            {uploading && (
              <>
                <p>Speed: {speedMBps.toFixed(2)} MB/s</p>
                <p>ETA: {Math.ceil(etaSeconds)} seconds</p>
              </>
            )}

            <button
              onClick={startUpload}
              disabled={uploading || !uploadId}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>

            <h4>Chunk Status</h4>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {chunks.map((c) => (
                <div key={c.index}>
                  Chunk {c.index}:{" "}
                  {chunkStatus[c.index] || "pending"}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
