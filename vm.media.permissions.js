"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function bootstrapMediaPermissionUX(global) {
    var SqueakGlobal = global.Squeak || (global.Squeak = {});
    var DEFAULT_ANALYTICS_LIMIT = 200;

    function cloneDetail(detail) {
        if (!detail || typeof detail !== "object") return {};
        var copy = {};
        for (var key in detail) {
            if (Object.prototype.hasOwnProperty.call(detail, key)) {
                copy[key] = detail[key];
            }
        }
        return copy;
    }

    function safeText(value) {
        if (value === undefined || value === null) return "";
        return String(value);
    }

    class MediaPermissionUX {
        constructor(globalScope) {
            this.global = globalScope;
            this.document = globalScope && globalScope.document ? globalScope.document : null;
            this.analytics = [];
            this.analyticsLimit = DEFAULT_ANALYTICS_LIMIT;
            this.activePrompt = null;
        }

        shouldHandleMicrophoneError(error) {
            var description = this.describeMicrophoneError(error);
            if (!description) return false;
            if (description.reason && description.reason !== "unknown") return true;
            var message = (error && error.message ? error.message : "").toLowerCase();
            return message.indexOf("microphone") >= 0 || message.indexOf("permission") >= 0;
        }

        describeMicrophoneError(error) {
            if (!error) {
                return {
                    reason: "unknown",
                    label: "Microphone access failed.",
                    message: "",
                    name: "Error",
                };
            }
            var name = safeText(error.name || "Error");
            var message = safeText(error.message || error.description || error.toString());
            var reason = "unknown";
            var normalizedName = name.toLowerCase();
            if (normalizedName === "notallowederror" || normalizedName === "permissiondeniederror") {
                reason = "permission-denied";
            } else if (normalizedName === "securityerror") {
                reason = "security";
            } else if (normalizedName === "notfounderror" || normalizedName === "devicesnotfounderror") {
                reason = "device-missing";
            } else if (normalizedName.indexOf("denied") >= 0) {
                reason = "permission-denied";
            } else if (normalizedName.indexOf("device") >= 0 || message.toLowerCase().indexOf("device") >= 0) {
                reason = "device-missing";
            }
            var label;
            switch (reason) {
                case "permission-denied":
                    label = "Microphone access was blocked by the browser.";
                    break;
                case "device-missing":
                    label = "No microphone was found or it is currently unavailable.";
                    break;
                case "security":
                    label = "Browser security restrictions blocked microphone access.";
                    break;
                default:
                    label = "Microphone access failed.";
            }
            return {
                reason: reason,
                label: label,
                message: message,
                name: name,
            };
        }

        handleMicrophoneError(context) {
            var self = this;
            var promptContext = context || {};
            var error = promptContext.error;
            var description = this.describeMicrophoneError(error);
            if (!this.shouldHandleMicrophoneError(error)) {
                return Promise.reject(error);
            }
            return this.presentMicrophonePrompt(promptContext, description).then(function(action) {
                var normalized = self._normalizeAction(action);
                if (normalized.type === "retry" && typeof promptContext.onRetry === "function") {
                    return promptContext.onRetry(normalized.options || {});
                }
                if (normalized.type === "fallback") {
                    var mode = normalized.mode;
                    if (mode === "synthetic" && typeof promptContext.onSelectSynthetic === "function") {
                        return promptContext.onSelectSynthetic(normalized.options || {});
                    }
                    if (mode === "file" && typeof promptContext.onSelectFile === "function") {
                        return promptContext.onSelectFile(normalized.options || {});
                    }
                }
                if (typeof promptContext.onCancel === "function") {
                    return promptContext.onCancel(normalized.options || {});
                }
                return Promise.reject(error);
            });
        }

        presentMicrophonePrompt(context, description) {
            var self = this;
            var promptDetail = {
                context: context || {},
                metadata: description || this.describeMicrophoneError(context && context.error),
                overlay: null,
                resolved: false,
                resolve: null,
            };
            if (this.activePrompt && this.activePrompt.resolve) {
                this.recordEvent("prompt.dismiss.replaced", this._promptAnalyticsPayload(this.activePrompt));
                this.activePrompt.resolve({ type: "dismiss", reason: "replaced" });
            }
            this.activePrompt = promptDetail;
            this.recordEvent("prompt.shown", this._promptAnalyticsPayload(promptDetail));
            return new Promise(function(resolve) {
                promptDetail.resolve = function(action) {
                    if (promptDetail.resolved) return;
                    promptDetail.resolved = true;
                    self._teardownPrompt(promptDetail);
                    resolve(action);
                };
                if (self.document && self.document.body && typeof self.document.createElement === "function") {
                    self._renderPrompt(promptDetail);
                } else {
                    self.recordEvent("prompt.render.skipped", self._promptAnalyticsPayload(promptDetail));
                }
            });
        }

        _renderPrompt(promptDetail) {
            var doc = this.document;
            if (!doc || !doc.body) return;
            var overlay = doc.createElement("div");
            overlay.className = "squeak-media-permission-overlay";
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.backgroundColor = "rgba(0, 0, 0, 0.55)";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.zIndex = "2147483646";

            var panel = doc.createElement("div");
            panel.className = "squeak-media-permission-panel";
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-modal", "true");
            panel.style.maxWidth = "420px";
            panel.style.width = "90%";
            panel.style.background = "#1f1f1f";
            panel.style.color = "#f5f5f5";
            panel.style.borderRadius = "12px";
            panel.style.padding = "24px";
            panel.style.boxShadow = "0 18px 48px rgba(0, 0, 0, 0.35)";
            panel.style.fontFamily = "system-ui, sans-serif";

            var title = doc.createElement("h2");
            title.textContent = "Microphone permission required";
            title.style.marginTop = "0";
            title.style.fontSize = "1.2rem";
            panel.appendChild(title);

            var message = doc.createElement("p");
            message.textContent = promptDetail.metadata ? promptDetail.metadata.label : "Microphone access failed.";
            message.style.marginBottom = "12px";
            panel.appendChild(message);

            var guidance = doc.createElement("ul");
            guidance.style.paddingLeft = "20px";
            guidance.style.marginTop = "0";
            guidance.style.marginBottom = "16px";

            var items = [
                "Select the lock icon in the address bar and enable microphone access.",
                "If you closed the browser prompt, choose Retry to ask again.",
                "Use the Synthetic Source fallback to keep recording without a microphone.",
            ];
            for (var i = 0; i < items.length; i++) {
                var li = doc.createElement("li");
                li.textContent = items[i];
                li.style.marginBottom = "6px";
                guidance.appendChild(li);
            }
            panel.appendChild(guidance);

            if (promptDetail.metadata && promptDetail.metadata.message) {
                var errorLine = doc.createElement("p");
                errorLine.style.fontSize = "0.85rem";
                errorLine.style.opacity = "0.8";
                errorLine.style.wordBreak = "break-word";
                errorLine.textContent = "Error: " + promptDetail.metadata.message;
                panel.appendChild(errorLine);
            }

            var buttonBar = doc.createElement("div");
            buttonBar.style.display = "flex";
            buttonBar.style.flexWrap = "wrap";
            buttonBar.style.gap = "8px";
            buttonBar.style.marginTop = "18px";

            var retryBtn = this._createButton(doc, "Retry Microphone", function() {
                this.selectPromptAction({ type: "retry" });
            }.bind(this));
            retryBtn.style.flex = "1 1 45%";
            retryBtn.style.background = "#3a7afe";
            retryBtn.style.color = "#fff";

            var syntheticBtn = this._createButton(doc, "Use Synthetic Source", function() {
                this.selectPromptAction({ type: "fallback", mode: "synthetic" });
            }.bind(this));
            syntheticBtn.style.flex = "1 1 45%";

            var dismissBtn = this._createButton(doc, "Dismiss", function() {
                this.selectPromptAction({ type: "dismiss", reason: "dismiss" });
            }.bind(this));
            dismissBtn.style.flex = "1 1 100%";
            dismissBtn.style.background = "#333";
            dismissBtn.style.color = "#f5f5f5";

            buttonBar.appendChild(retryBtn);
            buttonBar.appendChild(syntheticBtn);
            buttonBar.appendChild(dismissBtn);
            panel.appendChild(buttonBar);

            overlay.appendChild(panel);
            doc.body.appendChild(overlay);
            promptDetail.overlay = overlay;

            if (typeof retryBtn.focus === "function") {
                setTimeout(function() { retryBtn.focus(); }, 0);
            }
        }

        _createButton(doc, label, handler) {
            var button = doc.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.style.padding = "10px 12px";
            button.style.border = "none";
            button.style.borderRadius = "8px";
            button.style.cursor = "pointer";
            button.style.fontSize = "0.95rem";
            button.style.fontWeight = "600";
            button.addEventListener("click", handler);
            return button;
        }

        _teardownPrompt(promptDetail) {
            if (promptDetail.overlay && promptDetail.overlay.parentNode) {
                promptDetail.overlay.parentNode.removeChild(promptDetail.overlay);
            }
            if (this.activePrompt === promptDetail) {
                this.activePrompt = null;
            }
        }

        selectPromptAction(action) {
            if (!this.activePrompt || typeof this.activePrompt.resolve !== "function") return false;
            var normalized = this._normalizeAction(action);
            var payload = this._promptAnalyticsPayload(this.activePrompt);
            payload.action = normalized.type;
            if (normalized.type === "fallback" && normalized.mode) {
                payload.mode = normalized.mode;
                this.recordEvent("prompt.action.fallback." + normalized.mode, payload);
            } else {
                this.recordEvent("prompt.action." + normalized.type, payload);
            }
            this.activePrompt.resolve(normalized);
            return true;
        }

        dismissPrompt(reason) {
            if (!this.activePrompt || typeof this.activePrompt.resolve !== "function") return false;
            var payload = this._promptAnalyticsPayload(this.activePrompt);
            payload.reason = reason || "dismiss";
            this.recordEvent("prompt.dismiss", payload);
            this.activePrompt.resolve({ type: "dismiss", reason: reason || "dismiss" });
            return true;
        }

        getActivePrompt() {
            return this.activePrompt;
        }

        getAnalytics() {
            return this.analytics.slice();
        }

        recordEvent(action, detail) {
            var entry = {
                action: action,
                detail: cloneDetail(detail),
                timestamp: Date.now(),
            };
            this.analytics.push(entry);
            if (this.analytics.length > this.analyticsLimit) {
                this.analytics.splice(0, this.analytics.length - this.analyticsLimit);
            }
            if (typeof this.global.dispatchEvent === "function" && typeof this.global.CustomEvent === "function") {
                try {
                    var event = new this.global.CustomEvent("squeak.mediaPermissionAnalytics", { detail: entry });
                    this.global.dispatchEvent(event);
                } catch (err) {
                    // ignored: CustomEvent may not be constructible in some environments
                }
            }
            return entry;
        }

        _normalizeAction(action) {
            if (action === undefined || action === null) {
                return { type: "dismiss" };
            }
            if (typeof action === "string") {
                if (action === "synthetic") {
                    return { type: "fallback", mode: "synthetic" };
                }
                return { type: action };
            }
            var normalized = cloneDetail(action);
            if (!normalized.type) normalized.type = "dismiss";
            return normalized;
        }

        _promptAnalyticsPayload(promptDetail) {
            var payload = {
                reason: promptDetail.metadata ? promptDetail.metadata.reason : null,
                name: promptDetail.metadata ? promptDetail.metadata.name : null,
                mode: "microphone",
            };
            var options = promptDetail.context && promptDetail.context.options;
            if (options && options.mode) {
                payload.mode = options.mode;
            }
            if (promptDetail.metadata && promptDetail.metadata.message) {
                payload.message = promptDetail.metadata.message;
            }
            return payload;
        }
    }

    Object.extend(SqueakGlobal,
        {
            ensureMediaPermissionUX: function ensureMediaPermissionUX() {
                if (!this.mediaPermissions || !(this.mediaPermissions instanceof MediaPermissionUX)) {
                    this.mediaPermissions = new MediaPermissionUX(global);
                }
                return this.mediaPermissions;
            },
        });

    SqueakGlobal.MediaPermissionUX = MediaPermissionUX;
})(typeof window !== "undefined" ? window : globalThis);
