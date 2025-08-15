class ModalDialog {
  constructor() {
    this.modal = null;
    this.overlay = null;
    this.currentResolve = null;
    this.isAnimating = false;
  }

  show(options = {}) {
    const {
      title = 'Confirmation',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'confirm',
      showProgress = false
    } = options;

    return new Promise((resolve) => {
      // If we're currently animating, wait for it to finish
      if (this.isAnimating) {
        setTimeout(() => {
          this.show(options).then(resolve);
        }, 350);
        return;
      }

      // Remove existing modal if any
      this.hide();

      // Wait a bit to ensure cleanup is complete
      setTimeout(() => {
        this.createModal(title, message, confirmText, cancelText, type, showProgress, resolve);
      }, 50);
    });
  }

  createModal(title, message, confirmText, cancelText, type, showProgress, resolve) {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    // Create modal dialog
    this.modal = document.createElement('div');
    this.modal.className = `modal-dialog ${type}`;

    // Add content
    this.modal.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-message">${message}</div>
        ${showProgress ? '<div class="progress-container"><div class="progress-bar" id="progressBar" style="width: 0%"></div></div>' : ''}
      </div>
      <div class="modal-footer">
        ${type !== 'alert' && type !== 'progress' ? `<button class="btn-secondary" id="modalCancel">${cancelText}</button>` : ''}
        <button class="btn-primary" id="modalConfirm">${confirmText}</button>
      </div>
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Set animation flag
    this.isAnimating = true;

    // Add animation class after a brief delay
    setTimeout(() => {
      this.modal.classList.add('show');
      this.isAnimating = false;
    }, 10);

    // Bind events
    this.bindModalEvents(resolve);
  }

  bindModalEvents(resolve) {
    const confirmBtn = this.modal.querySelector('#modalConfirm');
    const cancelBtn = this.modal.querySelector('#modalCancel');
    const closeBtn = this.modal.querySelector('.modal-close');

    this.currentResolve = resolve;
    
    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      resolve(true);
    };

    const handleCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      resolve(false);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        handleCancel(e);
      }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        handleCancel(e);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  updateProgress(percentage, message = '') {
    if (!this.modal) return;
    
    const progressBar = this.modal.querySelector('#progressBar');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    if (message) {
      const messageElement = this.modal.querySelector('.modal-message');
      if (messageElement) {
        messageElement.innerHTML = message;
      }
    }
  }

  hide() {
    if (this.modal && this.overlay) {
      this.isAnimating = true;
      this.modal.classList.remove('show');
      
      // Wait for animation to complete before removing
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.modal = null;
        this.overlay = null;
        this.currentResolve = null;
        this.isAnimating = false;
      }, 300);
    }
  }
}

// Global instance
window.ModalDialog = new ModalDialog();