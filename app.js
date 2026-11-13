(() => {
  'use strict';

  const CONTENT = window.CYBERWAN_CONTENT;
  if (!CONTENT) {
    console.error('[CyberWan] content.js 未加载。');
    return;
  }

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapeAttr = escapeHtml;

  const debounce = (fn, wait = 80) => {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  const storage = {
    get(key, fallback = null) {
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* ignore */
      }
    },
  };

  const posts = CONTENT.posts.map((post, index) => ({
    ...post,
    index,
    searchBlob: [post.title, post.excerpt, post.tags.join(' '), post.content].join(' ').toLowerCase(),
  }));
  const site = CONTENT.site || {};
  const projects = CONTENT.projects || [];
  const notes = CONTENT.notes || [];
  const about = CONTENT.about || {};
  const commentsConfig = CONTENT.comments || {};

  const allTags = [];
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      if (!allTags.includes(tag)) allTags.push(tag);
    });
  });

  const state = {
    tag: '全部',
    query: '',
    activePost: null,
    view: 'home',
    fontSizeIndex: 1,
  };

  const els = {
    html: document.documentElement,
    body: document.body,
    themeToggle: $('#themeToggle'),
    search: $('#searchInput'),
    navLinks: $$('[data-nav]'),
    homeView: $('#homeView'),
    projectsView: $('#projectsView'),
    archiveView: $('#archiveView'),
    aboutView: $('#aboutView'),
    articleView: $('#articleView'),
    notesList: $('#notesList'),
    projectGrid: $('#projectGrid'),
    archiveList: $('#archiveList'),
    aboutIntro: $('#aboutIntro'),
    skillList: $('#skillList'),
    timelineList: $('#timelineList'),
    resumeButton: $('#resumeButton'),
    tagFilters: $('#tagFilters'),
    topicList: $('#topicList'),
    postGrid: $('#postGrid'),
    postCount: $('#postCount'),
    resultText: $('#resultText'),
    emptyState: $('#emptyState'),
    resetFilters: $('#resetFilters'),
    articleTitle: $('#articleTitle'),
    articleSubtitle: $('#articleSubtitle'),
    articleKicker: $('#articleKicker'),
    articleDate: $('#articleDate'),
    articleReadTime: $('#articleReadTime'),
    articleTags: $('#articleTags'),
    articleContent: $('#articleContent'),
    articleToc: $('.article-toc'),
    tocNav: $('#tocNav'),
    tocToggle: $('#tocToggle'),
    fontDown: $('#fontDown'),
    fontUp: $('#fontUp'),
    shareNative: $('#shareNative'),
    shareWeibo: $('#shareWeibo'),
    shareX: $('#shareX'),
    copyLink: $('#copyLink'),
    backButton: $('#backButton'),
    articleBackButton: $('#articleBackButton'),
    readingBar: $('#readingBar'),
    giscusThread: $('#giscusThread'),
    commentsNote: $('#commentsNote'),
    lightbox: $('#lightbox'),
    lightboxImage: $('#lightboxImage'),
    lightboxClose: $('#lightboxClose'),
    backToTop: $('#backToTop'),
    localTime: $('#localTime'),
    year: $('#year'),
    siteStats: $('#siteStats'),
  };

  const themeMeta = $('meta[name="theme-color"]');
  const FONT_SIZES = [14, 15.5, 17, 18.5];
  const VIEW_TITLES = {
    home: '@CyberWan · 个人博客',
    projects: '项目 · @CyberWan',
    archive: '归档 · @CyberWan',
    about: '关于 · @CyberWan',
  };

  /* ------------------------------------------------------------
     Theme / font size
     ------------------------------------------------------------ */
  const setTheme = (theme, persist = true) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    els.html.dataset.theme = next;
    if (themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#0e1015' : '#f7f6f2');
    if (els.themeToggle) {
      els.themeToggle.setAttribute('aria-label', next === 'dark' ? '切换到浅色模式' : '切换到深色模式');
    }
    if (persist) storage.set('cw-theme-simple', next);
    if (state.view === 'article' && state.activePost && commentsConfig.repo && commentsConfig.repoId) {
      renderComments(state.activePost);
    }
  };

  const initTheme = () => {
    const stored = storage.get('cw-theme-simple', null);
    setTheme(stored === 'dark' ? 'dark' : 'light', false);
    els.themeToggle?.addEventListener('click', () => {
      setTheme(els.html.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  };

  const applyFontSize = () => {
    const size = FONT_SIZES[state.fontSizeIndex] || FONT_SIZES[1];
    els.html.style.setProperty('--article-font-size', `${size}px`);
  };

  const initFontSize = () => {
    const stored = Number(storage.get('cw-font-size-index', '1'));
    state.fontSizeIndex = Number.isFinite(stored) ? Math.max(0, Math.min(FONT_SIZES.length - 1, stored)) : 1;
    applyFontSize();
    const change = (delta) => {
      state.fontSizeIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, state.fontSizeIndex + delta));
      applyFontSize();
      storage.set('cw-font-size-index', String(state.fontSizeIndex));
    };
    els.fontDown?.addEventListener('click', () => change(-1));
    els.fontUp?.addEventListener('click', () => change(1));
  };

  /* ------------------------------------------------------------
     Page data renderers
     ------------------------------------------------------------ */
  const renderNotes = () => {
    if (!els.notesList) return;
    els.notesList.innerHTML = notes.map((note) => `
      <article class="note-card">
        <div class="note-head">
          <time>${escapeHtml(note.date)}</time>
          <span>${escapeHtml(note.tag || '日常')}</span>
        </div>
        <p>${escapeHtml(note.text)}</p>
      </article>
    `).join('');
  };

  const renderProjects = () => {
    if (!els.projectGrid) return;
    els.projectGrid.innerHTML = projects.map((project) => {
      const external = /^https?:\/\//.test(project.link || '');
      const repoExternal = /^https?:\/\//.test(project.repo || '');
      return `
        <article class="project-card">
          <div class="project-top">
            <span>${escapeHtml(project.year || '2026')}</span>
            <span class="project-status">${escapeHtml(project.status || '进行中')}</span>
          </div>
          <h3>${escapeHtml(project.title)}</h3>
          <p class="project-subtitle">${escapeHtml(project.subtitle || '')}</p>
          <p class="project-description">${escapeHtml(project.description || '')}</p>
          <div class="project-tags">${(project.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          <div class="project-links">
            ${project.link ? `<a href="${escapeAttr(project.link)}"${external ? ' target="_blank" rel="noopener"' : ''}>查看项目 ↗</a>` : ''}
            ${project.repo ? `<a href="${escapeAttr(project.repo)}"${repoExternal ? ' target="_blank" rel="noopener"' : ''}>源码 ↗</a>` : ''}
          </div>
        </article>
      `;
    }).join('');
  };

  const renderArchive = () => {
    if (!els.archiveList) return;
    const grouped = new Map();
    [...posts].sort((a, b) => b.date.localeCompare(a.date)).forEach((post) => {
      const year = post.date.slice(0, 4);
      if (!grouped.has(year)) grouped.set(year, []);
      grouped.get(year).push(post);
    });
    els.archiveList.innerHTML = Array.from(grouped.entries()).map(([year, items]) => `
      <section class="archive-year">
        <h2>${escapeHtml(year)}</h2>
        ${items.map((post) => `
          <div class="archive-item">
            <time class="archive-date">${escapeHtml(post.displayDate.slice(5))}</time>
            <a class="archive-title" href="#post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a>
            <span class="archive-tags">${escapeHtml(post.tags.join(' · '))}</span>
          </div>
        `).join('')}
      </section>
    `).join('');
  };

  const renderAbout = () => {
    if (!els.aboutIntro) return;
    els.aboutIntro.textContent = (about.intro || []).join(' ');
    els.skillList.innerHTML = (about.skills || []).map((skill) => `
      <div class="skill-row">
        <div class="skill-row-top"><span>${escapeHtml(skill.name)}</span><span>${Number(skill.level) || 0}%</span></div>
        <div class="skill-bar" role="progressbar" aria-label="${escapeAttr(skill.name)}" aria-valuenow="${Number(skill.level) || 0}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Number(skill.level) || 0}%"></span></div>
      </div>
    `).join('');
    els.timelineList.innerHTML = (about.timeline || []).map((item) => `
      <div class="timeline-item">
        <span class="timeline-year">${escapeHtml(item.year)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </div>
    `).join('');
    if (about.resumeUrl) {
      els.resumeButton.hidden = false;
      els.resumeButton.href = about.resumeUrl;
    }
  };

  /* ------------------------------------------------------------
     Post list / filters
     ------------------------------------------------------------ */
  const renderTagFilters = () => {
    const values = ['全部', ...allTags];
    els.tagFilters.innerHTML = values.map((tag) => `
      <button class="filter-button${state.tag === tag ? ' is-active' : ''}" type="button"
        data-tag="${escapeAttr(tag)}" aria-pressed="${state.tag === tag}">
        ${escapeHtml(tag)}
      </button>
    `).join('');
  };

  const syncTagFilters = () => {
    $$('.filter-button', els.tagFilters).forEach((button) => {
      const active = button.dataset.tag === state.tag;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const renderTopics = () => {
    if (!els.topicList) return;
    els.topicList.innerHTML = allTags.map((tag) => {
      const count = posts.filter((post) => post.tags.includes(tag)).length;
      return `<button class="topic-row" type="button" data-topic="${escapeAttr(tag)}">
        <span>${escapeHtml(tag)}</span><span>${String(count).padStart(2, '0')}</span>
      </button>`;
    }).join('');
  };

  const highlightMatch = (text, query) => {
    if (!query) return escapeHtml(text);
    const source = String(text);
    const lower = source.toLowerCase();
    const needle = query.toLowerCase();
    let cursor = 0;
    let result = '';
    let index = lower.indexOf(needle, cursor);
    if (index === -1) return escapeHtml(source);
    while (index !== -1) {
      result += escapeHtml(source.slice(cursor, index));
      result += `<mark>${escapeHtml(source.slice(index, index + needle.length))}</mark>`;
      cursor = index + needle.length;
      index = lower.indexOf(needle, cursor);
    }
    return result + escapeHtml(source.slice(cursor));
  };

  const getFilteredPosts = () => {
    const query = state.query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesTag = state.tag === '全部' || post.tags.includes(state.tag);
      const matchesQuery = !query || post.searchBlob.includes(query);
      return matchesTag && matchesQuery;
    });
  };

  const coverWord = (post) => post.cover.label.split('_')
    .map((part) => `<span>${escapeHtml(part)}</span>`)
    .join('');

  const renderPosts = () => {
    const filtered = getFilteredPosts();
    if (!filtered.length) {
      els.postGrid.innerHTML = '';
      els.emptyState.hidden = false;
      els.resultText.textContent = state.query ? `没有匹配 “${state.query.slice(0, 18)}”` : '没有匹配的文章';
      els.postCount.textContent = '00';
      return;
    }

    els.emptyState.hidden = true;
    const leadId = filtered.find((post) => post.featured)?.id || filtered[0].id;

    els.postGrid.innerHTML = filtered.map((post, index) => {
      const isFeatured = filtered.length === 1 || (filtered.length >= 3 && post.id === leadId);
      const query = state.query.trim();
      const coverClass = `cover-${((post.id - 1) % 3) + 1}`;
      return `
        <article class="post-card${isFeatured ? ' is-featured' : ''}" style="--i:${index}">
          <a class="post-cover ${coverClass}" href="#post/${encodeURIComponent(post.slug)}" aria-label="阅读：${escapeAttr(post.title)}">
            <span class="cover-top"><span>${escapeHtml(post.cover.code)}</span><span>${escapeHtml(post.displayDate)}</span></span>
            <span class="cover-word">${coverWord(post)}</span>
            <span class="cover-number">${String(post.id).padStart(2, '0')}</span>
            <span class="cover-foot">${escapeHtml(post.tags.join(' / '))}</span>
          </a>
          <div class="post-info">
            <div class="post-meta">
              <span>${escapeHtml(post.displayDate)}</span><span class="dot"></span>
              <span>${formatReadTime(post.readTime)}</span>
            </div>
            <h3 class="post-title"><a href="#post/${encodeURIComponent(post.slug)}">${highlightMatch(post.title, query)}</a></h3>
            <p class="post-excerpt">${highlightMatch(post.excerpt, query)}</p>
            <div class="post-tags">${post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="post-footer">
              <a class="read-link" href="#post/${encodeURIComponent(post.slug)}">
                阅读文章
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              </a>
              <span class="post-index">NO. ${String(post.id).padStart(2, '0')}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    els.postCount.textContent = String(filtered.length).padStart(2, '0');
    els.resultText.textContent = state.query ? `找到 ${filtered.length} 篇相关文章` : `共 ${filtered.length} 篇文章`;
  };

  const formatReadTime = (value) => {
    const match = String(value || '').match(/(\d+)/);
    return match ? `${match[1]} 分钟阅读` : '阅读';
  };

  const goToJournal = () => {
    if (state.view !== 'home') {
      history.replaceState(null, '', '#journal');
      route();
    } else {
      document.getElementById('journal')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  };

  const setTag = (tag) => {
    state.tag = tag;
    syncTagFilters();
    renderPosts();
    goToJournal();
  };

  const resetFilters = () => {
    state.tag = '全部';
    state.query = '';
    els.search.value = '';
    syncTagFilters();
    renderPosts();
    els.search.focus();
  };

  /* ------------------------------------------------------------
     Markdown / article
     ------------------------------------------------------------ */
  const sanitizeHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, form, link, meta').forEach((node) => node.remove());
    doc.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
        if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  };

  const fallbackMarkdown = (markdown) => {
    return escapeHtml(markdown)
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('');
  };

  const renderMarkdown = (markdown) => {
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        return sanitizeHtml(window.marked.parse(markdown, { gfm: true, breaks: false }));
      } catch (error) {
        return fallbackMarkdown(markdown);
      }
    }
    return fallbackMarkdown(markdown);
  };

  const getShareUrl = (post) => {
    const base = (site.url || '').replace(/\/$/, '');
    if (base && !base.includes('YOUR-USERNAME')) return `${base}/#post/${post.slug}`;
    return window.location.href;
  };

  const updateShareLinks = (post) => {
    const url = getShareUrl(post);
    const title = post.title;
    if (els.shareWeibo) {
      els.shareWeibo.href = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    }
    if (els.shareX) {
      els.shareX.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    }
    if (els.shareNative) {
      els.shareNative.dataset.url = url;
      els.shareNative.dataset.title = title;
    }
  };

  const renderComments = (post) => {
    if (!els.giscusThread) return;
    els.giscusThread.innerHTML = '';
    const configured = Boolean(commentsConfig.repo && commentsConfig.repoId);
    if (!configured) {
      els.commentsNote.hidden = false;
      els.commentsNote.textContent = '评论系统已完成接入，但还没有绑定 GitHub 仓库。在 content.js 的 comments 里填入 repo 和 repoId 后即可启用。';
      return;
    }
    els.commentsNote.hidden = true;
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', commentsConfig.repo);
    script.setAttribute('data-repo-id', commentsConfig.repoId);
    script.setAttribute('data-category', commentsConfig.category || 'General');
    script.setAttribute('data-category-id', commentsConfig.categoryId || '');
    script.setAttribute('data-mapping', 'specific');
    script.setAttribute('data-term', post.slug);
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', els.html.dataset.theme === 'dark' ? 'dark' : 'light');
    script.setAttribute('data-lang', commentsConfig.lang || 'zh-CN');
    script.setAttribute('data-loading', 'lazy');
    els.giscusThread.appendChild(script);
  };

  const renderArticle = (post) => {
    state.activePost = post;
    els.articleKicker.textContent = `JOURNAL / ${post.cover.label}`;
    els.articleTitle.textContent = post.title;
    els.articleSubtitle.textContent = post.excerpt;
    els.articleDate.textContent = post.displayDate;
    els.articleReadTime.textContent = formatReadTime(post.readTime);
    els.articleTags.innerHTML = post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    els.articleContent.innerHTML = renderMarkdown(post.content);

    const headings = $$('h2, h3', els.articleContent);
    els.tocNav.innerHTML = '';
    headings.forEach((heading, index) => {
      const id = `section-${post.id}-${index + 1}`;
      heading.id = id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `toc-link${heading.tagName === 'H3' ? ' toc-sub' : ''}`;
      button.dataset.target = id;
      button.textContent = heading.textContent.trim();
      button.addEventListener('click', () => {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (els.articleToc.classList.contains('is-open')) {
          els.articleToc.classList.remove('is-open');
          els.tocToggle.setAttribute('aria-expanded', 'false');
        }
      });
      els.tocNav.appendChild(button);
    });

    $$('pre code', els.articleContent).forEach((code) => {
      const pre = code.parentElement;
      const langClass = Array.from(code.classList).find((name) => name.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : 'text';
      if (window.hljs) {
        try {
          if (window.hljs.getLanguage(lang)) {
            code.className = `language-${lang}`;
            window.hljs.highlightElement(code);
          }
        } catch (error) {
          /* keep plain */
        }
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      const head = document.createElement('div');
      head.className = 'code-head';
      head.innerHTML = `<span>${escapeHtml(lang)}</span><button class="copy-code" type="button">复制</button>`;
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(head);
      wrapper.appendChild(pre);
    });

    $$('a', els.articleContent).forEach((link) => {
      if (/^https?:\/\//i.test(link.getAttribute('href') || '')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });

    updateShareLinks(post);
    renderComments(post);
    els.articleToc.classList.remove('is-open');
    els.tocToggle.setAttribute('aria-expanded', 'false');
    els.readingBar.style.width = '0%';
    updateReadingState();
    window.scrollTo(0, 0);
    window.setTimeout(() => els.articleTitle.focus({ preventScroll: true }), 40);
  };

  /* ------------------------------------------------------------
     Views / routing
     ------------------------------------------------------------ */
  const viewMap = () => ({
    home: els.homeView,
    projects: els.projectsView,
    archive: els.archiveView,
    about: els.aboutView,
    article: els.articleView,
  });

  const setView = (name) => {
    const views = viewMap();
    Object.entries(views).forEach(([key, element]) => {
      element.hidden = key !== name;
    });
    state.view = name;
    els.html.dataset.view = name;
    if (name !== 'article') {
      window.scrollTo(0, 0);
    }
  };

  const setActiveNav = (name) => {
    const active = name === 'article' ? 'journal' : name;
    els.navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.nav === active);
    });
  };

  const route = () => {
    const hash = window.location.hash;
    const postMatch = hash.match(/^#post\/(.+)$/);
    if (postMatch) {
      const slug = decodeURIComponent(postMatch[1]);
      const post = posts.find((item) => item.slug === slug);
      if (post) {
        setView('article');
        document.title = `${post.title} · @CyberWan`;
        renderArticle(post);
        setActiveNav('journal');
        return;
      }
    }

    const page = hash.replace('#', '');
    if (page === 'projects' || page === 'archive' || page === 'about') {
      setView(page);
      document.title = VIEW_TITLES[page];
      setActiveNav(page);
      return;
    }

    setView('home');
    document.title = VIEW_TITLES.home;
    setActiveNav(page === 'journal' ? 'journal' : 'home');
    if (page === 'journal') {
      window.setTimeout(() => {
        document.getElementById('journal')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 40);
    } else if (page === 'notes') {
      window.setTimeout(() => {
        document.getElementById('notes')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 40);
    } else if (page === 'home' || page === '') {
      window.scrollTo(0, 0);
    }
  };

  const closeArticle = () => {
    window.location.hash = 'journal';
  };

  /* ------------------------------------------------------------
     Reading progress / toc
     ------------------------------------------------------------ */
  let readingTick = 0;
  const updateReadingState = () => {
    if (state.view !== 'article') return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    els.readingBar.style.width = `${percent}%`;

    const headings = $$('h2, h3', els.articleContent);
    let activeId = '';
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top < 150) activeId = heading.id;
    });
    $$('.toc-link', els.tocNav).forEach((link) => {
      link.classList.toggle('is-active', link.dataset.target === activeId);
    });
  };

  const onScroll = () => {
    if (readingTick) return;
    readingTick = window.requestAnimationFrame(() => {
      readingTick = 0;
      updateReadingState();
      els.backToTop?.classList.toggle('is-visible', window.scrollY > 700);
    });
  };

  /* ------------------------------------------------------------
     Copy / share / lightbox
     ------------------------------------------------------------ */
  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        /* fallback */
      }
    }
    try {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const ok = document.execCommand('copy');
      helper.remove();
      return ok;
    } catch (error) {
      return false;
    }
  };

  const openLightbox = (src, alt) => {
    if (!els.lightbox || !els.lightboxImage) return;
    els.lightboxImage.src = src;
    els.lightboxImage.alt = alt || '';
    els.lightbox.classList.add('is-open');
    els.lightbox.setAttribute('aria-hidden', 'false');
    els.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    if (!els.lightbox?.classList.contains('is-open')) return;
    els.lightbox.classList.remove('is-open');
    els.lightbox.setAttribute('aria-hidden', 'true');
    els.body.style.overflow = '';
    els.lightboxImage.src = '';
  };

  const initArticleTools = () => {
    els.tocToggle?.addEventListener('click', () => {
      const open = els.articleToc.classList.toggle('is-open');
      els.tocToggle.setAttribute('aria-expanded', String(open));
    });

    els.copyLink?.addEventListener('click', async () => {
      const ok = await copyText(window.location.href);
      els.copyLink.textContent = ok ? '已复制' : '复制失败';
      window.setTimeout(() => { els.copyLink.textContent = '复制链接'; }, 1600);
    });

    els.shareNative?.addEventListener('click', async () => {
      const url = els.shareNative.dataset.url || window.location.href;
      const title = els.shareNative.dataset.title || document.title;
      if (navigator.share) {
        try {
          await navigator.share({ title, text: title, url });
          return;
        } catch (error) {
          /* cancelled or unsupported */
        }
      }
      const ok = await copyText(url);
      els.shareNative.textContent = ok ? '已复制' : '分享';
      window.setTimeout(() => { els.shareNative.textContent = '分享'; }, 1600);
    });

    els.articleContent.addEventListener('click', async (event) => {
      const copyButton = event.target.closest('.copy-code');
      if (copyButton) {
        const code = copyButton.closest('.code-block')?.querySelector('code');
        if (!code) return;
        const ok = await copyText(code.textContent);
        copyButton.textContent = ok ? '已复制' : '失败';
        window.setTimeout(() => { copyButton.textContent = '复制'; }, 1400);
        return;
      }
      const image = event.target.closest('img');
      if (image) {
        openLightbox(image.currentSrc || image.src, image.alt);
      }
    });

    els.lightbox?.addEventListener('click', (event) => {
      if (event.target === els.lightbox || event.target === els.lightboxClose) closeLightbox();
    });
    els.lightboxClose?.addEventListener('click', closeLightbox);
  };

  /* ------------------------------------------------------------
     Search / filters / route listeners
     ------------------------------------------------------------ */
  const initSearch = () => {
    const onInput = debounce(() => {
      state.query = els.search.value.trim();
      if (state.view !== 'home') {
        history.replaceState(null, '', '#journal');
        route();
      }
      renderPosts();
    }, 70);

    els.search.addEventListener('input', onInput);
    els.search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        els.search.value = '';
        state.query = '';
        renderPosts();
        els.search.blur();
      }
    });

    els.tagFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tag]');
      if (button) setTag(button.dataset.tag);
    });

    els.topicList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-topic]');
      if (button) setTag(button.dataset.topic);
    });

    els.resetFilters.addEventListener('click', resetFilters);
  };

  const initRouting = () => {
    window.addEventListener('hashchange', route);
    els.backButton.addEventListener('click', closeArticle);
    els.articleBackButton.addEventListener('click', closeArticle);
  };

  const initGadgets = () => {
    const updateTime = () => {
      if (!els.localTime) return;
      els.localTime.textContent = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
    };
    updateTime();
    window.setInterval(updateTime, 30000);
    els.year.textContent = String(new Date().getFullYear());

    els.backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && els.lightbox?.classList.contains('is-open')) {
        closeLightbox();
        return;
      }
      if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        event.preventDefault();
        els.search.focus();
      }
      if (event.key === 'Escape' && state.view === 'article' && document.activeElement !== els.search) {
        closeArticle();
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  const init = () => {
    initTheme();
    initFontSize();
    renderTagFilters();
    renderTopics();
    renderNotes();
    renderProjects();
    renderArchive();
    renderAbout();
    renderPosts();
    initSearch();
    initArticleTools();
    initRouting();
    initGadgets();
    route();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
