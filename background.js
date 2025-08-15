console.log("CoinGecko Data Exporter background script loaded");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "stopExport") {
    console.log("Export stopped.");
    sendResponse({ success: true });
  }

  return true;
});

