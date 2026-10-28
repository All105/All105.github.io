// Legal pages only declare title, lang and pageKey (editable in /admin); the rest is derived here.
export default {
  layout: "layouts/legal.njk",
  eleventyComputed: {
    permalink: (data) => data.routes[data.pageKey][data.lang],
    seoTitle: (data) => data.seo[data.pageKey][data.lang][0],
    seoDescription: (data) => data.seo[data.pageKey][data.lang][1],
  },
};
