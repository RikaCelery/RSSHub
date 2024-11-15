import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import { config } from '@/config';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/post/:tid/:authorId?',
    categories: ['bbs'],
    example: '/nga/post/18449558',
    parameters: { tid: '帖子 id, 可在帖子 URL 找到', authorId: '作者 id' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '帖子',
    maintainers: ['xyqfer', 'syrinka'],
    handler,
};
async function loadFromPage(tid: string, authorId: string, pageId: string) {
    const $ = await getPage(tid, authorId, pageId);
    const title = $('title').text() || '';
    const posterMap = JSON.parse(
        $('script')
            .text()
            .match(/commonui\.userInfo\.setAll\((.*)\)$/m)![1]
    );
    const authorName = authorId ? posterMap[authorId].username : undefined;

    const items = $('#m_posts_c')
        .children()
        .filter('table')
        .map((ind, post_) => {
            const post = $(post_);
            const posterId = post
                .find('.posterinfo a')
                .first()
                .attr('href')!
                .match(/&uid=(-?\d+)$/)![1];
            const poster = authorName || posterMap[posterId].username;
            const content = post.find('.postcontent').first();
            const description = formatContent(content.html());
            const postId = content.attr('id');
            const link = getPageUrl(tid, authorId, pageId, postId);
            const pubDate = timezone(parseDate(post.find('.postInfo > span').first().text(), 'YYYY-MM-DD HH:mm'), +8);

            return {
                title: load(description).text(),
                author: poster,
                link,
                description,
                pubDate,
                guid: postId,
            };
        });
    return { title, authorName, items: items.toArray() };
}
const getPageUrl = (tid, authorId, page = '1', hash = '') => `https://nga.178.com/read.php?tid=${tid}&page=${page}${authorId ? `&authorid=${authorId}` : ''}&rand=${Math.floor(Math.random() * 1000)}${hash ? '#' + hash : ''}`;
const getPage = async (tid, authorId, pageId = '1') => {
    const link = getPageUrl(tid, authorId, pageId);
    const timestamp = Math.floor(Date.now() / 1000);
    let cookieString = `guestJs=${timestamp};`;
    if (config.nga.uid && config.nga.cid) {
        cookieString = `ngaPassportUid=${config.nga.uid}; ngaPassportCid=${config.nga.cid};`;
    }
    let response;
    for (let index = 0; index < 8; index++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            response = await got(link, {
                responseType: 'buffer',
                headers: {
                    Referer: `https://nga.178.com/read.php?tid=41312589`,
                    Cookie: cookieString,
                },
            });
            break;
        } catch (error) {
            logger.info('retry ' + String(error));
        }
    }

    const htmlString = iconv.decode(response.data, 'gbk');
    return load(htmlString);
};

const getLastPageId = async (tid, authorId) => {
    const $ = await getPage(tid, authorId);
    const nav = $('#pagebtop');
    const match = nav.html()!.match(/{0:'\/read\.php\?tid=(\d+).*?',1:(\d+),.*?}/);
    return match ? match[2] : '1';
};

const deepReplace = (str, pattern, replace) => {
    // 对于可能存在嵌套的样式一路 replace 到最深处
    while (pattern.test(str)) {
        str = str.replace(pattern, replace);
    }
    return str;
};

const formatContent = (str) => {
    // 简单样式
    str = deepReplace(str, /\[(b|u|i|del|code|sub|sup)](.+?)\[\/\1]/g, '<$1>$2</$1>');
    str = str
        .replaceAll(/\[dice](.+?)\[\/dice]/g, '<b>ROLL : $1</b>')
        .replaceAll(/\[color=(.+?)](.+?)\[\/color]/g, '<span style="color:$1;">$2</span>')
        .replaceAll(/\[font=(.+?)](.+?)\[\/font]/g, '<span style="font-family:$1;">$2</span>')
        .replaceAll(/\[size=(.+?)](.+?)\[\/size]/g, '<span style="font-size:$1;">$2</span>')
        .replaceAll(/\[align=(.+?)](.+?)\[\/align]/g, '<span style="text-align:$1;">$2</span>');
    // 列表
    str = deepReplace(str, /\[\*](.+?)(?=\[\*]|\[\/list])/g, '<li>$1</li>');
    str = deepReplace(str, /\[list](.+?)\[\/list]/g, '<ul>$1</ul>');
    // 图片
    str = str.replaceAll(/\[img](.+?)\[\/img]/g, (m, src) => `<img src='${src[0] === '.' ? 'https://img.nga.178.com/attachments' + src.slice(1) : src}'></img>`);
    // 折叠
    str = deepReplace(str, /\[collapse(?:=(.+?))?](.+?)\[\/collapse]/g, '<details><summary>$1</summary>$2</details>');
    // 引用
    str = deepReplace(str, /\[quote](.+?)\[\/quote]/g, '<blockquote>$1</blockquote>')
        .replaceAll(/\[@(.+?)]/g, '<a href="https://nga.178.com/nuke.php?func=ucp&username=$1">@$1</a>')
        .replaceAll(/\[uid=(\d+)](.+?)\[\/uid]/g, '<a href="https://nga.178.com/nuke.php?func=ucp&uid=$1">@$2</a>')
        .replaceAll(/\[tid=(\d+)](.+?)\[\/tid]/g, '<a href="https://nga.178.com/read.php?tid=$1">$2</a>')
        .replaceAll(/\[pid=(\d+),(\d+),(\d+)](.+?)\[\/pid]/g, (m, pid, tid, page, str) => {
            // return '<span></span>';
            const url = `https://nga.178.com/read.php?tid=${tid}&page=${page}#pid${pid}Anchor`;
            return `<a href="${url}" class="reply-id">${str}</a>`;
        });
    // 链接
    str = str.replaceAll(/\[url=(.+?)](.+?)\[\/url]/g, '<a href="$1">$2</a>');
    // 分割线
    str = str.replaceAll(/\[h](.+?)\[\/h]/g, '<h4 style="font-size:1.17em;font-weight:bold;border-bottom:1px solid #aaa;clear:both;margin:1.33em 0 0.2em 0;">$1</h4>');
    return str;
};
async function handler(ctx) {
    const tid = ctx.req.param('tid');
    const authorId = ctx.req.param('authorId') || undefined;
    const pageId = await getLastPageId(tid, authorId);

    const { items, title, authorName } = await loadFromPage(tid, authorId, pageId);
    const rssTitle = authorName ? `NGA ${authorName} ${title}` : `NGA ${title}`;
    if (Number.parseInt(pageId) <= 1) {
        const pages = (
            await Promise.all(
                Array(Number.parseInt(pageId))
                    .fill(0)
                    .map(async (_, pageId) => {
                        const data = await loadFromPage(tid, authorId, String(pageId + 1));
                        return data.items;
                    })
            )
        ).flat();
        items.push(...pages);
    } else {
        // const size = Number.parseInt(pageId);
        // const pages = await Promise.all(
        //     Array(size)
        //         .fill(0)
        //         .map((_, i) => i + 1)
        //         .slice(size - 2, size - 1)
        //         .map(async (pageId) => {
        //             const data = await loadFromPage(tid, authorId, String(pageId));
        //             return data.items;
        //         })
        // );
        // for (const pageItems of pages) {
        //     items.push(...pageItems);
        // }
        const ascending = (
            await Promise.all(
                Array(1)
                    .fill(0)
                    .map(async (_, i) => (await loadFromPage(tid, authorId, String(2 - i - 1))).items)
            )
        ).flat();
        const pageOneItems = ascending.slice(10);
        const maxDate = items.findLast(() => true)!.pubDate;
        const minDate = pageOneItems[0].pubDate;
        const middleDate = new Date(Math.max(maxDate.getTime() - minDate.getTime(), 0) / 2 + minDate.getTime());

        items.push(
            {
                title: '---分割线---',
                author: 'rsshub',
                description: `<div class="divider">共有${pageId}页，只显示最新和最旧2页</div>`,
                pubDate: middleDate,
            } as any,
            ...pageOneItems
        );
    }

    return {
        title: rssTitle,
        link: getPageUrl(tid, authorId, pageId),
        item: items,
    };
}
