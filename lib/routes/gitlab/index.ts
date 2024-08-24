import { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { ofetch } from 'ofetch';

export const route: Route = {
    path: '/updated',
    categories: ['programming'],
    example: '/updated',
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
interface El {
    id: number;
    name: string;
    description: string;
    visibility: string;
    full_name: string;
    created_at: string;
    updated_at: string;
    avatar_url: null;
    type: string;
    can_edit: boolean;
    edit_path: string;
    relative_path: string;
    permission: null;
    children_count: number;
    parent_id: number;
    subgroup_count: number;
    project_count: number;
    leave_path: string;
    can_leave: boolean;
    can_remove: boolean;
    number_users_with_delimiter: string;
    markdown_description: string;
}
async function handler() {
    const response: El[] = await ofetch('https://gitlab.igem.org/groups/2024/-/children.json?sort=latest_activity_desc', {
        headers: {
            accept: 'application/json',
        },
    });
    const item = response
        .filter((el) => el.relative_path !== '/2024/software-tools"')
        .map((item) => ({
            // item title
            title: item.name,
            // item link
            link: item.description.substring(item.description.indexOf('https://2024.igem.wiki')),
            // item description
            description: item.markdown_description,
            // item publish date or time
            pubDate: parseDate(item.updated_at),
        }));

    return {
        title: 'GitLab',
        link: 'https://gitlab.igem.org/',
        language: 'zh-CN',
        item,
    };
}
