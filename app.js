// const { createElement } = require("react");

const STORAGE_KEY = "stockroom-inventory-v1";

// Application state
let inventory = loadInventory();

const form = document.querySelector("#inventoryForm");
const itemIdInput = document.querySelector("#itemId");
const skuInput = document.querySelector("#sku");
const nameInput = document.querySelector("#name");
const categoryInput = document.querySelector("#category");
const quantityInput = document.querySelector("#quantity");
const reorderInput = document.querySelector("#reorderLevel");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const inventoryBody = document.querySelector("#inventoryBody");
const formMessage = document.querySelector("#formMessage");

// Read saved inventory safely.
function loadInventory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    // Reject malformed records instead of trusting stored data.
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.sku === "string" &&
        typeof item.name === "string" &&
        typeof item.category === "string" &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity >= 0 &&
        Number.isSafeInteger(item.reorderLevel) &&
        item.reorderLevel >= 0,
    );
  } catch (error) {
    console.error("Could not load inventory:", error);
    return [];
  }
}

// Save the current state.
function saveInventory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    return true;
  } catch (error) {
    console.error("Could not save inventory:", error);
    showMessage("Unable to save. Check browser storage.");
    return false;
  }
}

function showMessage(message = "") {
  formMessage.textContent = message;
}

function resetForm() {
  form.reset();
  itemIdInput.value = "";
  quantityInput.value = "0";
  reorderInput.value = "5";

  document.querySelector("#formTitle").textContent = "Add inventory item";

  document.querySelector("#saveButton").textContent = "Add item";
  document.querySelector("#cancelButton").classList.add("hidden");

  showMessage();
}

function getStockStatus(item) {
  if (item.quantity === 0) {
    return { label: "Out of stock", className: "out" };
  }

  if (item.quantity <= item.reorderLevel) {
    return { label: "Low stock", className: "low" };
  }

  return { label: "In stock", className: "in-stock" };
}

// Create a cell using textContent to avoid interpreting user input as HTML.
function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function renderInventory() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm);

    const status = getStockStatus(item);
    let matchesStatus = true;

    if (selectedStatus === "in-stock") {
      matchesStatus = status.className === "in-stock";
    } else if (selectedStatus === "low") {
      matchesStatus = status.className === "low";
    } else if (selectedStatus === "out") {
      matchesStatus = status.className === "out";
    }

    return matchesSearch && matchesStatus;
  });

  inventoryBody.replaceChildren();

  for (const item of filteredInventory) {
    const row = document.createElement("tr");
    const status = getStockStatus(item);

    row.append(
      createCell(item.sku),
      createCell(item.name),
      createCell(item.category),
      createCell(String(item.quantity)),
    );

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");

    statusBadge.className = `status ${status.className}`;
    statusBadge.textContent = status.label;
    statusCell.append(statusBadge);
    row.append(statusCell);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary small";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${item.name}`);
    editButton.addEventListener("click", () => editItem(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger small";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${item.name}`);
    deleteButton.addEventListener("click", () => deleteItem(item.id));

    const reduceButton = document.createElement("button");
    reduceButton.type = "button";
    reduceButton.className = "secondary small";
    reduceButton.textContent = "Reduce stock";
    reduceButton.disabled = item.quantity === 0;
    reduceButton.setAttribute("aria-label", "Reduce stock for ${item.name}");
    reduceButton.addEventListener("click", () => reduceStock(item.id));

    actions.append(reduceButton, editButton, deleteButton);
    actionsCell.append(actions);
    row.append(actionsCell);

    inventoryBody.append(row);
  }

  document.querySelector("#totalItems").textContent = inventory.length;

  const totalUnits = inventory.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  document.querySelector("#totalUnits").textContent = totalUnits;

  const lowStockCount = inventory.filter(
    (item) => getStockStatus(item).className === "low",
  ).length;

  document.querySelector("#lowStock").textContent = lowStockCount;

  document.querySelector("#resultsCount").textContent =
    `${filteredInventory.length} of ${inventory.length} items`;

  const emptyState = document.querySelector("#emptyState");
  emptyState.classList.toggle("hidden", filteredInventory.length > 0);

  if (inventory.length === 0) {
    emptyState.textContent =
      "No inventory records yet. Add your first item above.";
  } else {
    emptyState.textContent = "No items match your search or selected filter.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  console.log("add item form submitted");
  showMessage();

  const id = itemIdInput.value;
  const sku = skuInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const quantity = Number(quantityInput.value);
  const reorderLevel = Number(reorderInput.value);

  if (!sku || !name || !category) {
    showMessage("Complete all required fields.");
    return;
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    !Number.isSafeInteger(reorderLevel) ||
    reorderLevel < 0
  ) {
    showMessage("Quantities must be non-negative whole numbers.");
    return;
  }

  const duplicateSKU = inventory.some(
    (item) => item.sku.toUpperCase() === sku && item.id !== id,
  );

  if (duplicateSKU) {
    showMessage("That SKU already exists. Use a unique SKU.");
    return;
  }

  const existingItem = inventory.find((item) => item.id === id);

  const item = {
    id: id || crypto.randomUUID(),
    sku,
    name,
    category,
    quantity,
    reorderLevel,
  };

  if (existingItem) {
    inventory = inventory.map((current) =>
      current.id === id ? item : current,
    );
  } else {
    inventory.push(item);
  }

  if (!saveInventory()) {
    // Restore the previous in-memory state if saving fails.
    if (existingItem) {
      inventory = inventory.map((current) =>
        current.id === id ? existingItem : current,
      );
    } else {
      inventory = inventory.filter((current) => current.id !== item.id);
    }

    renderInventory();
    return;
  }

  resetForm();
  renderInventory();
});

function editItem(id) {
  const item = inventory.find((current) => current.id === id);
  if (!item) return;

  itemIdInput.value = item.id;
  skuInput.value = item.sku;
  nameInput.value = item.name;
  categoryInput.value = item.category;
  quantityInput.value = item.quantity;
  reorderInput.value = item.reorderLevel;

  document.querySelector("#formTitle").textContent = "Edit inventory item";
  document.querySelector("#saveButton").textContent = "Save changes";
  document.querySelector("#cancelButton").classList.remove("hidden");

  showMessage();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  skuInput.focus();
}

function reduceStock(id) {
  const item = inventory.find((current) => current.id === id);

  if (!item || item.quantity <= 0) {
    return;
  }
  const previousQuantity = item.quantity;
  item.quantity = item.quantity - 1;
  if (!saveInventory()) {
    item.quantity = previousQuantity;
    renderInventory();
    return;
  }
  renderInventory();
}

function deleteItem(id) {
  const item = inventory.find((current) => current.id === id);
  if (!item) return;

  const confirmed = window.confirm(
    `Delete "${item.name}" (${item.sku})? This cannot be undone.`,
  );

  if (!confirmed) return;

  const previousInventory = inventory;
  inventory = inventory.filter((current) => current.id !== id);

  if (!saveInventory()) {
    inventory = previousInventory;
    renderInventory();
    return;
  }

  if (itemIdInput.value === id) {
    resetForm();
  }

  renderInventory();
}

document.querySelector("#cancelButton").addEventListener("click", resetForm);

searchInput.addEventListener("input", renderInventory);
statusFilter.addEventListener("change", renderInventory);

// Export the full inventory, not just the filtered results.
document.querySelector("#exportButton").addEventListener("click", () => {
  const headers = [
    "SKU",
    "Item Name",
    "Category",
    "Quantity",
    "Reorder Threshold",
  ];

  const escapeCSV = (value) => `"${String(value).replace(/"/g, '""')}"`;

  const rows = inventory.map((item) => [
    item.sku,
    item.name,
    item.category,
    item.quantity,
    item.reorderLevel,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  // BOM improves compatibility with spreadsheet applications.
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "stockroom-inventory.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

// Initial page render.
console.log("stockroom javascript is running");
renderInventory();
