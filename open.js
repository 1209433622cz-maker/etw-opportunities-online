const message = document.querySelector("#message");
const keyLabel = "etw-opportunities-online-tab-key";

function bytes(encoded) {
  const value = encoded.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(value), (part) => part.charCodeAt(0));
}

async function openCatalog() {
  const suppliedKey = new URLSearchParams(location.hash.slice(1)).get("key");
  let encoded = suppliedKey;
  try { encoded ??= sessionStorage.getItem(keyLabel); } catch { /* A full link still works. */ }
  if (!encoded || !/^[A-Za-z0-9_-]{43}$/.test(encoded)) {
    message.textContent = "请使用含访问密钥的完整网址打开项目库。";
    return;
  }

  const response = await fetch("./sealed.json", { cache: "no-store" });
  if (!response.ok) throw new Error("catalog unavailable");
  const envelope = await response.json();
  if (envelope.version !== 1) throw new Error("unsupported version");
  const key = await crypto.subtle.importKey("raw", bytes(encoded), "AES-GCM", false, ["decrypt"]);
  const opened = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv: bytes(envelope.iv),
    additionalData: new TextEncoder().encode("ETW protected opportunity catalog v1"),
  }, key, bytes(envelope.contents));
  const { artwork, catalog, css, script } = JSON.parse(new TextDecoder().decode(opened));
  try {
    sessionStorage.setItem(keyLabel, encoded);
    if (suppliedKey) history.replaceState(null, "", location.pathname + location.search);
  } catch { /* Leave the supplied link intact if the browser blocks local storage. */ }

  const style = document.createElement("style");
  style.textContent = css;
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = artwork.logo;
  document.head.append(style, icon);
  const moduleUrl = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
  try {
    const app = await import(moduleUrl);
    app.mount(catalog, artwork);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

openCatalog().catch(() => {
  message.textContent = "项目库暂时无法打开。请使用交付给你的完整网址重试。";
});
