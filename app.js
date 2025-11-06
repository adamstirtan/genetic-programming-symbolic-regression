/* UI Template: minimal wiring, single full-bleed canvas */
(function setupDrawer() {
  const sidebar = document.getElementById("sidebar");
  const openBtn = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("backdrop");
  const mq = window.matchMedia("(max-width: 900px)");
  function closeDrawer() {
    sidebar && sidebar.classList.remove("open");
    backdrop && backdrop.classList.remove("show");
  }
  function openDrawer() {
    sidebar && sidebar.classList.add("open");
    backdrop && backdrop.classList.add("show");
  }
  openBtn &&
    openBtn.addEventListener("click", () => {
      if (sidebar.classList.contains("open")) closeDrawer();
      else openDrawer();
    });
  backdrop && backdrop.addEventListener("click", closeDrawer);
  window.addEventListener("resize", () => {
    if (!mq.matches) closeDrawer();
  });
})();

(function setupModal() {
  const modal = document.getElementById("template-modal");
  const backdrop = document.getElementById("template-modal-backdrop");
  const titleEl = document.getElementById("template-modal-title");
  const contentEl = document.getElementById("template-modal-content");
  const closeBtn = document.getElementById("template-modal-close");
  const infoBtn = document.getElementById("template-info-btn");
  function open(opts = {}) {
    if (!modal || !backdrop) return;
    if (opts.title && titleEl) titleEl.textContent = opts.title;
    if (opts.html && contentEl) contentEl.innerHTML = opts.html;
    modal.classList.add("show");
    backdrop.classList.add("show");
  }
  function close() {
    modal && modal.classList.remove("show");
    backdrop && backdrop.classList.remove("show");
  }
  window.TemplateUI = window.TemplateUI || {};
  window.TemplateUI.openModal = open;
  window.TemplateUI.closeModal = close;
  closeBtn && closeBtn.addEventListener("click", close);
  backdrop && backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  infoBtn && infoBtn.addEventListener("click", () => open());
})();

class UITemplateApp {
  constructor() {
    // canvas (full-bleed)
    this.containerEl = document.getElementById("canvas-container");
    this.canvas = document.getElementById("simCanvas");
    this.ctx = this.canvas.getContext("2d");

    // status
    this.iterationDisplay = document.getElementById("iteration");
    this.metricDisplay = document.getElementById("metric");
    this.statusDisplay = document.getElementById("status");

    // controls
    this.startButton = document.getElementById("startButton");
    this.pauseButton = document.getElementById("pauseButton");
    this.resetButton = document.getElementById("resetButton");
    this.saveButton = document.getElementById("saveButton");

    this.initChart();
    this.attachEvents();
    this.resizeCanvasToContainer();
    window.addEventListener("resize", () => this.resizeCanvasToContainer());
    this.updateStatus("Ready");
    this.clearCanvas();
  }

  attachEvents() {
    this.startButton?.addEventListener("click", () => {
      this.startButton.disabled = true;
      this.pauseButton.disabled = false;
      this.updateStatus("Running (template - no simulation)");
      this.drawTemplateIndicator();
    });

    this.pauseButton?.addEventListener("click", () => {
      this.startButton.disabled = false;
      this.pauseButton.disabled = true;
      this.updateStatus("Paused");
    });

    this.resetButton?.addEventListener("click", () => {
      this.startButton.disabled = false;
      this.pauseButton.disabled = true;
      this.iterationDisplay.textContent = "0";
      this.metricDisplay.textContent = "N/A";
      this.clearCanvas();
      this.updateStatus("Reset");
    });

    this.saveButton?.addEventListener("click", () => this.saveImage());
  }

  resizeCanvasToContainer() {
    if (!this.containerEl || !this.canvas) return;
    const w = this.containerEl.clientWidth;
    const h = this.containerEl.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.clearCanvas();
    }
  }

  clearCanvas() {
    const w = this.canvas.width || 300;
    const h = this.canvas.height || 300;
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, w, h);
  }

  drawTemplateIndicator() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    ctx.fillStyle = "rgba(87,166,255,0.15)";
    ctx.fillRect(10, 10, Math.max(40, w * 0.25), Math.max(40, h * 0.25));
    ctx.strokeStyle = "#57a6ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, Math.max(40, w * 0.25), Math.max(40, h * 0.25));
    ctx.fillStyle = "#0f1730";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Template Output", 16, 28);
    ctx.restore();
  }

  saveImage() {
    const link = document.createElement("a");
    link.download = "template-output.png";
    link.href = this.canvas.toDataURL("image/png");
    link.click();
    this.updateStatus("Image saved");
  }

  updateStatus(msg) {
    if (this.statusDisplay) this.statusDisplay.textContent = msg;
  }

  initChart() {
    try {
      const canvas = document.getElementById("metricChart");
      if (!canvas || typeof Chart === "undefined") return;
      const ctx = canvas.getContext("2d");
      this.metricChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Metric",
              data: [],
              borderColor: "#5cf2c7",
              backgroundColor: "rgba(92,242,199,0.15)",
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.15,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              grid: { color: "rgba(231,237,246,0.06)" },
              ticks: { color: "#a7b1c2" },
            },
            y: {
              grid: { color: "rgba(231,237,246,0.06)" },
              ticks: { color: "#a7b1c2" },
            },
          },
          plugins: {
            legend: { labels: { color: "#e7edf6" } },
            tooltip: { mode: "index", intersect: false },
          },
        },
      });
    } catch (_) {
      // ignore
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new UITemplateApp();
});
