import { usageQuery, type KickLiveStream, type KickStats, type LiveStats, type UsageStats } from '@quiz/shared';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client';
import { categories, questions } from '../../db/schema';
import { STATS_TIMEZONE, statsToday } from '../../game/usage';

export async function adminStatsRoutes(app: FastifyInstance, opts: { live: () => LiveStats; kickLive?: () => KickLiveStream[] }) {
  app.get('/live', async () => opts.live());

  app.get('/usage', async (req): Promise<UsageStats> => {
    const { days } = usageQuery.parse(req.query);
    const since = sql`(${statsToday} - ${days - 1}::int)`;
    const gameDay = sql`(created_at at time zone ${STATS_TIMEZONE})::date`;
    const rows = <T>(q: ReturnType<typeof sql>) => db.execute(q) as unknown as Promise<T[]>;

    const [visits, games, today, byDay, platforms, modes, topCategories] = await Promise.all([
      rows<{ visitors: number; visits: number; newVisitors: number }>(sql`
        select count(distinct device_id)::int as "visitors", coalesce(sum(visits), 0)::int as "visits",
          (select count(*)::int from (select min(day) as first from daily_visits group by device_id) f where f.first >= ${since}) as "newVisitors"
        from daily_visits where day >= ${since}`),
      rows<{ created: number; started: number; finished: number; median: number | null }>(sql`
        select count(*)::int as "created", count(started_at)::int as "started", count(finished_at)::int as "finished",
          percentile_cont(0.5) within group (order by extract(epoch from finished_at - started_at) / 60)
            filter (where finished_at is not null and started_at is not null) as "median"
        from games where ${gameDay} >= ${since}`),
      rows<{ visitors: number; visits: number; games: number }>(sql`
        select (select count(*)::int from daily_visits where day = ${statsToday}) as "visitors",
          (select coalesce(sum(visits), 0)::int from daily_visits where day = ${statsToday}) as "visits",
          (select count(*)::int from games where ${gameDay} = ${statsToday}) as "games"`),
      rows<{ day: string; visitors: number; visits: number; games: number; finished: number }>(sql`
        select to_char(d, 'YYYY-MM-DD') as "day",
          coalesce(v.visitors, 0) as "visitors", coalesce(v.visits, 0) as "visits",
          coalesce(g.games, 0) as "games", coalesce(g.finished, 0) as "finished"
        from generate_series(${since}, ${statsToday}, interval '1 day') as d
        left join (select day, count(*)::int as visitors, sum(visits)::int as visits from daily_visits group by day) v on v.day = d::date
        left join (select ${gameDay} as day, count(*)::int as games, count(finished_at)::int as finished from games group by 1) g on g.day = d::date
        order by d`),
      rows<{ platform: UsageStats['platforms'][number]['platform']; visitors: number }>(sql`
        select platform, count(distinct device_id)::int as "visitors" from daily_visits where day >= ${since}
        group by platform order by 2 desc, 1`),
      rows<UsageStats['modes'][number]>(sql`
        select mode, variant, count(*)::int as "games" from games where started_at is not null and ${gameDay} >= ${since}
        group by mode, variant order by 3 desc`),
      rows<UsageStats['topCategories'][number]>(sql`
        select c.id as "categoryId", c.name, count(*)::int as "games"
        from games g cross join lateral jsonb_array_elements_text(g.category_ids) as picked(id)
        join categories c on c.id = picked.id::int
        where g.started_at is not null and (g.created_at at time zone ${STATS_TIMEZONE})::date >= ${since}
        group by c.id, c.name order by 3 desc, c.name limit 10`),
    ]);

    const median = games[0]?.median;
    return {
      days,
      totals: {
        visitors: visits[0]?.visitors ?? 0,
        visits: visits[0]?.visits ?? 0,
        newVisitors: visits[0]?.newVisitors ?? 0,
        gamesCreated: games[0]?.created ?? 0,
        gamesStarted: games[0]?.started ?? 0,
        gamesFinished: games[0]?.finished ?? 0,
        medianGameMinutes: median == null ? null : Math.round(Number(median) * 10) / 10,
      },
      today: today[0] ?? { visitors: 0, visits: 0, games: 0 },
      byDay,
      platforms,
      modes,
      topCategories,
    };
  });

  // Kick stream mode: account links, stream sessions, viewers who joined, and the streams running now.
  app.get('/kick', async (req): Promise<KickStats> => {
    const { days } = usageQuery.parse(req.query);
    const since = sql`(${statsToday} - ${days - 1}::int)`;
    const day = (col: string) => sql.raw(`(${col} at time zone '${STATS_TIMEZONE}')::date`);
    const rows = <T>(q: ReturnType<typeof sql>) => db.execute(q) as unknown as Promise<T[]>;
    const [links, streams, byDay, variants, topChannels, recent] = await Promise.all([
      rows<{ links: number; channels: number }>(sql`
        select count(*)::int as "links", count(distinct lower(channel))::int as "channels" from kick_links where ${day('linked_at')} >= ${since}`),
      rows<KickStats['totals']>(sql`
        select count(*)::int as "streams", count(*) filter (where not test)::int as "realStreams",
          count(game_started_at) filter (where not test)::int as "gamesStarted", count(finished_at) filter (where not test)::int as "finished",
          coalesce(sum(players), 0)::int as "joins", coalesce(sum(players) filter (where test), 0)::int as "testJoins",
          coalesce(max(players), 0)::int as "maxPlayers",
          coalesce(sum(rounds) filter (where not test), 0)::int as "rounds"
        from kick_streams where ${day('started_at')} >= ${since}`),
      rows<KickStats['byDay'][number]>(sql`
        select to_char(d, 'YYYY-MM-DD') as "day", coalesce(s.streams, 0) as "streams", coalesce(s.joins, 0) as "joins", coalesce(l.links, 0) as "links"
        from generate_series(${since}, ${statsToday}, interval '1 day') as d
        left join (select ${day('started_at')} as day, count(*) filter (where not test)::int as streams, sum(players)::int as joins from kick_streams group by 1) s on s.day = d::date
        left join (select ${day('linked_at')} as day, count(*)::int as links from kick_links group by 1) l on l.day = d::date
        order by d`),
      rows<KickStats['variants'][number]>(sql`
        select variant, count(*)::int as "streams" from kick_streams where variant is not null and not test and ${day('started_at')} >= ${since}
        group by variant order by 2 desc`),
      rows<KickStats['topChannels'][number]>(sql`
        select channel, count(*)::int as "streams", coalesce(sum(players), 0)::int as "joins", max(started_at)::text as "lastAt"
        from kick_streams where not test and ${day('started_at')} >= ${since}
        group by channel order by 3 desc, 2 desc limit 10`),
      rows<KickStats['recent'][number]>(sql`
        select channel, variant, test, players, rounds, started_at::text as "startedAt", finished_at::text as "finishedAt"
        from kick_streams order by started_at desc limit 15`),
    ]);
    const t = streams[0];
    return {
      days,
      totals: {
        links: links[0]?.links ?? 0,
        channels: links[0]?.channels ?? 0,
        streams: t?.streams ?? 0,
        realStreams: t?.realStreams ?? 0,
        gamesStarted: t?.gamesStarted ?? 0,
        finished: t?.finished ?? 0,
        joins: t?.joins ?? 0,
        testJoins: t?.testJoins ?? 0,
        maxPlayers: t?.maxPlayers ?? 0,
        rounds: t?.rounds ?? 0,
      },
      byDay,
      variants,
      topChannels,
      recent,
      live: opts.kickLive?.() ?? [],
    };
  });

  // Active, approved question count per category × points level, to spot gaps on the board.
  app.get('/coverage', async () => {
    const rows = await db
      .select({ categoryId: categories.id, slug: categories.slug, name: categories.name, points: questions.points, n: count(questions.id) })
      .from(categories)
      .leftJoin(questions, and(eq(questions.categoryId, categories.id), eq(questions.active, true), eq(questions.status, 'approved')))
      .groupBy(categories.id, questions.points)
      .orderBy(asc(categories.sortOrder), asc(categories.id));

    const byCat = new Map<number, { categoryId: number; slug: string; name: string; counts: Record<number, number> }>();
    for (const r of rows) {
      const entry = byCat.get(r.categoryId) ?? { categoryId: r.categoryId, slug: r.slug, name: r.name, counts: {} };
      if (r.points != null) entry.counts[r.points] = r.n;
      byCat.set(r.categoryId, entry);
    }
    return [...byCat.values()];
  });
}
