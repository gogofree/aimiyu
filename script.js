// 全局常量定义
const RESULTS_PER_DISPLAY = 9; // 每次搜索显示的结果数量

class RiddleDataManager {
    constructor() {
        this.cache = {};
        this.allRiddles = [];
        this.allRiddlesLoaded = false;
        this.allPagesLoaded = false;
        this.loadedPages = new Set();
        this.currentPage = 0;
        this.riddles = []; // 当前已加载的所有谜语数据
        this.itemsPerPage = 50; // 每页加载的项目数
        this.totalPages = 3; // 分片文件总数
    }
    
    // 内部fetch方法 - 支持分片文件
    async _fetchAllRiddles() {
        try {
            // 使用相对路径，确保在所有页面都能正确加载
            const response = await fetch('data/all_riddles.json');
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            // 尝试使用备用路径
            const response = await fetch('./data/all_riddles.json');
            if (!response.ok) {
                throw new Error(`备用路径加载也失败! 状态: ${response.status}`);
            }
            return await response.json();
        }
    }
    
    // 获取指定页码的分片数据
    async _fetchPageData(pageNum) {
        try {
            // 尝试加载分片文件
            const response = await fetch(`data/all_riddles_page_${pageNum}.json`);
            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            // 尝试备用路径
            try {
                const response = await fetch(`./data/all_riddles_page_${pageNum}.json`);
                if (!response.ok) {
                    return null;
                }
                return await response.json();
            } catch (fallbackError) {
                return null;
            }
        }
    }
    
    // 获取缓存数据
    async getDataFor(category = null) {
        const allData = await this.loadAllRiddles();
        
        if (!category) {
            return allData;
        }
        
        // 返回特定分类的数据
        return allData.filter(riddle => riddle && riddle.category === category);
    }
    
    // 清除缓存（用于内存管理）
    clearCache() {
        this.cache = {};
        this.allRiddles = [];
        this.riddles = [];
        this.allRiddlesLoaded = false;
        this.allPagesLoaded = false;
        this.loadedPages.clear();
        this.currentPage = 0;
    }
    
    // 加载下一页数据 - 分片加载功能
    async loadNextPage() {
        const pageNum = this.currentPage + 1;
        
        // 如果已经加载完所有数据或正在加载中，则不再加载
        if (this.allPagesLoaded || pageNum > this.totalPages) {
            return { data: [], hasMore: false };
        }
        
        try {
            // 直接加载分片文件
            const pageData = await this._fetchPageData(pageNum);
            
            if (!pageData || !Array.isArray(pageData) || pageData.length === 0) {
                console.log(`第${pageNum}页没有数据或加载失败`);
                // 如果分片文件加载失败，尝试使用完整文件（备用方案）
                if (!this.allRiddlesLoaded) {
                    console.log('尝试使用完整数据文件作为备用');
                    const allData = await this._fetchAllRiddles();
                    let processedData = [];
                    if (Array.isArray(allData)) {
                        processedData = allData;
                    } else if (allData && typeof allData === 'object') {
                        // 处理可能的嵌套结构
                        if (allData.riddles && Array.isArray(allData.riddles)) {
                            processedData = allData.riddles;
                        } else if (allData.data && Array.isArray(allData.data)) {
                            processedData = allData.data;
                        } else if (allData.items && Array.isArray(allData.items)) {
                            processedData = allData.items;
                        } else {
                            processedData = Object.values(allData).filter(item => item && typeof item === 'object');
                        }
                    }
                    this.allRiddles = processedData;
                    this.riddles = processedData;
                    this.allRiddlesLoaded = true;
                    
                    // 计算当前页的数据（基于完整数据的分页）
                    const startIndex = this.currentPage * this.itemsPerPage;
                    const endIndex = startIndex + this.itemsPerPage;
                    const slicedData = this.riddles.slice(startIndex, endIndex);
                    
                    this.currentPage++;
                    const hasMore = endIndex < this.riddles.length;
                    if (!hasMore) {
                        this.allPagesLoaded = true;
                    }
                    
                    return { data: slicedData, hasMore };
                }
                return { data: [], hasMore: false };
            }
            
            // 合并新数据到已加载的数据中
            this.riddles = [...this.riddles, ...pageData];
            this.loadedPages.add(pageNum);
            this.currentPage = pageNum;
            
            // 检查是否还有更多数据
            const hasMore = pageNum < this.totalPages;
            if (!hasMore) {
                this.allPagesLoaded = true;
            }
            
            return { data: pageData, hasMore };
        } catch (error) {
            return { data: [], hasMore: false };
        }
    }
    
    // 检查是否还有更多数据
    hasMoreData() {
        return !this.allPagesLoaded;
    }
    
    // 加载所有谜语数据
    async loadAllRiddles() {
        // 如果已经加载过，直接返回缓存的数据
        if (this.allRiddlesLoaded && this.allRiddles.length > 0) {
            return this.allRiddles;
        }
        
        try {
            // 尝试加载完整数据文件
            const data = await this._fetchAllRiddles();
            let processedData = [];
            
            // 处理数据格式
            if (Array.isArray(data)) {
                processedData = data;
            } else if (data && typeof data === 'object') {
                // 处理可能的嵌套结构
                if (data.riddles && Array.isArray(data.riddles)) {
                    processedData = data.riddles;
                } else if (data.data && Array.isArray(data.data)) {
                    processedData = data.data;
                } else if (data.items && Array.isArray(data.items)) {
                    processedData = data.items;
                } else {
                    // 尝试提取对象中的数组值
                    const values = Object.values(data);
                    for (const value of values) {
                        if (Array.isArray(value)) {
                            processedData = [...processedData, ...value];
                        }
                    }
                }
            }
            
            // 验证并过滤数据
            processedData = processedData.filter(riddle => {
                return riddle && typeof riddle === 'object' &&
                       typeof riddle.question === 'string' && riddle.question.trim() !== '' &&
                       typeof riddle.answer === 'string' && riddle.answer.trim() !== '';
            });
            
            // 更新缓存
            this.allRiddles = processedData;
            this.riddles = processedData;
            this.allRiddlesLoaded = true;
            
            return processedData;
        } catch (error) {
            // 如果加载失败，尝试通过分片加载获取数据
            try {
                this.clearCache(); // 清除可能损坏的缓存
                
                let allData = [];
                while (this.hasMoreData() && allData.length < 500) { // 设置上限避免无限循环
                    const result = await this.loadNextPage();
                    allData = [...allData, ...result.data];
                    if (!result.hasMore) break;
                }
                
                return allData;
            } catch (fallbackError) {
                return [];
            }
        }
    }
}

// 创建全局数据管理器实例
const riddleDataManager = new RiddleDataManager();

// 全局变量
let allRiddles = []; // 保持向后兼容

// 分页相关常量
const ITEMS_PER_PAGE = 1000; // 每页的谜语数量
const CATEGORY_TOTAL_PAGES = {}; // 存储每个分类的总页数
const CATEGORY_CURRENT_PAGE = {}; // 存储每个分类的当前页码
const CATEGORY_LOADING = {}; // 标记每个分类是否正在加载
const CATEGORY_LOADED_PAGES = {}; // 记录每个分类已加载的页面

// 获取所有分类
const allCategories = ["动物", "物品", "字谜", "植物", "自然", "脑筋急转弯", "食物", "建筑", "电器", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪", "春", "夏", "秋", "冬", "山"];

// 分页相关常量
const TOTAL_PAGES = 1; // 总页数，根据实际数据量调整

// 初始化分类页面计数
allCategories.forEach(category => {
    CATEGORY_CURRENT_PAGE[category] = 0;
    CATEGORY_LOADING[category] = false;
    CATEGORY_LOADED_PAGES[category] = new Set();
    CATEGORY_TOTAL_PAGES[category] = 2; // 每个分类模拟2000条数据，每页1000条，共2页
});



// 按分类和页码加载数据 - 优化版，支持分片加载、关键词搜索和热度排序
async function loadCategoryPage(category, page) {
    const cacheKey = `${category}_page_${page}`;
    
    // 确保全局变量已初始化
    window.riddlesCache = window.riddlesCache || {};
    window.CATEGORY_LOADING = window.CATEGORY_LOADING || {};
    window.CATEGORY_LOADED_PAGES = window.CATEGORY_LOADED_PAGES || {};
    window.allRiddles = window.allRiddles || [];
    
    const riddlesCache = window.riddlesCache;
    const CATEGORY_LOADING = window.CATEGORY_LOADING;
    const CATEGORY_LOADED_PAGES = window.CATEGORY_LOADED_PAGES;
    const allRiddles = window.allRiddles;
    
    // 检查缓存
    if (riddlesCache[cacheKey]) {
        return riddlesCache[cacheKey];
    }
    
    // 确保分类状态对象已初始化
    if (CATEGORY_LOADING[category] === undefined) {
        CATEGORY_LOADING[category] = false;
    }
    
    if (CATEGORY_LOADING[category]) {
        // 等待正在进行的加载完成
        let waitCount = 0;
        while (CATEGORY_LOADING[category] && waitCount < 50) { // 防止无限循环
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        console.log(`等待完成，返回缓存数据: ${cacheKey}`);
        return riddlesCache[cacheKey] || [];
    }
    
    try {
        CATEGORY_LOADING[category] = true;
        
        // 使用数据管理器加载数据，支持分片加载
        let allData;
        try {
            // 使用数据管理器加载当前页面的数据
            const loadResult = await riddleDataManager.loadNextPage();
            // 使用数据管理器中的已加载数据
            allData = riddleDataManager.riddles;
        } catch (loadError) {
            // 尝试直接使用全局allRiddles变量作为备用
            if (Array.isArray(allRiddles) && allRiddles.length > 0) {
                allData = allRiddles;
            } else {
                // 尝试备用加载方式
                try {
                    allData = await loadAllRiddles();
                } catch (backupError) {
                    throw new Error('无法加载谜语数据，请刷新页面重试');
                }
            }
        }
        
        // 从数据管理器获取当前加载的所有数据
        const riddlesArray = riddleDataManager.riddles || [];
        
        // 强制使用搜索模式以确保更好的兼容性
        const isUrlCategorySearch = true;
        let data;
        
        if (isUrlCategorySearch) {
            // URL参数搜索：宽松匹配 - 搜索问题、答案或分类中包含关键词的谜语
            const keyword = category.toLowerCase();
            
            data = riddlesArray.filter(riddle => {
                // 添加更严格的验证，确保对象有效且包含必要字段
                if (!riddle || typeof riddle !== 'object') {
                    return false;
                }
                
                // 确保问题和答案字段存在且为字符串
                const question = (riddle.question || '').toLowerCase();
                const answer = (riddle.answer || '').toLowerCase();
                const riddleCategory = (riddle.category || '').toLowerCase();
                
                // 添加额外的有效性检查
                if (question.trim() === '' || answer.trim() === '') {
                    return false;
                }
                
                const matches = question.includes(keyword) || 
                              answer.includes(keyword) || 
                              riddleCategory.includes(keyword);
                
                return matches;
            });
            
            // 按热度排序（降序），添加安全检查
            try {
                data.sort((a, b) => {
                    const popularityA = typeof a.popularity === 'number' ? a.popularity : 0;
                    const popularityB = typeof b.popularity === 'number' ? b.popularity : 0;
                    return popularityB - popularityA;
                });
            } catch (sortError) {
                // 排序错误不影响主流程，静默处理
            }
        } else {
            // 分类按钮点击：严格匹配
            data = riddlesArray.filter(riddle => {
                return riddle && typeof riddle === 'object' && 
                       riddle.category === category && 
                       typeof riddle.question === 'string' && riddle.question.trim() !== '' &&
                       typeof riddle.answer === 'string' && riddle.answer.trim() !== '';
            });
        }
        
        // 缓存数据
        riddlesCache[cacheKey] = data;
        window.riddlesCache = riddlesCache;
        
        // 确保CATEGORY_LOADED_PAGES已初始化
        if (!CATEGORY_LOADED_PAGES[category]) {
            CATEGORY_LOADED_PAGES[category] = new Set();
        }
        CATEGORY_LOADED_PAGES[category].add(page);
        window.CATEGORY_LOADED_PAGES = CATEGORY_LOADED_PAGES;
        
        // 添加到所有谜语中（避免重复，增强安全检查）
        data.forEach(riddle => {
            if (riddle && typeof riddle === 'object' && 
                typeof riddle.id !== 'undefined' && 
                !allRiddles.some(r => r && r.id === riddle.id)) {
                allRiddles.push(riddle);
                console.log(`添加新谜语到全局数组: ID=${riddle.id}`);
            }
        });
        window.allRiddles = allRiddles;
        
        return data;
    } catch (error) {
        // 记录错误但仍返回模拟数据，确保页面不会空白
        const mockData = [
            { id: Math.random(), question: '系统暂时无法加载数据', answer: '请刷新页面重试', category: category, popularity: 1 }
        ];
        return mockData;
    } finally {
        CATEGORY_LOADING[category] = false;
        window.CATEGORY_LOADING = CATEGORY_LOADING;
    }
}

// 加载指定分类的下一页数据
async function loadNextCategoryPage(category) {
    // 确保分类状态已初始化
    if (!CATEGORY_CURRENT_PAGE[category]) {
        CATEGORY_CURRENT_PAGE[category] = 0;
    }
    
    if (!CATEGORY_TOTAL_PAGES[category]) {
        CATEGORY_TOTAL_PAGES[category] = 2; // 默认2页
    }
    
    const currentPage = CATEGORY_CURRENT_PAGE[category];
    const totalPages = CATEGORY_TOTAL_PAGES[category];
    
    if (currentPage >= totalPages) {
        return { data: [], hasMore: false };
    }
    
    const nextPage = currentPage + 1;
    
    // 修复：确保loadCategoryPage返回有效的数据
    let data = [];
    try {
        data = await loadCategoryPage(category, nextPage) || [];
    } catch (error) {
        data = [];
    }
    
    // 更新当前页码
    if (data.length > 0) {
        CATEGORY_CURRENT_PAGE[category] = nextPage;
    }
    
    const hasMore = nextPage < totalPages;
    
    return {
        data,
        hasMore
    };
}

// 加载指定分类的所有页面数据 - 优化版
async function loadCategory(category) {
    try {
        // 使用统一的数据管理器，避免重复加载
        const allData = await riddleDataManager.loadAllRiddles();
        
        // 筛选特定分类的数据
        const categoryData = allData.filter(riddle => riddle && riddle.category === category);
        
        return categoryData;
    } catch (error) {
        return [];
    }
}

// 加载所有谜语 - 优化版
async function loadAllRiddles() {
    try {
        // 尝试多种加载方式，确保数据可靠性
        let data;
        
        try {
            // 主要加载方式：使用统一的数据管理器
            data = await riddleDataManager.loadAllRiddles();
        } catch (primaryError) {
            
            // 尝试直接调用_fetchAllRiddles作为备用
            try {
                console.log('尝试备用加载方式...');
                data = await riddleDataManager._fetchAllRiddles();
                console.log('备用加载成功');
            } catch (backupError) {
                console.error('备用加载也失败:', backupError);
                
                // 最后检查全局变量中是否有数据
                if (Array.isArray(allRiddles) && allRiddles.length > 0) {
                    console.log('使用已有的全局谜语数据');
                    data = allRiddles;
                } else {
                    throw new Error('无法通过任何方式加载谜语数据');
                }
            }
        }
        
        // 增强数据格式验证和清理
        let validData = [];
        if (Array.isArray(data)) {
            // 过滤出有效的谜语对象
            validData = data.filter(item => {
                return item && typeof item === 'object' &&
                       typeof item.question === 'string' && item.question.trim() !== '' &&
                       typeof item.answer === 'string' && item.answer.trim() !== '';
            });
        } else if (typeof data === 'object' && data !== null) {
            // 尝试从常见的嵌套结构中提取数据
            const possibleArrays = [data.riddles, data.data, data.items];
            for (const arr of possibleArrays) {
                if (Array.isArray(arr)) {
                    validData = arr.filter(item => {
                        return item && typeof item === 'object' &&
                               typeof item.question === 'string' && item.question.trim() !== '' &&
                               typeof item.answer === 'string' && item.answer.trim() !== '';
                    });
                    break;
                }
            }
        } else {
            validData = [];
        }
        
        // 更新全局变量保持向后兼容
        allRiddles = validData;
        window.allRiddles = validData; // 确保全局窗口对象也更新
        
        return validData;
    } catch (error) {
        // 返回一个包含错误提示的最小数据集，避免页面完全空白
        const fallbackData = [
            { id: 'error-placeholder', question: '无法加载谜语数据', answer: '请刷新页面重试或稍后再来', category: '系统', popularity: 0 }
        ];
        allRiddles = fallbackData;
        window.allRiddles = fallbackData;
        return fallbackData;
    }
}

// 按需加载部分谜语用于随机和热门展示 - 优化版
async function loadEssentialRiddles() {
    try {
        // 使用统一的数据管理器一次性加载
        const data = await riddleDataManager.loadAllRiddles();
        
        // 更新全局变量
        allRiddles = data;
        
        return data;
    } catch (error) {
        return [];
    }
}

// 将DOM元素获取移到DOMContentLoaded事件中，确保元素已加载
let randomRiddleEl, randomAnswerEl, showAnswerBtn, refreshRiddleBtn, 
    popularRiddlesEl, searchInput, searchBtn, singleColumnBtn, gridViewBtn;

// 当前随机谜语
let currentRandomRiddle = null;

// 分页相关变量
const RIDDLES_PER_PAGE = 9; // 每页显示的谜语数量
let currentPage = 0; // 当前页码
let hasMoreRiddles = true; // 是否还有更多谜语

// 设置布局切换功能
function setupLayoutToggle() {
    // 同时尝试两种方式获取布局控制按钮
    // 方式1：按ID获取
    const singleColumnBtn = document.getElementById('single-column-btn');
    const gridViewBtn = document.getElementById('grid-view-btn');
    
    // 方式2：按类名获取
    const listBtn = document.querySelector('.layout-btn.list');
    const gridBtn = document.querySelector('.layout-btn.grid');
    
    // 确定最终使用的按钮
    const finalSingleColumnBtn = singleColumnBtn || listBtn;
    const finalGridViewBtn = gridViewBtn || gridBtn;
    
    if (!finalSingleColumnBtn || !finalGridViewBtn) {
        console.log('未找到布局控制按钮，跳过布局设置');
        return;
    }
    
    console.log('找到布局控制按钮');
    
    // 获取谜语容器
    const popularRiddlesEl = document.getElementById('popular-riddles');
    const categoryRiddlesEl = document.getElementById('category-riddles-container');
    
    // 如果都没有找到，跳过
    if (!popularRiddlesEl && !categoryRiddlesEl) {
        return;
    }
    
    // 处理布局切换的通用函数
    const applyLayout = (isGrid) => {
        // 应用到热门谜语区域
        if (popularRiddlesEl) {
            if (isGrid) {
                popularRiddlesEl.classList.add('grid-view');
            } else {
                popularRiddlesEl.classList.remove('grid-view');
            }
        }
        
        // 应用到分类谜语区域
        if (categoryRiddlesEl) {
            if (isGrid) {
                categoryRiddlesEl.classList.add('grid-view');
            } else {
                categoryRiddlesEl.classList.remove('grid-view');
            }
        }
        
        // 更新按钮状态
        if (isGrid) {
            finalGridViewBtn.classList.add('active');
            finalSingleColumnBtn.classList.remove('active');
        } else {
            finalSingleColumnBtn.classList.add('active');
            finalGridViewBtn.classList.remove('active');
        }
        
        // 保存用户偏好（同时更新两种存储键名以保持兼容性）
        localStorage.setItem('layoutPreference', isGrid ? 'grid' : 'single');
        localStorage.setItem('riddleLayout', isGrid ? 'grid' : 'list');
    };
    
    // 定义命名事件处理函数
    function handleSingleColumnLayout() {
        applyLayout(false);
    }
    
    function handleGridLayout() {
        applyLayout(true);
    }
    
    // 移除可能存在的旧事件监听器，防止重复绑定
    finalSingleColumnBtn.removeEventListener('click', handleSingleColumnLayout);
    finalGridViewBtn.removeEventListener('click', handleGridLayout);
    
    // 绑定新的事件监听器
    finalSingleColumnBtn.addEventListener('click', handleSingleColumnLayout);
    finalGridViewBtn.addEventListener('click', handleGridLayout);
    
    // 从localStorage恢复布局偏好（检查两种存储键名）
    const savedLayout1 = localStorage.getItem('layoutPreference');
    const savedLayout2 = localStorage.getItem('riddleLayout');
    
    // 优先使用第一种，如果没有则使用第二种，默认使用网格布局
    let shouldUseGrid = true; // 默认网格
    
    if (savedLayout1 === 'grid' || savedLayout2 === 'grid') {
        shouldUseGrid = true;
    } else if (savedLayout1 === 'single' || savedLayout2 === 'list') {
        shouldUseGrid = false;
    }
    
    applyLayout(shouldUseGrid);
}

// 初始化页面
async function initPage() {
    showLoadingState();
    
    // 使用单独的错误处理，确保一个组件失败不会影响其他组件加载
    try {
        // 设置布局切换功能 - 这是UI基础，应该首先执行
        try {
            console.log('设置布局切换功能...');
            setupLayoutToggle();
            console.log('布局切换功能设置完成');
        } catch (layoutError) {
            console.error('设置布局切换失败:', layoutError);
            // 继续执行，不中断其他初始化
        }
        
        // 加载必要的谜语数据 - 核心功能，尝试多重加载
        try {
            console.log('加载必要的谜语数据...');
            await loadEssentialRiddles();
            console.log('必要数据加载完成');
        } catch (dataError) {
            console.error('加载数据失败:', dataError);
            // 尝试使用备用加载方法
            try {
                await loadAllRiddles();
            } catch (backupError) {
                // 继续执行，让其他组件尝试使用可能已有的数据
            }
        }
        
        // 获取DOM元素
        randomRiddleEl = document.getElementById('random-riddle');
        randomAnswerEl = document.getElementById('random-answer');
        showAnswerBtn = document.getElementById('show-answer-btn');
        refreshRiddleBtn = document.getElementById('refresh-riddle-btn');
        popularRiddlesEl = document.getElementById('popular-riddles');
        
        // 特别关注搜索相关元素
        searchInput = document.getElementById('search-input');
        searchBtn = document.getElementById('search-btn');
        
        singleColumnBtn = document.getElementById('single-column-btn');
        gridViewBtn = document.getElementById('grid-view-btn');
        
        // 生成随机谜语 - 即使数据加载部分失败也尝试生成
        try {
            await generateRandomRiddle();
        } catch (randomError) {
            // 显示错误信息但继续
            if (randomRiddleEl) {
                randomRiddleEl.textContent = '无法加载随机谜语，请稍后重试';
            }
        }
        
        // 生成热门谜语 - 同上
        try {
            await generatePopularRiddles();
        } catch (popularError) {
            // 显示错误信息但继续
            if (popularRiddlesEl) {
                popularRiddlesEl.innerHTML = '<div class="error-message">无法加载热门谜语，请稍后重试</div>';
            }
        }
        
        // 绑定事件 - 确保用户交互可用
        try {
            bindEvents();
        } catch (eventError) {
            // 继续执行
        }
        
        // 检查URL参数 - 处理可能的页面跳转或特殊请求
        try {
            checkUrlParams();
        } catch (urlError) {
            // 继续执行，不中断正常页面
        }
        
    } catch (fatalError) {
        showErrorState("页面加载过程中发生严重错误，请刷新页面重试");
    } finally {
        // 确保总是隐藏加载状态
        try {
            hideLoadingState();
        } catch (loadingError) {
            // 确保即使隐藏加载状态失败也不崩溃
            const loadingElements = document.querySelectorAll('.loading-overlay, .loading-spinner');
            loadingElements.forEach(el => {
                try {
                    el.style.display = 'none';
                } catch (e) {}
            });
        }
    }
}

// 显示加载状态
function showLoadingState() {
    const randomSection = document.querySelector('.random-section');
    const popularSection = document.querySelector('.popular-section');
    
    if (randomSection) {
        randomSection.style.opacity = '0.6';
    }
    
    if (popularSection) {
        popularSection.style.opacity = '0.6';
    }
}

// 隐藏加载状态
function hideLoadingState() {
    const randomSection = document.querySelector('.random-section');
    const popularSection = document.querySelector('.popular-section');
    
    if (randomSection) {
        randomSection.style.opacity = '1';
    }
    
    if (popularSection) {
        popularSection.style.opacity = '1';
    }
}

// 显示错误状态
function showErrorState(message) {
    const mainEl = document.querySelector('main');
    if (mainEl) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        mainEl.prepend(errorEl);
    }
}

// 生成随机谜语 - 优化版
async function generateRandomRiddle() {
    try {
        // 显示加载状态
        randomRiddleEl.textContent = '加载中...';
        
        // 确保必要的DOM元素存在
        if (!randomRiddleEl || !randomAnswerEl || !showAnswerBtn) {
            throw new Error('页面元素不完整，无法显示随机谜语');
        }
        
        // 使用数据管理器获取所有谜语，添加更强的数据验证
        let allData;
        try {
            allData = await riddleDataManager.loadAllRiddles();
        } catch (loadError) {
            // 尝试直接使用全局allRiddles变量作为备用
            if (Array.isArray(allRiddles) && allRiddles.length > 0) {
                allData = allRiddles;
            } else {
                // 尝试备用加载方式
                try {
                    allData = await loadAllRiddles();
                } catch (backupError) {
                    throw new Error('无法加载谜语数据，请刷新页面重试');
                }
            }
        }
        
        // 增强数据格式验证和嵌套结构提取
        let riddlesArray;
        if (Array.isArray(allData)) {
            riddlesArray = allData;
        } else if (typeof allData === 'object' && allData !== null) {
            // 尝试从常见的嵌套结构中提取数据
            if (Array.isArray(allData.riddles)) {
                riddlesArray = allData.riddles;
            } else if (Array.isArray(allData.data)) {
                riddlesArray = allData.data;
            } else if (Array.isArray(allData.items)) {
                riddlesArray = allData.items;
            } else {
                // 作为最后手段，尝试将对象值转换为数组
                const objectValues = Object.values(allData);
                riddlesArray = Array.isArray(objectValues[0]) ? objectValues[0] : [];
            }
        } else {
            riddlesArray = [];
        }
        
        // 过滤出有效的谜语，添加更严格的验证
        const validRiddles = riddlesArray.filter(riddle => {
            return riddle && typeof riddle === 'object' && 
                  typeof riddle.question === 'string' && riddle.question.trim() !== '' &&
                  typeof riddle.answer === 'string' && riddle.answer.trim() !== '';
        });
        
        // 检查是否有有效的谜语可用
        if (validRiddles.length === 0) {
            throw new Error('没有找到有效的谜语数据');
        }
        
        // 随机选择一个谜语
        const randomIndex = Math.floor(Math.random() * validRiddles.length);
        currentRandomRiddle = validRiddles[randomIndex];
        
        // 显示谜语问题并添加绿色类别信息
        const question = currentRandomRiddle.question || '未知问题';
        const category = currentRandomRiddle.category || currentRandomRiddle.type || '';
        
        // 检查DOM元素是否存在
        if (randomRiddleEl) {
            if (category && typeof category === 'string' && category.trim() !== '') {
                randomRiddleEl.innerHTML = `${question} <span style="color: green;">(${category.trim()})</span>`;
            } else {
                randomRiddleEl.textContent = question;
            }
        }
        
        if (randomAnswerEl) {
            randomAnswerEl.innerHTML = '<span id="random-answer-content">答案: ' + (currentRandomRiddle.answer || '未知答案') + '</span>';
            
            // 统一使用hidden类来控制答案的显示/隐藏
            randomAnswerEl.classList.remove('show');
            randomAnswerEl.classList.add('hidden');
        }
        // 同时清除style.display，避免样式冲突
        if (randomAnswerEl) randomAnswerEl.style.display = '';
        
        if (showAnswerBtn) showAnswerBtn.textContent = '显示答案';
    } catch (error) {
        if (randomRiddleEl) randomRiddleEl.textContent = '加载失败，请重试';
        if (randomAnswerEl) randomAnswerEl.textContent = '';
        if (showAnswerBtn) showAnswerBtn.textContent = '显示答案';
    }
}

async function generatePopularRiddles(loadMore = false) {
    try {
        // 显示加载状态
        if (!loadMore) {
            showLoadingState();
        }

        // 确保popularRiddlesEl存在
        if (!popularRiddlesEl) {
            hideLoadingState();
            return;
        }

        // 直接使用riddleDataManager获取所有谜语数据，添加更强的数据验证
        let allData;
        try {
            allData = await riddleDataManager.loadAllRiddles();
        } catch (loadError) {
            // 尝试直接使用全局allRiddles变量作为备用
            if (Array.isArray(allRiddles) && allRiddles.length > 0) {
                allData = allRiddles;
            } else {
                // 尝试备用加载方式 - 使用loadAllRiddles函数
                try {
                    allData = await loadAllRiddles();
                } catch (backupError) {
                    throw new Error('无法加载谜语数据，请稍后重试');
                }
            }
        }

        // 增强数据格式验证和嵌套结构提取
        let riddlesArray;
        if (Array.isArray(allData)) {
            riddlesArray = allData;
        } else if (typeof allData === 'object' && allData !== null) {
            // 尝试从常见的嵌套结构中提取数据
            if (Array.isArray(allData.riddles)) {
                riddlesArray = allData.riddles;
            } else if (Array.isArray(allData.data)) {
                riddlesArray = allData.data;
            } else if (Array.isArray(allData.items)) {
                riddlesArray = allData.items;
            } else {
                // 作为最后手段，尝试将对象值转换为数组
                const objectValues = Object.values(allData);
                riddlesArray = Array.isArray(objectValues[0]) ? objectValues[0] : [];
            }
        } else {
            riddlesArray = [];
        }

        // 过滤出有效的谜语对象，添加更严格的验证
        const validRiddles = riddlesArray.filter(riddle => {
            return riddle && typeof riddle === 'object' && 
                  typeof riddle.question === 'string' && riddle.question.trim() !== '' &&
                  typeof riddle.answer === 'string' && riddle.answer.trim() !== '';
        });

        // 按热度排序并确保有popularity字段，添加安全检查
        const sortedRiddles = validRiddles.sort((a, b) => {
            const popularityA = typeof a.popularity === 'number' ? a.popularity : 0;
            const popularityB = typeof b.popularity === 'number' ? b.popularity : 0;
            return popularityB - popularityA;
        });
        
        // 计算当前页要显示的谜语
        const startIndex = loadMore ? currentPage * RIDDLES_PER_PAGE : 0;
        const endIndex = startIndex + RIDDLES_PER_PAGE;
        const pageRiddles = sortedRiddles.slice(startIndex, endIndex);
        
        // 更新页码
        if (loadMore) {
            currentPage++;
        } else {
            currentPage = 0;
        }
        
        // 检查是否还有更多谜语
        hasMoreRiddles = endIndex < sortedRiddles.length;
        
        // 渲染谜语 - 创建统一的渲染函数以避免重复代码
        const renderRiddleCard = (riddle, index) => {
            try {
                // 额外的安全检查
                if (!riddle || typeof riddle !== 'object') {
                    return;
                }
                
                const card = document.createElement('div');
                card.className = 'riddle-card fade-in';
                card.innerHTML = `
                    <h3>${riddle.question}</h3>
                    <p class="answer">
                        <span class="answer-content">答案：${riddle.answer}</span>
                    </p>
                    <button class="show-answer-btn">查看答案</button>
                    <div class="meta-info">
                        <span class="category-tag">${riddle.category}</span>
                        <span>热度: ${riddle.popularity}</span>
                    </div>
                `;
                
                popularRiddlesEl.appendChild(card);
                
                // 绑定查看答案事件，添加DOM元素存在检查
                const answerBtn = card.querySelector('.show-answer-btn');
                const answerEl = card.querySelector('.answer');
                
                if (answerBtn && answerEl) {
                    answerBtn.addEventListener('click', () => {
                        answerEl.classList.toggle('show');
                        answerBtn.textContent = answerEl.classList.contains('show') ? '隐藏答案' : '查看答案';
                    });
                }
            } catch (error) {
                // 静默处理渲染错误，避免影响整体功能
            }
        };

        // 根据模式渲染谜语
        if (loadMore) {
            // 追加模式
            pageRiddles.forEach((riddle, index) => renderRiddleCard(riddle, index));
        } else {
            // 清空并重新渲染
            popularRiddlesEl.innerHTML = '';
            pageRiddles.forEach((riddle, index) => renderRiddleCard(riddle, index));
        }
        
        // 更新加载更多按钮
        updateLoadMoreButton();
        
    } catch (error) {
        showErrorState("加载热门谜语失败，请稍后重试");
    } finally {
        // 隐藏加载状态
        if (!loadMore) {
            hideLoadingState();
        }
        popularRiddlesEl.classList.remove('loading');
    }
}

// 更新加载更多按钮
function updateLoadMoreButton() {
    // 检查是否已有加载更多按钮容器
    let loadMoreContainer = document.querySelector('.load-more-container');
    
    // 如果没有，创建一个
    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.className = 'load-more-container';
        popularRiddlesEl.parentNode.insertBefore(loadMoreContainer, popularRiddlesEl.nextSibling);
    }
    
    // 清空容器
    loadMoreContainer.innerHTML = '';
    
    // 如果还有更多谜语，添加加载更多按钮
    if (hasMoreRiddles) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.textContent = '加载更多';
        
        // 绑定点击事件
        loadMoreBtn.addEventListener('click', () => {
            // 显示加载状态
            loadMoreBtn.textContent = '加载中...';
            loadMoreBtn.disabled = true;
            
            // 模拟加载延迟，提升用户体验
            setTimeout(() => {
                currentPage++;
                generatePopularRiddles(true); // 加载更多
                
                // 恢复按钮状态
                loadMoreBtn.textContent = '加载更多';
                loadMoreBtn.disabled = false;
            }, 500);
        });
        
        loadMoreContainer.appendChild(loadMoreBtn);
    } else {
        // 如果没有更多谜语，显示提示信息
        const noMoreText = document.createElement('p');
        noMoreText.className = 'no-more-text';
        noMoreText.textContent = '没有更多谜语了';
        loadMoreContainer.appendChild(noMoreText);
    }
}

// 绑定事件
function bindEvents() {
    console.log('开始绑定事件，当前DOM元素状态:', {
        showAnswerBtn: !!showAnswerBtn,
        refreshRiddleBtn: !!refreshRiddleBtn,
        searchInput: !!searchInput,
        searchBtn: !!searchBtn
    });
    
    // 显示/隐藏答案按钮
    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
            if (randomAnswerEl) {
                randomAnswerEl.classList.toggle('hidden');
                showAnswerBtn.textContent = randomAnswerEl.classList.contains('hidden') ? '显示答案' : '隐藏答案';
            }
        });
        console.log('显示答案按钮事件绑定成功');
    }
    
    // 刷新谜语按钮
    if (refreshRiddleBtn) {
        refreshRiddleBtn.addEventListener('click', () => {
            generateRandomRiddle();
        });
        console.log('刷新谜语按钮事件绑定成功');
    }
    
    // 搜索功能
    if (searchBtn) {
        console.log('搜索按钮存在，绑定点击事件');
        searchBtn.addEventListener('click', performSearch);
        // 添加额外的调试输出
        searchBtn.addEventListener('click', () => {
            console.log('搜索按钮被点击！');
        });
    } else {
        console.error('搜索按钮未找到！');
    }
    
    if (searchInput) {
        console.log('搜索输入框存在，绑定键盘事件');
        searchInput.addEventListener('keyup', (e) => {
            console.log('键盘事件触发，键:', e.key);
            if (e.key === 'Enter') {
                console.log('回车键被按下，执行搜索');
                performSearch();
            }
        });
    } else {
        console.error('搜索输入框未找到！');
    }
}

// 全局常量已定义，这里不需要重复定义

// 执行搜索 - 支持分片加载的版本
async function performSearch() {
    // 再次检查searchInput是否存在
    if (!searchInput) {
        // 尝试重新获取元素
        const newSearchInput = document.getElementById('search-input');
        if (newSearchInput) {
            searchInput = newSearchInput;
        } else {
            return;
        }
    }
    
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        return;
    }
    
    // 显示加载状态
    const searchContainer = searchBtn.parentElement;
    const originalText = searchBtn.innerHTML;
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchBtn.disabled = true;
    
    // 重置数据管理器的分页状态
    riddleDataManager.currentPage = 0;
    riddleDataManager.loadedPages.clear();
    riddleDataManager.allPagesLoaded = false;
    
    // 跟踪搜索结果
    let totalResults = 0;
    let displayedResults = 0;
    // 全局常量已定义，这里不需要重复定义
    let hasMoreResults = true;
    let searchResultsSection = null;
    let resultsGrid = null;
    let loadMoreBtn = null;
    
    try {
        // 如果在首页，准备搜索结果区域
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            const mainEl = document.querySelector('main');
            const popularSection = document.querySelector('.popular-section');
            const categoriesSection = document.querySelector('.categories-section');
            const randomSection = document.querySelector('.random-section');
            
            // 隐藏其他板块
            if (popularSection) popularSection.style.display = 'none';
            if (categoriesSection) categoriesSection.style.display = 'none';
            if (randomSection) randomSection.style.display = 'none';
            
            // 检查是否已有搜索结果板块
            searchResultsSection = document.querySelector('.search-results');
            if (!searchResultsSection) {
                searchResultsSection = document.createElement('section');
                searchResultsSection.className = 'search-results';
                mainEl.appendChild(searchResultsSection);
            }
            
            // 填充搜索结果标题
            searchResultsSection.innerHTML = `
                <h2>🔍 搜索结果: "${searchTerm}" (0 条)</h2>
            `;
            
            // 创建结果网格
            resultsGrid = document.createElement('div');
            resultsGrid.className = 'riddles-grid';
            searchResultsSection.appendChild(resultsGrid);
            
            // 创建加载更多按钮容器
            let loadMoreContainer = document.createElement('div');
            loadMoreContainer.className = 'load-more-container';
            loadMoreContainer.style.display = 'none';
            searchResultsSection.appendChild(loadMoreContainer);
            
            // 创建加载更多按钮
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = '加载更多结果';
            loadMoreBtn.className = 'load-more-btn';
            loadMoreContainer.appendChild(loadMoreBtn);
        } else {
            // 非首页情况（如分类页面）也实现完整的加载更多功能
            
            const mainEl = document.querySelector('main');
            const categoryHeader = document.querySelector('.category-header');
            const riddlesContainer = document.querySelector('.riddles-container');
            
            // 隐藏分类头部和原有谜语容器
            if (categoryHeader) categoryHeader.style.display = 'none';
            if (riddlesContainer) riddlesContainer.style.display = 'none';
            
            // 检查是否已有搜索结果板块
            searchResultsSection = document.querySelector('.search-results');
            if (!searchResultsSection) {
                searchResultsSection = document.createElement('section');
                searchResultsSection.className = 'search-results';
                mainEl.appendChild(searchResultsSection);
            }
            
            // 填充搜索结果标题
            searchResultsSection.innerHTML = `
                <h2>🔍 搜索结果: "${searchTerm}" (0 条)</h2>
            `;
            
            // 创建结果网格
            resultsGrid = document.createElement('div');
            resultsGrid.className = 'riddles-grid';
            searchResultsSection.appendChild(resultsGrid);
            
            // 创建加载更多按钮容器
            let loadMoreContainer = document.createElement('div');
            loadMoreContainer.className = 'load-more-container';
            loadMoreContainer.style.display = 'none';
            searchResultsSection.appendChild(loadMoreContainer);
            
            // 创建加载更多按钮
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = '加载更多结果';
            loadMoreBtn.className = 'load-more-btn';
            loadMoreContainer.appendChild(loadMoreBtn);
        }
        
        // 累积所有搜索结果的数组
        let allSearchResults = [];
        
        // 重置数据管理器的分页状态
        riddleDataManager.currentPage = 0;
        riddleDataManager.loadedPages.clear();
        riddleDataManager.allPagesLoaded = false;
        
        // 绑定加载更多按钮事件
        loadMoreBtn.addEventListener('click', () => loadAndDisplayResults(true));
        
        // 加载和显示搜索结果的函数
        const loadAndDisplayResults = async (isLoadMore = false) => {
            try {
                if (isLoadMore) {
                    loadMoreBtn.disabled = true;
                    loadMoreBtn.textContent = '加载中...';
                }
                
                // 加载数据直到找到足够的结果或没有更多数据
                while (displayedResults < (isLoadMore ? displayedResults + RESULTS_PER_DISPLAY : RESULTS_PER_DISPLAY) && hasMoreResults) {
                    const { data: newRiddles, hasMore } = await riddleDataManager.loadNextPage();
                    hasMoreResults = hasMore;
                    
                    // 过滤当前页的数据
                    const pageResults = newRiddles.filter(riddle => 
                        riddle.question.includes(searchTerm) ||
                        riddle.answer.includes(searchTerm) ||
                        riddle.category.includes(searchTerm)
                    );
                    
                    // 添加到所有搜索结果
                    allSearchResults = [...allSearchResults, ...pageResults];
                    totalResults += pageResults.length;
                    
                    // 静默处理，不输出日志
                    
                    // 如果还有更多页面，继续加载以找到足够的匹配结果
                    if (!hasMoreResults) break;
                }
                
                // 确定需要显示的结果范围
                const startIndex = displayedResults;
                const endIndex = Math.min(displayedResults + RESULTS_PER_DISPLAY, allSearchResults.length);
                const resultsToDisplay = allSearchResults.slice(startIndex, endIndex);
                displayedResults = endIndex;
                
                // 静默处理，不输出日志
                
                // 显示结果
                resultsToDisplay.forEach(riddle => {
                    const card = document.createElement('div');
                    card.className = 'riddle-card fade-in';
                    card.innerHTML = `
                        <h3>${riddle.question}</h3>
                        <p class="answer">
                            <span class="answer-content">答案：${riddle.answer}</span>
                        </p>
                        <button class="show-answer-btn">查看答案</button>
                        <div class="meta-info">
                            <span class="category-tag">${riddle.category}</span>
                            <span>热度: ${riddle.popularity}</span>
                        </div>
                    `;
                    
                    resultsGrid.appendChild(card);
                    
                    // 绑定查看答案事件
                    const answerBtn = card.querySelector('.show-answer-btn');
                    const answerEl = card.querySelector('.answer');
                    
                    answerBtn.addEventListener('click', () => {
                        answerEl.classList.toggle('show');
                        answerBtn.textContent = answerEl.classList.contains('show') ? '隐藏答案' : '查看答案';
                    });
                });
                
                // 更新搜索标题显示结果数量
                searchResultsSection.querySelector('h2').textContent = 
                    `🔍 搜索结果: "${searchTerm}" (${totalResults} 条)`;
                
                // 更新加载更多按钮状态
                const loadMoreContainer = searchResultsSection.querySelector('.load-more-container');
                if (loadMoreContainer) {
                    if (displayedResults < totalResults) {
                        loadMoreBtn.textContent = '加载更多结果';
                        loadMoreBtn.disabled = false;
                        loadMoreContainer.style.display = 'block';
                    } else {
                        loadMoreContainer.style.display = 'none';
                    }
                    
                    // 如果没有找到任何结果
                    if (totalResults === 0) {
                        resultsGrid.innerHTML = `
                            <div class="no-results">
                                <i class="fas fa-search"></i>
                                <p>没有找到相关的谜语，请尝试其他关键词</p>
                            </div>
                        `;
                        loadMoreContainer.style.display = 'none';
                    }
                }
                
            } catch (error) {
                resultsGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>搜索过程中出现错误，请稍后重试</p>
                    </div>
                `;
                const loadMoreContainer = searchResultsSection.querySelector('.load-more-container');
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }
            }
        };
        
        // 绑定加载更多按钮事件
        loadMoreBtn.addEventListener('click', () => loadAndDisplayResults(true));
        
        // 开始加载第一页数据
        await loadAndDisplayResults();
        
    } catch (error) {
        if (resultsGrid) {
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>搜索过程中出现错误，请稍后重试</p>
                </div>
            `;
        }
    } finally {
        // 恢复按钮状态
        searchBtn.innerHTML = originalText;
        searchBtn.disabled = false;
    }
}

// 显示搜索结果
function displaySearchResults(results, searchTerm, isError = false) {
    const mainEl = document.querySelector('main');
    const popularSection = document.querySelector('.popular-section');
    const categoriesSection = document.querySelector('.categories-section');
    const randomSection = document.querySelector('.random-section');
    
    // 确保结果是数组
    if (!Array.isArray(results)) {
        results = [];
        isError = true;
    }
    
    // 隐藏其他板块
    if (popularSection) popularSection.style.display = 'none';
    if (categoriesSection) categoriesSection.style.display = 'none';
    if (randomSection) randomSection.style.display = 'none';
    
    // 检查是否已有搜索结果板块
    let searchResultsSection = document.querySelector('.search-results');
    if (!searchResultsSection) {
        searchResultsSection = document.createElement('section');
        searchResultsSection.className = 'search-results';
        mainEl.appendChild(searchResultsSection);
    }
    
    // 填充搜索结果标题，显示总匹配数量
    const totalMatches = results._totalResults || results.length;
    searchResultsSection.innerHTML = `
        <h2>🔍 搜索结果: "${searchTerm}" (${totalMatches} 条)</h2>
    `;
    
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'riddles-grid';
    searchResultsSection.appendChild(resultsGrid);
    
    if (isError) {
        resultsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <p>搜索过程中出现错误，请稍后重试</p>
            </div>
        `;
    } else if (results.length === 0) {
        resultsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>没有找到相关的谜语，请尝试其他关键词</p>
            </div>
        `;
    } else {
        // 只显示前9个结果
        const resultsToDisplay = results.slice(0, RESULTS_PER_DISPLAY);
        resultsToDisplay.forEach(riddle => {
            const card = document.createElement('div');
            card.className = 'riddle-card fade-in';
            card.innerHTML = `
                <h3>${riddle.question}</h3>
                <p class="answer">
                    <span class="answer-content">答案：${riddle.answer}</span>
                </p>
                <button class="show-answer-btn">查看答案</button>
                <div class="meta-info">
                    <span class="category-tag">${riddle.category}</span>
                    <span>热度: ${riddle.popularity}</span>
                </div>
            `;
            
            resultsGrid.appendChild(card);
            
            // 绑定查看答案事件
            const answerBtn = card.querySelector('.show-answer-btn');
            const answerEl = card.querySelector('.answer');
            
            answerBtn.addEventListener('click', () => {
                answerEl.classList.toggle('show');
                answerBtn.textContent = answerEl.classList.contains('show') ? '隐藏答案' : '查看答案';
            });
        });
    }
}

// 检查URL参数的函数在后面有异步版本，这里已移除重复定义

async function filterRiddlesByCategory(category) {
    console.log(`切换到分类: ${category}`);
    
    // 显示加载状态
    showLoadingState();
    
    try {
        // 重置该分类的页面计数和状态
        CATEGORY_CURRENT_PAGE[category] = 0;
        
        // 初始化分类特定的状态对象
        if (!window.categoryState) {
            window.categoryState = {};
        }
        window.categoryState[category] = {
            displayedIndex: 0,  // 当前已显示到的索引
            allSearchResults: [],  // 所有匹配的结果
            hasMoreResults: true  // 是否还有更多结果
        };
        
        // 初始化显示索引
        
        // 获取HTML中已有的容器，不要清空整个riddles-container
        const container = document.querySelector('.riddles-container');
        if (!container) {
            return;
        }
        
        // 只清空谜语容器的内容，保留其他元素
        const existingRiddlesContainer = document.getElementById('category-riddles-container');
        if (existingRiddlesContainer) {
            existingRiddlesContainer.innerHTML = '';
        }
        
        // 更新分类标题（如果存在）
        const existingTitle = container.querySelector('.category-title');
        if (existingTitle) {
            existingTitle.textContent = `${category}谜语`;
        } else {
            // 如果标题不存在则创建
            const categoryTitle = document.createElement('h2');
            categoryTitle.textContent = `${category}谜语`;
            categoryTitle.classList.add('category-title');
            container.insertBefore(categoryTitle, existingRiddlesContainer || null);
        }
        
        // 确保布局控制按钮存在
        let layoutControls = container.querySelector('.layout-controls');
        if (!layoutControls) {
            layoutControls = document.createElement('div');
            layoutControls.className = 'layout-controls';
            layoutControls.innerHTML = `
                <button id="single-column-btn" class="layout-btn">
                    <i class="fas fa-list"></i> 单列显示
                </button>
                <button id="grid-view-btn" class="layout-btn">
                    <i class="fas fa-th-large"></i> 网格显示
                </button>
            `;
            container.insertBefore(layoutControls, existingRiddlesContainer || null);
        }
        
        // 确保谜语容器存在
        let riddlesContainer = existingRiddlesContainer;
        if (!riddlesContainer) {
            riddlesContainer = document.createElement('div');
            riddlesContainer.className = 'riddles-grid';
            riddlesContainer.id = 'category-riddles-container';
            container.appendChild(riddlesContainer);
        }
        
        // 应用保存的布局偏好
        const savedLayout = localStorage.getItem('layoutPreference');
        const savedLayout2 = localStorage.getItem('riddleLayout');
        const shouldUseGrid = !(savedLayout === 'single' || savedLayout2 === 'list');
        
        if (shouldUseGrid) {
            riddlesContainer.classList.add('grid-view');
        }
        
        // 设置按钮激活状态
        const singleBtn = document.getElementById('single-column-btn');
        const gridBtn = document.getElementById('grid-view-btn');
        if (singleBtn && gridBtn) {
            singleBtn.classList.toggle('active', !shouldUseGrid);
            gridBtn.classList.toggle('active', shouldUseGrid);
        }
        
        // 立即设置布局切换，因为DOM已经准备好
        setupLayoutToggle();
        
        // 确保加载更多按钮存在
        let loadMoreBtn = container.querySelector('.load-more-btn');
        if (!loadMoreBtn) {
            // 创建加载更多按钮容器
            let loadMoreContainer = document.querySelector('.load-more-container');
            if (!loadMoreContainer) {
                loadMoreContainer = document.createElement('div');
                loadMoreContainer.className = 'load-more-container';
                container.appendChild(loadMoreContainer);
            }
            
            // 创建加载更多按钮
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = '加载更多';
            loadMoreBtn.classList.add('load-more-btn');
            loadMoreContainer.appendChild(loadMoreBtn);
        } else {
            // 重置按钮状态
            loadMoreBtn.textContent = '加载更多';
            loadMoreBtn.disabled = false;
        }
        
        // 清除之前的数据缓存
        riddleDataManager.clearCache();
        
        // 初始化已渲染谜语记录
        if (!window.renderedRiddles) {
            window.renderedRiddles = new Set();
        }
        window.renderedRiddles.clear();
        
        // 添加初始加载提示
        const loadingText = document.createElement('p');
        loadingText.textContent = `正在加载${category}分类的谜语...`;
        riddlesContainer.appendChild(loadingText);
        
        // 首次加载并显示最多9条结果
        await loadAndDisplayCategoryResults(category, riddlesContainer, loadMoreBtn, 9);
        
        // 移除初始加载提示
        if (loadingText.parentNode) {
            loadingText.parentNode.removeChild(loadingText);
        }
        
        // 绑定加载更多按钮事件
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            // 移除旧的加载更多按钮
            const oldBtn = loadMoreContainer.querySelector('.load-more-btn');
            if (oldBtn) {
                oldBtn.remove();
            }
            
            // 创建新的加载更多按钮
            const newLoadMoreBtn = document.createElement('button');
            newLoadMoreBtn.textContent = '加载更多';
            newLoadMoreBtn.classList.add('load-more-btn');
            loadMoreContainer.appendChild(newLoadMoreBtn);
            
            newLoadMoreBtn.addEventListener('click', async () => {
                await loadAndDisplayCategoryResults(category, riddlesContainer, newLoadMoreBtn, 9);
            });
        }
        
    } catch (error) {
        showErrorState(`加载${category}分类失败，请稍后重试`);
    } finally {
        hideLoadingState();
    }
}

// 更新分类页面的加载更多按钮
function updateCategoryLoadMoreButton(hasMore, button) {
    if (hasMore) {
        button.textContent = '加载更多';
        button.disabled = false;
    } else {
        button.textContent = '没有更多谜语了';
        button.disabled = true;
    }
}

// 加载并显示分类结果 - 实现按9条分页显示的功能
async function loadAndDisplayCategoryResults(category, riddlesContainer, loadMoreBtn, itemsToLoad = 9) {
    // 检查是否正在加载
    if (window.CATEGORY_LOADING && window.CATEGORY_LOADING[category]) {
        return;
    }
    
    // 获取分类状态
    const state = window.categoryState && window.categoryState[category];
    if (!state) {
        return;
    }
    
    try {
        // 设置加载状态
        if (!window.CATEGORY_LOADING) window.CATEGORY_LOADING = {};
        window.CATEGORY_LOADING[category] = true;
        
        // 显示加载中状态
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '加载中...';
        }
        
        // 检查是否需要加载更多数据
        let itemsLoaded = 0;
        const fragment = document.createDocumentFragment();
        
        // 初始化riddlesContainer的显示状态
        if (riddlesContainer.children.length === 0 || (riddlesContainer.children.length === 1 && riddlesContainer.children[0].tagName === 'P')) {
            riddlesContainer.innerHTML = ''; // 清空初始提示文本
        }
        
        // 循环直到找到足够的结果或没有更多数据
        while (itemsLoaded < itemsToLoad && state.hasMoreResults) {
            // 尝试从当前已加载的结果中获取下一批
            const remainingResults = state.allSearchResults.length - state.displayedIndex;
            
            if (remainingResults > 0) {
                // 从已加载的数据中取结果
                const endIndex = Math.min(state.displayedIndex + itemsToLoad, state.allSearchResults.length);
                const batchResults = state.allSearchResults.slice(state.displayedIndex, endIndex);
                
                // 从已加载数据中获取结果
                
                // 渲染这批结果
                const renderedCount = renderRiddleBatch(batchResults, fragment, window.renderedRiddles);
                itemsLoaded += renderedCount;
                state.displayedIndex = endIndex;
                
                // 如果已经获取了足够的结果，跳出循环
                if (itemsLoaded >= itemsToLoad) {
                    break;
                }
            }
            
            // 如果已加载数据不足，尝试加载下一页
            const loadResult = await riddleDataManager.loadNextPage();
            
            // 修正：loadNextPage返回的不是success字段，而是直接返回data和hasMore
            if (loadResult && loadResult.data && loadResult.data.length > 0) {
                // 加载数据成功
                
                // 直接使用loadResult.data作为当前页数据
                const riddlesArray = Array.isArray(loadResult.data) ? loadResult.data : [];
                
                // 筛选指定分类的谜语，并过滤有效数据
                const newFilteredData = riddlesArray.filter(riddle => {
                    // 安全检查
                    if (!riddle || typeof riddle !== 'object') return false;
                    
                    // 宽松匹配分类
                    const riddleCategory = String(riddle.category || '');
                    const targetCategory = String(category || '');
                    const question = String(riddle.question || '');
                    const answer = String(riddle.answer || '');
                    
                    return riddleCategory.includes(targetCategory) || 
                           question.includes(targetCategory) || 
                           answer.includes(targetCategory);
                });
                
                // 筛选完成
                
                // 按热度排序
                const newSortedData = newFilteredData.sort((a, b) => {
                    const popA = typeof a.popularity === 'number' ? a.popularity : 0;
                    const popB = typeof b.popularity === 'number' ? b.popularity : 0;
                    return popB - popA;
                });
                
                // 将新数据添加到全局结果数组
                state.allSearchResults = [...state.allSearchResults, ...newSortedData];
                
                // 计算还需要加载多少条数据
                const stillNeed = itemsToLoad - itemsLoaded;
                
                // 从新添加的数据中获取所需数量
                if (stillNeed > 0 && newSortedData.length > 0) {
                    // 计算可以从新数据中获取的数量
                    const takeFromNew = Math.min(stillNeed, newSortedData.length);
                    
                    // 从新数据中获取对应数量的谜语
                    const newBatchResults = state.allSearchResults.slice(state.displayedIndex, state.displayedIndex + takeFromNew);
                    
                    // 渲染这批结果
                    const renderedCount = renderRiddleBatch(newBatchResults, fragment, window.renderedRiddles);
                    itemsLoaded += renderedCount;
                    state.displayedIndex += takeFromNew;
                    
                    // 如果已经获取了足够的结果，跳出循环
                    if (itemsLoaded >= itemsToLoad) {
                        break;
                    }
                }
            } else {
                // 没有更多数据了
                state.hasMoreResults = false;
                break;
            }
        }
        
        // 检查是否已经加载了足够的谜语，如果超过itemsToLoad，只显示itemsToLoad条
        if (fragment.children.length > itemsToLoad) {
            // 只保留itemsToLoad个元素
            const excessElements = fragment.children.length - itemsToLoad;
            for (let i = 0; i < excessElements; i++) {
                fragment.removeChild(fragment.lastChild);
            }
        }
        
        // 一次性将所有新卡片添加到DOM中
        if (fragment.children.length > 0) {
            riddlesContainer.appendChild(fragment);
        } else {
            // 如果没有加载到任何数据且总结果为空，显示空状态
            if (state.allSearchResults.length === 0) {
                const emptyState = document.createElement('p');
                emptyState.textContent = `未找到"${category}"相关的谜语`;
                riddlesContainer.appendChild(emptyState);
            }
        }
        
        // 更新按钮状态
        const hasMore = state.hasMoreResults || state.displayedIndex < state.allSearchResults.length;
        updateCategoryLoadMoreButton(hasMore, loadMoreBtn);
        // 更新加载更多按钮状态
        
    } catch (error) {
        // 显示错误消息
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.textContent = '加载失败，请稍后重试';
        riddlesContainer.appendChild(errorContainer);
        
        // 恢复按钮状态
        if (loadMoreBtn) {
            loadMoreBtn.textContent = '加载更多';
            loadMoreBtn.disabled = false;
        }
    } finally {
        // 重置加载状态
        if (window.CATEGORY_LOADING) {
            window.CATEGORY_LOADING[category] = false;
        }
    }
}

// 渲染谜语批次的辅助函数
function renderRiddleBatch(riddles, fragment, renderedSet) {
    let renderedCount = 0;
    
    riddles.forEach((riddle, index) => {
        // 确保riddle是有效的对象
        if (!riddle || typeof riddle !== 'object') {
            return;
        }
        
        // 使用谜语ID或问题作为唯一标识
        const riddleId = riddle.id || riddle.question || '';
        
        // 检查是否已经渲染过
        if (renderedSet && renderedSet.has(riddleId)) {
            return;
        }
        
        try {
            const card = document.createElement('div');
            card.className = 'riddle-card fade-in';
            card.innerHTML = `
                <h3>${riddle.question || '未知问题'}</h3>
                <p class="answer">
                    <span class="answer-content">答案：${riddle.answer || '未知答案'}</span>
                </p>
                <button class="show-answer-btn">查看答案</button>
                <div class="meta-info">
                    <span class="category-tag">${riddle.category || '未分类'}</span>
                    <span>热度: ${riddle.popularity || 0}</span>
                </div>
            `;
            
            // 绑定查看答案事件
            const answerBtn = card.querySelector('.show-answer-btn');
            const answerEl = card.querySelector('.answer');
            
            if (answerBtn && answerEl) {
                answerBtn.addEventListener('click', () => {
                    answerEl.classList.toggle('show');
                    answerBtn.textContent = answerEl.classList.contains('show') ? '隐藏答案' : '查看答案';
                });
            }
            
            fragment.appendChild(card);
            if (renderedSet) {
                renderedSet.add(riddleId);
            }
            renderedCount++;
        } catch (err) {
            // 静默处理渲染错误
        }
    });
    
    return renderedCount;
}

// 分类页面初始化 - 优化版
async function initCategoryPage() {
    
    // 确保状态对象已初始化
    window.riddlesCache = window.riddlesCache || {};
    window.CATEGORY_LOADING = window.CATEGORY_LOADING || {};
    window.CATEGORY_CURRENT_PAGE = window.CATEGORY_CURRENT_PAGE || {};
    window.CATEGORY_TOTAL_PAGES = window.CATEGORY_TOTAL_PAGES || {};
    window.CATEGORY_LOADED_PAGES = window.CATEGORY_LOADED_PAGES || {};
    window.allRiddles = window.allRiddles || [];
    
    // 获取搜索相关DOM元素 - 分类页面也需要搜索功能
    searchInput = document.getElementById('search-input');
    searchBtn = document.getElementById('search-btn');
    
    // 初始化已加载页面集合
    allCategories.forEach(category => {
        if (!window.CATEGORY_LOADED_PAGES[category]) {
            window.CATEGORY_LOADED_PAGES[category] = new Set();
        }
    });
    
    // 预加载数据，提高首次交互响应速度
    try {
        await riddleDataManager.loadAllRiddles();
        window.allRiddles = riddleDataManager.allRiddles; // 更新全局变量
        
        // 设置布局切换功能
        setupLayoutToggle();
    } catch (error) {
        // 静默处理预加载失败
    }
    
    // 绑定分类筛选按钮事件
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.textContent.trim();
            try {
                // 更新按钮active状态
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                await filterRiddlesByCategory(category);
                // 更新URL参数
                const url = new URL(window.location);
                url.searchParams.set('category', category);
                window.history.pushState({}, '', url);
                
                // 更新页面标题为SEO优化的标题
                document.title = `${category}的谜语 - 爱谜语`;
            } catch (error) {
                alert(`加载${category}分类失败，请刷新页面重试`);
            }
        });
    });
    
    // 立即检查URL参数 - 确保在页面加载时处理
    try {
        await checkUrlParams();
    } catch (error) {
        // 静默处理URL参数检查失败
    }
    
    // 添加内存管理：页面卸载前清理缓存（可选）
    window.addEventListener('beforeunload', () => {
        // 如果需要，可以在这里清理缓存
        // riddleDataManager.clearCache();
    });
    
    // 绑定搜索和其他事件
    bindEvents();
    
    // 为当前分类按钮添加active类
    const urlParams = new URLSearchParams(window.location.search);
    const encodedCategory = urlParams.get('category');
    if (encodedCategory) {
        const decodedCategory = decodeURIComponent(encodedCategory);
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            if (btn.textContent.trim() === decodedCategory) {
                btn.classList.add('active');
            }
        });
    }
    
    // 分类页面初始化完成
}

// 检查URL参数 - 添加URL编码参数解码处理
async function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedCategory = urlParams.get('category');
    
    // 检查是否在分类页面，支持带.html和不带.html后缀的情况
    const pathname = window.location.pathname;
    const isCategoryPage = pathname.includes('categories.html') || pathname.endsWith('/categories') || pathname === '/categories';
    
    // 只有在分类页面才处理分类参数和加载默认分类
    if (isCategoryPage) {
        if (encodedCategory) {
            try {
                // 解码URL编码的分类参数
                const decodedCategory = decodeURIComponent(encodedCategory);
                // 根据解码后的分类筛选谜语
                await filterRiddlesByCategory(decodedCategory);
                
                // 更新页面标题为SEO优化的标题
                document.title = `关于“${decodedCategory}”的谜语 - 爱谜语`;
            } catch (error) {
                // 如果URL参数处理失败，尝试加载默认分类
                try {
                    await filterRiddlesByCategory('动物');
                // 设置默认分类标题
                document.title = '动物谜语 - 爱谜语';
            } catch (defaultError) {
                // 静默处理默认分类加载失败
            }
            }
        } else {
            try {
                await filterRiddlesByCategory('动物');
                // 设置默认分类标题
                document.title = '动物谜语 - 爱谜语';
            } catch (error) {
                // 静默处理默认分类加载失败
            }
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 支持带.html和不带.html后缀的分类页面路径
        const pathname = window.location.pathname;
        const isCategoryPage = pathname.includes('categories.html') || pathname.endsWith('/categories') || pathname === '/categories';
        
        if (isCategoryPage) {
            await initCategoryPage();
        } else {
            await initPage();
        }
    } catch (error) {
        // 显示通用错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e74c3c;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
        `;
        errorDiv.textContent = '页面加载失败，请刷新重试';
        document.body.appendChild(errorDiv);
    }
});