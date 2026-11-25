// --- TAB SWITCHING ---
function switchTab(tabId, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

// --- CONTIGUOUS MEMORY ALLOCATION ---
let totalMem = 1024;
let blocks = [];
let procCounter = 1;
let nextFitIndex = 0;

function initMemory() {
  totalMem = Math.max(64, parseInt(document.getElementById('totalMemInput').value) || 1024);
  blocks = [{ id: null, size: totalMem, free: true }];
  procCounter = 1;
  nextFitIndex = 0;
  document.getElementById('allocLog').innerHTML = '';
  logAlloc(`Memory initialized to ${totalMem} KB.`, 'ok');
  renderMemory();
}

function logAlloc(msg, type = '') {
  const box = document.getElementById('allocLog');
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.prepend(div);
}

function allocateProcess() {
  const size = parseInt(document.getElementById('procSizeInput').value);
  const algo = document.getElementById('allocAlgo').value;
  if (!size || size <= 0) return logAlloc('Enter a valid process size.', 'err');

  let targetIdx = -1;
  if (algo === 'first') {
    targetIdx = blocks.findIndex(b => b.free && b.size >= size);
  } else if (algo === 'best') {
    let minSize = Infinity;
    blocks.forEach((b, i) => {
      if (b.free && b.size >= size && b.size < minSize) {
        minSize = b.size;
        targetIdx = i;
      }
    });
  } else if (algo === 'worst') {
    let maxSize = -1;
    blocks.forEach((b, i) => {
      if (b.free && b.size >= size && b.size > maxSize) {
        maxSize = b.size;
        targetIdx = i;
      }
    });
  } else if (algo === 'next') {
    for (let offset = 0; offset < blocks.length; offset++) {
      const i = (nextFitIndex + offset) % blocks.length;
      if (blocks[i].free && blocks[i].size >= size) {
        targetIdx = i;
        nextFitIndex = i;
        break;
      }
    }
  }

  if (targetIdx === -1) {
    return logAlloc(`Allocation failed: No free block >= ${size} KB.`, 'err');
  }

  const chosen = blocks[targetIdx];
  const pid = `P${procCounter++}`;
  const remaining = chosen.size - size;
  const newBlocks = [{ id: pid, size: size, free: false }];
  if (remaining > 0) newBlocks.push({ id: null, size: remaining, free: true });

  blocks.splice(targetIdx, 1, ...newBlocks);
  logAlloc(`Allocated ${pid} (${size} KB) using ${algo.toUpperCase()} Fit.`, 'ok');
  renderMemory();
}

function deallocateBlock(index) {
  const b = blocks[index];
  if (!b || b.free) return;
  const pid = b.id;
  b.free = true;
  b.id = null;

  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].free && blocks[i + 1].free) {
      blocks[i].size += blocks[i + 1].size;
      blocks.splice(i + 1, 1);
      i--;
    }
  }
  logAlloc(`Deallocated ${pid} and merged adjacent free space.`);
  renderMemory();
}

function compactMemory() {
  const allocated = blocks.filter(b => !b.free);
  const usedSize = allocated.reduce((sum, b) => sum + b.size, 0);
  const freeSize = totalMem - usedSize;

  blocks = [...allocated];
  if (freeSize > 0) blocks.push({ id: null, size: freeSize, free: true });
  nextFitIndex = 0;
  logAlloc(`Memory compacted. Free space consolidated into ${freeSize} KB.`, 'ok');
  renderMemory();
}

function renderMemory() {
  const bar = document.getElementById('memoryBar');
  bar.innerHTML = '';
  let used = 0;
  let free = 0;
  let freeBlocks = 0;

  blocks.forEach((b, idx) => {
    if (b.free) {
      free += b.size;
      freeBlocks++;
    } else {
      used += b.size;
    }

    const div = document.createElement('div');
    div.className = `mem-block ${b.free ? 'free' : 'allocated'}`;
    div.style.width = `${(b.size / totalMem) * 100}%`;
    div.title = `${b.free ? 'Free' : b.id}: ${b.size} KB`;
    div.innerHTML = `<span>${b.free ? 'Free' : b.id}</span><span>${b.size}K</span>`;
    if (!b.free) div.onclick = () => deallocateBlock(idx);
    bar.appendChild(div);
  });

  document.getElementById('mTotal').textContent = `${totalMem} KB`;
  document.getElementById('mUsed').textContent = `${used} KB`;
  document.getElementById('mFree').textContent = `${free} KB`;
  document.getElementById('mFrags').textContent = freeBlocks;
}

// --- PAGING & PAGE REPLACEMENT ---
let pagingHistory = [];
let currentStep = 0;
let currentFrameCount = 3;
let playTimer = null;

function simulatePagingData(algo, frameCount, refs) {
  let frames = [];
  let fifoQueue = [];
  const history = [];

  refs.forEach((page, step) => {
    const isHit = frames.includes(page);
    if (!isHit) {
      if (frames.length < frameCount) {
        frames.push(page);
        fifoQueue.push(page);
      } else {
        let victim = null;
        if (algo === 'fifo') {
          victim = fifoQueue.shift();
          fifoQueue.push(page);
        } else if (algo === 'lru') {
          let lruIdx = Infinity;
          frames.forEach(f => {
            const lastUsed = refs.slice(0, step).lastIndexOf(f);
            if (lastUsed < lruIdx) {
              lruIdx = lastUsed;
              victim = f;
            }
          });
        } else if (algo === 'optimal') {
          let farthest = -1;
          frames.forEach(f => {
            const nextUse = refs.slice(step + 1).indexOf(f);
            if (nextUse === -1) {
              farthest = Infinity;
              victim = f;
            } else if (nextUse > farthest) {
              farthest = nextUse;
              victim = f;
            }
          });
        }
        frames[frames.indexOf(victim)] = page;
      }
    }
    history.push({ page, frames: [...frames], isHit });
  });

  return history;
}

function preparePaging() {
  stopPlay();
  document.getElementById('anomalyBox').className = 'anomaly-box';
  const algo = document.getElementById('pageAlgo').value;
  currentFrameCount = Math.max(1, parseInt(document.getElementById('frameCountInput').value) || 3);
  const refs = document.getElementById('refStringInput').value.trim().split(/\s+/).filter(Boolean);
  if (refs.length === 0) return;

  pagingHistory = simulatePagingData(algo, currentFrameCount, refs);
  currentStep = pagingHistory.length;
  renderPagingView();
}

function stepPaging(delta) {
  currentStep = Math.max(1, Math.min(pagingHistory.length, currentStep + delta));
  renderPagingView();
}

function resetPagingView() {
  stopPlay();
  currentStep = pagingHistory.length;
  renderPagingView();
}

function togglePlay() {
  if (playTimer) {
    stopPlay();
  } else {
    if (currentStep >= pagingHistory.length) currentStep = 1;
    document.getElementById('btnPlay').textContent = 'Pause';
    renderPagingView();
    playTimer = setInterval(() => {
      if (currentStep < pagingHistory.length) {
        currentStep++;
        renderPagingView();
      } else {
        stopPlay();
      }
    }, 700);
  }
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  document.getElementById('btnPlay').textContent = 'Auto-Play';
}

function renderPagingView() {
  const visible = pagingHistory.slice(0, currentStep);
  const hits = visible.filter(h => h.isHit).length;
  const faults = visible.length - hits;

  document.getElementById('pTotal').textContent = visible.length;
  document.getElementById('pHits').textContent = hits;
  document.getElementById('pFaults').textContent = faults;
  document.getElementById('pRatio').textContent = visible.length ? `${((hits / visible.length) * 100).toFixed(1)}%` : '0%';
  document.getElementById('stepIndicator').textContent = `Step: ${currentStep} / ${pagingHistory.length}`;

  document.getElementById('btnPrev').disabled = currentStep <= 1;
  document.getElementById('btnNext').disabled = currentStep >= pagingHistory.length;

  let html = `<table><thead><tr><th>Step</th>`;
  visible.forEach((h, i) => {
    const cls = i === currentStep - 1 ? 'active-col' : '';
    html += `<th class="${cls}">${h.page}</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let f = 0; f < currentFrameCount; f++) {
    html += `<tr><th>Frame ${f + 1}</th>`;
    visible.forEach((h, i) => {
      const cls = i === currentStep - 1 ? 'active-col' : '';
      html += `<td class="${cls}">${h.frames[f] !== undefined ? h.frames[f] : '-'}</td>`;
    });
    html += `</tr>`;
  }

  html += `<tr><th>Status</th>`;
  visible.forEach((h, i) => {
    const activeCls = i === currentStep - 1 ? 'active-col' : '';
    html += `<td class="${h.isHit ? 'badge-hit' : 'badge-fault'} ${activeCls}">${h.isHit ? 'HIT' : 'FAULT'}</td>`;
  });
  html += `</tr></tbody></table>`;

  document.getElementById('pagingTableWrap').innerHTML = html;
}

function checkBelady() {
  const framesN = Math.max(1, parseInt(document.getElementById('frameCountInput').value) || 3);
  const refs = document.getElementById('refStringInput').value.trim().split(/\s+/).filter(Boolean);
  if (refs.length === 0) return;

  const faultsN = simulatePagingData('fifo', framesN, refs).filter(h => !h.isHit).length;
  const faultsN1 = simulatePagingData('fifo', framesN + 1, refs).filter(h => !h.isHit).length;

  const box = document.getElementById('anomalyBox');
  if (faultsN1 > faultsN) {
    box.className = 'anomaly-box detected';
    box.textContent = `Belady's Anomaly Detected! Under FIFO, ${framesN} frames produced ${faultsN} faults, while ${framesN + 1} frames produced ${faultsN1} faults.`;
  } else {
    box.className = 'anomaly-box none';
    box.textContent = `No Belady's Anomaly for this string: ${framesN} frames = ${faultsN} faults, ${framesN + 1} frames = ${faultsN1} faults.`;
  }
}

// Initialize on load
initMemory();
preparePaging();