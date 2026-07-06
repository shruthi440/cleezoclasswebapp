(function () {
  const params = new URLSearchParams(window.location.search);
  const storage = window.localStorage;

  const read = (key, fallback = "") => {
    const value = params.get(key) || storage.getItem(key) || fallback;
    return String(value || "").trim();
  };

  const schoolName = read("school");
  const schoolLogo = read("schoolLogo");
  const schoolAddress = read("schoolAddress");
  const studentPhoto = read("photo");

  const resolveMediaUrl = (value) => {
    if (!value) return "";
    let url = String(value).trim();
    if (!url) return "";
    if (url.startsWith("data:image")) return url;
    if (url.startsWith("http")) return url;
    if (url.startsWith("/uploads/")) return `https://cleezoclass.com:4000${url}`;
    if (url.startsWith("uploads/")) return `https://cleezoclass.com:4000/${url}`;
    if (url.startsWith("/public/uploads/")) return `https://cleezoclass.com:4000${url.replace("/public", "")}`;
    if (/^[A-Za-z0-9+/=]+$/.test(url) && url.length > 100) {
      return `data:image/png;base64,${url}`;
    }
    return url;
  };

  const applyText = (selectors, value) => {
    selectors.split(",").forEach((selector) => {
      document.querySelectorAll(selector.trim()).forEach((node) => {
        node.textContent = value || "--";
      });
    });
  };

  const applyImage = (selectors, value) => {
    const url = resolveMediaUrl(value);
    selectors.split(",").forEach((selector) => {
      document.querySelectorAll(selector.trim()).forEach((node) => {
        if (!url) {
          node.hidden = true;
          node.removeAttribute("src");
          return;
        }
        node.src = url;
        node.hidden = false;
      });
    });
  };

  const injectStyles = () => {
    if (document.getElementById("idcard-common-styles")) return;
    const style = document.createElement("style");
    style.id = "idcard-common-styles";
    style.textContent = `
      .idcard-common-back-details {
        display: grid;
        gap: 4px;
        margin-top: 6px;
        padding: 6px 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px dashed rgba(15, 23, 42, 0.12);
        color: #476070;
        font-size: 8px;
        line-height: 1.25;
      }
      .idcard-common-back-details .top {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .idcard-common-back-details .logo {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        object-fit: cover;
        background: #eef2f7;
        flex: 0 0 auto;
      }
      .idcard-common-back-details .title {
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #18928d;
      }
      .idcard-common-back-details .address {
        font-size: 7px;
        line-height: 1.2;
      }
      .idcard-common-back-details .conditions {
        display: grid;
        gap: 2px;
      }
      .idcard-common-back-details .conditions strong {
        font-size: 7px;
        text-transform: uppercase;
        color: #18928d;
      }
      .idcard-common-back-details .conditions div {
        font-size: 7px;
        line-height: 1.2;
      }
    `;
    document.head.appendChild(style);
  };

  const fitPage = () => {
    const page = document.querySelector(".page");
    if (!(page instanceof HTMLElement)) return;

    const availableWidth = Math.max(window.innerWidth - 12, 320);
    const availableHeight = Math.max(window.innerHeight - 12, 320);
    const pageWidth = page.scrollWidth || page.getBoundingClientRect().width || availableWidth;
    const pageHeight = page.scrollHeight || page.getBoundingClientRect().height || availableHeight;
    const scale = Math.min(availableWidth / pageWidth, availableHeight / pageHeight, 1);

    page.style.transformOrigin = "top center";
    page.style.transform = `scale(${scale})`;
    page.style.width = `${100 / scale}%`;
    page.style.marginLeft = "auto";
    page.style.marginRight = "auto";
  };

  const injectBackDetails = () => {
    const back = document.querySelector(".back");
    if (!(back instanceof HTMLElement) || back.querySelector(".idcard-common-back-details")) return;

    const details = document.createElement("div");
    details.className = "idcard-common-back-details";
    details.innerHTML = `
      <div class="top">
        ${schoolLogo ? `<img class="logo" alt="School logo" src="${resolveMediaUrl(schoolLogo)}" />` : ""}
        <div>
          <div class="title">${schoolName || "School Name"}</div>
          ${schoolAddress ? `<div class="address">${schoolAddress}</div>` : ""}
        </div>
      </div>
      <div class="conditions">
        <strong>Conditions</strong>
        <div>1. Keep this card safe and bring it daily.</div>
        <div>2. Use it only for school identification.</div>
        <div>3. Return it to the office if found.</div>
        <div>4. Report changes in phone or address.</div>
      </div>
    `;
    back.appendChild(details);
  };

  const syncFromQueryAndStorage = () => {
    applyText("[data-school], [data-school-name]", schoolName);
    applyText("[data-school-address]", schoolAddress);
    applyImage("img[data-school-logo]", schoolLogo);
    applyImage("img[data-photo], img[data-student-photo]", studentPhoto);
  };

  const init = () => {
    injectStyles();
    syncFromQueryAndStorage();
    injectBackDetails();
    requestAnimationFrame(() => fitPage());
    window.addEventListener("resize", fitPage);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
