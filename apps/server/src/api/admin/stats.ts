import { usageQuery, type LiveStats, type UsageStats } from '@quiz/shared';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client';
import { categories, questions } from '../../db/schema';
import { STATS_TIMEZONE, statsToday } from '../../game/usage';

export async function adminStatsRoutes(app: FastifyInstance, opts: { live: () => LiveStats }) {
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
