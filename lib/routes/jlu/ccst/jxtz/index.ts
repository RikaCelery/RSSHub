import { Data, DataItem, Route } from '@/types';
import got from '@/utils/got'; // Custom got instance
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio'; // HTML parser with jQuery-like API

export const route: Route = {
    path: '/ccst/jxtz',
    categories: ['university'],
    radar: [
        {
            source: ['ccst.jlu.edu.cn/rcpy/bksjy/jxtz.htm'],
        },
    ],
    example: '/jlu/ccst/jxtz',
    name: '吉林大学计算机科学与技术学院 - 教学通知',
    maintainers: ['RikaCelery'],
    handler,
    url: 'ccst.jlu.edu.cn',
};

async function handler(): Promise<Data> {
    // const category = ctx.req.param('category');
    const baseUrl = 'https://ccst.jlu.edu.cn';
    const url = `${baseUrl}/rcpy/bksjy/jxtz.htm`;
    const response = await got(url);
    const $ = load(response.body);

    const list = $('.section.container .main .list3 ul li');
    const item = await Promise.all(
        list.toArray().map(async (item) => {
            const el = $(item);

            const linkEl = el.find('a');
            const dateEl = el.find('.date');
            const dateStr = dateEl.text().trim();
            const title = linkEl.text().trim();
            const rawLink = linkEl.attr('href')!.replaceAll('..', ''); // Replace all occurrences of '..'
            const link = `${baseUrl}${encodeURI(rawLink)}`; // Encode the URL properly

            const response = await got(link);
            const $2 = load(response.body);
            const url = new URL(link)!;
            const resources = $2('.article > form > ul > li a')
                .toArray()
                .map((a) => {
                    const downloadUrl = url.protocol + '://' + url.host + $2(a).attr('href');
                    return {
                        type: $2(a)
                            .text()
                            .split('.')
                            .findLast(() => true)!,
                        url: downloadUrl,
                    };
                });
            $2('.content a').each((_, a) => {
                $2(a).html(`<a href="${$2(a).attr('href')}" target="_blank">${$2(a).text()}(https://ccst.jlu.edu.cn${$2(a).attr('href')})</a>`);
            });
            $2('.article > form > ul > li a').each((_, a) => {
                $2(a).html(`<a href="${$2(a).attr('href')}" target="_blank">${$2(a).text()}(https://ccst.jlu.edu.cn${$2(a).attr('href')})</a>`);
            });
            const content = $2('.content').append('附件📎：\n<br/>').append($2('.article > form > ul > li a')).html();
            const newsDate = parseDate(dateStr);
            const ret: DataItem = {
                title,
                link,
                description: content!,
                pubDate: newsDate,
                _extra: {
                    links: resources,
                },
            };
            return ret;
        })
    );
    return {
        title: `吉林大学计算机科学与技术学院 - 教学通知`,
        link: baseUrl,
        description: `吉林大学计算机科学与技术学院 - 教学通知`,
        item,
    };
}
