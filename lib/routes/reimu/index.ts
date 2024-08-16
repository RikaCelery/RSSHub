import { DataItem, Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';

export const route: Route = {
    path: '/posts/newest/:count?',
    categories: ['blog'],
    example: '/posts/newest/2',
    parameters: { count: 'page counts, default 1' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'posts',
    maintainers: ['RikaCelery'],
    handler,
    description: ``,
};
async function handler(ctx) {
    const { count: totalPages = '1' } = ctx.req.param();
    const pageList = Array.from({ length: totalPages }, (_, i) => i + 1);

    const responses = await Promise.all(pageList.map((page) => got(`https://blog.reimu.net/page/${page}`)));
    const ret = responses
        .map((resp) => load(resp.data))
        .flatMap(($) => {
            const items: DataItem[] = [];
            $('article').each((i, el) => {
                const id = $(el).attr('id')?.split('-')[1];
                const link = $(el).find('a.more-link').attr('href');
                const pubDate = $(el).find('.posted-on .entry-date.published').attr('datetime');
                const updated = $(el).find('.posted-on .updated').attr('datetime');
                const author = $(el).find('.author a').text();
                const banner = $(el).find('.entry-content img').get(0)?.attribs.src;
                $(el).find('.entry-content p a.more-link').remove();
                $(el)
                    .find('.entry-content p a')
                    .each((i, el) => {
                        $(el).replaceWith(`${$(el).unwrap('a')}(${$(el).attr('href')})`);
                    });
                items.push({
                    title: $(el).find('.entry-title').text(),
                    id,
                    link,
                    pubDate,
                    updated,
                    author,
                    banner,
                    description: $(el).find('.entry-content').html()!,
                });
            });
            return items;
        });
    return {
        title: '灵梦御所',
        link: 'https://blog.reimu.net/',
        language: 'zh-CN',
        item: ret,
    };
}
