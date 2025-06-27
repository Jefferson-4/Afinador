let mediaRecorder;
let audioChunks = [];
let audioBlob;

const recordBtn = document.getElementById("record-btn");
const stopBtn = document.getElementById("stop-btn");
const audioPlayback = document.getElementById("recorded-audio");

recordBtn.addEventListener("click", async () => {
  alert("Se solicitará permiso para usar el micrófono. Por favor, acéptalo.");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioPlayback.src = audioUrl;

      procesarAudioBlob(audioBlob);
    };

    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error("Error al acceder al micrófono:", error);
    alert("No se pudo acceder al micrófono. Verifica que esté conectado y que diste permiso en el navegador.");
  }
});

stopBtn.addEventListener("click", () => {
  mediaRecorder.stop();
  recordBtn.disabled = false;
  stopBtn.disabled = true;
});

const modoEscalaCheckbox = document.getElementById("modo-escala");
const modoLabel = document.getElementById("modo-label");
modoEscalaCheckbox.addEventListener("change", () => {
  modoLabel.textContent = modoEscalaCheckbox.checked ? "Menor" : "Mayor";
});

const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const startPointSlider = document.getElementById("start-point");
const endPointSlider = document.getElementById("end-point");

let waveformData = [];
let totalSamples = 0;

function dibujarWaveform(data) {
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 100;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#1e90ff";

  const step = Math.ceil(data.length / width);
  const amp = height / 2;

  for (let i = 0; i < width; i++) {
    const slice = data.slice(i * step, (i + 1) * step);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
  }
}

function procesarAudioBlob(blob) {
  const reader = new FileReader();
  reader.readAsArrayBuffer(blob);
  reader.onloadend = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContext.decodeAudioData(reader.result, buffer => {
      const rawData = buffer.getChannelData(0);
      totalSamples = rawData.length;
      waveformData = rawData;
      dibujarWaveform(rawData);
    });
  };
}

function actualizarSeleccion() {
  const start = parseInt(startPointSlider.value);
  const end = parseInt(endPointSlider.value);
  if (end <= start) return;

  const width = canvas.width;
  const height = canvas.height;

  dibujarWaveform(waveformData);

  const startX = (start / 100) * width;
  const endX = (end / 100) * width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(startX, 0, endX - startX, height);
}

startPointSlider.addEventListener("input", actualizarSeleccion);
endPointSlider.addEventListener("input", actualizarSeleccion);

function dibujarPlayhead(canvas, startRatio, endRatio, duration) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const startX = startRatio * width;
  const endX = endRatio * width;
  let startTime = null;

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;
    const progressRatio = elapsed / duration;
    const currentX = startX + (endX - startX) * progressRatio;

    if (canvas.id === "waveform") {
      dibujarWaveform(waveformData);
      actualizarSeleccion();
    }

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, height);
    ctx.stroke();

    if (progressRatio < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

const playSelectionBtn = document.getElementById("play-selection-btn");
playSelectionBtn.addEventListener("click", () => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioBlob.arrayBuffer().then(bufferArray => {
    audioCtx.decodeAudioData(bufferArray, buffer => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const duracion = buffer.duration;
      const start = parseInt(startPointSlider.value) / 100;
      const end = parseInt(endPointSlider.value) / 100;

      source.connect(audioCtx.destination);
      source.start(0, duracion * start, duracion * (end - start));

      dibujarPlayhead(canvas, start, end, duracion * (end - start));
    });
  });
});
