export type Recording = {
  id: string; title: string; text: string; voice: string; format: "wav" | "mp3";
  duration: number; subtitles: string; created: string;
  source: "studio" | "playground" | "clone"; audio: Blob;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Browser history storage is unavailable.")); return; }
    const request = indexedDB.open("byteminus-recordings", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("recordings", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecording(recording: Recording) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("recordings", "readwrite");
      transaction.objectStore("recordings").put(recording);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function listRecordings(): Promise<Recording[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("recordings").objectStore("recordings").getAll();
      request.onsuccess = () => resolve((request.result as Recording[]).sort((a, b) => b.created.localeCompare(a.created)));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function deleteRecording(id: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("recordings", "readwrite");
      transaction.objectStore("recordings").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
