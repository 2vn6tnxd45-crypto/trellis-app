/**
 * Krib Booking Widget Embed Script
 * ================================
 * Lightweight embeddable script that loads the booking widget
 *
 * Usage:
 * <div id="krib-booking"></div>
 * <script
 *   src="https://mykrib.app/widget/booking.js"
 *   data-contractor="CONTRACTOR_ID"
 *   data-color="#10b981"
 * ></script>
 */
(function() {
    'use strict';

    // Configuration
    var WIDGET_VERSION = '1.0.0';
    var API_BASE = ''; // Will be set based on script location
    var IFRAME_ORIGIN = '';

    // Get script element and configuration
    var scriptElement = document.currentScript || (function() {
        var scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    var config = {
        contractorId: scriptElement.getAttribute('data-contractor'),
        color: scriptElement.getAttribute('data-color') || '#10b981',
        services: scriptElement.getAttribute('data-services') || '',
        container: scriptElement.getAttribute('data-container') || 'krib-booking',
        mode: scriptElement.getAttribute('data-mode') || 'inline', // 'inline' or 'popup'
        buttonText: scriptElement.getAttribute('data-button-text') || 'Book Now'
    };

    // Detect API base from script source
    var scriptSrc = scriptElement.src;
    if (scriptSrc) {
        var url = new URL(scriptSrc);
        API_BASE = url.origin;
        IFRAME_ORIGIN = url.origin;
    }

    // Validate configuration
    if (!config.contractorId) {
        console.error('[Krib Widget] Missing required data-contractor attribute');
        return;
    }

    // Styles
    var styles = '\
        .krib-widget-container {\
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
            max-width: 480px;\
            margin: 0 auto;\
        }\
        .krib-widget-iframe {\
            width: 100%;\
            min-height: 600px;\
            border: none;\
            border-radius: 16px;\
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);\
        }\
        .krib-widget-loading {\
            display: flex;\
            align-items: center;\
            justify-content: center;\
            min-height: 300px;\
            background: #f9fafb;\
            border-radius: 16px;\
        }\
        .krib-widget-spinner {\
            width: 40px;\
            height: 40px;\
            border: 3px solid #e5e7eb;\
            border-top-color: ' + config.color + ';\
            border-radius: 50%;\
            animation: krib-spin 1s linear infinite;\
        }\
        @keyframes krib-spin {\
            to { transform: rotate(360deg); }\
        }\
        .krib-widget-error {\
            text-align: center;\
            padding: 40px 20px;\
            background: #fef2f2;\
            border-radius: 16px;\
            color: #dc2626;\
        }\
        .krib-popup-overlay {\
            position: fixed;\
            top: 0;\
            left: 0;\
            right: 0;\
            bottom: 0;\
            background: rgba(0, 0, 0, 0.5);\
            display: flex;\
            align-items: center;\
            justify-content: center;\
            z-index: 999999;\
            padding: 20px;\
        }\
        .krib-popup-content {\
            background: #fff;\
            border-radius: 16px;\
            width: 100%;\
            max-width: 500px;\
            max-height: 90vh;\
            overflow: hidden;\
            position: relative;\
        }\
        .krib-popup-close {\
            position: absolute;\
            top: 12px;\
            right: 12px;\
            width: 32px;\
            height: 32px;\
            border-radius: 50%;\
            background: rgba(0,0,0,0.1);\
            border: none;\
            cursor: pointer;\
            font-size: 20px;\
            color: #fff;\
            z-index: 10;\
        }\
        .krib-popup-close:hover {\
            background: rgba(0,0,0,0.2);\
        }\
        .krib-trigger-btn {\
            display: inline-flex;\
            align-items: center;\
            justify-content: center;\
            padding: 14px 28px;\
            background: ' + config.color + ';\
            color: #fff;\
            border: none;\
            border-radius: 10px;\
            font-size: 16px;\
            font-weight: 600;\
            cursor: pointer;\
            transition: all 0.2s;\
        }\
        .krib-trigger-btn:hover {\
            filter: brightness(0.95);\
            transform: translateY(-1px);\
        }\
    ';

    // Inject styles
    var styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Widget class
    function KribWidget(config) {
        this.config = config;
        this.container = null;
        this.iframe = null;
        this.isPopup = config.mode === 'popup';
        this.popupOverlay = null;
    }

    KribWidget.prototype.init = function() {
        this.container = document.getElementById(this.config.container);
        if (!this.container) {
            console.error('[Krib Widget] Container element not found: #' + this.config.container);
            return;
        }

        if (this.isPopup) {
            this.createTriggerButton();
        } else {
            this.createWidget();
        }
    };

    KribWidget.prototype.createTriggerButton = function() {
        var self = this;
        var button = document.createElement('button');
        button.className = 'krib-trigger-btn';
        button.textContent = this.config.buttonText;
        button.onclick = function() {
            self.openPopup();
        };
        this.container.appendChild(button);
    };

    KribWidget.prototype.openPopup = function() {
        var self = this;

        // Create overlay
        this.popupOverlay = document.createElement('div');
        this.popupOverlay.className = 'krib-popup-overlay';
        this.popupOverlay.onclick = function(e) {
            if (e.target === self.popupOverlay) {
                self.closePopup();
            }
        };

        // Create popup content
        var popup = document.createElement('div');
        popup.className = 'krib-popup-content';

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.className = 'krib-popup-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = function() {
            self.closePopup();
        };
        popup.appendChild(closeBtn);

        // Create iframe inside popup
        this.createIframe(popup);

        this.popupOverlay.appendChild(popup);
        document.body.appendChild(this.popupOverlay);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    };

    KribWidget.prototype.closePopup = function() {
        if (this.popupOverlay) {
            document.body.removeChild(this.popupOverlay);
            this.popupOverlay = null;
            document.body.style.overflow = '';
        }
    };

    KribWidget.prototype.createWidget = function() {
        var wrapper = document.createElement('div');
        wrapper.className = 'krib-widget-container';

        // Loading state
        var loading = document.createElement('div');
        loading.className = 'krib-widget-loading';
        loading.innerHTML = '<div class="krib-widget-spinner"></div>';
        wrapper.appendChild(loading);

        this.container.appendChild(wrapper);
        this.createIframe(wrapper, loading);
    };

    KribWidget.prototype.createIframe = function(container, loadingEl) {
        var self = this;

        // Build iframe URL
        var iframeSrc = API_BASE + '/widget/booking-frame.html?' +
            'contractor=' + encodeURIComponent(this.config.contractorId) +
            '&color=' + encodeURIComponent(this.config.color) +
            '&v=' + WIDGET_VERSION;

        if (this.config.services) {
            iframeSrc += '&services=' + encodeURIComponent(this.config.services);
        }

        // Create iframe
        this.iframe = document.createElement('iframe');
        this.iframe.className = 'krib-widget-iframe';
        this.iframe.src = iframeSrc;
        this.iframe.title = 'Book Appointment';
        this.iframe.allow = 'geolocation';
        this.iframe.style.display = 'none';

        this.iframe.onload = function() {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
            self.iframe.style.display = 'block';
        };

        this.iframe.onerror = function() {
            if (loadingEl) {
                loadingEl.innerHTML = '<div class="krib-widget-error">Failed to load booking widget. Please try again later.</div>';
            }
        };

        container.appendChild(this.iframe);

        // Listen for messages from iframe
        window.addEventListener('message', function(event) {
            if (event.origin !== IFRAME_ORIGIN) return;

            var data = event.data;
            if (!data || data.source !== 'krib-widget') return;

            switch (data.type) {
                case 'resize':
                    self.iframe.style.height = data.height + 'px';
                    break;
                case 'booking-complete':
                    self.onBookingComplete(data.booking);
                    break;
                case 'close':
                    if (self.isPopup) {
                        self.closePopup();
                    }
                    break;
            }
        });
    };

    KribWidget.prototype.onBookingComplete = function(booking) {
        // Dispatch custom event
        var event = new CustomEvent('krib-booking-complete', {
            detail: booking
        });
        this.container.dispatchEvent(event);
        window.dispatchEvent(event);

        // Close popup after short delay
        if (this.isPopup) {
            var self = this;
            setTimeout(function() {
                self.closePopup();
            }, 3000);
        }
    };

    // Initialize widget
    function initWidget() {
        var widget = new KribWidget(config);
        widget.init();

        // Expose global API
        window.KribWidget = window.KribWidget || {};
        window.KribWidget.instances = window.KribWidget.instances || [];
        window.KribWidget.instances.push(widget);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        initWidget();
    }
})();
