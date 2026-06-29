const addButtons = Array.from(document.querySelectorAll("[data-add-target]"));
const contextMenu = document.getElementById("contextMenu");
const toast = document.getElementById("toast");
const renameDialog = document.getElementById("renameDialog");
const renameForm = document.getElementById("renameForm");
const displayNameInput = document.getElementById("displayNameInput");
const launchNameInput = document.getElementById("launchNameInput");
const iconUrlInput = document.getElementById("iconUrlInput");
const pathInput = document.getElementById("pathInput");
const iconPreview = document.getElementById("iconPreview");
const iconFileInput = document.getElementById("iconFileInput");
const pickIconBtn = document.getElementById("pickIconBtn");
const webDialog = document.getElementById("webDialog");
const webForm = document.getElementById("webForm");
const webDisplayNameInput = document.getElementById("webDisplayNameInput");
const webLaunchNameInput = document.getElementById("webLaunchNameInput");
const webIconUrlInput = document.getElementById("webIconUrlInput");
const webIconPreview = document.getElementById("webIconPreview");
const webIconFileInput = document.getElementById("webIconFileInput");
const webPickIconBtn = document.getElementById("webPickIconBtn");
const webUrlInput = document.getElementById("webUrlInput");
const sectionLabels = {
  file: "文件",
  folder: "文件夹",
  web: "网页"
};
const STORAGE_KEY = "quickopen.cards";

let activeCard = null;
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function getStorageApi() {
  if (typeof utools !== "undefined" && utools.dbStorage) {
    return utools.dbStorage;
  }
  return null;
}

function getSystemFileIcon(filePath) {
  if (typeof utools !== "undefined" && typeof utools.getFileIcon === "function") {
    try {
      return utools.getFileIcon(filePath) || "";
    } catch (error) {
      return "";
    }
  }

  return "";
}

function readStoredCards() {
  const storage = getStorageApi();
  if (storage && typeof storage.getItem === "function") {
    return storage.getItem(STORAGE_KEY) || [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function writeStoredCards(cards) {
  const storage = getStorageApi();
  if (storage && typeof storage.setItem === "function") {
    storage.setItem(STORAGE_KEY, cards);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function serializeCards() {
  return Array.from(document.querySelectorAll(".card")).map((card) => ({
    section: card.dataset.section,
    type: card.dataset.type,
    title: card.dataset.title,
    displayName: card.dataset.displayName || "",
    path: card.dataset.path,
    icon: card.dataset.icon || "",
    defaultThumb: card.dataset.defaultThumb || ""
  }));
}

function saveCards() {
  writeStoredCards(serializeCards());
}

function clearAllCards() {
  document.querySelectorAll(".card-list").forEach((list) => {
    list.innerHTML = "";
  });
}

function refreshAllCounts() {
  document.querySelectorAll(".column").forEach(updateColumnCount);
}

function getBaseName(targetPath) {
  if (!targetPath) {
    return "";
  }
  const normalized = targetPath.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || normalized;
}

function getThumbLabel(type, targetPath) {
  if (type === "网页") {
    return "WEB";
  }
  if (type === "文件夹") {
    return "DIR";
  }

  const fileName = getBaseName(targetPath);
  const segments = fileName.split(".");
  if (segments.length > 1) {
    return segments.pop().slice(0, 3).toUpperCase();
  }
  return "FILE";
}

function normalizeWebUrl(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getShellApi() {
  if (typeof require !== "function") {
    return null;
  }

  try {
    return require("electron").shell;
  } catch (error) {
    return null;
  }
}

async function openCardTarget(card) {
  const { type, path, title } = card.dataset;
  const shell = getShellApi();

  if (type === "网页") {
    const targetUrl = normalizeWebUrl(path);

    if (typeof utools !== "undefined" && typeof utools.shellOpenExternal === "function") {
      await utools.shellOpenExternal(targetUrl);
      return;
    }

    if (shell && typeof shell.openExternal === "function") {
      await shell.openExternal(targetUrl);
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (typeof utools !== "undefined" && typeof utools.shellOpenPath === "function") {
    utools.shellOpenPath(path);
    return;
  }

  if (shell && typeof shell.openPath === "function") {
    const result = await shell.openPath(path);
    if (result) {
      showToast(`打开失败: ${title}`);
    }
    return;
  }

  showToast("当前环境不支持打开本地路径");
}

function bindCardEvents(card) {
  card.dataset.displayName = card.dataset.displayName || "";
  const thumb = card.querySelector(".card-thumb");
  card.dataset.defaultThumb = thumb ? thumb.textContent.trim() : "";

  card.addEventListener("click", async () => {
    try {
      await openCardTarget(card);
    } catch (error) {
      showToast(`打开失败: ${card.dataset.title}`);
    }
  });

  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openContextMenu(event, card);
  });
}

function createCard(type, targetPath, options = {}) {
  const card = document.createElement("button");
  const title = options.title || getBaseName(targetPath);
  const displayName = options.displayName || title;
  const thumbLabel = getThumbLabel(type, targetPath);

  card.type = "button";
  card.className = "card";
  card.dataset.section = options.section || "";
  card.dataset.type = type;
  card.dataset.title = title;
  card.dataset.path = targetPath;
  card.dataset.displayName = options.displayName || "";
  card.dataset.icon = options.icon || "";
  card.innerHTML = `
    <div class="card-thumb">${thumbLabel}</div>
    <h3>${displayName}</h3>
  `;

  bindCardEvents(card);
  if (options.defaultThumb) {
    card.dataset.defaultThumb = options.defaultThumb;
  }
  if (options.icon) {
    const thumb = card.querySelector(".card-thumb");
    thumb.style.backgroundImage = `url("${options.icon.replace(/"/g, '\\"')}")`;
    thumb.classList.add("has-image");
    thumb.textContent = "";
  }
  return card;
}

function addCardToSection(sectionName, type, targetPath, options = {}) {
  const column = document.querySelector(`.column[data-section="${sectionName}"]`);
  if (!column) {
    return;
  }

  const list = column.querySelector(".card-list");
  const card = createCard(type, targetPath, {
    ...options,
    section: sectionName
  });
  list.appendChild(card);
  updateColumnCount(column);
  saveCards();
  showToast(`已添加${sectionLabels[sectionName]}: ${options.displayName || card.dataset.title}`);
}

function loadCards() {
  const savedCards = readStoredCards();
  clearAllCards();

  savedCards.forEach((item) => {
    if (!item || !item.section || !item.type || !item.path) {
      return;
    }

    const column = document.querySelector(`.column[data-section="${item.section}"]`);
    if (!column) {
      return;
    }

    const list = column.querySelector(".card-list");
    const card = createCard(item.type, item.path, {
      section: item.section,
      title: item.title,
      displayName: item.displayName,
      icon: item.icon,
      defaultThumb: item.defaultThumb
    });
    list.appendChild(card);
  });

  refreshAllCounts();
}

async function chooseWithUtools(properties) {
  if (typeof utools === "undefined" || typeof utools.showOpenDialog !== "function") {
    showToast("当前环境不支持 uTools 文件选择");
    return null;
  }

  try {
    const result = await utools.showOpenDialog({
      properties
    });
    return Array.isArray(result) ? result : null;
  } catch (error) {
    showToast("打开选择窗口失败");
    return null;
  }
}

async function handleAddFile() {
  const selected = await chooseWithUtools(["openFile"]);
  if (!selected || !selected[0]) {
    return;
  }

  addCardToSection("file", "文件", selected[0], {
    icon: getSystemFileIcon(selected[0])
  });
}

async function handleAddFolder() {
  const selected = await chooseWithUtools(["openDirectory"]);
  if (!selected || !selected[0]) {
    return;
  }
  addCardToSection("folder", "文件夹", selected[0]);
}

function openWebDialog() {
  webDialog.classList.add("open");
  webDialog.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    webLaunchNameInput.focus();
  }, 20);
}

function closeWebDialog() {
  webDialog.classList.remove("open");
  webDialog.setAttribute("aria-hidden", "true");
  webForm.reset();
  webIconFileInput.value = "";
  setPreviewImage(webIconPreview, "");
}

function hideContextMenu() {
  contextMenu.classList.remove("open");
}

function openContextMenu(event, card) {
  activeCard = card;
  const menuWidth = 180;
  const menuHeight = 148;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
  contextMenu.style.left = x + "px";
  contextMenu.style.top = y + "px";
  contextMenu.classList.add("open");
}

function setPreviewImage(targetPreview, value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    targetPreview.style.backgroundImage = "";
    targetPreview.classList.remove("has-image");
    targetPreview.textContent = "未选择";
    return;
  }

  targetPreview.style.backgroundImage = `url("${trimmed.replace(/"/g, '\\"')}")`;
  targetPreview.classList.add("has-image");
  targetPreview.textContent = "图标";
}

function openRenameDialog(card) {
  const title = card.dataset.title || "";
  const displayName = card.dataset.displayName || "";
  const path = card.dataset.path || "";
  const icon = card.dataset.icon || "";

  displayNameInput.value = displayName;
  launchNameInput.value = title;
  iconUrlInput.value = icon;
  pathInput.value = path;
  setPreviewImage(iconPreview, icon);

  renameDialog.classList.add("open");
  renameDialog.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    launchNameInput.focus();
    launchNameInput.select();
  }, 20);
}

function closeRenameDialog() {
  renameDialog.classList.remove("open");
  renameDialog.setAttribute("aria-hidden", "true");
  renameForm.reset();
  iconFileInput.value = "";
  setPreviewImage(iconPreview, "");
}

function updateColumnCount(column) {
  const count = column.querySelectorAll(".card").length;
  column.querySelector(".count").textContent = `${count} 项`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const tempInput = document.createElement("textarea");
  tempInput.value = text;
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  const success = document.execCommand("copy");
  document.body.removeChild(tempInput);
  return success;
}

addButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (button.dataset.addTarget === "file") {
      await handleAddFile();
      return;
    }

    if (button.dataset.addTarget === "folder") {
      await handleAddFolder();
      return;
    }

    openWebDialog();
  });
});

contextMenu.addEventListener("click", async (event) => {
  const menuItem = event.target.closest(".menu-item");
  if (!menuItem || !activeCard) {
    return;
  }

  const action = menuItem.dataset.action;
  const title = activeCard.dataset.title;
  const path = activeCard.dataset.path;

  if (action === "rename") {
    hideContextMenu();
    openRenameDialog(activeCard);
    return;
  }

  if (action === "copy") {
    try {
      const copied = await copyText(path);
      showToast(copied ? `已复制路径: ${title}` : "复制失败");
    } catch (error) {
      showToast("复制失败");
    }
  }

  if (action === "delete") {
    const cardToDelete = activeCard;
    const column = cardToDelete.closest(".column");
    cardToDelete.remove();
    updateColumnCount(column);
    saveCards();
    showToast(`已删除: ${title}`);
    activeCard = null;
  }

  hideContextMenu();
});

iconUrlInput.addEventListener("input", () => {
  setPreviewImage(iconPreview, iconUrlInput.value);
});

pickIconBtn.addEventListener("click", () => {
  iconFileInput.click();
});

iconFileInput.addEventListener("change", () => {
  const [file] = iconFileInput.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    iconUrlInput.value = reader.result;
    setPreviewImage(iconPreview, reader.result);
  };
  reader.readAsDataURL(file);
});

webIconUrlInput.addEventListener("input", () => {
  setPreviewImage(webIconPreview, webIconUrlInput.value);
});

webPickIconBtn.addEventListener("click", () => {
  webIconFileInput.click();
});

webIconFileInput.addEventListener("change", () => {
  const [file] = webIconFileInput.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    webIconUrlInput.value = reader.result;
    setPreviewImage(webIconPreview, reader.result);
  };
  reader.readAsDataURL(file);
});

renameForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!activeCard) {
    closeRenameDialog();
    return;
  }

  const launchName = launchNameInput.value.trim();
  const displayName = displayNameInput.value.trim();
  const iconValue = iconUrlInput.value.trim();

  if (!launchName) {
    launchNameInput.focus();
    return;
  }

  activeCard.dataset.title = launchName;
  activeCard.dataset.displayName = displayName;
  activeCard.dataset.icon = iconValue;

  const titleNode = activeCard.querySelector("h3");
  titleNode.textContent = displayName || launchName;

  const thumb = activeCard.querySelector(".card-thumb");
  if (iconValue) {
    thumb.style.backgroundImage = `url("${iconValue.replace(/"/g, '\\"')}")`;
    thumb.classList.add("has-image");
    thumb.textContent = "";
  } else {
    thumb.style.backgroundImage = "";
    thumb.classList.remove("has-image");
    thumb.textContent = activeCard.dataset.defaultThumb || "DIR";
  }

  closeRenameDialog();
  saveCards();
  showToast(`已更新: ${displayName || launchName}`);
});

webForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const launchName = webLaunchNameInput.value.trim();
  const displayName = webDisplayNameInput.value.trim();
  const iconValue = webIconUrlInput.value.trim();
  const url = normalizeWebUrl(webUrlInput.value);

  if (!launchName) {
    webLaunchNameInput.focus();
    return;
  }

  if (!url) {
    webUrlInput.focus();
    return;
  }

  addCardToSection("web", "网页", url, {
    title: launchName,
    displayName,
    icon: iconValue
  });

  closeWebDialog();
});

renameDialog.addEventListener("click", (event) => {
  const closeTarget = event.target.closest("[data-close-dialog]");
  if (closeTarget) {
    closeRenameDialog();
  }
});

webDialog.addEventListener("click", (event) => {
  const closeTarget = event.target.closest("[data-close-web-dialog]");
  if (closeTarget) {
    closeWebDialog();
  }
});

window.addEventListener("click", (event) => {
  if (!event.target.closest(".context-menu")) {
    hideContextMenu();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideContextMenu();
    if (renameDialog.classList.contains("open")) {
      closeRenameDialog();
    }
    if (webDialog.classList.contains("open")) {
      closeWebDialog();
    }
  }
});

window.addEventListener("resize", hideContextMenu);
window.addEventListener("scroll", hideContextMenu, true);
window.addEventListener("blur", hideContextMenu);

loadCards();
