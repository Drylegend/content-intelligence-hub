window.CIH = window.CIH || {};

window.CIH.routes = {
  home: "/html/index.html",
  login: "/html/login.html",
  register: "/html/register.html",
  dashboard: "/html/dashboard.html",
  scraper: "/html/scraper.html",
  summary: "/html/summary.html",
  audio: "/html/audio.html",
  saved: "/html/saved.html",
  about: "/html/about.html",
  contact: "/html/contact.html",
  reactDashboard: "/react-app/index.html"
};

window.CIH.getToken = function getToken() {
  return localStorage.getItem("token") || "";
};

window.CIH.setToken = function setToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  }
};

window.CIH.clearToken = function clearToken() {
  localStorage.removeItem("token");
};

window.CIH.authHeader = function authHeader(extraHeaders = {}) {
  if (extraHeaders.Authorization || extraHeaders.authorization) {
    return { ...extraHeaders };
  }

  const token = window.CIH.getToken();
  return token
    ? { ...extraHeaders, Authorization: `Bearer ${token}` }
    : { ...extraHeaders };
};

window.CIH.storeContentId = function storeContentId(contentId) {
  sessionStorage.setItem("contentId", contentId);
};

window.CIH.getContentId = function getContentId() {
  return sessionStorage.getItem("contentId") || "";
};

window.CIH.apiFetch = async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  const shouldSetJson = body && !(body instanceof FormData) && !headers.has("Content-Type");

  if (shouldSetJson) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers: window.CIH.authHeader(Object.fromEntries(headers.entries())),
    body
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
};

window.CIH.requireAuth = function requireAuth() {
  const token = window.CIH.getToken();
  if (!token) {
    window.location.href = window.CIH.routes.login;
    return false;
  }
  return true;
};

window.CIH.formatDate = function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

window.CIH.formatBytes = function formatBytes(bytes) {
  const numericBytes = Number(bytes || 0);
  if (!numericBytes) {
    return "0 B";
  }

  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(numericBytes) / Math.log(1024)), sizes.length - 1);
  const value = numericBytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${sizes[index]}`;
};

window.CIH.formatDuration = function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

window.CIH.estimateReadDuration = function estimateReadDuration(wordCount) {
  return Math.max(1, Math.round(Number(wordCount || 0) / 150));
};

window.CIH.arrayBufferToBase64 = function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

window.CIH.joinUint8Arrays = function joinUint8Arrays(arrays) {
  const totalLength = arrays.reduce((sum, item) => sum + item.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  arrays.forEach((array) => {
    merged.set(array, offset);
    offset += array.length;
  });

  return merged;
};

window.CIH.getTheme = function getTheme() {
  return localStorage.getItem("cih-theme") || "light";
};

window.CIH.setTheme = function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("cih-theme", theme);
  updateThemeImages();
  updateThemeToggleUI();
};

window.CIH.setButtonLoading = function setButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.classList.toggle("is-loading", Boolean(isLoading));
  button.setAttribute("aria-busy", String(Boolean(isLoading)));
};

window.CIH.showLoader = function showLoader(message = "Loading premium workspace") {
  const loader = document.getElementById("appLoader");
  if (!loader) {
    return;
  }

  const copy = loader.querySelector("[data-loader-copy]");
  if (copy) {
    copy.textContent = message;
  }

  loader.classList.remove("is-hidden");
};

window.CIH.hideLoader = function hideLoader() {
  const loader = document.getElementById("appLoader");
  if (!loader) {
    return;
  }

  loader.classList.add("is-hidden");
};

function ensureLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
    return Promise.resolve();
  }

  if (window.__cihLucidePromise) {
    return window.__cihLucidePromise;
  }

  window.__cihLucidePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js";
    script.onload = () => {
      window.lucide.createIcons();
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__cihLucidePromise;
}

function setActiveNav() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === page) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function syncAuthUI() {
  const authContainers = document.querySelectorAll(".nav-auth");
  const token = window.CIH.getToken();

  authContainers.forEach((container) => {
    container.innerHTML = token
      ? `
        <a href="${window.CIH.routes.dashboard}" class="btn btn-outline">Dashboard</a>
        <button type="button" class="btn btn-primary" data-logout>Log Out</button>
      `
      : `
        <a href="${window.CIH.routes.login}" class="btn btn-outline">Sign In</a>
        <a href="${window.CIH.routes.register}" class="btn btn-primary">Sign Up</a>
      `;
  });
}

function updateThemeToggleUI() {
  const theme = window.CIH.getTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const icon = button.querySelector("[data-theme-icon]");
    const label = button.querySelector("[data-theme-label]");
    if (icon) {
      icon.setAttribute("data-lucide", theme === "dark" ? "sun-medium" : "moon-star");
    }
    if (label) {
      label.textContent = theme === "dark" ? "Light" : "Dark";
    }
  });

  ensureLucide().catch(() => {});
}

function updateThemeImages() {
  const theme = window.CIH.getTheme();
  document.querySelectorAll("[data-theme-image]").forEach((image) => {
    const nextSrc = theme === "dark" ? image.dataset.darkSrc : image.dataset.lightSrc;
    if (nextSrc) {
      image.src = nextSrc;
    }
  });
}

function ensureBrandFavicon() {
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }

  icon.type = "image/svg+xml";
  icon.href = "/images/logo-cih.svg";
}

function injectNavUtilities() {
  document.querySelectorAll(".nav-container").forEach((container) => {
    if (container.querySelector(".nav-utilities")) {
      return;
    }

    const utilities = document.createElement("div");
    utilities.className = "nav-utilities";
    utilities.innerHTML = `
      <button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle color theme">
        <span data-theme-icon data-lucide="moon-star"></span>
        <span class="theme-toggle-label" data-theme-label>Dark</span>
      </button>
    `;

    const auth = container.querySelector(".nav-auth");
    if (auth) {
      container.insertBefore(utilities, auth);
    } else {
      container.appendChild(utilities);
    }
  });
}

function bindThemeToggle() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-theme-toggle]");
    if (!toggle) {
      return;
    }

    const nextTheme = window.CIH.getTheme() === "dark" ? "light" : "dark";
    window.CIH.setTheme(nextTheme);
  });
}

function applySavedTheme() {
  document.documentElement.setAttribute("data-theme", window.CIH.getTheme());
  updateThemeImages();
}

function injectLoader() {
  if (document.getElementById("appLoader")) {
    return;
  }

  const loader = document.createElement("div");
  loader.className = "app-loader";
  loader.id = "appLoader";
  loader.innerHTML = `
    <div class="loader-panel">
      <div class="loader-mark">CIH</div>
      <div class="loader-rings" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p class="loader-copy" data-loader-copy>Loading premium workspace</p>
    </div>
  `;

  document.body.appendChild(loader);
}

function bindNavigationLoader() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href$=".html"], a[href^="#"]');
    if (!link) {
      return;
    }

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) {
      return;
    }

    window.CIH.showLoader("Opening workspace");
  });
}

function bindLogout() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-logout]");
    if (!trigger) {
      return;
    }

    window.CIH.clearToken();
    syncAuthUI();
    window.location.href = window.CIH.routes.login;
  });
}

function initNavToggle() {
  const navbar = document.querySelector(".navbar");
  const navToggle = document.getElementById("navToggle");
  if (!navbar || !navToggle) {
    return;
  }

  navToggle.innerHTML = '<span data-lucide="menu"></span>';

  navToggle.addEventListener("click", () => {
    navbar.classList.toggle("nav-open");
    ensureLucide().catch(() => {});
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => navbar.classList.remove("nav-open"));
  });
}

function injectYear() {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  ensureBrandFavicon();
  injectNavUtilities();
  setActiveNav();
  syncAuthUI();
  bindThemeToggle();
  bindLogout();
  initNavToggle();
  injectLoader();
  bindNavigationLoader();
  injectYear();
  updateThemeToggleUI();
  ensureLucide().catch(() => {});
  window.setTimeout(() => {
    window.CIH.hideLoader();
  }, 420);
});
