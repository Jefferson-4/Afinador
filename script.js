let tunedBuffer = null;
let fragmentDuration = 0;

window.onload = () => {
    // 📌 Estado inicial
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let waveformData = [];
    let totalSamples = 0; //TEMPORLA

    // 🎛️ Referencias del DOM
    const recordBtn = document.getElementById("record-btn");
    const stopBtn = document.getElementById("stop-btn");
    const audioPlayback = document.getElementById("recorded-audio");
    const tuneBtn = document.getElementById("tune-btn");
    const playSelectionBtn = document.getElementById("play-selection-btn");
    const canvas = document.getElementById("waveform");
    const ctx = canvas.getContext("2d");
    const startPointSlider = document.getElementById("start-point");
    const endPointSlider = document.getElementById("end-point");
    const outputSection = document.querySelector(".output-section");
  
    const playTunedBtn = document.getElementById("play-tuned-btn");
    playTunedBtn.addEventListener("click", () => {
      if (!tunedBuffer) {
        alert("⚠️ Primero debes afinar el audio.");
        return;
      }
    
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      const gainValue = parseFloat(document.getElementById("output-volume").value);
      gainNode.gain.value = gainValue;
      source.buffer = tunedBuffer;
      source.connect(gainNode).connect(audioCtx.destination);
      source.start();

    });


    // 🎼 Notas base
    const baseNotas = [];
    const nombres = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    for (let octava = 1; octava <= 7; octava++) {
      for (let i = 0; i < nombres.length; i++) {
        const nota = nombres[i];
        const n = i + (octava - 4) * 12; // distancia desde A4
        const freq = 440 * Math.pow(2, (n - 9) / 12); // A4 = 440 Hz, index 9
        baseNotas.push({ nota: `${nota}${octava}`, freq });
      }
    }
    
  
    // 🎼 Patrones de escala
    const escalas = {
      mayor: [0, 2, 4, 5, 7, 9, 11],
      menor: [0, 2, 3, 5, 7, 8, 10]
    };
  
//Mostrar Escala

function mostrarEscalaSeleccionada() {
    const raiz = document.getElementById("escala-select").value;
    const modo = document.getElementById("modo-escala").checked ? "menor" : "mayor";
    const escala = generarEscala(raiz, modo);
  
    // Extraer solo los nombres de nota sin octava y eliminar duplicados
    const nombresUnicos = [...new Set(escala.map(n => n.nota.replace(/[0-9]/g, '')))];
  
    const notas = nombresUnicos.join(" - ");
    const modoTexto = modo.charAt(0).toUpperCase() + modo.slice(1);
    document.getElementById("escala-activa").textContent = `🎵 Escala activa (${modoTexto}): ${notas}`;
  }
  
  



    // 🎧 Inicializar detectPitch solo si PITCHFINDER existe
    const sampleRate = 44100;
    let detectPitch = null;
    if (window.PitchFinder && typeof window.PitchFinder.AMDF === 'function') {
      detectPitch = window.PitchFinder.AMDF({ sampleRate: 44100 });
    } else {
      console.warn('⚠️ Pitchfinder no disponible: detección de pitch deshabilitada.');
    }
  
    function detectarPitch(buffer) {
      if (!detectPitch) return null;
      const result = detectPitch(buffer);
      if (typeof result === "number") return result;
      if (result && typeof result === "object" && result.freq) return result.freq;
      return null;
    }
  
   

    function notaMásCercana(freq) {
      let mejorNota = null;
      let menorDif = Infinity;
      baseNotas.forEach(n => {
        const d = Math.abs(freq - n.freq);
        if (d < menorDif) {
          menorDif = d;
          mejorNota = n;
        }
      });
      return mejorNota;
    }
  
    // 🎚️ Afinar fragmento con Tone.js
    async function afinarFragmento(blob, targetFreq, actualFreq) {
      const ratio = targetFreq / actualFreq;
      const player = new Tone.Player({
        url: URL.createObjectURL(blob),
        playbackRate: ratio,
        autostart: true
      }).toDestination();
      const shift = new Tone.PitchShift().toDestination();
      shift.pitch = Math.log2(ratio) * 12;
      player.connect(shift);
    }
  
    // 🎙️ Grabación
    recordBtn.addEventListener("click", async () => {
      alert("Se solicitará permiso para usar el micrófono.");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          audioPlayback.src = URL.createObjectURL(audioBlob);
          procesarAudioBlob(audioBlob);
        };
        mediaRecorder.start();
        recordBtn.disabled = true;
        stopBtn.disabled = false;
      } catch (err) {
        console.error(err);
        alert("No se pudo acceder al micrófono.");
      }
    });
  
    stopBtn.addEventListener("click", () => {
      mediaRecorder.stop();
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    });
  
    // 🔁 Modo mayor/menor
    const modoEscalaCheckbox = document.getElementById("modo-escala");
    const escalaSelect = document.getElementById("escala-select");
    escalaSelect.addEventListener("change", mostrarEscalaSeleccionada);
modoEscalaCheckbox.addEventListener("change", mostrarEscalaSeleccionada);

    const modoLabel = document.getElementById("modo-label");
    modoEscalaCheckbox.addEventListener("change", () => {
      modoLabel.textContent = modoEscalaCheckbox.checked ? "Menor" : "Mayor";
    });
  
    // 📊 Waveform
    function dibujarWaveform(data) {
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = 100);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#1e90ff";
      const step = Math.ceil(data.length / w);
      const amp = h / 2;
      for (let i = 0; i < w; i++) {
        const slice = data.slice(i * step, (i + 1) * step);
        const min = Math.min(...slice);
        const max = Math.max(...slice);
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    }
  
    function dibujarWaveformAfinado(data) {
        const canvasTuned = document.getElementById("waveform-tuned");
        const ctxTuned = canvasTuned.getContext("2d");
        const w = (canvasTuned.width = canvasTuned.offsetWidth);
        const h = (canvasTuned.height = 100);
        ctxTuned.clearRect(0, 0, w, h);
        ctxTuned.fillStyle = "#28a745";
        const step = Math.ceil(data.length / w);
        const amp = h / 2;
        for (let i = 0; i < w; i++) {
          const slice = data.slice(i * step, (i + 1) * step);
          const min = Math.min(...slice);
          const max = Math.max(...slice);
          ctxTuned.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
      }
      

    function procesarAudioBlob(blob) {
      const reader = new FileReader();
      reader.readAsArrayBuffer(blob);
      reader.onloadend = () => {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        ac.decodeAudioData(reader.result, buffer => {
          waveformData = buffer.getChannelData(0);
          totalSamples = waveformData.length;
          dibujarWaveform(waveformData);
        });
      };
    }
  
    // 🎛️ Actualizar selección
    function actualizarSeleccion() {
      const start = +startPointSlider.value;
      const end = +endPointSlider.value;
      if (end <= start) return;
      dibujarWaveform(waveformData);
      const w = canvas.width, h = canvas.height;
      const x0 = (start / 100) * w, x1 = (end / 100) * w;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x0, 0, x1 - x0, h);
    }
  
    startPointSlider.addEventListener("input", actualizarSeleccion);
    endPointSlider.addEventListener("input", actualizarSeleccion);
  
    // ▶️ Reproducir selección
    function dibujarPlayhead(canvas, startR, endR, dur) {
      const C = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const x0 = startR * W, x1 = endR * W;
      let t0 = null;
      function anim(ts) {
        if (!t0) t0 = ts;
        const e = (ts - t0) / 1000;
        const p = e / dur;
        const cx = x0 + (x1 - x0) * p;
        dibujarWaveform(waveformData);
        actualizarSeleccion();
        C.strokeStyle = "white";
        C.beginPath();
        C.moveTo(cx, 0);
        C.lineTo(cx, H);
        C.stroke();
        if (p < 1) requestAnimationFrame(anim);
      }
      requestAnimationFrame(anim);
    }
  
    playSelectionBtn.addEventListener("click", () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      audioBlob.arrayBuffer().then(buf => {
        ac.decodeAudioData(buf, buffer => {
          const src = ac.createBufferSource();
          src.buffer = buffer;
          const dur = buffer.duration;
          const s = +startPointSlider.value / 100;
          const e = +endPointSlider.value / 100;
          src.connect(ac.destination);
          src.start(0, dur * s, dur * (e - s));
          dibujarPlayhead(canvas, s, e, dur * (e - s));
        });
      });
    });
  

//afuera
function generarEscala(raiz, modo) {
    const patron = escalas[modo];
    const notasEnEscala = [];
  
    for (let octava = 1; octava <= 7; octava++) {
      const indexRaiz = baseNotas.findIndex(n => n.nota === `${raiz}${octava}`);
      if (indexRaiz === -1) continue;
  
      patron.forEach(intervalo => {
        const index = indexRaiz + intervalo;
        if (index < baseNotas.length) {
          notasEnEscala.push(baseNotas[index]);
        }
      });
    }
  
    return notasEnEscala;
  }
  

  function notaMasCercanaEnEscala(freq, escala) {
    let mejorNota = null;
    let menorDiferencia = Infinity;
    escala.forEach(n => {
      const dif = Math.abs(freq - n.freq);
      if (dif < menorDiferencia) {
        menorDiferencia = dif;
        mejorNota = n;
      }
    });
    return mejorNota;
  }

  function ventanaHann(N) {
    const w = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    }
    return w;
  }
  
  

    tuneBtn.addEventListener("click", async () => {
      if (!detectPitch) {
        alert("⚠️ Detección de pitch no disponible.");
        return;
      }
  
      // Obtener fragmento seleccionado
      const s = +startPointSlider.value / 100;
      const e = +endPointSlider.value / 100;
      const i0 = Math.floor(waveformData.length * s);
      const i1 = Math.floor(waveformData.length * e);
      const fragment = waveformData.slice(i0, i1);
      fragmentDuration = (i1 - i0) / sampleRate;

  
      // Obtener escala seleccionada
      const raiz = document.getElementById("escala-select").value;
      const modo = document.getElementById("modo-escala").checked ? "menor" : "mayor";
      const escalaSeleccionada = generarEscala(raiz, modo);
  
      // Parámetros

      const windowMs = 50;
      const windowSize = Math.floor((windowMs / 1000) * sampleRate);
      const gainValue = parseFloat(document.getElementById("output-volume").value);
      const intensidadAfinacion = parseFloat(document.getElementById("tuning-intensity").value) / 100;
      const agresividad = parseFloat(document.getElementById("tuning-aggressiveness").value) / 100;

      // Crear fragmentos corregidos
    
  
      const hann = ventanaHann(windowSize);
      const hopSize = Math.floor(windowSize / 2);
      const outputBuffer = new Float32Array(fragment.length + 2 * windowSize);
      const sumaHann = new Float32Array(outputBuffer.length);

      let cursor = 0;

      for (let i = 0; i + windowSize <= fragment.length; i += hopSize) {
        let window = fragment.slice(i, i + windowSize);
window = filtroSuavizado(window); // 👈 Aplica filtro FIR de suavizado
        const freq = detectarPitch(window);
        if (!freq) continue;
      
        const nota = notaMasCercanaEnEscala(freq, escalaSeleccionada);
        if (!nota) continue;
      
// 🎯 Calcular desviación en cents y actualizar vúmetro
const cents = 1200 * Math.log2(freq / nota.freq);
const clamped = Math.max(-50, Math.min(50, cents));
const porcentaje = (clamped + 50) / 100; // de 0 a 1
document.getElementById("aguja").style.left = `${porcentaje * 100}%`;


        const ratio = Math.pow(nota.freq / freq, agresividad);


        if (ratio < 0.8 || ratio > 1.25) continue;

        const correctedSize = Math.floor(windowSize * ratio);
        const corrected = new Float32Array(correctedSize);
        for (let j = 0; j < correctedSize; j++) {
          const index = j / ratio;
          const i0 = Math.floor(index);
          const i1 = i0 + 1;
        
          if (i1 >= window.length) {
            corrected[j] = 0;
            continue;
          }
        
          const frac = index - i0;
          const sample0 = window[i0];
          const sample1 = window[i1];
          corrected[j] = sample0 * (1 - frac) + sample1 * frac;
        }
        
        
      
        for (let j = 0; j < corrected.length; j++) {
          const hannIndex = Math.floor(j * hann.length / corrected.length);
          const w = hann[hannIndex];
          const pos = cursor + j;
        
          outputBuffer[pos] += corrected[j] * w;
          sumaHann[pos] += w;
        }
        cursor += hopSize; // 👈 mueve el cursor al siguiente bloque
        
          
      }
      for (let i = 0; i < outputBuffer.length; i++) {
        if (sumaHann[i] > 0) {
          outputBuffer[i] /= sumaHann[i];
        }
      }
      
      // Reconstruir el fragmento original con Hann y solapamiento
const originalBuffer = new Float32Array(outputBuffer.length);
for (let i = 0; i + windowSize <= fragment.length; i += hopSize) {
  const window = fragment.slice(i, i + windowSize);
  for (let j = 0; j < windowSize; j++) {
    originalBuffer[i + j] += window[j] * hann[j];
  }
}

let afinadoData;
let buffer;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

if (intensidadAfinacion === 0) {
    afinadoData = fragment;
    buffer = audioCtx.createBuffer(1, fragment.length, sampleRate);
    buffer.copyToChannel(fragment, 0);
  } else {
    // Mezclar original reconstruido con afinado
    const mezcla = new Float32Array(outputBuffer.length);
    for (let i = 0; i < outputBuffer.length; i++) {
      const original = originalBuffer[i] || 0;
      const afinado = outputBuffer[i] || 0;
      mezcla[i] = (1 - intensidadAfinacion) * original + intensidadAfinacion * afinado;
    }
  
    // 🔧 Recortar la mezcla para que tenga la misma longitud que el fragmento original
    const trimmed = mezcla.slice(0, fragment.length);
  
    buffer = audioCtx.createBuffer(1, trimmed.length, sampleRate);
    buffer.copyToChannel(trimmed, 0);
    afinadoData = trimmed;
  }
  

tunedBuffer = buffer;
dibujarWaveformAfinado(afinadoData);


      
  
     
      // Reproducir
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = gainValue;


  
      // Mostrar resultado
      document.querySelectorAll(".output-section p").forEach(x => x.remove());
      const p = document.createElement("p");
      p.textContent = `✅ Afinación aplicada con solapamiento.`;

      outputSection.appendChild(p);
    });

    const downloadBtn = document.getElementById("download-btn");
    downloadBtn.addEventListener("click", () => {
      if (!tunedBuffer) {
        alert("⚠️ Primero debes afinar el audio.");
        return;
      }
    
      const wavBlob = audioBufferToWav(tunedBuffer);
      const url = URL.createObjectURL(wavBlob);
      downloadBtn.href = url;
    });

    
    mostrarEscalaSeleccionada();
  }

  function filtroSuavizado(window) {
    const output = new Float32Array(window.length);
    for (let i = 1; i < window.length - 1; i++) {
      output[i] = 0.25 * window[i - 1] + 0.5 * window[i] + 0.25 * window[i + 1];
    }
  
    // Opcional: copiar bordes sin modificar
    output[0] = window[0];
    output[window.length - 1] = window[window.length - 1];
  
    return output;
  }
  

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2;
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);
  
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
  
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
  
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = buffer.getChannelData(ch)[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
  
    return new Blob([view], { type: 'audio/wav' });
  }

