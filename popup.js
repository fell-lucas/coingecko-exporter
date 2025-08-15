class StatusManager {
  constructor() {
    this.statusElement = document.getElementById('statusMessage');
  }

  show(message, type = 'info') {
    this.statusElement.textContent = message;
    this.statusElement.className = `status-message status-${type}`;
    this.statusElement.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => this.hide(), 5000);
    }
  }

  hide() {
    this.statusElement.style.display = 'none';
  }
}

const statusManager = new StatusManager();

// Enhanced export configuration with column selection
class ExportConfig {
  constructor() {
    this.format = 'csv';
    this.showPreview = true;
    this.selectedColumns = new Set();
    this.customFilename = '';
    this.currentDataType = null; // 'portfolio' or 'transactions'
    
    // Default column selections (in proper display order)
    this.defaultPortfolioColumns = ['coin', 'symbol', 'price', 'holdingsValue', 'totalHoldings', 'pnlValue', 'pnlPercentage'];
    this.defaultTransactionColumns = ['type', 'price', 'quantity', 'dateTime', 'cost', 'pnl'];
    
    // Storage keys for preferences
    this.storageKeys = {
      portfolioColumns: 'columnPrefs_portfolio',
      transactionColumns: 'columnPrefs_transactions',
      exportFormat: 'exportFormat_pref',
      showPreview: 'showPreview_pref'
    };
    
    this.bindEvents();
    this.loadPreferences().then(() => {
      // Detect page type and apply preferences during initialization
      this.detectAndSetDataType();
      this.updateUI();
    });
  }

  bindEvents() {
    // Format selection
    document.getElementById('exportFormat').addEventListener('change', (e) => {
      this.format = e.target.value;
      this.updateUI();
      this.savePreferences(); // Save when changed
    });

    // Preview checkbox
    document.getElementById('showPreview').addEventListener('change', (e) => {
      this.showPreview = e.target.checked;
      this.savePreferences(); // Save when changed
    });

    // Custom filename
    document.getElementById('exportFileName').addEventListener('input', (e) => {
      this.customFilename = e.target.value.trim();
    });

    // Column selection events
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('column-checkbox')) {
        const column = e.target.dataset.column;
        if (e.target.checked) {
          this.selectedColumns.add(column);
        } else {
          this.selectedColumns.delete(column);
        }
        // Save preferences when column selection changes
        this.savePreferences();
      }
    });

    // Control buttons
    document.getElementById('selectAllColumns').addEventListener('click', () => {
      this.selectAllColumns();
      this.savePreferences(); // Save after bulk change
    });

    document.getElementById('deselectAllColumns').addEventListener('click', () => {
      this.deselectAllColumns();
      this.savePreferences(); // Save after bulk change
    });

    document.getElementById('resetToDefault').addEventListener('click', () => {
      this.resetToDefault();
      this.savePreferences(); // Save after reset
    });
  }

  // Load user preferences from Chrome storage
  async loadPreferences() {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.sync.get([
          this.storageKeys.portfolioColumns,
          this.storageKeys.transactionColumns,
          this.storageKeys.exportFormat,
          this.storageKeys.showPreview
        ], resolve);
      });

      // Load export format preference
      if (result[this.storageKeys.exportFormat]) {
        this.format = result[this.storageKeys.exportFormat];
        document.getElementById('exportFormat').value = this.format;
      }

      // Load preview preference
      if (result[this.storageKeys.showPreview] !== undefined) {
        this.showPreview = result[this.storageKeys.showPreview];
        document.getElementById('showPreview').checked = this.showPreview;
      }

      // Load column preferences - we'll apply them when the data type is set
      this.savedPortfolioColumns = result[this.storageKeys.portfolioColumns] || this.defaultPortfolioColumns;
      this.savedTransactionColumns = result[this.storageKeys.transactionColumns] || this.defaultTransactionColumns;

    } catch (error) {
      console.error('Error loading preferences:', error);
      // Use defaults if loading fails
      this.savedPortfolioColumns = this.defaultPortfolioColumns;
      this.savedTransactionColumns = this.defaultTransactionColumns;
    }
  }

  // Save user preferences to Chrome storage
  async savePreferences() {
    try {
      const prefsToSave = {
        [this.storageKeys.exportFormat]: this.format,
        [this.storageKeys.showPreview]: this.showPreview
      };

      // Save column preferences based on current data type
      if (this.currentDataType === 'portfolio') {
        const portfolioColumns = Array.from(this.selectedColumns);
        if (portfolioColumns.length > 0) {
          prefsToSave[this.storageKeys.portfolioColumns] = portfolioColumns;
        }
      } else if (this.currentDataType === 'transactions') {
        const transactionColumns = Array.from(this.selectedColumns);
        if (transactionColumns.length > 0) {
          prefsToSave[this.storageKeys.transactionColumns] = transactionColumns;
        }
      }

      await new Promise(resolve => {
        chrome.storage.sync.set(prefsToSave, resolve);
      });

      // Update saved preferences in memory
      if (this.currentDataType === 'portfolio') {
        this.savedPortfolioColumns = Array.from(this.selectedColumns);
      } else if (this.currentDataType === 'transactions') {
        this.savedTransactionColumns = Array.from(this.selectedColumns);
      }

      // Show saved indicator
      this.showSavedIndicator();

    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  // Show visual indicator that preferences were saved
  showSavedIndicator() {
    const indicator = document.getElementById('preferencesSaved');
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 1500);
    }
  }

  // Helper methods to identify column types
  isPortfolioColumn(column) {
    const portfolioColumns = ['coin', 'symbol', 'price', 'change1h', 'change24h', 'change7d', 'volume', 'marketCap', 'holdingsValue', 'totalHoldings', 'pnlValue', 'pnlPercentage'];
    return portfolioColumns.includes(column);
  }

  isTransactionColumn(column) {
    const transactionColumns = ['type', 'price', 'quantity', 'dateTime', 'fees', 'cost', 'proceeds', 'pnl', 'notes'];
    return transactionColumns.includes(column);
  }

  setDataType(dataType) {
    this.currentDataType = dataType;
    
    // Clear current selections
    this.selectedColumns.clear();
    
    // Load saved preferences for this data type
    if (dataType === 'portfolio') {
      this.savedPortfolioColumns.forEach(col => this.selectedColumns.add(col));
    } else if (dataType === 'transactions') {
      this.savedTransactionColumns.forEach(col => this.selectedColumns.add(col));
    }
    
    // Update UI
    this.showRelevantColumns();
    this.updateColumnCheckboxes();
  }

  // Detect page type during popup initialization and set data type
  async detectAndSetDataType() {
    try {
      // Get active tab
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!tabs || tabs.length === 0 || !tabs[0].url.includes('coingecko.com')) {
        // If not on CoinGecko, show both column groups and use portfolio defaults
        this.currentDataType = 'portfolio';
        this.savedPortfolioColumns.forEach(col => this.selectedColumns.add(col));
        this.showRelevantColumns();
        this.updateColumnCheckboxes();
        return;
      }

      const activeTab = tabs[0];
      
      // Try to detect table type
      const tableResponse = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTab.id, { action: "detectPageType" }, (response) => {
          // Handle cases where content script might not be ready
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });

      if (tableResponse && tableResponse.pageType) {
        this.setDataType(tableResponse.pageType);
      } else {
        // Fallback: assume portfolio and use saved preferences
        this.currentDataType = 'portfolio';
        this.savedPortfolioColumns.forEach(col => this.selectedColumns.add(col));
        this.showRelevantColumns();
        this.updateColumnCheckboxes();
      }
    } catch (error) {
      console.log('Could not detect page type during initialization, using defaults:', error);
      // Fallback: use portfolio defaults
      this.currentDataType = 'portfolio';
      this.savedPortfolioColumns.forEach(col => this.selectedColumns.add(col));
      this.showRelevantColumns();
      this.updateColumnCheckboxes();
    }
  }

  showRelevantColumns() {
    const portfolioGroup = document.getElementById('portfolioColumns');
    const transactionGroup = document.getElementById('transactionColumns');
    
    if (this.currentDataType === 'portfolio') {
      portfolioGroup.style.display = 'block';
      transactionGroup.style.display = 'none';
    } else if (this.currentDataType === 'transactions') {
      portfolioGroup.style.display = 'none';
      transactionGroup.style.display = 'block';
    } else {
      // Show both if unknown
      portfolioGroup.style.display = 'block';
      transactionGroup.style.display = 'block';
    }
  }

  selectAllColumns() {
    const activeCheckboxes = this.getActiveColumnCheckboxes();
    activeCheckboxes.forEach(checkbox => {
      checkbox.checked = true;
      this.selectedColumns.add(checkbox.dataset.column);
    });
  }

  deselectAllColumns() {
    const activeCheckboxes = this.getActiveColumnCheckboxes();
    activeCheckboxes.forEach(checkbox => {
      checkbox.checked = false;
      this.selectedColumns.delete(checkbox.dataset.column);
    });
  }

  resetToDefault() {
    // Clear current selection
    this.selectedColumns.clear();
    
    // Set default based on current data type
    const defaultColumns = this.currentDataType === 'transactions' 
      ? this.defaultTransactionColumns 
      : this.defaultPortfolioColumns;
    
    defaultColumns.forEach(col => this.selectedColumns.add(col));
    this.updateColumnCheckboxes();
  }

  getActiveColumnCheckboxes() {
    const portfolioGroup = document.getElementById('portfolioColumns');
    const transactionGroup = document.getElementById('transactionColumns');
    
    let activeGroup;
    if (portfolioGroup.style.display !== 'none') {
      activeGroup = portfolioGroup;
    } else {
      activeGroup = transactionGroup;
    }
    
    return activeGroup.querySelectorAll('.column-checkbox');
  }

  updateColumnCheckboxes() {
    const allCheckboxes = document.querySelectorAll('.column-checkbox');
    allCheckboxes.forEach(checkbox => {
      checkbox.checked = this.selectedColumns.has(checkbox.dataset.column);
    });
  }

  updateUI() {
    // Column options are always visible now
    const columnOptions = document.getElementById('columnOptions');
    columnOptions.style.display = 'block';
  }

  getSelectedColumns() {
    return Array.from(this.selectedColumns);
  }

  getConfig() {
    return {
      format: this.format,
      showPreview: this.showPreview,
      selectedColumns: this.getSelectedColumns(),
      customFilename: this.customFilename
    };
  }
}

const exportConfig = new ExportConfig();

// Simplified handleExport function without tracking
async function handleExport() {
  const exportBtn = document.getElementById('startExportBtn');

  try {
    // Show loading state
    exportBtn.classList.add('btn-loading');
    exportBtn.disabled = true;
    statusManager.show('Initializing export...', 'info');

    // Show confirmation with better modal
    const confirmed = await window.ModalDialog.show({
      title: 'Confirm Export',
      message: 'Confirm you are on your CoinGecko portfolio page or crypto transaction page. If you are not, the export will fail or contain irrelevant data.',
      confirmText: 'Start Export',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      statusManager.hide();
      return;
    }

    // Get active tab
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const activeTab = tabs[0];

    // Check if on CoinGecko
    if (!activeTab.url.includes('coingecko.com')) {
      throw new Error('Please navigate to a CoinGecko page first');
    }

    // Detect table type and set it in export config
    const tableResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTab.id, { action: "detectPageType" }, resolve);
    });

    if (!tableResponse || !tableResponse.pageType) {
      throw new Error('No valid data table detected. Please ensure you\'re on a CoinGecko portfolio or transactions page.');
    }

    // Set the data type in exportConfig so it shows the right column options
    exportConfig.setDataType(tableResponse.pageType);

    // Get preview data if enabled
    if (exportConfig.showPreview) {
      const previewResponse = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTab.id, {
          action: "getPreview"
        }, resolve);
      });

      if (previewResponse && previewResponse.data) {
        // Filter preview data based on selected columns
        const selectedColumns = exportConfig.getSelectedColumns();
        const filteredPreviewData = filterDataByColumns(previewResponse.data, selectedColumns);

        // Show preview and get confirmation, pass the total row count from original response
        const previewConfirmed = await showDataPreview(
          filteredPreviewData,
          previewResponse.type,
          selectedColumns,
          previewResponse.totalRows || previewResponse.data.length
        );
        if (!previewConfirmed) {
          statusManager.hide();
          return;
        }

        // Add a delay to ensure the preview modal is fully closed
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    // Show progress modal after preview is confirmed and closed
    window.ModalDialog.show({
      title: 'Exporting Data',
      message: 'Generating export file...',
      type: 'progress',
      showProgress: true
    });

    // Wait for the progress modal to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update progress
    window.ModalDialog.updateProgress(25, 'Processing data...');

    // Start actual export
    const exportResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTab.id, {
        action: "extractData",
        config: exportConfig.getConfig()
      }, resolve);
    });

    if (!exportResponse || !exportResponse.success) {
      throw new Error(exportResponse?.error || 'Export failed');
    }

    // Update progress
    window.ModalDialog.updateProgress(100, 'Export completed successfully!');

    // Show success message
    setTimeout(() => {
      window.ModalDialog.hide();
      statusManager.show('Export completed successfully!', 'success');
    }, 1500);

  } catch (error) {
    console.error('Export error:', error);

    // Hide any open modal
    window.ModalDialog.hide();

    // Wait for modal to close before showing error
    setTimeout(async () => {
      statusManager.show(`Export failed: ${error.message}`, 'error');

      // Show error modal for user-friendly error display
      await window.ModalDialog.show({
        title: 'Export Failed',
        message: `An error occurred during export:\n\n${error.message}\n\nPlease try again or contact support if the issue persists.`,
        confirmText: 'OK',
        type: 'alert'
      });
    }, 400);
  } finally {
    // Reset button state
    exportBtn.classList.remove('btn-loading');
    exportBtn.disabled = false;
  }
}

// Filter data to only include selected columns
function filterDataByColumns(data, selectedColumns) {
  if (!selectedColumns || selectedColumns.length === 0) {
    return data; // Return all data if no columns selected
  }
  
  return data.map(row => {
    const filteredRow = {};
    selectedColumns.forEach(column => {
      if (row.hasOwnProperty(column)) {
        filteredRow[column] = row[column];
      }
    });
    return filteredRow;
  });
}

// Data preview function
async function showDataPreview(data, tableType, selectedColumns = null, totalRows = null) {
  // Create preview HTML
  const previewHtml = generatePreviewTable(data.slice(0, 2)); // Show first 2 rows
  
  // Use provided totalRows or fall back to data length
  const rowCount = totalRows || data.length;
  
  // Create column info message
  let columnInfo = '';
  if (selectedColumns && selectedColumns.length > 0) {
    columnInfo = `<div style="margin-bottom: 10px; font-size: 12px; color: #4BCC00; font-weight: 500;">
      📊 Exporting ${selectedColumns.length} selected columns: ${selectedColumns.join(', ')}
    </div>`;
  } else {
    columnInfo = `<div style="margin-bottom: 10px; font-size: 12px; color: #666;">
      📊 Exporting all available columns
    </div>`;
  }
  
  const result = await window.ModalDialog.show({
    title: `Preview ${tableType} Export`,
    message: `
      <div style="margin-bottom: 15px;">Found ${rowCount} rows. Preview of first 2 rows:</div>
      ${columnInfo}
      <div style="margin-bottom: 8px; font-size: 11px; color: #666; font-style: italic;">
        💡 Tip: Scroll horizontally to see all columns
      </div>
      <div class="data-preview">${previewHtml}</div>
      <div style="margin-top: 10px; font-size: 11px; color: #666;">
        This preview shows exactly what will be exported. Continue with export?
      </div>
    `,
    confirmText: 'Export',
    cancelText: 'Cancel'
  });
  
  return result;
}

function generatePreviewTable(data) {
  if (!data || data.length === 0) return '<p>No data to preview</p>';
  
  const availableColumns = Object.keys(data[0]);
  
  // Define proper column order
  const portfolioColumnOrder = [
    'coin', 'symbol', 'price', 'change1h', 'change24h', 'change7d', 
    'volume', 'marketCap', 'holdingsValue', 'totalHoldings', 'pnlValue', 'pnlPercentage'
  ];
  
  const transactionColumnOrder = [
    'type', 'price', 'quantity', 'dateTime', 'fees', 'cost', 'proceeds', 'pnl', 'notes'
  ];
  
  // Determine if this is portfolio or transaction data and get ordered columns
  const isPortfolio = availableColumns.includes('coin') || availableColumns.includes('holdingsValue');
  const columnOrder = isPortfolio ? portfolioColumnOrder : transactionColumnOrder;
  
  // Filter to only show columns that exist in the data, in the proper order
  const columns = columnOrder.filter(col => availableColumns.includes(col));
  
  // Define user-friendly column names
  const columnDisplayNames = {
    // Portfolio columns
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
    pnlPercentage: 'PNL Percentage',
    // Transaction columns
    type: 'Type',
    quantity: 'Quantity',
    dateTime: 'Date & Time',
    fees: 'Fees',
    cost: 'Cost',
    proceeds: 'Proceeds',
    pnl: 'PNL',
    notes: 'Notes'
  };
  
  let html = '<table><thead><tr>';
  columns.forEach(col => {
    const displayName = columnDisplayNames[col] || col;
    html += `<th>${displayName}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  data.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      const cellValue = row[col] || 'N/A';
      // Truncate long values for better display
      const displayValue = String(cellValue).length > 20 
        ? String(cellValue).substring(0, 20) + '...' 
        : cellValue;
      html += `<td title="${cellValue}">${displayValue}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  return html;
}

// Simple export button handler without payment/tracking
document.getElementById("startExportBtn").addEventListener("click", async () => {
  try {
    statusManager.hide();
    await handleExport();
  } catch (error) {
    console.error("Error in export process:", error);
    statusManager.show(`Unable to start export: ${error.message}`, 'error');
  }
});
