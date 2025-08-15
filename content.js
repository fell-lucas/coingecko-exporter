console.log("CoinGecko Data Exporter content script loaded");

// No longer automatically run on page load. Just define the necessary functions.
function detectTableType() {
  // Check if the portfolio holdings table is present
  const holdingsTable = document.querySelector("tbody tr[data-portfolio-coin-id]");
  if (holdingsTable) {
    return "portfolio";
  }

  // Check if the transactions table is present
  const transactionsTable = document.querySelector("tbody tr td");
  if (transactionsTable) {
    return "transactions";
  }

  return null;
}

function extractData() {
  const tableType = detectTableType();

  if (tableType === "portfolio") {
    return extractPortfolioHoldings();
  } else if (tableType === "transactions") {
    return extractTransactions();
  } else {
    throw new Error("No valid data table detected. Please ensure you're on a valid CoinGecko page.");
  }
}

// Helper function to generate a formatted date string
function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function extractPortfolioHoldings() {
  let holdings = [];
  
  let tableRows = document.querySelectorAll("tbody tr[data-portfolio-coin-id]");

  tableRows.forEach(row => {
      let columns = row.querySelectorAll("td");

      let coinElement = columns[1]?.querySelector("a div div");
      let symbolElement = columns[1]?.querySelector("a div div div");
      let priceElement = columns[3]?.querySelector("span");
      let change1hElement = columns[4]?.querySelector("span");
      let change24hElement = columns[5]?.querySelector("span");
      let change7dElement = columns[6]?.querySelector("span");
      let volumeElement = columns[9]?.innerText.trim() || "N/A";
      let marketCapElement = columns[10]?.innerText.trim() || "N/A";
      
      // Extract Holdings Value and Total Holdings correctly
      let holdingsRaw = columns[14]?.innerText.trim() || "N/A";
      let holdingsParts = holdingsRaw.match(/([-\d,.\$]+)\s+([-\d,.\$]+)\s+(\w+)/);
      let holdingsValue = holdingsParts ? holdingsParts[1] : "N/A";  
      let totalHoldings = holdingsParts ? `${holdingsParts[2]} ${holdingsParts[3]}` : "N/A";  

      // Extract PNL Value and PNL Percentage correctly, ensuring negative signs are preserved
      let pnlRaw = columns[15]?.innerText.trim() || "N/A";
      let pnlValueMatch = pnlRaw.match(/(-?[\d,.\$]+)/);  
      let pnlPercentageMatch = pnlRaw.match(/(-?[\d,.]+%)/);  

      let pnlValue = pnlValueMatch ? pnlValueMatch[0] : "N/A";  
      let pnlPercentage = pnlPercentageMatch ? pnlPercentageMatch[0] : "N/A";  

      // Ensure negative values are correctly handled
      if (pnlRaw.includes("-")) {
        if (!pnlValue.startsWith("-")) pnlValue = "-" + pnlValue;
        if (!pnlPercentage.startsWith("-")) pnlPercentage = "-" + pnlPercentage;
      }

      let coin = coinElement ? coinElement.innerText.trim() : "N/A";
      let symbol = symbolElement ? symbolElement.innerText.trim() : "N/A";
      let price = priceElement ? priceElement.innerText.trim() : "N/A";
      let change1h = change1hElement ? change1hElement.innerText.trim() : "N/A";
      let change24h = change24hElement ? change24hElement.innerText.trim() : "N/A";
      let change7d = change7dElement ? change7dElement.innerText.trim() : "N/A";

      holdings.push({
        coin,
        symbol,
        price,
        change1h,
        change24h,
        change7d,
        volume: volumeElement,
        marketCap: marketCapElement,
        holdingsValue,
        totalHoldings,
        pnlValue,        
        pnlPercentage    
      });
  });

  if (holdings.length === 0) {
    throw new Error("No portfolio data found!");
  }

  return {
    type: "portfolio",
    data: holdings
  };
}

function extractTransactions() {
  let transactions = [];
  const rows = document.querySelectorAll("tbody tr");

  rows.forEach(row => {
    const columns = row.querySelectorAll("td");

    if (columns.length > 1) {
      const type = columns[0]?.innerText.trim();
      let price = columns[1]?.innerText.trim();
      const quantity = columns[2]?.innerText.trim();
      let dateTime = columns[3]?.innerText.trim();
      const fees = columns[4]?.innerText.trim();
      const cost = columns[5]?.innerText.trim();
      const proceeds = columns[6]?.innerText.trim();
      const pnl = columns[7]?.innerText.trim();
      const notes = columns[8]?.innerText.trim();

      // Fix Price Formatting (remove commas)
      price = price.replace(/,/g, "");

      // Fix Date Formatting (Ensure consistent format)
      if (dateTime.includes("AM") || dateTime.includes("PM")) {
        dateTime = dateTime.replace(/\s+/g, " "); // Remove extra spaces
      }

      transactions.push({
        type,
        price,
        quantity,
        dateTime,
        fees,
        cost,
        proceeds,
        pnl,
        notes
      });
    }
  });

  if (transactions.length === 0) {
    throw new Error("No transactions found!");
  }

  return {
    type: "transactions",
    data: transactions
  };
}

function downloadCSV(data, filename, type, selectedColumns = null) {
  let csvContent = "data:text/csv;charset=utf-8,";

  if (type === "portfolio") {
    // Define all possible columns and their display names in the correct order
    const allColumns = {
      coin: 'Coin',
      symbol: 'Symbol', 
      price: 'Price',
      change1h: '1h Change',
      change24h: '24h Change',
      change7d: '7d Change',
      volume: '24h Volume',
      marketCap: 'Market Cap',
      holdingsValue: 'Holdings Value',
      totalHoldings: 'Total Holdings',
      pnlValue: 'PNL Value',
      pnlPercentage: 'PNL Percentage'
    };

    // Define the proper column order
    const columnOrder = [
      'coin', 'symbol', 'price', 'change1h', 'change24h', 'change7d', 
      'volume', 'marketCap', 'holdingsValue', 'totalHoldings', 'pnlValue', 'pnlPercentage'
    ];

    // Use selected columns or all columns, but maintain the proper order
    let columnsToExport;
    if (selectedColumns && selectedColumns.length > 0) {
      // Filter the ordered columns to only include selected ones
      columnsToExport = columnOrder.filter(col => selectedColumns.includes(col));
    } else {
      columnsToExport = columnOrder;
    }

    // Create header
    csvContent += columnsToExport.map(col => allColumns[col]).join(',') + '\n';
    
    // Create data rows
    data.forEach(entry => {
      const row = columnsToExport.map(col => `"${entry[col] || 'N/A'}"`).join(',');
      csvContent += row + '\n';
    });
  } else {
    // Transaction columns
    const allColumns = {
      type: 'Type',
      price: 'Price',
      quantity: 'Quantity',
      dateTime: 'Date & Time',
      fees: 'Fees',
      cost: 'Cost',
      proceeds: 'Proceeds',
      pnl: 'PNL',
      notes: 'Notes'
    };

    // Define the proper column order for transactions
    const columnOrder = [
      'type', 'price', 'quantity', 'dateTime', 'fees', 'cost', 'proceeds', 'pnl', 'notes'
    ];

    // Use selected columns or all columns, but maintain the proper order
    let columnsToExport;
    if (selectedColumns && selectedColumns.length > 0) {
      // Filter the ordered columns to only include selected ones
      columnsToExport = columnOrder.filter(col => selectedColumns.includes(col));
    } else {
      columnsToExport = columnOrder;
    }

    // Create header
    csvContent += columnsToExport.map(col => allColumns[col]).join(',') + '\n';
    
    // Create data rows
    data.forEach(entry => {
      const row = columnsToExport.map(col => `"${entry[col] || 'N/A'}"`).join(',');
      csvContent += row + '\n';
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadJSON(data, filename, type, selectedColumns = null) {
  let filteredData = data;
  
  // Filter data based on selected columns if provided
  if (selectedColumns && selectedColumns.length > 0) {
    // Define proper column order for consistent export
    let columnOrder;
    if (type === "portfolio") {
      columnOrder = [
        'coin', 'symbol', 'price', 'change1h', 'change24h', 'change7d', 
        'volume', 'marketCap', 'holdingsValue', 'totalHoldings', 'pnlValue', 'pnlPercentage'
      ];
    } else {
      columnOrder = [
        'type', 'price', 'quantity', 'dateTime', 'fees', 'cost', 'proceeds', 'pnl', 'notes'
      ];
    }

    // Filter the ordered columns to only include selected ones
    const orderedSelectedColumns = columnOrder.filter(col => selectedColumns.includes(col));

    filteredData = data.map(entry => {
      const filteredEntry = {};
      orderedSelectedColumns.forEach(col => {
        if (entry.hasOwnProperty(col)) {
          filteredEntry[col] = entry[col];
        }
      });
      return filteredEntry;
    });
  }

  const jsonContent = JSON.stringify({
    exportType: type,
    exportDate: new Date().toISOString(),
    totalRecords: filteredData.length,
    data: filteredData
  }, null, 2);

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Enhanced message handling
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.action === 'extractData') {
      const tableType = detectTableType();
      
      if (!tableType) {
        throw new Error('No supported table found on this page.');
      }
      
      // Extract data based on type
      const result = extractData();
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
      const config = message.config || {};
      const customFilename = config.customFilename || '';
      const format = config.format || 'csv';
      const selectedColumns = config.selectedColumns || null;
      
      let filename;
      if (customFilename) {
        filename = customFilename.includes('.') ? customFilename : `${customFilename}.${format}`;
      } else {
        filename = `coingecko-${result.type}-${timestamp}.${format}`;
      }

      // Generate and download content based on format
      if (format === 'csv') {
        downloadCSV(result.data, filename, result.type, selectedColumns);
      } else if (format === 'json') {
        downloadJSON(result.data, filename, result.type, selectedColumns);
      }

      sendResponse({
        success: true,
        type: result.type,
        rowCount: result.data.length,
        filename: filename
      });
    } 
    
    else if (message.action === 'detectPageType') {
      const pageType = detectTableType();
      sendResponse({
        success: true,
        pageType: pageType
      });
    }
    
    else if (message.action === 'getPreview') {
      const tableType = detectTableType();
      if (!tableType) {
        sendResponse({
          success: false,
          error: 'No supported table found'
        });
        return;
      }
      
      const result = extractData();
      // Return first 2 rows for preview
      sendResponse({
        success: true,
        type: result.type,
        data: result.data.slice(0, 2),
        totalRows: result.data.length
      });
    }
    

  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
  
  return true; // Indicate asynchronous response
});

// Auto-detect page type on load
document.addEventListener('DOMContentLoaded', () => {
  const tableType = detectTableType();
  console.log(`CoinGecko Data Exporter - table type detected: ${tableType}`);
});
