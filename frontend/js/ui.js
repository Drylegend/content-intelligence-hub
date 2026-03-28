window.CIH = window.CIH || {};

window.CIH.showToast = function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(window.CIH.toastTimeout);
  window.CIH.toastTimeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
};

window.CIH.showAlert = function showAlert(options = {}) {
  const settings =
    typeof options === "string"
      ? { message: options }
      : {
          title: options.title || "Notice",
          message: options.message || "",
          tone: options.tone || "info"
        };

  let modal = document.getElementById("alertModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "alertModal";
    modal.className = "alert-modal hidden";
    modal.innerHTML = `
      <div class="alert-modal__backdrop" data-alert-close></div>
      <div class="alert-modal__panel" role="alertdialog" aria-modal="true" aria-labelledby="alertModalTitle" aria-describedby="alertModalMessage">
        <div class="alert-modal__header">
          <strong id="alertModalTitle">Notice</strong>
          <button type="button" class="alert-modal__close" aria-label="Close popup" data-alert-close>&times;</button>
        </div>
        <p class="alert-modal__message" id="alertModalMessage"></p>
        <div class="alert-modal__actions">
          <button type="button" class="btn btn-primary" data-alert-close>OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-alert-close]")) {
        modal.classList.add("hidden");
      }
    });
  }

  modal.querySelector("#alertModalTitle").textContent = settings.title;
  modal.querySelector("#alertModalMessage").textContent = settings.message;
  modal.dataset.tone = settings.tone;
  modal.classList.remove("hidden");
};

window.CIH.hideAlert = function hideAlert() {
  const modal = document.getElementById("alertModal");
  if (modal) {
    modal.classList.add("hidden");
  }
};

function initReveal() {
  const revealNodes = document.querySelectorAll(".reveal");
  if (!revealNodes.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealNodes.forEach((node) => observer.observe(node));
}

function initCountUp() {
  const nodes = document.querySelectorAll("[data-count]");
  if (!nodes.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const target = Number(entry.target.dataset.count || 0);
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 40));

        const timer = window.setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            window.clearInterval(timer);
          }
          entry.target.textContent = current.toLocaleString();
        }, 28);

        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.3 }
  );

  nodes.forEach((node) => observer.observe(node));
}

function initTabs() {
  document.querySelectorAll("[data-tab-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab-target]");
      if (!button) {
        return;
      }

      const targetId = button.dataset.tabTarget;
      group.querySelectorAll("[data-tab-target]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      const scope = group.closest("[data-tab-scope]") || document;
      scope.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === targetId);
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initCountUp();
  initTabs();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.CIH.hideAlert();
  }
});
