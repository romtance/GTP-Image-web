// GPT Image Generator - Main Script

class GPTImageGenerator {
    constructor() {
        this.API_PROXY_URL = '/api/generate';

        this.selectedSize = '1024x1024';
        this.selectedCount = 1;
        this.isGenerating = false;
        this.history = [];
        this.historyPage = 1;
        this.historyPageSize = 50;
        this.historyTotal = 0;
        this.historyTotalPages = 0;
        this.historySort = 'time';
        this.likedHistoryIds = new Set();
        this.likingHistoryIds = new Set();
        this.username = '';

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.loadLikedHistory();
        this.loadUsername();
        this.restorePrompt();
        this.loadHistory();
    }

    loadUsername() {
        this.username = localStorage.getItem('gptImageUsername') || '';
        this.updateUserInfo();
    }

    loadLikedHistory() {
        try {
            const likedIds = JSON.parse(localStorage.getItem('gptImageLikedHistoryIds') || '[]');
            this.likedHistoryIds = new Set(Array.isArray(likedIds) ? likedIds : []);
        } catch {
            this.likedHistoryIds = new Set();
        }
    }

    saveLikedHistory() {
        localStorage.setItem('gptImageLikedHistoryIds', JSON.stringify([...this.likedHistoryIds]));
    }

    showUsernameDialog(callback) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="username-dialog">
                <h3>请输入用户名</h3>
                <p>生成图片需要先设置用户名</p>
                <div class="dialog-input-group">
                    <input type="text" id="dialogUsernameInput" class="dialog-input" placeholder="请输入用户名" autocomplete="off">
                </div>
                <p id="dialogError" class="dialog-error"></p>
                <div class="dialog-buttons">
                    <button id="dialogCancelBtn" class="dialog-btn cancel">取消</button>
                    <button id="dialogConfirmBtn" class="dialog-btn confirm">确认</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);

        const input = document.getElementById('dialogUsernameInput');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        const error = document.getElementById('dialogError');

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        const confirm = () => {
            const username = input.value.trim();
            if (!username) {
                error.textContent = '请输入用户名';
                return;
            }
            if (username.length < 2) {
                error.textContent = '用户名至少需要2个字符';
                return;
            }
            localStorage.setItem('gptImageUsername', username);
            this.username = username;
            this.updateUserInfo();
            closeModal();
            if (callback) callback();
        };

        confirmBtn.addEventListener('click', confirm);
        cancelBtn.addEventListener('click', closeModal);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        input.focus();
    }

    restorePrompt() {
        const savedPrompt = localStorage.getItem('gptImagePrompt');
        if (savedPrompt) {
            this.promptInput.value = savedPrompt;
            this.updateUI();
        }
    }

    savePrompt() {
        localStorage.setItem('gptImagePrompt', this.promptInput.value);
    }

    bindElements() {
        this.promptInput = document.getElementById('prompt');
        this.generateBtn = document.getElementById('generateBtn');
        this.btnText = this.generateBtn.querySelector('.btn-text');
        this.btnLoading = this.generateBtn.querySelector('.btn-loading');
        this.gallery = document.getElementById('gallery');
        this.historyGallery = document.getElementById('historyGallery');
        this.historyPagination = document.getElementById('historyPagination');
        this.historySortControls = document.getElementById('historySortControls');
        this.historySortButtons = document.querySelectorAll('.history-sort-btn');
        this.sizeButtons = document.querySelectorAll('.size-btn');
        this.countButtons = document.querySelectorAll('.count-btn');
        this.authBtn = document.getElementById('authBtn');
        this.userInfo = document.getElementById('userInfo');
    }

    bindEvents() {
        // Size selection
        this.sizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.sizeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedSize = btn.dataset.size;
            });
        });

        // Count selection
        this.countButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.countButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCount = parseInt(btn.dataset.count);
            });
        });

        // Generate button
        this.generateBtn.addEventListener('click', () => this.generateImage());

        // Input event for prompt textarea - auto save
        this.promptInput.addEventListener('input', () => {
            this.updateUI();
            this.savePrompt();
        });

        // Enter key in textarea
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.generateImage();
            }
        });

        this.historySortButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setHistorySort(btn.dataset.sort));
        });
    }

    updateUI() {
        const hasPrompt = this.promptInput.value.trim().length > 0;
        this.generateBtn.disabled = !hasPrompt || this.isGenerating;
    }

    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            if (this.username) {
                userInfo.innerHTML = `
                    <span class="user-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        ${this.username}
                    </span>
                `;
            } else {
                userInfo.innerHTML = `
                    <span class="user-badge guest" onclick="generator.showUsernameDialog()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        点击登录
                    </span>
                `;
            }
        }
    }

    async generateImage() {
        const prompt = this.promptInput.value.trim();
        if (!prompt || this.isGenerating) return;

        if (!this.username) {
            this.showUsernameDialog(() => this.generateImage());
            return;
        }

        this.setLoading(true);
        this.clearMessages();

        try {
            const payload = {
                model: 'gpt-image-2',
                prompt: prompt,
                size: this.selectedSize,
                n: this.selectedCount
            };

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
            }

            const data = await response.json();
            this.displayImages(data);

            // Save to history with URLs (server already converted b64 to files)
            const historyItem = {
                id: Date.now(),
                prompt: prompt,
                size: this.selectedSize,
                count: this.selectedCount,
                images: (data.data || []).map(img => img.url),
                username: this.username,
                timestamp: new Date().toISOString(),
                likes: 0
            };

            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyItem)
            });

            this.historyPage = 1;
            this.showSuccess('图片生成成功！');
            this.loadHistory();

        } catch (error) {
            this.showError(error.message || '生成图片时发生错误');
        } finally {
            this.setLoading(false);
        }
    }

    async loadHistory() {
        try {
            const res = await fetch(`/api/history?page=${this.historyPage}&pageSize=${this.historyPageSize}&sort=${this.historySort}`);
            if (res.ok) {
                const payload = await res.json();
                this.history = Array.isArray(payload) ? payload : (payload.items || []);
                this.historyPage = Array.isArray(payload) ? 1 : (payload.page || 1);
                this.historyPageSize = Array.isArray(payload) ? 50 : (payload.pageSize || 50);
                this.historyTotal = Array.isArray(payload) ? this.history.length : (payload.total || 0);
                this.historyTotalPages = Array.isArray(payload)
                    ? (this.history.length > 0 ? 1 : 0)
                    : (payload.totalPages || 0);
                this.historySort = Array.isArray(payload) ? 'time' : (payload.sort || 'time');
            }
        } catch {}
        this.renderHistorySortControls();
        this.renderHistory();
        this.renderHistoryPagination();
    }

    renderHistorySortControls() {
        this.historySortButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === this.historySort);
        });
    }

    setHistorySort(sort) {
        if (!sort || sort === this.historySort) {
            return;
        }

        this.historySort = sort;
        this.historyPage = 1;
        this.loadHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyGallery.innerHTML = `
                <div class="history-placeholder">
                    <div class="placeholder-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 8V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <p>生成历史将显示在这里</p>
                </div>
            `;
            return;
        }

        this.historyGallery.innerHTML = this.history.map(item => {
            const imgSrc = item.images[0].startsWith('/') ? item.images[0] : `data:image/png;base64,${item.images[0]}`;
            const escapedPrompt = this.escapeHtml(item.prompt).replace(/'/g, "\\'");
            const isLiked = this.likedHistoryIds.has(item.id);
            const isLiking = this.likingHistoryIds.has(item.id);
            const likeLabel = isLiked ? '已点赞' : '点赞';
            const likeClassName = `history-action-btn${isLiked ? ' liked' : ''}`;
            return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-image-wrapper">
                    <img src="${imgSrc}" alt="Generated image" class="history-item-image">
                    <button class="preview-btn" onclick="generator.showImagePreview('${item.images[0]}', '${escapedPrompt}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                    </button>
                </div>
                <div class="history-item-info">
                    <p class="history-item-prompt">${this.escapeHtml(item.prompt)}</p>
                    <div class="history-item-meta">
                        <span class="meta-user">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            ${item.username || '匿名'}
                        </span>
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12,6 12,12 16,14"/>
                            </svg>
                            ${this.formatDate(item.timestamp)}
                        </span>
                    </div>
                    <div class="history-item-actions">
                        <button class="history-action-btn" onclick="generator.reusePrompt('${escapedPrompt}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <polyline points="1,4 1,10 7,10"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                            </svg>
                            使用提示词
                        </button>
                        <button class="${likeClassName}" onclick="generator.toggleHistoryLike(${item.id})" ${isLiking ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <path d="M12 21s-6.716-4.35-9.192-8.116C.879 9.95 2.01 5.5 6.09 5.5c2.057 0 3.237 1.153 3.91 2.09.673-.937 1.853-2.09 3.91-2.09 4.08 0 5.211 4.45 3.282 7.384C18.716 16.65 12 21 12 21z"/>
                            </svg>
                            ${likeLabel} · ${item.likes || 0}
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    renderHistoryPagination() {
        if (!this.historyPagination) return;

        if (this.historyTotalPages <= 1) {
            this.historyPagination.innerHTML = '';
            this.historyPagination.style.display = 'none';
            return;
        }

        this.historyPagination.style.display = 'flex';
        this.historyPagination.innerHTML = `
            <button class="history-page-btn" ${this.historyPage <= 1 ? 'disabled' : ''} onclick="generator.goToHistoryPage(${this.historyPage - 1})">上一页</button>
            <div class="history-page-info">第 ${this.historyPage} / ${this.historyTotalPages} 页 · 共 ${this.historyTotal} 条</div>
            <button class="history-page-btn" ${this.historyPage >= this.historyTotalPages ? 'disabled' : ''} onclick="generator.goToHistoryPage(${this.historyPage + 1})">下一页</button>
        `;
    }

    async goToHistoryPage(page) {
        if (page < 1 || page > this.historyTotalPages || page === this.historyPage) {
            return;
        }

        this.historyPage = page;
        await this.loadHistory();
        this.historyPagination.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async toggleHistoryLike(id) {
        if (this.likingHistoryIds.has(id)) {
            return;
        }

        const isLiked = this.likedHistoryIds.has(id);
        this.likingHistoryIds.add(id);
        this.renderHistory();

        try {
            const res = await fetch(`/api/history/${id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ liked: !isLiked })
            });

            if (!res.ok) {
                throw new Error('点赞失败');
            }

            const updatedItem = await res.json();

            if (isLiked) {
                this.likedHistoryIds.delete(id);
            } else {
                this.likedHistoryIds.add(id);
            }
            this.saveLikedHistory();

            if (this.historySort === 'likes') {
                await this.loadHistory();
                return;
            }

            this.history = this.history.map(item => item.id === id
                ? { ...item, likes: updatedItem.likes || 0 }
                : item);
        } catch (error) {
            this.showError(error.message || '点赞失败');
        } finally {
            this.likingHistoryIds.delete(id);
            this.renderHistory();
        }
    }

    reusePrompt(prompt) {
        this.promptInput.value = prompt;
        this.updateUI();
        this.promptInput.focus();
    }

    async deleteHistoryItem(id) {
        try {
            const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await this.loadHistory();
                if (this.history.length === 0 && this.historyPage > 1) {
                    this.historyPage -= 1;
                    await this.loadHistory();
                }
            }
        } catch {}
    }

    showImagePreview(imageSrc, prompt) {
        const imgSrc = imageSrc.startsWith('/') ? imageSrc : `data:image/png;base64,${imageSrc}`;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <img src="${imgSrc}" alt="Preview" class="modal-image">
                <div class="modal-prompt-container">
                    <div class="modal-prompt-label">提示词</div>
                    <p class="modal-prompt">${this.escapeHtml(prompt)}</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Show modal with animation
        setTimeout(() => modal.classList.add('active'), 10);

        // Close modal
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    displayImages(response) {
        const images = response.data || [];
        if (images.length === 0) {
            throw new Error('未返回图片数据');
        }

        // Clear gallery
        this.gallery.innerHTML = '';

        images.forEach((imageData, index) => {
            const imageCard = this.createImageCard(imageData, index);
            this.gallery.appendChild(imageCard);
        });
    }

    createImageCard(imageData, index) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const imgSrc = imageData.url || `data:image/png;base64,${imageData.b64_json}`;
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `生成的图片 ${index + 1}`;
        img.loading = 'lazy';

        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';

        const actions = document.createElement('div');
        actions.className = 'image-actions';

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'action-btn';
        downloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7,10 12,15 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        downloadBtn.title = '下载图片';
        downloadBtn.addEventListener('click', () => this.downloadImage(imageData, index));

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4A2 2 0 0 1 2 13V4A2 2 0 0 1 4 2H13A2 2 0 0 1 15 4V5" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        copyBtn.title = '复制图片';
        copyBtn.addEventListener('click', () => this.copyImage(imageData));

        actions.appendChild(downloadBtn);
        actions.appendChild(copyBtn);
        overlay.appendChild(actions);

        card.appendChild(img);
        card.appendChild(overlay);

        return card;
    }

    async getImageBlob(imageData) {
        if (imageData.url) {
            const response = await fetch(imageData.url);
            if (!response.ok) throw new Error('图片获取失败');
            return response.blob();
        }

        if (imageData.b64_json) {
            const response = await fetch(`data:image/png;base64,${imageData.b64_json}`);
            return response.blob();
        }

        throw new Error('缺少图片数据');
    }

    async downloadImage(imageData, index) {
        try {
            const blob = await this.getImageBlob(imageData);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `gpt-image-${Date.now()}-${index + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            this.showError('下载图片失败');
        }
    }

    async copyImage(imageData) {
        try {
            const blob = await this.getImageBlob(imageData);
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            this.showSuccess('图片已复制到剪贴板');
        } catch (error) {
            this.showError('复制图片失败');
        }
    }

    setLoading(loading) {
        this.isGenerating = loading;
        this.generateBtn.disabled = loading;

        if (loading) {
            this.btnText.style.display = 'none';
            this.btnLoading.style.display = 'flex';
        } else {
            this.btnText.style.display = 'block';
            this.btnLoading.style.display = 'none';
        }
    }

    showError(message) {
        this.clearMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.gallery.parentNode.insertBefore(errorDiv, this.gallery.nextSibling);
    }

    showSuccess(message) {
        this.clearMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        this.gallery.parentNode.insertBefore(successDiv, this.gallery.nextSibling);
    }

    clearMessages() {
        const messages = document.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => msg.remove());
    }
}

// Initialize the application
let generator;
document.addEventListener('DOMContentLoaded', () => {
    generator = new GPTImageGenerator();
});
