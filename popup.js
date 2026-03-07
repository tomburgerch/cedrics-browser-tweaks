// YouTube Speed Saver - Popup Script

const DEFAULT_SPEED = 2.0;
const buttons = document.querySelectorAll(".speed-btn");
const status = document.getElementById("status");

// Load current speed and highlight active button
chrome.storage.sync.get("preferredSpeed", (result) => {
  const speed = result.preferredSpeed || DEFAULT_SPEED;
  highlightActive(speed);
  status.textContent = `Speed: ${speed}x (saved)`;
});

// Handle button clicks
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const speed = parseFloat(btn.dataset.speed);
    chrome.storage.sync.set({ preferredSpeed: speed }, () => {
      highlightActive(speed);
      status.textContent = `Speed: ${speed}x (saved)`;
    });
  });
});

function highlightActive(speed) {
  buttons.forEach((btn) => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed) === speed);
  });
}
