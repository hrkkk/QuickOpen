const addButtons = Array.from(document.querySelectorAll("[data-add-target]"));
const contextMenu = document.getElementById("contextMenu");
const toast = document.getElementById("toast");
const renameDialog = document.getElementById("renameDialog");
const renameForm = document.getElementById("renameForm");
const displayNameInput = document.getElementById("displayNameInput");
const launchNameInput = document.getElementById("launchNameInput");
const iconUrlInput = document.getElementById("iconUrlInput");
const pathInput = document.getElementById("pathInput");
const pathFieldLabel = document.getElementById("pathFieldLabel");
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
const commandDialog = document.getElementById("commandDialog");
const commandDialogTitle = document.getElementById("commandDialogTitle");
const commandForm = document.getElementById("commandForm");
const commandNameInput = document.getElementById("commandNameInput");
const commandIconUrlInput = document.getElementById("commandIconUrlInput");
const commandIconPreview = document.getElementById("commandIconPreview");
const commandIconFileInput = document.getElementById("commandIconFileInput");
const commandPickIconBtn = document.getElementById("commandPickIconBtn");
const commandInput = document.getElementById("commandInput");
const commandCwdInput = document.getElementById("commandCwdInput");
const commandAdminInput = document.getElementById("commandAdminInput");
const pickCommandCwdBtn = document.getElementById("pickCommandCwdBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const settingsDialog = document.getElementById("settingsDialog");
const settingsForm = document.getElementById("settingsForm");
const sectionLabels = {
  file: "文件",
  folder: "文件夹",
  web: "网页",
  command: "快捷指令"
};
const STORAGE_KEY = "quickopen.cards";
const SETTINGS_STORAGE_KEY = "quickopen.settings";
const DEFAULT_SETTINGS = Object.freeze({
  columnLayout: "grid",
  cardSize: "medium"
});

let activeCard = null;
let toastTimer = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let draggedCard = null;
let dragSourceList = null;
let dragOrderChanged = false;
let iconLoadSequence = 0;

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

function normalizeSettings(value) {
  const settings = value && typeof value === "object" ? value : {};
  return {
    columnLayout: ["vertical", "grid"].includes(settings.columnLayout)
      ? settings.columnLayout
      : DEFAULT_SETTINGS.columnLayout,
    cardSize: ["small", "medium", "large"].includes(settings.cardSize)
      ? settings.cardSize
      : DEFAULT_SETTINGS.cardSize
  };
}

function readStoredSettings() {
  const storage = getStorageApi();
  if (storage && typeof storage.getItem === "function") {
    return normalizeSettings(storage.getItem(SETTINGS_STORAGE_KEY));
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeStoredSettings(settings) {
  const storage = getStorageApi();
  if (storage && typeof storage.setItem === "function") {
    storage.setItem(SETTINGS_STORAGE_KEY, settings);
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function applySettings(settings) {
  currentSettings = normalizeSettings(settings);
  document.body.dataset.columnLayout = currentSettings.columnLayout;
  document.body.dataset.cardSize = currentSettings.cardSize;
}

function loadSettings() {
  applySettings(readStoredSettings());
}

function serializeCards() {
  return Array.from(document.querySelectorAll(".card")).map((card) => ({
    section: card.dataset.section,
    type: card.dataset.type,
    title: card.dataset.title,
    displayName: card.dataset.displayName || "",
    path: card.dataset.path,
    cwd: card.dataset.cwd || "",
    runAsAdmin: card.dataset.runAsAdmin === "true",
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
  if (type === "指令") {
    return "C";
  }
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

function setCardThumbIcon(thumb, iconValue, fallbackLabel) {
  const value = (iconValue || "").trim();
  const loadToken = String(++iconLoadSequence);
  thumb.dataset.iconLoadToken = loadToken;

  const showFallback = () => {
    if (thumb.dataset.iconLoadToken !== loadToken) {
      return;
    }
    thumb.style.backgroundImage = "";
    thumb.classList.remove("has-image");
    thumb.textContent = fallbackLabel;
  };

  if (!value) {
    showFallback();
    return;
  }

  const image = new Image();
  image.onload = () => {
    if (thumb.dataset.iconLoadToken !== loadToken) {
      return;
    }
    thumb.style.backgroundImage = `url("${value.replace(/"/g, '\\"')}")`;
    thumb.classList.add("has-image");
    thumb.textContent = "";
  };
  image.onerror = showFallback;
  image.src = value;
}

function convertIconFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片格式不受支持"));
      image.onload = () => {
        const maxSize = 128;
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("无法处理图片"));
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimized = canvas.toDataURL("image/webp", 0.82);
        resolve(
          optimized.startsWith("data:image/webp")
            ? optimized
            : canvas.toDataURL("image/png")
        );
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function setIconFromFile(file, input, preview) {
  try {
    const dataUrl = await convertIconFileToDataUrl(file);
    input.value = dataUrl;
    setPreviewImage(preview, dataUrl);
  } catch (error) {
    showToast(error.message || "处理图片失败");
  }
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

async function executeSavedCommand(card) {
  const systemApi = window.quickOpenSystem;
  const command = (card.dataset.path || "").trim();
  const cwd = (card.dataset.cwd || "").trim();
  const runAsAdmin = card.dataset.runAsAdmin === "true";
  const title = card.dataset.displayName || card.dataset.title || "快捷指令";

  if (!systemApi || typeof systemApi.executeCommand !== "function") {
    showToast("系统执行服务未加载，请重新安装插件");
    return;
  }

  if (!command) {
    showToast("指令内容为空，请右键编辑");
    return;
  }

  if (runAsAdmin) {
    showToast(`正在请求管理员授权：${title}`);
  }

  try {
    await systemApi.executeCommand({ command, cwd, runAsAdmin });
    showToast(`${runAsAdmin ? "已以管理员身份执行" : "已执行"}：${title}`);
  } catch (error) {
    showToast(`执行失败：${error.message || title}`);
  }
}

async function openCardTarget(card) {
  const { type, path } = card.dataset;

  if (type === "指令") {
    return executeSavedCommand(card);
  }

  if (type === "网页") {
    const targetUrl = normalizeWebUrl(path);

    if (typeof utools !== "undefined" && typeof utools.shellOpenExternal === "function") {
      await utools.shellOpenExternal(targetUrl);
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (typeof utools !== "undefined" && typeof utools.shellOpenPath === "function") {
    utools.shellOpenPath(path);
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

  const dragHandle = card.querySelector(".drag-handle");
  dragHandle.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  dragHandle.addEventListener("dragstart", (event) => {
    draggedCard = card;
    dragSourceList = card.closest(".card-list");
    dragOrderChanged = false;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.title || "QuickOpen");
    }
    window.requestAnimationFrame(() => card.classList.add("dragging"));
  });
  dragHandle.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    dragSourceList?.classList.remove("drag-active");
    if (dragOrderChanged) {
      saveCards();
      showToast("项目顺序已保存");
    }
    draggedCard = null;
    dragSourceList = null;
    dragOrderChanged = false;
  });
}

function bindCardListSorting() {
  document.querySelectorAll(".card-list").forEach((list) => {
    list.addEventListener("dragover", (event) => {
      if (!draggedCard || list !== dragSourceList) {
        return;
      }

      event.preventDefault();
      list.classList.add("drag-active");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      const targetCard = event.target.closest(".card");
      if (!targetCard || targetCard === draggedCard) {
        if (!targetCard && list.lastElementChild !== draggedCard) {
          list.appendChild(draggedCard);
          dragOrderChanged = true;
        }
        return;
      }

      const targetRect = targetCard.getBoundingClientRect();
      const columnCount = getComputedStyle(list).gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean).length;
      const insertBefore = columnCount > 1
        ? event.clientX < targetRect.left + targetRect.width / 2
        : event.clientY < targetRect.top + targetRect.height / 2;

      if (insertBefore) {
        list.insertBefore(draggedCard, targetCard);
      } else {
        list.insertBefore(draggedCard, targetCard.nextElementSibling);
      }
      dragOrderChanged = true;
    });

    list.addEventListener("drop", (event) => {
      if (draggedCard && list === dragSourceList) {
        event.preventDefault();
      }
      list.classList.remove("drag-active");
    });
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
  card.dataset.cwd = options.cwd || "";
  card.dataset.runAsAdmin = options.runAsAdmin ? "true" : "false";
  card.dataset.displayName = options.displayName || "";
  card.dataset.icon = options.icon || "";
  card.innerHTML = `
    <span class="drag-handle" draggable="true" title="拖动排序" aria-label="拖动排序">⋮⋮</span>
    <div class="card-thumb">${thumbLabel}</div>
    <h3>${displayName}</h3>
  `;

  bindCardEvents(card);
  if (type === "指令") {
    card.dataset.defaultThumb = "C";
  } else if (options.defaultThumb) {
    card.dataset.defaultThumb = options.defaultThumb;
  }
  if (options.icon) {
    const thumb = card.querySelector(".card-thumb");
    setCardThumbIcon(thumb, options.icon, card.dataset.defaultThumb || thumbLabel);
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
      cwd: item.cwd,
      runAsAdmin: item.runAsAdmin,
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

function openCommandDialog(card = null) {
  activeCard = card;
  commandDialogTitle.textContent = card ? "编辑快捷指令" : "添加快捷指令";
  commandNameInput.value = card ? (card.dataset.displayName || card.dataset.title || "") : "";
  commandIconUrlInput.value = card ? (card.dataset.icon || "") : "";
  setPreviewImage(commandIconPreview, commandIconUrlInput.value);
  commandInput.value = card ? (card.dataset.path || "") : "";
  commandCwdInput.value = card ? (card.dataset.cwd || "") : "";
  commandAdminInput.checked = card ? card.dataset.runAsAdmin === "true" : false;
  commandDialog.classList.add("open");
  commandDialog.setAttribute("aria-hidden", "false");

  window.setTimeout(() => commandNameInput.focus(), 20);
}

function closeCommandDialog() {
  commandDialog.classList.remove("open");
  commandDialog.setAttribute("aria-hidden", "true");
  commandForm.reset();
  commandIconFileInput.value = "";
  setPreviewImage(commandIconPreview, "");
  activeCard = null;
}

function openSettingsDialog() {
  settingsForm.querySelector(
    `[name="columnLayout"][value="${currentSettings.columnLayout}"]`
  ).checked = true;
  settingsForm.querySelector(
    `[name="cardSize"][value="${currentSettings.cardSize}"]`
  ).checked = true;
  settingsDialog.classList.add("open");
  settingsDialog.setAttribute("aria-hidden", "false");
}

function closeSettingsDialog() {
  settingsDialog.classList.remove("open");
  settingsDialog.setAttribute("aria-hidden", "true");
}

function hideContextMenu() {
  contextMenu.classList.remove("open");
}

function openContextMenu(event, card) {
  activeCard = card;
  const copyItem = contextMenu.querySelector('[data-action="copy"]');
  copyItem.textContent = card.dataset.type === "指令" ? "复制指令" : "复制路径";
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
  pathFieldLabel.textContent = card.dataset.type === "网页" ? "网址：" : "路径：";
  pathInput.placeholder = card.dataset.type === "网页"
    ? "例如：https://www.example.com"
    : "输入文件或文件夹的完整路径";
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

    if (button.dataset.addTarget === "command") {
      openCommandDialog();
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
  const isCommand = activeCard.dataset.type === "指令";

  if (action === "rename") {
    hideContextMenu();
    if (activeCard.dataset.type === "指令") {
      openCommandDialog(activeCard);
      return;
    }
    openRenameDialog(activeCard);
    return;
  }

  if (action === "copy") {
    try {
      const copied = await copyText(path);
      const targetName = isCommand ? "指令" : "路径";
      showToast(copied ? `已复制${targetName}：${title}` : "复制失败");
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

iconFileInput.addEventListener("change", async () => {
  const [file] = iconFileInput.files || [];
  if (!file) {
    return;
  }

  await setIconFromFile(file, iconUrlInput, iconPreview);
});

webIconUrlInput.addEventListener("input", () => {
  setPreviewImage(webIconPreview, webIconUrlInput.value);
});

webPickIconBtn.addEventListener("click", () => {
  webIconFileInput.click();
});

webIconFileInput.addEventListener("change", async () => {
  const [file] = webIconFileInput.files || [];
  if (!file) {
    return;
  }

  await setIconFromFile(file, webIconUrlInput, webIconPreview);
});

commandIconUrlInput.addEventListener("input", () => {
  setPreviewImage(commandIconPreview, commandIconUrlInput.value);
});

commandPickIconBtn.addEventListener("click", () => {
  commandIconFileInput.click();
});

commandIconFileInput.addEventListener("change", async () => {
  const [file] = commandIconFileInput.files || [];
  if (!file) {
    return;
  }

  await setIconFromFile(file, commandIconUrlInput, commandIconPreview);
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
  const type = activeCard.dataset.type;
  const rawPath = pathInput.value.trim();
  const targetPath = type === "网页" ? normalizeWebUrl(rawPath) : rawPath;

  if (!launchName) {
    launchNameInput.focus();
    return;
  }

  if (!targetPath) {
    pathInput.focus();
    return;
  }

  activeCard.dataset.title = launchName;
  activeCard.dataset.displayName = displayName;
  activeCard.dataset.icon = iconValue;
  activeCard.dataset.path = targetPath;
  activeCard.dataset.defaultThumb = getThumbLabel(type, targetPath);

  const titleNode = activeCard.querySelector("h3");
  titleNode.textContent = displayName || launchName;

  const thumb = activeCard.querySelector(".card-thumb");
  setCardThumbIcon(thumb, iconValue, activeCard.dataset.defaultThumb || "DIR");

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

commandForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = commandNameInput.value.trim();
  const iconValue = commandIconUrlInput.value.trim();
  const command = commandInput.value.trim();
  const cwd = commandCwdInput.value.trim();
  const runAsAdmin = commandAdminInput.checked;

  if (!name) {
    commandNameInput.focus();
    return;
  }
  if (!command) {
    commandInput.focus();
    return;
  }

  if (activeCard && activeCard.dataset.type === "指令") {
    activeCard.dataset.title = name;
    activeCard.dataset.displayName = name;
    activeCard.dataset.icon = iconValue;
    activeCard.dataset.path = command;
    activeCard.dataset.cwd = cwd;
    activeCard.dataset.runAsAdmin = runAsAdmin ? "true" : "false";
    activeCard.querySelector("h3").textContent = name;
    const thumb = activeCard.querySelector(".card-thumb");
    setCardThumbIcon(thumb, iconValue, activeCard.dataset.defaultThumb || "C");
    saveCards();
    showToast(`已更新：${name}`);
  } else {
    addCardToSection("command", "指令", command, {
      title: name,
      displayName: name,
      icon: iconValue,
      cwd,
      runAsAdmin
    });
  }

  closeCommandDialog();
});

pickCommandCwdBtn.addEventListener("click", async () => {
  const selected = await chooseWithUtools(["openDirectory"]);
  if (selected && selected[0]) {
    commandCwdInput.value = selected[0];
  }
});

openSettingsBtn.addEventListener("click", openSettingsDialog);

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(settingsForm);
  const settings = normalizeSettings({
    columnLayout: formData.get("columnLayout"),
    cardSize: formData.get("cardSize")
  });
  writeStoredSettings(settings);
  applySettings(settings);
  closeSettingsDialog();
  showToast("界面设置已保存");
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

commandDialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-command-dialog]")) {
    closeCommandDialog();
  }
});

settingsDialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-settings-dialog]")) {
    closeSettingsDialog();
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
    if (commandDialog.classList.contains("open")) {
      closeCommandDialog();
    }
    if (settingsDialog.classList.contains("open")) {
      closeSettingsDialog();
    }
  }
});

window.addEventListener("resize", hideContextMenu);
window.addEventListener("scroll", hideContextMenu, true);
window.addEventListener("blur", hideContextMenu);

loadSettings();
bindCardListSorting();
loadCards();
