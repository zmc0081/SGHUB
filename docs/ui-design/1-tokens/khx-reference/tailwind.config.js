/** @type {import('tailwindcss').Config} */
// =============================================================================
// KnowledgeHub X · Tailwind v3 Config
// 提取自 knowledgehubtemplate.webflow.io 实际页面截图
// 使用：将 colors / fontFamily / borderRadius / boxShadow 等节点合并到你的项目
//       配置中。若希望全量替换默认主题，请改用 `theme.colors = ...` 形式。
// =============================================================================

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,html}',
    './components/**/*.{js,ts,jsx,tsx,html}',
    './app/**/*.{js,ts,jsx,tsx,html}',
    './src/**/*.{js,ts,jsx,tsx,vue,html}',
  ],
  theme: {
    extend: {
      // -------- 颜色 --------
      colors: {
        // 品牌主色（核心：navy 是主按钮和标题，indigo 是强调）
        navy: {
          DEFAULT: '#1F2E4D',
          hover:   '#2A3A5F',
          active:  '#15203A',
        },
        indigo: {
          DEFAULT: '#4F46E5',
          hover:   '#3730A3',
          soft:    '#EEF0FF',
          light:   '#E0E5FF',
        },

        // 文字（与 Tailwind 默认 text-* 不冲突，通过 text-khx-1 等使用）
        'khx-1': '#1F2E4D',
        'khx-2': '#5C6B88',
        'khx-3': '#939EB3',

        // 边框
        'khx-border':        '#ECEEF5',
        'khx-border-strong': '#D9DEEA',

        // 背景
        'khx-bg':      '#F8FAFF',
        'khx-card':    '#FFFFFF',

        // Changelog 语义徽章色（成对使用）
        'badge-update':      { bg: '#EEF0FF', fg: '#4F46E5' },
        'badge-improve':     { bg: '#DEF5E2', fg: '#1A8A3A' },
        'badge-bug':         { bg: '#FFE0E0', fg: '#C8323C' },
        'badge-new':         { bg: '#FFF3C2', fg: '#8A6D00' },

        // 系统状态色
        'khx-success': { DEFAULT: '#1A8A3A', soft: '#DEF5E2' },
        'khx-danger':  { DEFAULT: '#C8323C', soft: '#FFE0E0' },
        'khx-warning': { DEFAULT: '#D4AE00', soft: '#FFF3C2' },
        'khx-info':    { DEFAULT: '#4F46E5', soft: '#EEF0FF' },
      },

      // -------- 字体家族 --------
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },

      // -------- 字号 + 行高（成对配置） --------
      fontSize: {
        'khx-display':    ['60px', { lineHeight: '1.2',  fontWeight: '700' }],
        'khx-display-sm': ['48px', { lineHeight: '1.2',  fontWeight: '700' }],
        'khx-h1':         ['36px', { lineHeight: '1.25', fontWeight: '700' }],
        'khx-h2':         ['24px', { lineHeight: '1.3',  fontWeight: '600' }],
        'khx-h3':         ['18px', { lineHeight: '1.4',  fontWeight: '600' }],
        'khx-body-lg':    ['18px', { lineHeight: '1.65', fontWeight: '400' }],
        'khx-body':       ['16px', { lineHeight: '1.65', fontWeight: '400' }],
        'khx-caption':    ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
        'khx-meta':       ['12px', { lineHeight: '1.5',  fontWeight: '500' }],
      },

      // -------- 圆角 --------
      borderRadius: {
        'khx-pill':    '999px',  // 按钮 / 导航 / 单行输入 / 徽章
        'khx-card':    '16px',   // 分类卡 / 套餐卡
        'khx-card-sm': '14px',   // 侧栏卡 / Changelog 卡 / textarea
        'khx-icon':    '10px',   // 图标盒
      },

      // -------- 阴影 --------
      boxShadow: {
        'khx-card':    '0 1px 2px rgba(31, 46, 77, 0.04), 0 8px 24px rgba(31, 46, 77, 0.06)',
        'khx-card-sm': '0 1px 2px rgba(31, 46, 77, 0.04), 0 4px 14px rgba(31, 46, 77, 0.05)',
        'khx-nav':     '0 4px 24px rgba(31, 46, 77, 0.08)',
        'khx-btn':     '0 4px 12px rgba(31, 46, 77, 0.18)',
        'khx-modal':   '0 20px 40px rgba(31, 46, 77, 0.18)',
        'khx-focus':   '0 0 0 3px rgba(31, 46, 77, 0.08)',
      },

      // -------- 间距（基于 4px 栅格，扩展几个常用值） --------
      spacing: {
        'khx-nav-top': '24px',  // 悬浮导航距顶
      },

      // -------- 容器最大宽 --------
      maxWidth: {
        'khx': '1200px',
      },

      // -------- 渐变（Hero / Contact 氛围背景） --------
      backgroundImage: {
        'khx-page':         'linear-gradient(135deg, #F8FAFF 0%, #F0F2FB 100%)',
        'khx-glow-purple':  'radial-gradient(circle, rgba(125, 66, 251, 0.18) 0%, transparent 70%)',
        'khx-glow-blue':    'radial-gradient(circle, rgba(141, 173, 253, 0.22) 0%, transparent 70%)',
      },

      // -------- 动效 --------
      transitionTimingFunction: {
        'khx': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        'khx-fast': '120ms',
        'khx':      '180ms',
        'khx-slow': '240ms',
      },
    },
  },
  plugins: [
    // 组件级 @layer components 快捷类（按需保留 / 删除）
    function ({ addComponents }) {
      addComponents({
        // ---- 主按钮：深海军蓝胶囊 ----
        '.btn-khx-primary': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 22px',
          fontWeight: '500',
          fontSize: '13px',
          lineHeight: '1',
          color: '#FFFFFF',
          backgroundColor: '#1F2E4D',
          borderRadius: '999px',
          boxShadow: '0 4px 12px rgba(31, 46, 77, 0.18)',
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#2A3A5F', transform: 'translateY(-1px)' },
          '&:active': { backgroundColor: '#15203A', transform: 'translateY(0)' },
        },

        // ---- 次按钮：白底胶囊 ----
        '.btn-khx-secondary': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 22px',
          fontWeight: '500',
          fontSize: '13px',
          lineHeight: '1',
          color: '#1F2E4D',
          backgroundColor: '#FFFFFF',
          border: '1px solid #ECEEF5',
          borderRadius: '999px',
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          '&:hover': { borderColor: '#1F2E4D' },
        },

        // ---- 链接按钮：靛紫文字 + 箭头 ----
        '.btn-khx-link': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '600',
          fontSize: '13px',
          color: '#4F46E5',
          background: 'transparent',
          border: 'none',
          padding: '0',
          cursor: 'pointer',
          transition: 'color 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': { color: '#3730A3' },
        },

        // ---- 输入框（胶囊单行） ----
        '.input-khx': {
          width: '100%',
          padding: '12px 18px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: '#1F2E4D',
          backgroundColor: '#FFFFFF',
          border: '1px solid #ECEEF5',
          borderRadius: '999px',
          outline: 'none',
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxSizing: 'border-box',
          '&:focus': {
            borderColor: '#1F2E4D',
            boxShadow: '0 0 0 3px rgba(31, 46, 77, 0.08)',
          },
          '&::placeholder': { color: '#939EB3' },
        },

        // ---- 卡片 ----
        '.card-khx': {
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 1px 2px rgba(31, 46, 77, 0.04), 0 8px 24px rgba(31, 46, 77, 0.06)',
          padding: '24px',
        },

        // ---- 图标盒 ----
        '.icon-box-khx': {
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          backgroundColor: '#EEF0FF',
          color: '#4F46E5',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        },

        // ---- 悬浮胶囊导航 ----
        '.nav-khx': {
          backgroundColor: '#FFFFFF',
          borderRadius: '999px',
          boxShadow: '0 4px 24px rgba(31, 46, 77, 0.08)',
          padding: '10px 12px 10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        },

        // ---- 徽章基类 ----
        '.badge-khx': {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '500',
          lineHeight: '1.5',
        },
        '.badge-khx-update':  { backgroundColor: '#EEF0FF', color: '#4F46E5' },
        '.badge-khx-improve': { backgroundColor: '#DEF5E2', color: '#1A8A3A' },
        '.badge-khx-bug':     { backgroundColor: '#FFE0E0', color: '#C8323C' },
        '.badge-khx-new':     { backgroundColor: '#FFF3C2', color: '#8A6D00' },
      });
    },
  ],
};
