const manifestData = {
    name: "Odometer Music Picker",
    short_name: "MusicPicker",
    start_url: "./",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#121214",
    orientation: "portrait",
    icons: [
        { src: "https://imglink.cc/cdn/94Z4EzdzuP.jpeg", sizes: "192x192", type: "image/jpeg" },
        { src: "https://imglink.cc/cdn/94Z4EzdzuP.jpeg", sizes: "512x512", type: "image/jpeg" }
    ]
};

const artistData = {
    "No.1": ["Koyu", "Tekel Sessizliği", "Full Kontak", "Bana Titre", "Sıkıntı Var"],
    "Stabil": ["Lavanta"],
    "Ceza": ["Holocaust", "Neyim Var Ki", "Yerli Plaka", "Feyz Al", "Panorama"],
    "Sagopa": ["Galiba", "Vasiyet", "Baytar", "Bu Şehri Arkamda Bırakıyorum", "Kendim Nedense"],
    "Blok3": ["Affetmem", "Patlattılar", "Gözlerinde Gözlerim", "Vur", "Olay"],
    "Şehinşah": ["Kana Kana", "İblis", "Düstur", "Pusula", "Yarım Kalır"],
    "Kezzo": ["Hikayeme Devam", "Geceler", "Kafam Hariç", "Dipsiz Kuyu", "Sokaklar"],
    "Allame": ["Fare Kapanı", "Manzara", "Kötü", "Bir Dakika", "Saldır"],
    "Joker": ["Yaşamak Öldürür", "Rhyme Terapisti", "Gözlerim", "Karakter", "Kafası Mükemmel"]
};

const artistImages = {
    "No.1": "https://imglink.cc/cdn/94Z4EzdzuP.jpeg",
    "Stabil": "https://imglink.cc/cdn/GVUbHybITO.jpeg"
};

const songAudioMap = {
    "No.1_Koyu": "https://mp3tourl.com/audio/1790626084973-2451ea90-b9f7-4f0e-8a4c-aa5a036b25aa.mp3",
    "No.1_Tekel Sessizliği": "https://mp3tourl.com/audio/1790801306851-3faa8b04-e920-4094-a819-8c5debd25c47.mp3"
};

const elements = {
    statusBar: document.getElementById("statusBar"),
    statusText: document.getElementById("statusText"),
    wheelContainer: document.getElementById("wheelContainer"),
    pickerList: document.getElementById("pickerList"),
    selectedTitle: document.getElementById("selectedTitle"),
    headerSubtitle: document.getElementById("headerSubtitle"),
    actionBtn: document.getElementById("actionBtn"),
    backBtn: document.getElementById("backBtn"),
    timeCounter: document.getElementById("timeCounter"),
    playerControlsContainer: document.getElementById("playerControlsContainer"),
    waveformArea: document.getElementById("waveformArea"),
    artistAvatarContainer: document.getElementById("artistAvatarContainer"),
    artistAvatarImg: document.getElementById("artistAvatarImg"),
    avatarPlaceholder: document.getElementById("avatarPlaceholder")
};

let currentAudioElement = null;
let currentPlayingKey = "";
const preloadedAudioCache = {};
let wakeLock = null;
let isUserScrolling = false;
let scrollTimeout = null;
let currentMode = "artists";
let currentData = Object.keys(artistData);
let selectedArtistName = "";
let selectedArtistIndex = 0;
let isPlaying = false;
let scrollOffset = 0;
let targetOffset = 0;
let isDragging = false;
let lastY = 0;
let velocity = 0;
let lastActiveIndex = -1;
let cachedItems = [];
let cachedSpans = [];
let lastAvatarName = "";
const totalWaveformBars = 32;

function setStatus(text, mode = "idle") {
    elements.statusText.textContent = text;
    elements.statusBar.classList.remove("status-searching", "status-playing", "status-paused");
    if (mode === "searching") elements.statusBar.classList.add("status-searching");
    else if (mode === "playing") elements.statusBar.classList.add("status-playing");
    else if (mode === "paused") elements.statusBar.classList.add("status-paused");
}

async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request("screen");
    } catch (_) {
        // Wake Lock is optional; playback can continue without it.
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {}).finally(() => { wakeLock = null; });
    }
}

function triggerHaptic(type = "tick") {
    if (!("vibrate" in navigator)) return;
    const patterns = {
        tick: 8,
        selection: 15,
        click: 25,
        play: [20, 40, 20],
        back: 30
    };
    navigator.vibrate(patterns[type] ?? 10);
}

function initWaveform() {
    elements.waveformArea.innerHTML = "";
    const baseHeights = [10, 16, 22, 12, 28, 18, 32, 14, 24, 30, 16, 20, 26, 12, 22, 18];
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < totalWaveformBars; i++) {
        const bar = document.createElement("div");
        bar.className = "waveform-bar";
        bar.style.height = `${baseHeights[i % baseHeights.length]}px`;
        fragment.appendChild(bar);
    }
    elements.waveformArea.appendChild(fragment);
}

function setWaveformPlaying(playing) {
    Array.from(elements.waveformArea.children).forEach(bar => {
        bar.classList.toggle("playing", playing);
    });
}

function updateWaveformProgress(percentage) {
    const bars = elements.waveformArea.children;
    const activeCount = Math.round((percentage / 100) * bars.length);
    for (let i = 0; i < bars.length; i++) {
        bars[i].classList.toggle("active", i < activeCount);
    }
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function seekSong(clientX) {
    if (!currentAudioElement || !Number.isFinite(currentAudioElement.duration)) return;
    const rect = elements.waveformArea.getBoundingClientRect();
    if (!rect.width) return;
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    currentAudioElement.currentTime = percentage * currentAudioElement.duration;
    updateWaveformProgress(percentage * 100);
}

function updateActionButtonText() {
    elements.actionBtn.textContent = currentMode === "artists" ? "Seç" : (isPlaying ? "Durdur" : "Oynat");
}

function preloadSong(songKey, audioUrl) {
    if (!audioUrl || preloadedAudioCache[songKey]) return;
    const audio = new Audio();
    audio.src = audioUrl;
    audio.preload = "auto";
    audio.load();
    preloadedAudioCache[songKey] = audio;
}

function playSongAtIndex(index) {
    if (index < 0 || index >= currentData.length) return;

    targetOffset = index;
    const songName = currentData[index];
    const songKey = `${selectedArtistName}_${songName}`;
    const audioUrl = songAudioMap[songKey];

    if (!audioUrl) {
        currentPlayingKey = "";
        isPlaying = false;
        if (currentAudioElement) currentAudioElement.pause();
        setWaveformPlaying(false);
        updateWaveformProgress(0);
        elements.timeCounter.textContent = "0:00 / 0:00";
        updateActionButtonText();
        setStatus("Ses dosyası yok", "paused");
        releaseWakeLock();
        return;
    }

    if (currentAudioElement && currentPlayingKey === songKey) {
        currentAudioElement.play().then(() => {
            isPlaying = true;
            setWaveformPlaying(true);
            updateActionButtonText();
            setStatus("Çalınıyor", "playing");
            requestWakeLock();
            triggerHaptic("play");
        }).catch(() => {
            isPlaying = false;
            updateActionButtonText();
            setStatus("Oynatma başarısız", "paused");
        });
        return;
    }

    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
    }

    currentAudioElement = preloadedAudioCache[songKey] || new Audio(audioUrl);
    currentAudioElement.preload = "auto";
    preloadedAudioCache[songKey] = currentAudioElement;
    currentPlayingKey = songKey;

    currentAudioElement.ontimeupdate = () => {
        if (!currentAudioElement || currentPlayingKey !== songKey) return;
        const current = currentAudioElement.currentTime;
        const duration = currentAudioElement.duration;
        elements.timeCounter.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
        if (duration > 0) updateWaveformProgress((current / duration) * 100);
    };

    currentAudioElement.onended = () => {
        if (currentPlayingKey !== songKey) return;
        isPlaying = false;
        setWaveformPlaying(false);
        updateWaveformProgress(0);
        elements.timeCounter.textContent = "0:00 / 0:00";
        updateActionButtonText();
        setStatus("Hazır", "idle");
        releaseWakeLock();
        targetOffset = (index + 1) % currentData.length;
    };

    currentAudioElement.play().then(() => {
        isPlaying = true;
        setWaveformPlaying(true);
        updateActionButtonText();
        setStatus("Çalınıyor", "playing");
        requestWakeLock();
        triggerHaptic("play");
    }).catch(() => {
        isPlaying = false;
        setWaveformPlaying(false);
        updateActionButtonText();
        setStatus("Oynatma başarısız", "paused");
    });
}

function togglePlayState() {
    const activeIndex = Math.round(scrollOffset);
    if (isPlaying) {
        if (currentAudioElement) currentAudioElement.pause();
        isPlaying = false;
        setWaveformPlaying(false);
        updateActionButtonText();
        setStatus("Duraklatıldı", "paused");
        releaseWakeLock();
        triggerHaptic("click");
    } else {
        playSongAtIndex(activeIndex);
    }
}

function updateArtistAvatar(name) {
    if (lastAvatarName === name) return;
    lastAvatarName = name;
    elements.artistAvatarContainer.classList.add("fade-out");

    setTimeout(() => {
        const imageUrl = artistImages[name];
        if (imageUrl) {
            elements.artistAvatarImg.src = imageUrl;
            elements.artistAvatarImg.style.display = "block";
            elements.avatarPlaceholder.style.display = "none";
        } else {
            elements.artistAvatarImg.removeAttribute("src");
            elements.artistAvatarImg.style.display = "none";
            elements.avatarPlaceholder.style.display = "block";
        }
        elements.artistAvatarContainer.classList.remove("fade-out");
    }, 120);
}

function loadList(dataArray, startIndex = 0) {
    currentData = dataArray;
    scrollOffset = startIndex;
    targetOffset = startIndex;
    velocity = 0;
    lastActiveIndex = -1;

    elements.pickerList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    currentData.forEach(item => {
        const el = document.createElement("div");
        el.className = "picker-wheel-item";
        const span = document.createElement("span");
        span.textContent = item;
        span.style.color = "#ffffff";
        el.appendChild(span);
        fragment.appendChild(el);
    });

    elements.pickerList.appendChild(fragment);
    cachedItems = [];
    cachedSpans = [];

    if (currentMode === "songs") {
        currentData.forEach(songName => {
            const key = `${selectedArtistName}_${songName}`;
            if (songAudioMap[key]) preloadSong(key, songAudioMap[key]);
        });
    }
}

function updatePositions() {
    if (!isDragging) {
        targetOffset += velocity;
        velocity *= 0.82;

        if (Math.abs(velocity) < 0.0008) {
            const nearest = Math.round(targetOffset);
            targetOffset += (nearest - targetOffset) * 0.15;
            if (isUserScrolling && Math.abs(nearest - targetOffset) < 0.001) {
                isUserScrolling = false;
                setStatus(currentMode === "artists" ? "Sanatçı seçildi" : "Şarkı seçildi", "idle");
            }
        }
    }

    const len = currentData.length;
    if (!len) {
        requestAnimationFrame(updatePositions);
        return;
    }

    if (targetOffset < 0) {
        targetOffset *= 0.8;
        velocity = 0;
    } else if (targetOffset > len - 1) {
        targetOffset = (len - 1) + (targetOffset - (len - 1)) * 0.8;
        velocity = 0;
    }

    scrollOffset += (targetOffset - scrollOffset) * 0.18;
    const activeIndex = Math.round(scrollOffset);

    if (activeIndex >= 0 && activeIndex < len && activeIndex !== lastActiveIndex) {
        lastActiveIndex = activeIndex;
        elements.selectedTitle.textContent = currentData[activeIndex];
        triggerHaptic("selection");

        if (currentMode === "artists") {
            selectedArtistIndex = activeIndex;
            updateArtistAvatar(currentData[activeIndex]);
        } else {
            if (isPlaying) {
                if (currentAudioElement) currentAudioElement.pause();
                isPlaying = false;
                setWaveformPlaying(false);
                updateActionButtonText();
                setStatus("Duraklatıldı", "paused");
                releaseWakeLock();
            }

            const songKey = `${selectedArtistName}_${currentData[activeIndex]}`;
            if (currentPlayingKey !== songKey) {
                if (currentAudioElement) {
                    currentAudioElement.pause();
                    currentAudioElement = null;
                }
                currentPlayingKey = "";
                elements.timeCounter.textContent = "0:00 / 0:00";
                updateWaveformProgress(0);
            }
        }
    }

    if (cachedItems.length !== len) {
        cachedItems = Array.from(elements.pickerList.children);
        cachedSpans = cachedItems.map(el => el.querySelector("span"));
    }

    const itemHeight = 45;
    for (let i = 0; i < len; i++) {
        const distance = i - scrollOffset;
        const absDist = Math.abs(distance);
        const item = cachedItems[i];
        if (!item) continue;

        item.style.transform = `translate3d(0, ${distance * itemHeight}px, 0) rotateX(${distance * -20}deg) scale(${Math.max(0.6, 1 - absDist * 0.18)})`;
        item.style.opacity = Math.max(0.1, 1 - absDist * 0.5);
        item.style.zIndex = Math.round(100 - absDist * 10);

        const span = cachedSpans[i];
        if (span) {
            span.style.color = absDist < 0.25 ? "#ffffff" : "#71717a";
            span.style.fontWeight = absDist < 0.25 ? "700" : "400";
        }
    }

    requestAnimationFrame(updatePositions);
}

function handleActionButtonAction(event) {
    event?.stopPropagation();
    event?.preventDefault();
    triggerHaptic("click");

    if (currentMode === "artists") {
        selectedArtistIndex = Math.round(scrollOffset);
        selectedArtistName = elements.selectedTitle.textContent;
        currentMode = "songs";

        elements.headerSubtitle.style.opacity = 0;
        elements.selectedTitle.style.opacity = 0;
        setTimeout(() => {
            elements.headerSubtitle.textContent = "Seçilen Şarkı";
            elements.headerSubtitle.style.opacity = 1;
            elements.selectedTitle.style.opacity = 1;
        }, 120);

        updateActionButtonText();
        elements.backBtn.style.display = "flex";
        elements.playerControlsContainer.style.display = "flex";
        elements.timeCounter.textContent = "0:00 / 0:00";
        initWaveform();
        loadList(artistData[selectedArtistName] || ["Şarkı bulunamadı"], 0);
        setStatus("Şarkı seçildi", "idle");
    } else {
        togglePlayState();
    }
}

function goBackToArtists(event) {
    event?.stopPropagation();
    event?.preventDefault();
    triggerHaptic("back");

    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        currentAudioElement = null;
    }
    currentPlayingKey = "";
    isPlaying = false;
    setWaveformPlaying(false);
    updateActionButtonText();
    releaseWakeLock();

    currentMode = "artists";
    elements.headerSubtitle.style.opacity = 0;
    elements.selectedTitle.style.opacity = 0;

    setTimeout(() => {
        elements.headerSubtitle.textContent = "Seçilen Sanatçı";
        elements.headerSubtitle.style.opacity = 1;
        elements.selectedTitle.style.opacity = 1;
    }, 120);

    elements.backBtn.style.display = "none";
    elements.playerControlsContainer.style.display = "none";
    updateActionButtonText();

    const artists = Object.keys(artistData);
    loadList(artists, selectedArtistIndex);
    updateArtistAvatar(artists[selectedArtistIndex]);
    setStatus("Sanatçı seçildi", "idle");
}

function setupListeners() {
    let lastActionClickTime = 0;
    const safeButtonHandler = handler => event => {
        const now = Date.now();
        if (now - lastActionClickTime < 300) return;
        lastActionClickTime = now;
        handler(event);
    };

    elements.actionBtn.addEventListener("click", safeButtonHandler(handleActionButtonAction));
    elements.backBtn.addEventListener("click", safeButtonHandler(goBackToArtists));

    const onStart = (event, y) => {
        if (event.target.closest("#actionBtn") || event.target.closest("#backBtn")) return;
        isDragging = true;
        isUserScrolling = true;
        lastY = y;
        velocity = 0;
        setStatus(currentMode === "artists" ? "Sanatçı seçiliyor..." : "Şarkı seçiliyor...", "searching");
    };

    const onMove = y => {
        if (!isDragging) return;
        const delta = y - lastY;
        lastY = y;
        targetOffset -= delta / 75;
        velocity = -delta / 75;
        if (Math.abs(delta) > 5) triggerHaptic("tick");
    };

    const onEnd = () => { isDragging = false; };

    elements.wheelContainer.addEventListener("mousedown", event => onStart(event, event.clientY));
    window.addEventListener("mousemove", event => onMove(event.clientY));
    window.addEventListener("mouseup", onEnd);

    elements.wheelContainer.addEventListener("touchstart", event => {
        if (event.touches.length) onStart(event, event.touches[0].clientY);
    }, { passive: true });
    window.addEventListener("touchmove", event => {
        if (event.touches.length) onMove(event.touches[0].clientY);
    }, { passive: true });
    window.addEventListener("touchend", onEnd);

    elements.wheelContainer.addEventListener("wheel", event => {
        event.preventDefault();
        isUserScrolling = true;
        setStatus("Seçiliyor...", "searching");
        targetOffset = Math.max(0, Math.min(currentData.length - 1, targetOffset + event.deltaY * 0.0018));
        triggerHaptic("tick");

        if (currentMode === "songs" && isPlaying) {
            if (currentAudioElement) currentAudioElement.pause();
            isPlaying = false;
            setWaveformPlaying(false);
            updateActionButtonText();
            elements.timeCounter.textContent = "0:00 / 0:00";
            updateWaveformProgress(0);
            setStatus("Duraklatıldı", "paused");
            releaseWakeLock();
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isUserScrolling = false;
            setStatus("Hazır", "idle");
        }, 100);
    }, { passive: false });

    let isSeeking = false;
    const handleSeekStart = clientX => {
        isSeeking = true;
        seekSong(clientX);
        triggerHaptic("tick");
    };
    const handleSeekMove = clientX => {
        if (isSeeking) seekSong(clientX);
    };
    const handleSeekEnd = () => { isSeeking = false; };

    elements.waveformArea.addEventListener("mousedown", event => handleSeekStart(event.clientX));
    window.addEventListener("mousemove", event => handleSeekMove(event.clientX));
    window.addEventListener("mouseup", handleSeekEnd);

    elements.waveformArea.addEventListener("touchstart", event => {
        if (event.touches.length) handleSeekStart(event.touches[0].clientX);
    }, { passive: true });
    window.addEventListener("touchmove", event => {
        if (isSeeking && event.touches.length) handleSeekMove(event.touches[0].clientX);
    }, { passive: true });
    window.addEventListener("touchend", handleSeekEnd);
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    // Service workers require a separate same-origin JS file and a secure context.
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

window.addEventListener("load", () => {
    loadList(Object.keys(artistData), 0);
    updateActionButtonText();
    requestAnimationFrame(updatePositions);
    setupListeners();
    registerServiceWorker();
    setStatus("Hazır", "idle");
});
