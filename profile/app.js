(() => {
  "use strict";

  const APP_VERSION = "mobile-v1.0.0";
  const DATA_URL =
    "../products.json";
  const IMAGE_BASE_URL =
    "../images";
  const IMAGE_EXTENSIONS = [".jpg", ".png", ".jpeg", ".webp"];

  const FIELDS = {
    productNo: ["상품번호", "상품 번호", "product_no", "productNo", "product_number"],
    productName: ["상품명", "상품 이름", "product_name", "productName", "name"],
    basePrice: ["기본가격", "기본 가격", "base_price", "basePrice"],
    category: ["분류", "category", "type"],
    option1: ["옵션1", "옵션 1", "option1", "option_1"],
    option2: ["옵션2", "옵션 2", "option2", "option_2"],
    option3: ["옵션3", "옵션 3", "option3", "option_3"],
    price: ["가격", "price", "option_price"],
    productCode: ["상품코드", "상품 코드", "product_code", "productCode", "code"],
    batchNo: ["배번호", "배 번호", "batch_no", "batchNo", "batch"],
    property: ["속성", "property", "attribute"],
    link: [
      "링크", "상품링크", "상품 링크", "상세링크", "상세페이지",
      "URL", "url", "link", "product_url", "productUrl"
    ],
    group: [
      "그룹", "그룹코드", "그룹 코드", "대표코드", "대표 코드",
      "group", "group_code", "groupCode", "group_id", "groupId"
    ]
  };

  const els = {
    dataStatus: document.getElementById("dataStatus"),
    searchInput: document.getElementById("searchInput"),
    searchButton: document.getElementById("searchButton"),
    resetButton: document.getElementById("resetButton"),
    suggestions: document.getElementById("suggestions"),
    message: document.getElementById("message"),
    productImage: document.getElementById("productImage"),
    imagePlaceholder: document.getElementById("imagePlaceholder"),
    productCode: document.getElementById("productCode"),
    batchNo: document.getElementById("batchNo"),
    productName: document.getElementById("productName"),
    option1: document.getElementById("option1"),
    option2: document.getElementById("option2"),
    option3: document.getElementById("option3"),
    property: document.getElementById("property"),
    group: document.getElementById("group"),
    productLink: document.getElementById("productLink"),
    groupSection: document.getElementById("groupSection"),
    groupList: document.getElementById("groupList")
  };

  let products = [];
  let currentProduct = null;
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];
  let imageRequestToken = 0;

  function normalize(value) {
    if (value === null || value === undefined) return "";
    const text = String(value).trim();
    return text.toLowerCase() === "nan" ? "" : text;
  }

  function keyOf(value) {
    return normalize(value).toLowerCase().replace(/[\s_]+/g, "");
  }

  function pick(record, aliases) {
    const keys = new Map(
      Object.keys(record).map((key) => [keyOf(key), key])
    );

    for (const alias of aliases) {
      const sourceKey = keys.get(keyOf(alias));
      if (sourceKey !== undefined) return normalize(record[sourceKey]);
    }
    return "";
  }

  function canonicalize(record) {
    const item = {};
    for (const [name, aliases] of Object.entries(FIELDS)) {
      item[name] = pick(record, aliases);
    }
    return item;
  }

  function display(value) {
    return normalize(value) || "-";
  }

  function setStatus(text, mode = "") {
    els.dataStatus.textContent = text;
    els.dataStatus.className = `status-pill ${mode}`.trim();
  }

  function setMessage(text = "") {
    els.message.textContent = text;
  }

  async function loadData() {
    setStatus("데이터 연결 중");
    setMessage("");

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const records = Array.isArray(json)
        ? json
        : Array.isArray(json.products)
          ? json.products
          : [];

      products = records.map(canonicalize).filter((item) =>
        item.productCode || item.batchNo
      );

      if (!products.length) {
        throw new Error("products.json에 검색 가능한 데이터가 없습니다.");
      }

      setStatus(`${products.length.toLocaleString()}개 연결`, "ok");
    } catch (error) {
      products = [];
      setStatus("데이터 오류", "error");
      setMessage(`데이터를 불러오지 못했습니다: ${error.message}`);
    }
  }

  function makeSuggestionList(keyword) {
    const q = normalize(keyword).toLowerCase();
    if (!q || !products.length) return [];

    const results = [];
    const seen = new Set();

    const append = (kind, value, product, startsWith) => {
      const normalizedValue = normalize(value);
      if (!normalizedValue) return;

      const uniqueKey = `${kind}|${normalizedValue.toLowerCase()}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      results.push({
        kind,
        value: normalizedValue,
        product,
        startsWith
      });
    };

    for (const product of products) {
      const code = product.productCode.toLowerCase();
      const batch = product.batchNo.toLowerCase();

      if (code.includes(q)) {
        append("상품코드", product.productCode, product, code.startsWith(q));
      }
      if (batch.includes(q)) {
        append("배번호", product.batchNo, product, batch.startsWith(q));
      }
    }

    results.sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.value.localeCompare(b.value, "ko", {
        numeric: true,
        sensitivity: "base"
      });
    });

    return results.slice(0, 10);
  }

  function renderSuggestions(keyword) {
    currentSuggestions = makeSuggestionList(keyword);
    activeSuggestionIndex = -1;
    els.suggestions.replaceChildren();

    if (!currentSuggestions.length) {
      hideSuggestions();
      return;
    }

    const fragment = document.createDocumentFragment();

    currentSuggestions.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-item";
      button.dataset.index = String(index);

      const kind = document.createElement("span");
      kind.className = "suggestion-kind";
      kind.textContent = item.kind;

      const value = document.createElement("span");
      value.className = "suggestion-value";
      value.textContent = item.value;

      const name = document.createElement("span");
      name.className = "suggestion-name";
      name.textContent = item.product.productName || "상품명 없음";

      button.append(kind, value, name);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        selectSuggestion(index);
      });

      fragment.appendChild(button);
    });

    els.suggestions.appendChild(fragment);
    els.suggestions.hidden = false;
  }

  function hideSuggestions() {
    els.suggestions.hidden = true;
    activeSuggestionIndex = -1;
  }

  function updateActiveSuggestion() {
    const items = [...els.suggestions.querySelectorAll(".suggestion-item")];

    items.forEach((item, index) => {
      item.classList.toggle("active", index === activeSuggestionIndex);
    });

    if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
      items[activeSuggestionIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function selectSuggestion(index) {
    const suggestion = currentSuggestions[index];
    if (!suggestion) return;

    els.searchInput.value = suggestion.value;
    hideSuggestions();
    showProfile(suggestion.product);
    setMessage("자동완성 항목을 선택했습니다.");
  }

  function findSearchRows(keyword) {
    const q = normalize(keyword).toLowerCase();
    if (!q) return [];

    const exact = products.filter(
      (item) =>
        item.productCode.toLowerCase() === q ||
        item.batchNo.toLowerCase() === q
    );

    if (exact.length) return exact;

    return products.filter(
      (item) =>
        item.productCode.toLowerCase().includes(q) ||
        item.batchNo.toLowerCase().includes(q)
    );
  }

  function chooseRepresentative(rows) {
    for (const row of rows) {
      const group = normalize(row.group);
      if (!group) continue;

      const representative = products.find(
        (item) => item.productCode === group || item.batchNo === group
      );
      if (representative) return representative;
    }

    return rows.find((row) => normalize(row.group)) || rows[0];
  }

  function search() {
    const keyword = normalize(els.searchInput.value);
    hideSuggestions();

    if (!keyword) {
      setMessage("상품코드 또는 배번호를 입력해 주세요.");
      return;
    }

    if (!products.length) {
      setMessage("데이터가 아직 준비되지 않았습니다.");
      return;
    }

    const rows = findSearchRows(keyword);

    if (!rows.length) {
      clearProfile();
      setMessage("검색 결과가 없습니다.");
      return;
    }

    const representative = chooseRepresentative(rows);
    showProfile(representative);
    setMessage(`${rows.length.toLocaleString()}개 검색됨`);
  }

  function showProfile(product) {
    currentProduct = product;

    els.productCode.textContent = display(product.productCode);
    els.batchNo.textContent = display(product.batchNo);
    els.productName.textContent = display(product.productName);
    els.option1.textContent = display(product.option1);
    els.option2.textContent = display(product.option2);
    els.option3.textContent = display(product.option3);
    els.property.textContent = display(product.property);
    els.group.textContent = display(product.group);

    const link = normalize(product.link);
    if (link) {
      const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
      els.productLink.href = url;
      els.productLink.textContent = link;
      els.productLink.classList.remove("disabled");
    } else {
      els.productLink.href = "#";
      els.productLink.textContent = "-";
      els.productLink.classList.add("disabled");
    }

    loadImage(product.batchNo);
    renderGroupProducts(product);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearProfile() {
    currentProduct = null;

    for (const element of [
      els.productCode,
      els.batchNo,
      els.productName,
      els.option1,
      els.option2,
      els.option3,
      els.property,
      els.group
    ]) {
      element.textContent = "-";
    }

    els.productLink.href = "#";
    els.productLink.textContent = "-";
    els.productLink.classList.add("disabled");

    imageRequestToken += 1;
    els.productImage.hidden = true;
    els.productImage.removeAttribute("src");
    els.imagePlaceholder.hidden = false;
    els.imagePlaceholder.textContent = "이미지 없음";

    els.groupSection.hidden = true;
    els.groupList.replaceChildren();
  }

  async function loadImage(batchNo) {
    const token = ++imageRequestToken;
    const batch = normalize(batchNo);

    els.productImage.hidden = true;
    els.imagePlaceholder.hidden = false;

    if (!batch) {
      els.imagePlaceholder.textContent = "배번호 없음";
      return;
    }

    els.imagePlaceholder.textContent = "이미지 불러오는 중...";

    for (const extension of IMAGE_EXTENSIONS) {
      const url = `${IMAGE_BASE_URL}/${encodeURIComponent(batch)}${extension}?v=${Date.now()}`;

      try {
        const success = await testImage(url);
        if (token !== imageRequestToken) return;

        if (success) {
          els.productImage.src = url;
          els.productImage.hidden = false;
          els.imagePlaceholder.hidden = true;
          return;
        }
      } catch (_) {
        // 다음 확장자 시도
      }
    }

    if (token === imageRequestToken) {
      els.imagePlaceholder.textContent = "이미지 없음";
    }
  }

  function testImage(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  }

  function getGroupProducts(product) {
    const map = new Map();
    const group = normalize(product.group);
    const productNo = normalize(product.productNo);
    const productCode = normalize(product.productCode);
    const batchNo = normalize(product.batchNo);

    const add = (item) => {
      const key = `${item.productCode}|${item.batchNo}`;
      if (!map.has(key)) map.set(key, item);
    };

    if (group) {
      products
        .filter((item) => normalize(item.group) === group)
        .forEach(add);

      products
        .filter(
          (item) => item.productCode === group || item.batchNo === group
        )
        .forEach(add);

      products
        .filter(
          (item) =>
            item.group === productCode ||
            item.group === batchNo
        )
        .forEach(add);
    }

    if (productNo) {
      products
        .filter((item) => item.productNo === productNo)
        .forEach(add);
    }

    if (!map.size) {
      products
        .filter(
          (item) =>
            item.productCode === productCode ||
            item.batchNo === batchNo
        )
        .forEach(add);
    }

    return [...map.values()];
  }

  function renderGroupProducts(product) {
    const rows = getGroupProducts(product);
    els.groupList.replaceChildren();

    if (rows.length <= 1) {
      els.groupSection.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "group-item";

      const isCurrent =
        row.productCode === product.productCode &&
        row.batchNo === product.batchNo;

      if (isCurrent) button.classList.add("current");

      const code = document.createElement("strong");
      code.textContent = `상품코드 : ${display(row.productCode)}`;

      const batch = document.createElement("span");
      batch.textContent = `배번호 : ${display(row.batchNo)}`;

      button.append(code, batch);
      button.addEventListener("click", () => showProfile(row));
      fragment.appendChild(button);
    }

    els.groupList.appendChild(fragment);
    els.groupSection.hidden = false;
  }

  function resetAll() {
    els.searchInput.value = "";
    hideSuggestions();
    clearProfile();
    setMessage("");
  }

  els.searchInput.addEventListener("input", () => {
    const keyword = els.searchInput.value;
    if (normalize(keyword)) {
      renderSuggestions(keyword);
    } else {
      hideSuggestions();
    }
  });

  els.searchInput.addEventListener("keydown", (event) => {
    if (!els.suggestions.hidden && currentSuggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeSuggestionIndex =
          (activeSuggestionIndex + 1) % currentSuggestions.length;
        updateActiveSuggestion();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeSuggestionIndex =
          (activeSuggestionIndex - 1 + currentSuggestions.length) %
          currentSuggestions.length;
        updateActiveSuggestion();
        return;
      }

      if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        selectSuggestion(activeSuggestionIndex);
        return;
      }

      if (event.key === "Escape") {
        hideSuggestions();
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });

  els.searchButton.addEventListener("click", search);
  els.resetButton.addEventListener("click", resetAll);

  document.addEventListener("pointerdown", (event) => {
    if (
      !els.suggestions.contains(event.target) &&
      event.target !== els.searchInput
    ) {
      hideSuggestions();
    }
  });

  els.productLink.addEventListener("click", (event) => {
    if (els.productLink.classList.contains("disabled")) {
      event.preventDefault();
      setMessage("등록된 링크가 없습니다.");
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`);
    });
  }

  clearProfile();
  loadData();
})();
