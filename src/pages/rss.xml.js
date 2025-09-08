import config from "@/config/config.json";
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js' // https://highlightjs.org/
const parser = new MarkdownIt({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre><code class="hljs">' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>';
      } catch (__) {}
    }

    return '<pre><code class="hljs">' + parser.utils.escapeHtml(str) + '</code></pre>';
  }
});


export async function GET(context) {
  // 获取所有内容集合
  const allContent = await getCollection('posts');

  // 过滤掉根目录下的 `-index.md` 文件
  const filteredContent = allContent.filter(item => {
    // 检查 slug 或文件路径是否包含 `-index.md`
    return item.id && !item.id.includes('-index');
  });
  return rss({
    title: config.site.title,
    description: config.metadata.meta_description,
    site: config.site.base_url ? config.site.base_url : "https://rs.bifuba.com",
    trailingSlash: false,
    stylesheet: '/rss/styles.xsl',
    items: filteredContent.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      author: post.data.author, // 包含自定义字段 author
      content: sanitizeHtml(parser.render(post.body), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
      }),
      // 从 `slug` 属性计算出 RSS 链接
      // 这个例子假设所有的文章都被渲染为 `/blog/[slug]` 路由
      link: `/${post.id}`,
    })),
  });
}
