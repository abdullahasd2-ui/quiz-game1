import { fieldLabel, questionInput, questionTypes, type QuestionType } from '@quiz/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, FileUpIcon } from 'lucide-react';
import Papa from 'papaparse';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorMessage, type ImportItem } from '@/lib/api';
import { PageHeader } from '../AdminLayout';
import { useCategories } from '../useCategories';

const CSV_COLUMNS = ['category', 'points', 'type', 'text', 'option1', 'option2', 'option3', 'option4', 'correct', 'image_url', 'reveal_url', 'active'] as const;
const TEMPLATE = `${CSV_COLUMNS.join(',')}\ngeo,100,text,ما هي عاصمة أستراليا؟,سيدني,ملبورن,كانبيرا,بريسبان,3,,,1\n`;

type Row = { line: number; item: ImportItem | null; errors: string[] };

const truthy = (v: string | undefined) => !v || ['1', 'true', 'yes', 'نعم'].includes(v.trim().toLowerCase());

/** CSV row → import item. `correct` is 1-based in the file because that's what people type in Excel. */
function fromCsv(r: Record<string, string>): Partial<ImportItem> {
  const type = (r.type?.trim() || 'text') as QuestionType;
  return {
    categorySlug: r.category?.trim() ?? '',
    points: Number(r.points),
    type,
    text: r.text ?? '',
    options: [r.option1, r.option2, r.option3, r.option4].map((o) => o ?? ''),
    correctIndex: Number(r.correct) - 1,
    imageUrl: r.image_url?.trim() || null,
    revealUrl: r.reveal_url?.trim() || null,
    active: truthy(r.active),
  };
}

export function ImportPage() {
  const categories = useCategories();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');

  function validate(raw: Partial<ImportItem>[]): Row[] {
    const slugs = new Set((categories.data ?? []).map((c) => c.slug));
    return raw.map((r, i) => {
      const errors: string[] = [];
      if (!r.categorySlug || !slugs.has(r.categorySlug)) errors.push(`فئة غير معروفة «${r.categorySlug ?? ''}»`);
            // Validate with a placeholder category id; the server resolves the slug.
      const parsed = questionInput.safeParse({ ...r, categoryId: 1 });
      if (!parsed.success) errors.push(...parsed.error.issues.map((x) => (x.path.length ? `${fieldLabel(x.path.join('.'))}: ${x.message}` : x.message)));
      const item = parsed.success && errors.length === 0 ? { ...parsed.data, categorySlug: r.categorySlug! } : null;
      return { line: i + 1, item, errors };
    });
  }

  async function onFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        setRows(validate(Array.isArray(data) ? data : data.questions ?? []));
      } else {
        const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
        setRows(validate(parsed.data.map(fromCsv)));
      }
    } catch {
      toast.error('تعذّرت قراءة الملف');
      setRows([]);
    }
  }

  const valid = rows.filter((r) => r.item);
  const invalid = rows.length - valid.length;

  const importMutation = useMutation({
    mutationFn: () => api.importQuestions(valid.map((r) => r.item!)),
    onSuccess: async ({ inserted }) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['questions'] }), queryClient.invalidateQueries({ queryKey: ['coverage'] })]);
      toast.success(`تم استيراد ${inserted} سؤال`);
      setRows([]);
      setFileName('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function downloadTemplate() {
    // BOM so Excel opens the Arabic text as UTF-8.
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'questions-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader title="استيراد أسئلة" description="أضف أسئلة كثيرة دفعة واحدة من ملف CSV (Excel) أو JSON" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. جهّز الملف</CardTitle>
          <CardDescription>
            حمّل القالب وافتحه في Excel. عمود <code dir="ltr">category</code> هو معرّف الفئة (مثل <code dir="ltr">geo</code>)، و<code dir="ltr">correct</code> رقم الإجابة الصحيحة من 1 إلى 4.
            الأنواع المتاحة: <code dir="ltr">{questionTypes.join(', ')}</code>. احفظ الملف بصيغة CSV UTF-8.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><DownloadIcon /> تحميل القالب</Button>
          <Button asChild>
            <label className="cursor-pointer">
              <FileUpIcon /> {fileName || 'اختر ملفًا'}
              <input type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
            </label>
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. راجع ثم استورد</CardTitle>
            <CardDescription>
              {valid.length} صالح{invalid > 0 && <span className="text-destructive"> · {invalid} فيه أخطاء ولن يُستورد حتى تصلحه في الملف</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>السؤال</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>النقاط</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.line} className={r.item ? '' : 'bg-destructive/5'}>
                      <TableCell className="tabular-nums text-muted-foreground">{r.line}</TableCell>
                      <TableCell className="max-w-sm">
                        <div className="truncate">{r.item?.text ?? '—'}</div>
                        {r.errors.map((e) => <div key={e} className="text-xs text-destructive" dir="auto">{e}</div>)}
                      </TableCell>
                      <TableCell>{r.item?.categorySlug}</TableCell>
                      <TableCell className="tabular-nums">{r.item?.points}</TableCell>
                      <TableCell>{r.item ? <Badge variant="secondary">جاهز</Badge> : <Badge variant="destructive">خطأ</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button disabled={valid.length === 0 || importMutation.isPending} onClick={() => importMutation.mutate()}>
              {importMutation.isPending ? 'جاري الاستيراد…' : `استيراد ${valid.length} سؤال`}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
