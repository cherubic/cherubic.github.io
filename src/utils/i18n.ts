export type Lang = 'zh' | 'en';

export function getLang(locale: string | undefined): Lang {
  return locale === 'en' ? 'en' : 'zh';
}

export const ui = {
  zh: {
    'nav.home':        '首页',
    'nav.archive':     '归档',
    'nav.categories':  '分类',
    'nav.tags':        '标签',
    'nav.about':       '关于',
    'sidebar.status':  'status',
    'sidebar.posts':   'posts',
    'sidebar.build':   'build',
    'sidebar.online':  '● online',
    'topbar.deploy':   'deploy: ok',
    'topbar.search':   '搜索文章…',
    'home.title':      '所有文章',
    'home.posts':      '篇文章',
    'archive.title':   '归档',
    'archive.posts':   '篇文章',
    'cats.title':      '分类',
    'tags.title':      '标签',
    'tags.count':      '个标签',
    'about.role':      'software engineer · blogger',
    'about.intro':     '这里是 xander 的个人博客，主要记录 Go / Kubernetes / 系统工程相关的技术探索与翻译笔记。',
    'about.contact_pre':  '如果你发现有任何错误或想交流，欢迎通过',
    'about.contact_suf':  '或邮件联系我。',
    'search.title':       '搜索',
    'search.placeholder': '输入关键词…',
    'search.all':         '查看全部结果 →',
    'search.empty_pre':   '没有找到',
    'search.empty_suf':   '的结果',
    'rp.toc':     '目录',
    'rp.recent':  '最近更新',
    'rp.tags':    '热门标签',
    'post.updated':   '更新',
    'post.min_read':  'min read',
    'post.share':     '分享：',
    'post.copy':      '复制链接',
    'post.copied':    '链接已复制',
    'post.prev':      '← 上一篇',
    'post.next':      '下一篇 →',
    'post.related':   '相关文章',
    'post.copyright': '本文采用 CC BY-NC-SA 4.0 协议授权，转载请注明来源。',
    'page.prev':  '← 上一页',
    'page.next':  '下一页 →',
    'page.label': '第',
    'page.of':    '/',
    'page.unit':  '页',
    'lang.switch': 'EN',
  },
  en: {
    'nav.home':        'Home',
    'nav.archive':     'Archive',
    'nav.categories':  'Categories',
    'nav.tags':        'Tags',
    'nav.about':       'About',
    'sidebar.status':  'status',
    'sidebar.posts':   'posts',
    'sidebar.build':   'build',
    'sidebar.online':  '● online',
    'topbar.deploy':   'deploy: ok',
    'topbar.search':   'Search…',
    'home.title':      'All Posts',
    'home.posts':      'posts',
    'archive.title':   'Archive',
    'archive.posts':   'posts',
    'cats.title':      'Categories',
    'tags.title':      'Tags',
    'tags.count':      'tags',
    'about.role':      'software engineer · blogger',
    'about.intro':     "This is xander's personal blog, documenting explorations and notes on Go, Kubernetes, and systems engineering.",
    'about.contact_pre':  'Found an error or want to chat? Feel free to open a',
    'about.contact_suf':  'or send an email.',
    'search.title':       'Search',
    'search.placeholder': 'Type to search…',
    'search.all':         'View all results →',
    'search.empty_pre':   'No results for',
    'search.empty_suf':   '',
    'rp.toc':     'Contents',
    'rp.recent':  'Recent Posts',
    'rp.tags':    'Popular Tags',
    'post.updated':   'Updated',
    'post.min_read':  'min read',
    'post.share':     'Share:',
    'post.copy':      'Copy Link',
    'post.copied':    'Link copied',
    'post.prev':      '← Previous',
    'post.next':      'Next →',
    'post.related':   'Related Posts',
    'post.copyright': 'Licensed under CC BY-NC-SA 4.0. Please cite the source when reproducing.',
    'page.prev':  '← Prev',
    'page.next':  'Next →',
    'page.label': 'Page',
    'page.of':    '/',
    'page.unit':  '',
    'lang.switch': 'ZH',
  },
} as const;

export type UIKey = keyof typeof ui.zh;

export function useTranslations(locale: string | undefined) {
  const lang = getLang(locale);
  return (key: UIKey): string => ui[lang][key];
}

/** Returns the locale-aware base path prefix: '' for zh, '/en' for en */
export function localePath(locale: string | undefined, path = '') {
  const lang = getLang(locale);
  const prefix = lang === 'en' ? '/en' : '';
  return prefix + (path || '/');
}
