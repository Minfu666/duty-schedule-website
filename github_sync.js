// GitHub同步功能
class GitHubSync {
    constructor() {
        // 注意：生产环境中应该使用更安全的方式存储token
        this.repo = 'Minfu666/duty-schedule-website'; // 需要替换为你的仓库信息
        this.filePath = 'data/schedule.json';
        this.branch = 'main';
        this.apiBaseUrl = 'https://api.github.com';
        this.token = this.getToken();
    }

    // 设置GitHub Token（需要用户提供）
    setToken(token) {
        this.token = token;
        localStorage.setItem('github_tokenJ', token);
    }

    // 获取存储的Token
    getToken() {
        return localStorage.getItem('github_tokenJ') || '';
    }

    // 保存数据到GitHub
    async saveToGitHub(data, commitMessage = '更新值班安排数据') {
        if (!this.token) {
            throw new Error('请先设置GitHub Token');
        }

        try {
            // 1. 获取当前文件信息
            const getFileResponse = await fetch(
                `${this.apiBaseUrl}/repos/${this.repo}/contents/${this.filePath}?ref=${this.branch}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!getFileResponse.ok) {
                throw new Error(`获取文件信息失败: ${getFileResponse.status}`);
            }

            const fileData = await getFileResponse.json();

            // 2. 准备更新内容
            const content = JSON.stringify(data, null, 2);
            const contentBase64 = btoa(unescape(encodeURIComponent(content)));

            // 3. 创建或更新文件
            const updateResponse = await fetch(
                `${this.apiBaseUrl}/repos/${this.repo}/contents/${this.filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: commitMessage,
                        content: contentBase64,
                        sha: fileData.sha,
                        branch: this.branch
                    })
                }
            );

            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(`更新文件失败: ${errorData.message}`);
            }

            return await updateResponse.json();
        } catch (error) {
            console.error('GitHub同步失败:', error);
            throw error;
        }
    }

    // 从GitHub获取数据
    async loadFromGitHub() {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/repos/${this.repo}/contents/${this.filePath}?ref=${this.branch}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`获取数据失败: ${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content);
            return JSON.parse(content);
        } catch (error) {
            console.error('从GitHub加载数据失败:', error);
            throw error;
        }
    }

    // 测试连接
    async testConnection() {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/user`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`连接测试失败: ${response.status}`);
            }

            const userData = await response.json();
            return {
                success: true,
                username: userData.login,
                repo: this.repo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出到全局作用域
window.GitHubSync = GitHubSync;