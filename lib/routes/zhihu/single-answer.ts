import { Data, Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import logger from '@/utils/logger';
import { config } from '@/config';
import { Headers } from 'ofetch';

export const route: Route = {
    path: '/question/:questionId/answer/:answerId',
    categories: ['social-media'],
    example: '/zhihu/question/264051433/answer/794739996',
    parameters: { questionId: '问题 id', answerId: '回答id' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.zhihu.com/question/:questionId'],
            target: '/question/:questionId',
        },
    ],
    name: '问题',
    maintainers: [],
    handler,
};

async function handler(ctx): Promise<Data> {
    const { questionId, answerId } = ctx.req.param();

    // second: get real data from zhihu
    // const rootUrl = 'https://www.zhihu.com';
    // const apiPath = `/api/v4/questions/${questionId}/answers?${new URLSearchParams({
    //     include:
    //         'data[*].is_normal,admin_closed_comment,reward_info,is_collapsed,annotation_action,annotation_detail,collapse_reason,is_sticky,collapsed_by,suggest_edit,comment_count,can_comment,content,editable_content,attachment,voteup_count,reshipment_settings,comment_permission,created_time,updated_time,review_info,relevant_info,question,excerpt,is_labeled,paid_info,paid_info_content,relationship.is_authorized,is_author,voting,is_thanked,is_nothelp,is_recognized;data[*].mark_infos[*].url;data[*].author.follower_count,badge[*].topics;data[*].settings.table_of_content.enabled&offset=0',
    //     limit: '20',
    //     // sort_by: sortBy,
    //     platform: 'desktop',
    // })}`;
    const header = new Headers();
    header.set('Cookie', config.zhihu.cookies || '');
    logger.info(config.zhihu.cookies);
    header.set('Referer', `https://www.zhihu.com/question/${questionId}/answer/${answerId}`);
    const response = await got.get(`https://www.zhihu.com/question/${questionId}/answer/${answerId}`, {
        headers: {
            Cookie: config.zhihu.cookies || '',
        },
    });
    const $ = load(response.data);
    const json = JSON.parse($('#js-initialData').text());

    const question = json.initialState?.entities?.questions?.[questionId];
    const answer = json.initialState?.entities?.answers?.[answerId];
    const content = json.initialState?.entities?.answers?.[answerId]?.content;
    // console.log(content);

    return {
        title: String(question.title),
        link: `https://www.zhihu.com/question/${questionId}`,
        // description: ,
        // author:,
        // image: answer.author.avatarUrl,
        allowEmpty: true,
        item: [
            {
                title: answer.author.headline + '@' + answer.author.name + ' 的回答',
                description: content,
                author: answer.author.headline + '@' + answer.author.name,
                image: answer.author.avatarUrl,
            },
        ],
    };
}
