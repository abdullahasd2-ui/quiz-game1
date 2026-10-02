import { LEGACY_DRAW_PREFIX } from '@quiz/shared';
import { ImageIcon, Loader2Icon, UploadIcon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';

type Props = { value: string | null; onChange: (url: string | null) => void; invalid?: boolean };

export function ImageField({ value, onChange, invalid }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isLegacy = value?.startsWith(LEGACY_DRAW_PREFIX);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      onChange(url);
    } catch (err) {
      toast.error(`فشل رفع الصورة: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-2 ${invalid ? 'border-destructive' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void upload(file);
      }}
    >
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {value && !isLegacy ? <img src={value} alt="" className="size-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        {isLegacy ? (
          <p className="text-destructive">كانت مرسومة في اللعبة القديمة ({value!.slice(LEGACY_DRAW_PREFIX.length)}). ارفع صورة حقيقية.</p>
        ) : value ? (
          <a href={value} target="_blank" rel="noreferrer" dir="ltr" className="block truncate text-muted-foreground hover:underline">{value}</a>
        ) : (
          <p className="text-muted-foreground">اسحب صورة هنا أو اضغط «رفع» (JPEG, PNG, WebP — حتى 5MB)</p>
        )}
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} رفع
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <XIcon /> إزالة
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
